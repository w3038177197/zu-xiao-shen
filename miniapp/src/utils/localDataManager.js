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

// 备份中会带上授权状态，但不带任何 token/openid/密钥
const AUTH_STATE_KEYS = [
  ['aiRemoteConsent', '联网 AI 授权状态'],
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

// 备份文件当前 schema 版本
const BACKUP_SCHEMA_VERSION = 1
// 支持恢复的最低版本（低于此版本需明确提示）
const BACKUP_MIN_SUPPORTED_VERSION = 1

// 不导出的敏感字段（出现在 data 中时会被清空）
// 这些字段与 token/openid/密钥/API key 相关，不属于本机资料
const SENSITIVE_FIELD_NAMES = [
  'token', 'accessToken', 'refreshToken', 'sessionKey', 'session_key',
  'openid', 'unionid', 'apiKey', 'api_key', 'secret',
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

// ============================================================
// 整包备份与恢复
// ============================================================

// 深度遍历对象，将敏感字段置为 null（不导出 token/openid/密钥/API key）
function sanitizeSensitiveFields(value, seen = new Set()) {
  if (typeof value !== 'object' || value === null) return value
  if (seen.has(value)) return value
  seen.add(value)
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSensitiveFields(item, seen))
  }
  const result = {}
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_FIELD_NAMES.includes(k)) {
      result[k] = null // 明确清空，不导出
    } else {
      result[k] = sanitizeSensitiveFields(v, seen)
    }
  }
  return result
}

// 统计某类数据的数量（用于备份摘要）
function countDataItems(value) {
  if (value == null) return 0
  if (Array.isArray(value)) return value.length
  if (typeof value === 'object') return Object.keys(value).length
  return 0
}

