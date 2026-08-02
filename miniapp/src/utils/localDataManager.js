import Taro from '@tarojs/taro'
import { STORAGE_KEYS } from '../constants/appConfig.js'
import { createZipArchive } from './evidencePackageExport.js'

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
  'aiSession', 'aiRemoteConsent', 'aiContractReviewConsent', 'aiMode', 'aiTaskHandoff',
  'aiConfig', 'aiFeedback',
  // 旧版本遗留的本地历史与本地模式开关
  'history', 'localOnlyMode',
  // 账号标识（不含会话令牌或授权状态）
  'accountId',
]

const LEGACY_STORAGE_KEYS = ['checkin_inspection_data', 'evidence_pack_data']

// 备份文件当前 schema 版本
const BACKUP_SCHEMA_VERSION = 1
// 支持恢复的最低版本（低于此版本需明确提示）
const BACKUP_MIN_SUPPORTED_VERSION = 1
const BACKUP_FORMAT = 'zip'
const MAX_BACKUP_BYTES = 35 * 1024 * 1024

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

function toBytes(value) {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  return new Uint8Array()
}

function utf8Bytes(value) {
  if (typeof TextEncoder === 'function') return new TextEncoder().encode(String(value || ''))
  const bytes = []
  for (const symbol of String(value || '')) {
    const code = symbol.codePointAt(0)
    if (code <= 0x7f) bytes.push(code)
    else if (code <= 0x7ff) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    else if (code <= 0xffff) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
  }
  return Uint8Array.from(bytes)
}

function readFileBytes(filePath) {
  const fs = Taro.getFileSystemManager?.()
  return new Promise((resolve, reject) => {
    if (!fs?.readFile) {
      reject(new Error('当前环境不支持读取本地文件'))
      return
    }
    fs.readFile({ filePath, success: ({ data }) => resolve(toBytes(data)), fail: reject })
  })
}

function writeFileBytes(filePath, bytes) {
  const fs = Taro.getFileSystemManager?.()
  return new Promise((resolve, reject) => {
    if (!fs?.writeFile) {
      reject(new Error('当前环境不支持写入本地文件'))
      return
    }
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    fs.writeFile({ filePath, data, success: resolve, fail: reject })
  })
}

function decodeUtf8(bytes) {
  if (typeof TextDecoder === 'function') return new TextDecoder().decode(bytes)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return decodeURIComponent(binary.split('').map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''))
}

function readU16(bytes, offset) { return bytes[offset] | (bytes[offset + 1] << 8) }
function readU32(bytes, offset) { return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0 }

