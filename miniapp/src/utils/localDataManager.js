import Taro from '@tarojs/taro'
import { STORAGE_KEYS } from '../constants/appConfig.js'

const DATA_KEYS = [
  ['contractDraft', '合同草稿'],
  ['reviewHistory', '审查记录'],
  ['reviewProfile', '审查偏好'],
  ['aiChat', 'AI 对话'],
  ['checkinInspection', '验房记录'],
  ['evidencePack', '退租证据包'],
  ['subsidyMatcher', '补贴匹配资料'],
  ['checkinRoomType', '验房房屋类型'],
]

const CLEAR_ONLY_KEYS = [
  // 联网 AI 会话与同意状态（含旧版本遗留 key）
  'aiSession', 'aiRemoteConsent', 'aiMode', 'aiTaskHandoff',
  'aiConfig', 'aiFeedback',
  // 旧版本遗留的本地历史与本地模式开关
  'history', 'localOnlyMode',
  // 账号标识（不含会话令牌或授权状态）
  'accountId',
]

function getSavedFileList() {
  // 优先使用微信原生 FileSystemManager，避免 Taro 旧 API 映射触发
  // `wx.getSavedFileList` 弃用警告；测试和其他端继续使用 Taro 回退。
  const nativeFileSystem = globalThis.wx?.getFileSystemManager?.()
  const fileSystem = nativeFileSystem || Taro.getFileSystemManager?.()
  if (typeof fileSystem?.getSavedFileList === 'function') {
    return new Promise((resolve, reject) => {
      fileSystem.getSavedFileList({ success: resolve, fail: reject })
    })
  }
  return Promise.reject(new Error('当前基础库不支持读取本地持久文件清单'))
}

function parseValue(value) {
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) } catch { return value }
}

export function getLocalDataSnapshot() {
  return DATA_KEYS.map(([key, label]) => {
    try {
      return { key, label, value: parseValue(Taro.getStorageSync(STORAGE_KEYS[key])) }
    } catch (error) {
      return { key, label, value: null, error }
    }
  })
}

export function formatLocalDataExport() {
  return JSON.stringify({
    app: '租小审',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: Object.fromEntries(getLocalDataSnapshot().map(({ key, value }) => [key, value ?? null])),
  }, null, 2)
}

export async function clearLocalData({ removePhotos = true } = {}) {
  const errors = []
  let removedFiles = 0
  DATA_KEYS.forEach(([key]) => {
    try { Taro.removeStorageSync(STORAGE_KEYS[key]) } catch (error) { errors.push(error) }
  })
  CLEAR_ONLY_KEYS.forEach((key) => {
    try { Taro.removeStorageSync(STORAGE_KEYS[key]) } catch (error) { errors.push(error) }
  })

  if (removePhotos) {
    try {
      const { fileList = [] } = await getSavedFileList()
      await Promise.all(fileList.map(async ({ filePath }) => {
        try {
          await Taro.removeSavedFile({ filePath })
          removedFiles += 1
        } catch (error) {
          errors.push(error)
        }
      }))
    } catch (error) {
      errors.push(error)
    }
  }
  return { ok: errors.length === 0, errors, removedFiles }
}

export function getLocalStorageInfo() {
  try {
    const info = Taro.getStorageInfoSync()
    return {
      currentSize: Math.max(0, Number(info.currentSize) || 0),
      limit: Math.max(0, Number(info.limit) || 10_240),
    }
  } catch {
    return null
  }
}

export function formatLocalBytes(bytes) {
  const value = Math.max(0, Number(bytes) || 0)
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function visitFilePaths(value, paths, seen) {
  if (typeof value === 'string') {
    if (/^(wxfile|ttfile|myfile|swanfile):\/\//i.test(value)) paths.add(value)
    return
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  if (Array.isArray(value)) {
    value.forEach((item) => visitFilePaths(item, paths, seen))
    return
  }
  Object.values(value).forEach((item) => visitFilePaths(item, paths, seen))
}

export function collectReferencedFilePaths(snapshot = getLocalDataSnapshot()) {
  const paths = new Set()
  const seen = new Set()
  snapshot.forEach(({ value }) => visitFilePaths(value, paths, seen))
  return paths
}

export async function getLocalDataUsage() {
  const storage = getLocalStorageInfo() || { currentSize: 0, limit: 0 }
  try {
    const { fileList = [] } = await getSavedFileList()
    const referencedPaths = collectReferencedFilePaths()
    const savedFileBytes = fileList.reduce((total, file) => total + (Number(file.size) || 0), 0)
    const unreferencedFiles = fileList.filter((file) => !referencedPaths.has(file.filePath))
    return {
      ...storage,
      savedFileBytes,
      savedFileCount: fileList.length,
      unreferencedCount: unreferencedFiles.length,
      unreferencedBytes: unreferencedFiles.reduce((total, file) => total + (Number(file.size) || 0), 0),
      fileListAvailable: true,
    }
  } catch {
    return {
      ...storage,
      savedFileBytes: 0,
      savedFileCount: 0,
      unreferencedCount: 0,
      unreferencedBytes: 0,
      fileListAvailable: false,
    }
  }
}

export async function cleanupUnreferencedSavedFiles() {
  const referencedPaths = collectReferencedFilePaths()
  const errors = []
  let removedFiles = 0
  let removedBytes = 0
  try {
    const { fileList = [] } = await getSavedFileList()
    const unreferencedFiles = fileList.filter((file) => !referencedPaths.has(file.filePath))
    await Promise.all(unreferencedFiles.map(async (file) => {
      try {
        await Taro.removeSavedFile({ filePath: file.filePath })
        removedFiles += 1
        removedBytes += Number(file.size) || 0
      } catch (error) {
        errors.push(error)
      }
    }))
  } catch (error) {
    errors.push(error)
  }
  return { ok: errors.length === 0, removedFiles, removedBytes, errors }
}