// 收集文件路径引用（用于恢复后检测缺失文件）
function collectFilePathRefs(value, refs, seen) {
  if (typeof value === 'string') {
    if (/^(wxfile|ttfile|myfile|swanfile|http:\/\/tmp\/|https?:\/\/tmp\/)/i.test(value)) {
      refs.push(value)
    }
    return
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  if (Array.isArray(value)) {
    value.forEach((item) => collectFilePathRefs(item, refs, seen))
    return
  }
  Object.values(value).forEach((item) => collectFilePathRefs(item, refs, seen))
}

// 检查本机持久文件清单中是否包含指定路径
async function checkExistingFilePaths(pathList) {
  if (!pathList.length) return { checked: [], missing: [] }
  try {
    const { fileList = [] } = await getSavedFileList()
    const existing = new Set(fileList.map((f) => f.filePath))
    const checked = pathList.filter((p) => existing.has(p))
    const missing = pathList.filter((p) => !existing.has(p))
    return { checked, missing }
  } catch {
    // 无法读取文件清单时，不阻塞恢复，但提示需要人工检查
    return { checked: [], missing: pathList, listUnavailable: true }
  }
}

// 导出整包备份 JSON 字符串
// 包含 version、exportedAt、appName、schema、data、summary、notes
// 照片/附件本地文件不包含在 JSON 内，只包含引用信息和文件名
// 不导出 session token、openid、云端密钥、API key
export function backupLocalData() {
  const snapshot = getLocalDataSnapshot()
  const data = {}
  const summary = {}

  for (const { key, label, value } of snapshot) {
    const sanitized = sanitizeSensitiveFields(value)
    data[key] = sanitized
    summary[key] = { label, count: countDataItems(sanitized) }
  }

  // 授权状态单独带上（仅布尔/标志位，不带 token）
  const authStates = {}
  for (const [key, label] of AUTH_STATE_KEYS) {
    try {
      const raw = parseValue(Taro.getStorageSync(STORAGE_KEYS[key]))
      // 只保留布尔/简单标志，对象内的 token 字段会被 sanitize 清空
      authStates[key] = sanitizeSensitiveFields(raw)
      summary[key] = { label, count: countDataItems(authStates[key]) }
    } catch {
      authStates[key] = null
      summary[key] = { label, count: 0 }
    }
  }

  return JSON.stringify({
    app: '租小审',
    appName: '租小审',
    version: BACKUP_SCHEMA_VERSION,
    schema: {
      dataKeys: DATA_KEYS.map(([k]) => k),
      authStateKeys: AUTH_STATE_KEYS.map(([k]) => k),
    },
    exportedAt: new Date().toISOString(),
    data,
    authStates,
    summary,
    notes: [
      '本备份仅包含本机资料的引用信息和元数据。',
      '照片、附件等本地文件不包含在 JSON 内，恢复后如发现文件缺失需要重新添加。',
      '不导出 session token、openid、云端密钥、API key 等敏感凭据。',
    ],
  }, null, 2)
}

// 解析备份 JSON 并生成摘要（用于导入前展示）
// 返回 { ok, summary, error, version, exportedAt, appName }
// ok=false 时 error 描述具体原因（JSON 损坏/版本不支持/结构校验失败）
export function parseBackupSummary(backupJsonString) {
  let parsed
  try {
    parsed = JSON.parse(backupJsonString)
  } catch (error) {
    return { ok: false, error: `备份文件 JSON 格式损坏：${error.message || '解析失败'}` }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: '备份文件结构无效：根对象不是对象' }
  }

  const version = Number(parsed.version)
  if (!Number.isFinite(version)) {
    return { ok: false, error: '备份文件缺少 version 字段' }
  }
  if (version < BACKUP_MIN_SUPPORTED_VERSION) {
    return {
      ok: false,
      unsupportedVersion: true,
      version,
      error: `备份版本 ${version} 已不受支持（最低支持版本 ${BACKUP_MIN_SUPPORTED_VERSION}），请使用新版本重新导出`,
    }
  }
  if (version > BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      unsupportedVersion: true,
      version,
      error: `备份版本 ${version} 高于当前应用支持的版本 ${BACKUP_SCHEMA_VERSION}，请升级小程序后再导入`,
    }
  }

  const data = parsed.data && typeof parsed.data === 'object' ? parsed.data : {}
  const authStates = parsed.authStates && typeof parsed.authStates === 'object' ? parsed.authStates : {}

  // 结构校验：data 必须是对象，且至少包含一个已知 key（或为空对象，表示空备份）
  const knownKeys = new Set([...DATA_KEYS.map(([k]) => k), ...AUTH_STATE_KEYS.map(([k]) => k)])
  const dataKeys = Object.keys(data)
  const unknownKeys = dataKeys.filter((k) => !knownKeys.has(k))
  // 允许空备份（用户当时就没有数据），但不允许大量未知 key（可能是别的应用备份）
  if (unknownKeys.length > 2) {
    return { ok: false, error: `备份文件包含过多未知数据 key（${unknownKeys.length} 个），可能不是租小审备份` }
  }

  const items = []
  for (const [key, label] of [...DATA_KEYS, ...AUTH_STATE_KEYS]) {
    const value = key in data ? data[key] : (key in authStates ? authStates[key] : null)
    const count = countDataItems(value)
    if (count > 0 || key in data || key in authStates) {
      items.push({ key, label, count })
    }
  }

  return {
    ok: true,
    version,
    exportedAt: parsed.exportedAt || null,
    appName: parsed.appName || parsed.app || '租小审',
    summary: items,
    notes: Array.isArray(parsed.notes) ? parsed.notes : [],
  }
}