// createZipArchive 只写入 STORE ZIP；解析器只接受同一格式，避免引入解压依赖。
function readStoreZip(bytes) {
  const data = toBytes(bytes)
  let eocd = -1
  for (let index = data.length - 22; index >= 0; index -= 1) {
    if (readU32(data, index) === 0x06054b50) { eocd = index; break }
  }
  if (eocd < 0) throw new Error('ZIP 备份缺少结束目录')
  const count = readU16(data, eocd + 10)
  const centralOffset = readU32(data, eocd + 16)
  const files = new Map()
  let cursor = centralOffset
  for (let index = 0; index < count; index += 1) {
    if (readU32(data, cursor) !== 0x02014b50) throw new Error('ZIP 目录损坏')
    const flags = readU16(data, cursor + 8)
    const method = readU16(data, cursor + 10)
    const compressedSize = readU32(data, cursor + 20)
    const nameLength = readU16(data, cursor + 28)
    const extraLength = readU16(data, cursor + 30)
    const commentLength = readU16(data, cursor + 32)
    const localOffset = readU32(data, cursor + 42)
    if (method !== 0 || (flags & 0x08)) throw new Error('只支持未压缩 ZIP 备份')
    const name = decodeUtf8(data.slice(cursor + 46, cursor + 46 + nameLength))
    const localNameLength = readU16(data, localOffset + 26)
    const localExtraLength = readU16(data, localOffset + 28)
    const start = localOffset + 30 + localNameLength + localExtraLength
    files.set(name, data.slice(start, start + compressedSize))
    cursor += 46 + nameLength + extraLength + commentLength
  }
  return files
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
  let removedGeneratedFiles = 0
  let storageKeys = [
    ...DATA_KEYS.map(([key]) => STORAGE_KEYS[key]),
    ...CLEAR_ONLY_KEYS.map((key) => STORAGE_KEYS[key]),
    ...LEGACY_STORAGE_KEYS,
  ]
  try {
    storageKeys = [...storageKeys, ...(Taro.getStorageInfoSync()?.keys || [])]
  } catch (error) {
    errors.push(error)
  }
  ;[...new Set(storageKeys.filter(Boolean))].forEach((key) => {
    try { Taro.removeStorageSync(key) } catch (error) { errors.push(error) }
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

    const userDataPath = Taro.env?.USER_DATA_PATH
    const fs = globalThis.wx?.getFileSystemManager?.() || Taro.getFileSystemManager?.()
    if (userDataPath && typeof fs?.readdir === 'function' && typeof fs?.unlink === 'function') {
      try {
        const files = await new Promise((resolve, reject) => {
          fs.readdir({ dirPath: userDataPath, success: ({ files: entries = [] }) => resolve(entries), fail: reject })
        })
        await Promise.all(files.map((name) => new Promise((resolve) => {
          const filePath = `${userDataPath}/${name}`
          fs.unlink({
            filePath,
            success: () => { removedGeneratedFiles += 1; resolve() },
            fail: (unlinkError) => {
              if (typeof fs.rmdir !== 'function') { errors.push(unlinkError); resolve(); return }
              fs.rmdir({
                dirPath: filePath,
                recursive: true,
                success: () => { removedGeneratedFiles += 1; resolve() },
                fail: (rmdirError) => { errors.push(rmdirError); resolve() },
              })
            },
          })
        })))
      } catch (error) {
        errors.push(error)
      }
    } else {
      errors.push(new Error('当前基础库不支持清理小程序文件目录'))
    }
  }
  return { ok: errors.length === 0, errors, removedFiles, removedGeneratedFiles }
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

function safeArchiveName(value, fallback = '未命名文件') {
  const cleaned = String(value || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '').trim()
  return (cleaned || fallback).slice(0, 100)
}

function isLocalPath(value) {
  return typeof value === 'string' && /^(wxfile|ttfile|myfile|swanfile|https?:\/\/tmp\/)/i.test(value)
}

function collectPackageFiles(parsed) {
  const files = new Map()
  const add = (localPath, meta = {}) => {
    if (!isLocalPath(localPath)) return
    const current = files.get(localPath) || { localPath, fileName: '', source: 'unknown', group: '其他材料' }
    files.set(localPath, {
      ...current,
      ...meta,
      fileName: safeArchiveName(meta.fileName || current.fileName || `本地文件-${files.size + 1}.bin`),
    })
  }
  const evidence = parsed?.data?.evidencePack
  Object.entries(evidence?.attachments || {}).forEach(([group, attachments]) => {
    ;(Array.isArray(attachments) ? attachments : []).forEach((attachment) => add(attachment?.localPath, {
      fileName: attachment?.fileName,
      source: attachment?.source || 'attachment',
      group,
    }))
  })
  const checkin = parsed?.data?.checkinInspection
  Object.entries(checkin || {}).forEach(([room, items]) => {
    Object.entries(items || {}).forEach(([item, record]) => {
      ;(Array.isArray(record?.photos) ? record.photos : []).forEach((localPath, index) => add(localPath, {
        fileName: `验房照片-${room}-${item}-${index + 1}.jpg`,
        source: 'checkin',
        group: '验房照片',
      }))
    })
  })
  const walk = (value) => {
    if (isLocalPath(value)) add(value)
    else if (Array.isArray(value)) value.forEach(walk)
    else if (value && typeof value === 'object') Object.values(value).forEach(walk)
  }
  walk(parsed?.data)
  return [...files.values()]
}

function replaceLocalPaths(value, pathMap, seen = new Set()) {
  if (typeof value === 'string') return pathMap.get(value) || value
  if (!value || typeof value !== 'object' || seen.has(value)) return value
  seen.add(value)
  if (Array.isArray(value)) return value.map((item) => replaceLocalPaths(item, pathMap, seen))
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceLocalPaths(item, pathMap, seen)]))
}

function replaceBackupTokens(value, tokenMap, seen = new Set()) {
  if (typeof value === 'string') return tokenMap.get(value) || value
  if (!value || typeof value !== 'object' || seen.has(value)) return value
  seen.add(value)
  if (Array.isArray(value)) return value.map((item) => replaceBackupTokens(item, tokenMap, seen))
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceBackupTokens(item, tokenMap, seen)]))
}

function escapeXml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function imageExtension(fileName) {
  const ext = String(fileName || '').toLowerCase().split('.').pop()
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? ext : ''
}

function buildDocxEntries(included, skipped, bytesById, data = {}) {
  const imageItems = included.filter((item) => imageExtension(item.fileName) && bytesById.has(item.id))
  const paragraphs = [
    '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>租小审完整备份</w:t></w:r></w:p>',
    `<w:p><w:r><w:t>生成时间：${escapeXml(new Date().toLocaleString('zh-CN', { hour12: false }))}</w:t></w:r></w:p>`,
    '<w:p><w:r><w:t>本文件同时保留可恢复的备份数据、照片和附件。请勿直接编辑压缩包内的备份文件。</w:t></w:r></w:p>',
    '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>文件清单</w:t></w:r></w:p>',
    ...included.map((item) => `<w:p><w:r><w:t>已包含：${escapeXml(item.fileName)}（${escapeXml(item.group || '其他材料')}，${item.size} 字节）</w:t></w:r></w:p>`),
    ...skipped.map((item) => `<w:p><w:r><w:t>未能读取：${escapeXml(item.fileName)}（${escapeXml(item.reason || '读取失败')}）</w:t></w:r></w:p>`),
  ]
  const reportSections = [
    ['合同审查数据', data.contractDraft],
    ['审查历史', data.reviewHistory],
    ['验房记录', data.checkinInspection],
    ['证据包数据', data.evidencePack],
    ['AI 对话', data.aiChat],
    ['补贴资料', data.subsidyMatcher],
  ]
  reportSections.forEach(([title, value]) => {
    if (value == null || value === '' || (Array.isArray(value) && !value.length)) return
    let text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
    text = text.replace(/(?:wxfile|ttfile|myfile|swanfile):\/\/[^"\s,}\]]+|backup-file:\/\/[^"\s,}\]]+/gi, '本地文件已打包')
    const lines = text.split(/\r?\n/).slice(0, 160)
    paragraphs.push(`<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(title)}</w:t></w:r></w:p>`)
    lines.forEach((line) => paragraphs.push(`<w:p><w:r><w:t>${escapeXml(line || ' ')}</w:t></w:r></w:p>`))
    if (text.split(/\r?\n/).length > lines.length) paragraphs.push('<w:p><w:r><w:t>（内容较长，完整数据保存在包内的租小审备份.json）</w:t></w:r></w:p>')
  })
  const relationships = []
  const mediaEntries = []
  imageItems.forEach((item, index) => {
    const ext = imageExtension(item.fileName)
    const mediaName = `image-${index + 1}.${ext}`
    const relId = `rId${index + 1}`
    relationships.push(`<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/>`)
    mediaEntries.push({ name: `word/media/${mediaName}`, data: bytesById.get(item.id), ext })
    paragraphs.push(`<w:p><w:r><w:t>${escapeXml(item.fileName)}</w:t></w:r></w:p><w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="5486400" cy="3657600"/><wp:docPr id="${index + 1}" name="${escapeXml(item.fileName)}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${index + 1}" name="${escapeXml(item.fileName)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="5486400" cy="3657600"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`)
  })
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${paragraphs.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`
  return {
    entries: [
      { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Default Extension="gif" ContentType="image/gif"/><Default Extension="webp" ContentType="image/webp"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>` },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdOfficeDocument" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
      { name: 'word/document.xml', data: documentXml },
      { name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.join('')}</Relationships>` },
      ...mediaEntries,
    ],
  }
}

export async function buildLocalBackupArchive({ format = 'docx' } = {}) {
  const parsed = JSON.parse(backupLocalData())
  const files = collectPackageFiles(parsed)
  const entries = []
  const included = []
  const skipped = []
  const bytesById = new Map()
  const pathMap = new Map()
  let totalBytes = 0
  const addEntry = (name, data) => {
    const bytes = data instanceof Uint8Array ? data : utf8Bytes(data)
    totalBytes += bytes.length
    if (totalBytes > MAX_BACKUP_BYTES) {
      const error = new Error('备份文件超过 35MB，请删除部分大文件后重试')
      error.code = 'backup-too-large'
      throw error
    }
    entries.push({ name, data: bytes })
  }

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]
    const id = `f${String(index + 1).padStart(4, '0')}`
    const archivePath = `files/${id}-${safeArchiveName(file.fileName)}`
    try {
      const bytes = await readFileBytes(file.localPath)
      addEntry(archivePath, bytes)
      bytesById.set(id, bytes)
      pathMap.set(file.localPath, `backup-file://${id}`)
      included.push({ id, archivePath, fileName: file.fileName, source: file.source, group: file.group, size: bytes.length, status: 'included' })
    } catch (error) {
      skipped.push({ id, fileName: file.fileName, source: file.source, group: file.group, size: 0, status: 'skipped', reason: error?.errMsg || error?.message || '文件读取失败' })
    }
  }

  const transformed = {
    ...parsed,
    backupFormat: BACKUP_FORMAT,
    fileManifest: [...included, ...skipped],
    data: replaceLocalPaths(parsed.data, pathMap),
    notes: [
      '本整包备份包含本机可读取的合同审查、验房、证据包、AI 对话和补贴资料。',
      '验房照片和证据附件以二进制文件放在 files/ 目录；缺失或读取失败的文件会列入 manifest.json。',
      '不导出 session token、openid、云端密钥或 API key。',
    ],
  }
  addEntry('租小审备份.json', JSON.stringify(transformed, null, 2))
  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    included,
    skipped,
    totalFiles: files.length,
    notice: '本压缩包由租小审在本机生成，请核对附件完整性后再保存或发送。',
  }
  addEntry('manifest.json', JSON.stringify(manifest, null, 2))
  if (format === 'docx') {
    buildDocxEntries(included, skipped, bytesById, transformed.data).entries.forEach((entry) => addEntry(entry.name, entry.data))
  }
  return { bytes: createZipArchive(entries), included, skipped, totalBytes, format }
}