// 恢复本地数据
// - 先保存 prevState 快照
// - 一次性写入所有 key
// - 任意 Storage 写入失败必须回滚旧数据
// - 重复导入同一备份不能产生重复历史或重复附件引用（按 id 去重合并）
// - 返回 { ok, restoredKeys, rolledBack, missingFiles, error }
export async function restoreLocalData(backupJsonString) {
  const summaryResult = parseBackupSummary(backupJsonString)
  if (!summaryResult.ok) {
    return { ok: false, restoredKeys: [], rolledBack: false, missingFiles: [], error: summaryResult.error }
  }

  let parsed
  try {
    parsed = JSON.parse(backupJsonString)
  } catch (error) {
    return { ok: false, restoredKeys: [], rolledBack: false, missingFiles: [], error: `备份文件 JSON 解析失败：${error.message}` }
  }

  const data = parsed.data && typeof parsed.data === 'object' ? parsed.data : {}
  const authStates = parsed.authStates && typeof parsed.authStates === 'object' ? parsed.authStates : {}

  // 1. 先保存 prevState 快照（用于失败回滚）
  const prevState = {}
  const allKeysToRestore = [
    ...DATA_KEYS.map(([k]) => k),
    ...AUTH_STATE_KEYS.map(([k]) => k),
  ]
  for (const key of allKeysToRestore) {
    try {
      prevState[key] = Taro.getStorageSync(STORAGE_KEYS[key])
    } catch {
      prevState[key] = null
    }
  }

  // 2. 一次性写入新数据（带去重合并逻辑）
  const restoredKeys = []
  const writeErrors = []
  for (const key of allKeysToRestore) {
    const newValue = key in data ? data[key] : (key in authStates ? authStates[key] : undefined)
    if (newValue === undefined) continue

    try {
      // 对于审查历史等列表类型，按 id 去重合并，避免重复导入产生重复记录
      const merged = mergeWithoutDuplicates(prevState[key], newValue)
      Taro.setStorageSync(STORAGE_KEYS[key], JSON.stringify(merged))
      restoredKeys.push(key)
    } catch (error) {
      writeErrors.push({ key, error })
    }
  }

  // 3. 任意写入失败 → 回滚所有 key 到 prevState
  if (writeErrors.length > 0) {
    for (const key of allKeysToRestore) {
      try {
        if (prevState[key] === null || prevState[key] === undefined) {
          Taro.removeStorageSync(STORAGE_KEYS[key])
        } else {
          Taro.setStorageSync(STORAGE_KEYS[key], prevState[key])
        }
      } catch {
        // 回滚失败也只能尽力而为
      }
    }
    return {
      ok: false,
      restoredKeys: [],
      rolledBack: true,
      missingFiles: [],
      error: `恢复失败：${writeErrors.length} 个 key 写入失败（首个：${writeErrors[0].key}），已回滚到恢复前状态`,
    }
  }

  // 4. 检测恢复后引用的本地文件是否缺失
  const restoredSnapshot = getLocalDataSnapshot()
  const refs = []
  const seen = new Set()
  for (const { value } of restoredSnapshot) {
    collectFilePathRefs(value, refs, seen)
  }
  const { missing, listUnavailable } = await checkExistingFilePaths(refs)

  return {
    ok: true,
    restoredKeys,
    rolledBack: false,
    missingFiles: missing,
    listUnavailable: !!listUnavailable,
    error: null,
  }
}

// 去重合并：对于列表类型按 id 去重；对于对象类型直接覆盖（不合并）
// 重复导入同一备份不能产生重复历史或重复附件引用
function mergeWithoutDuplicates(prevValue, newValue) {
  // 如果新值不是数组，直接用新值覆盖
  if (!Array.isArray(newValue)) return newValue
  // 如果旧值不是数组，新数组直接覆盖
  if (!Array.isArray(prevValue)) return newValue

  // 数组按 id 去重（id 优先，无 id 的按内容哈希去重）
  const seen = new Map()
  const merged = []
  const addItem = (item) => {
    if (item && typeof item === 'object' && item.id != null) {
      if (seen.has(`id:${item.id}`)) return
      seen.set(`id:${item.id}`, true)
    } else {
      const sig = JSON.stringify(item)
      if (seen.has(`sig:${sig}`)) return
      seen.set(`sig:${sig}`, true)
    }
    merged.push(item)
  }
  // 先加旧值，再加新值（新值覆盖同 id 旧值的位置）
  // 实际上为了"重复导入不重复"，我们用新值优先策略：
  // 以新值为准，旧值中与新值 id 重复的丢弃
  const newIds = new Set()
  for (const item of newValue) {
    if (item && typeof item === 'object' && item.id != null) {
      newIds.add(`id:${item.id}`)
    }
  }
  for (const item of prevValue) {
    if (item && typeof item === 'object' && item.id != null) {
      if (newIds.has(`id:${item.id}`)) continue // 旧值中被新值覆盖
    }
    addItem(item)
  }
  for (const item of newValue) {
    addItem(item)
  }
  return merged
}