export function parseBackupPackageSummary(bytes) {
  let files
  try { files = readStoreZip(bytes) } catch (error) { return { ok: false, error: error.message || 'ZIP 备份无法读取' } }
  const jsonBytes = files.get('租小审备份.json')
  if (!jsonBytes) return { ok: false, error: 'ZIP 备份缺少租小审备份.json' }
  const summary = parseBackupSummary(decodeUtf8(jsonBytes))
  if (!summary.ok) return summary
  let manifest = { included: [], skipped: [] }
  try {
    const manifestBytes = files.get('manifest.json')
    if (manifestBytes) manifest = JSON.parse(decodeUtf8(manifestBytes))
  } catch {
    return { ok: false, error: 'ZIP 备份的 manifest.json 损坏' }
  }
  return {
    ...summary,
    backupFormat: BACKUP_FORMAT,
    fileCount: Array.isArray(manifest.included) ? manifest.included.length : 0,
    skippedFileCount: Array.isArray(manifest.skipped) ? manifest.skipped.length : 0,
  }
}

async function saveRestoredFile(id, bytes) {
  const base = Taro.env?.USER_DATA_PATH || 'wxfile://userdata'
  const tempPath = `${base}/.zu-xiao-shen-restore-${id}`
  await writeFileBytes(tempPath, bytes)
  if (typeof Taro.saveFile !== 'function') return tempPath
  const result = await Taro.saveFile({ tempFilePath: tempPath })
  try { Taro.getFileSystemManager?.().unlink?.({ filePath: tempPath, success: () => {}, fail: () => {} }) } catch {}
  return result.savedFilePath || tempPath
}

export async function restoreBackupArchive(bytes) {
  let files
  try { files = readStoreZip(bytes) } catch (error) { return { ok: false, rolledBack: false, missingFiles: [], error: error.message || 'ZIP 备份无法读取' } }
  const jsonBytes = files.get('租小审备份.json')
  if (!jsonBytes) return { ok: false, rolledBack: false, missingFiles: [], error: 'ZIP 备份缺少租小审备份.json' }
  let parsed
  try { parsed = JSON.parse(decodeUtf8(jsonBytes)) } catch { return { ok: false, rolledBack: false, missingFiles: [], error: '备份 JSON 格式损坏' } }
  const manifestBytes = files.get('manifest.json')
  let manifest
  try { manifest = manifestBytes ? JSON.parse(decodeUtf8(manifestBytes)) : { included: [], skipped: [] } } catch { return { ok: false, rolledBack: false, missingFiles: [], error: 'ZIP 备份的 manifest.json 损坏' } }
  const tokenMap = new Map()
  const written = []
  try {
    for (const item of Array.isArray(manifest.included) ? manifest.included : []) {
      const archiveBytes = files.get(item.archivePath)
      if (!archiveBytes) throw new Error(`备份缺少文件：${item.fileName || item.archivePath}`)
      const localPath = await saveRestoredFile(item.id, archiveBytes)
      written.push(localPath)
      tokenMap.set(`backup-file://${item.id}`, localPath)
    }
    const restoredJson = JSON.stringify({ ...parsed, data: replaceBackupTokens(parsed.data, tokenMap) })
    const result = await restoreLocalData(restoredJson)
    if (!result.ok) throw new Error(result.error || '本地数据恢复失败')
    return { ...result, backupFormat: BACKUP_FORMAT, restoredFiles: written.length, missingFiles: (manifest.skipped || []).map((item) => item.fileName || item.id) }
  } catch (error) {
    await Promise.all(written.map(async (filePath) => {
      try { await Taro.removeSavedFile?.({ filePath }) } catch {}
    }))
    return { ok: false, rolledBack: true, missingFiles: [], error: error.message || '整包恢复失败' }
  }
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
