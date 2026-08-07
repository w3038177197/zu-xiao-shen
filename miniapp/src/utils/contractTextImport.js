import Taro from '@tarojs/taro'
import { CONTRACT_IMPORT_MAX_BYTES } from '../constants/checkinConfig.js'
import { REMOTE_AI_CONFIG } from '../constants/appConfig.js'
import { getCapabilityFailure } from './privacyAuth.js'
import { ensureMiniappSession } from './remoteAiRequest.js'
import { isCloudContainerAvailable, startCloudContainerRequest } from './cloudContainer.js'
import { getFileInfo } from './fileSystem.js'

export const CONTRACT_TEXT_EXTENSIONS = ['txt', 'md']
export const CONTRACT_DOCUMENT_EXTENSIONS = [...CONTRACT_TEXT_EXTENSIONS, 'docx', 'pdf']
export const CONTRACT_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']

function createImportError(code, message, cause) {
  const error = new Error(message)
  error.code = code
  error.cause = cause
  return error
}

function getExtension(fileName) {
  const name = String(fileName || '').trim().toLowerCase()
  const dotIndex = name.lastIndexOf('.')
  return dotIndex >= 0 ? name.slice(dotIndex + 1) : ''
}

export function validateContractFile(file, allowedExtensions = CONTRACT_DOCUMENT_EXTENSIONS) {
  if (!file?.path) throw createImportError('missing-file', '没有取得文件路径')
  const fileName = String(file.name || file.path.split('/').pop() || '合同文件')
  const extension = getExtension(fileName)
  if (!allowedExtensions.includes(extension)) {
    throw createImportError('unsupported-file', `当前支持 ${allowedExtensions.map((item) => item.toUpperCase()).join('、')} 文件`)
  }
  if (Number(file.size) > CONTRACT_IMPORT_MAX_BYTES) throw createImportError('file-too-large', '文件超过 8MB')
  return { ...file, name: fileName, extension }
}

export function normalizeImportedContractText(value) {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .trim()
}

export function validateContractTextFile(file) {
  return validateContractFile(file, CONTRACT_TEXT_EXTENSIONS)
}

function readUtf8File(filePath) {
  return new Promise((resolve, reject) => {
    Taro.getFileSystemManager().readFile({
      filePath,
      encoding: 'utf8',
      success: ({ data }) => resolve(data),
      fail: (error) => reject(createImportError('read-failed', '文件读取失败', error)),
    })
  })
}

export async function importWechatContractText() {
  let result
  try {
    result = await Taro.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: CONTRACT_TEXT_EXTENSIONS,
    })
  } catch (error) {
    const message = String(error?.errMsg || error?.message || '')
    if (/cancel/i.test(message)) throw createImportError('cancelled', '已取消选择', error)
    throw createImportError('choose-failed', '微信聊天文件选择失败', error)
  }

  const file = validateContractTextFile(result?.tempFiles?.[0])
  const text = normalizeImportedContractText(await readUtf8File(file.path))
  if (!text) throw createImportError('empty-file', '文件中没有可审查的文本')
  if (text.includes('\u0000')) throw createImportError('unsupported-encoding', '文件不是可读取的 UTF-8 文本')
  return { text, fileName: file.name, size: Number(file.size) || 0 }
}

export async function chooseWechatContractFile() {
  let result
  try {
    result = await Taro.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: CONTRACT_DOCUMENT_EXTENSIONS,
    })
  } catch (error) {
    const message = String(error?.errMsg || error?.message || '')
    if (/cancel/i.test(message)) throw createImportError('cancelled', '已取消选择', error)
    throw createImportError('choose-failed', '微信聊天文件选择失败', error)
  }
  return validateContractFile(result?.tempFiles?.[0])
}

export async function chooseContractImage(sourceType = 'album') {
  let result
  try {
    result = await Taro.chooseImage({ count: 1, sourceType: [sourceType], sizeType: ['compressed'] })
  } catch (error) {
    const message = String(error?.errMsg || error?.message || '')
    if (/cancel/i.test(message)) throw createImportError('cancelled', '已取消选择', error)
    throw createImportError('choose-image-failed', sourceType === 'camera' ? '拍照失败' : '相册选图失败', error)
  }
  const path = result?.tempFilePaths?.[0]
  const tempFile = result?.tempFiles?.[0] || {}
  if (!path) throw createImportError('missing-file', '没有取得合同图片')
  const pathName = String(path).split('/').pop() || ''
  const name = getExtension(pathName) ? pathName : `合同照片.${String(tempFile.type || 'jpg').replace(/^image\//, '')}`
  let file = validateContractFile({ path, name, size: Number(tempFile.size) || 0 }, CONTRACT_IMAGE_EXTENSIONS)
  if (typeof Taro.compressImage !== 'function') return file
  for (const quality of [65, 40]) {
    if (file.size <= 700 * 1024) break
    try {
      const compressed = await Taro.compressImage({ src: file.path, quality })
      if (!compressed?.tempFilePath) break
      const info = await getFileInfo(compressed.tempFilePath)
      file = validateContractFile({
        ...file,
        path: compressed.tempFilePath,
        size: Number(info?.size) || file.size,
      }, CONTRACT_IMAGE_EXTENSIONS)
    } catch {
      break
    }
  }
  return file
}

export async function importLocalContractFile(file) {
  const validated = validateContractFile(file)
  if (!CONTRACT_TEXT_EXTENSIONS.includes(validated.extension)) {
    throw createImportError('remote-required', '该格式需要联网解析')
  }
  const text = normalizeImportedContractText(await readUtf8File(validated.path))
  if (!text) throw createImportError('empty-file', '文件中没有可审查的文本')
  if (text.includes('\u0000')) throw createImportError('unsupported-encoding', '文件不是可读取的 UTF-8 文本')
  return { text, fileName: validated.name, size: Number(validated.size) || 0, mode: 'local' }
}

function parseUploadResponse(data) {
  if (data && typeof data === 'object') return data
  try { return JSON.parse(String(data || '')) } catch { return {} }
}

function readBase64File(filePath) {
  return new Promise((resolve, reject) => {
    Taro.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: ({ data }) => resolve(String(data || '')),
      fail: reject,
    })
  })
}

function isCloudContainerPlatformFailure(error) {
  const message = String(error?.errMsg || error?.message || '')
  return /cloud\.callContainer:fail[\s\S]*-606001|cloud\.callContainer:fail[\s\S]*system error/i.test(message)
}

function startAuthenticatedUpload({ file, path, fieldName, onProgress, timeoutMs = REMOTE_AI_CONFIG.requestTimeoutMs }) {
  let uploadTask = null
  let cancelled = false

  const uploadOnce = (session) => new Promise((resolve, reject) => {
    const startDirectUpload = () => Taro.uploadFile({
      url: `${REMOTE_AI_CONFIG.apiBaseUrl}${path}`,
      filePath: file.path,
      name: fieldName,
      formData: { fileName: file.name },
      header: { Authorization: `Bearer ${session.token}` },
      timeout: timeoutMs,
      success: (response) => {
        const data = parseUploadResponse(response.data)
        if (response.statusCode >= 200 && response.statusCode < 300 && data?.ok && data?.text) {
          resolve(data)
          return
        }
        reject(createImportError(
          response.statusCode === 401 ? 'unauthorized' : response.statusCode === 429 ? 'busy' : 'remote-failed',
          data?.message || `解析服务请求失败（${response.statusCode}）`,
          response,
        ))
      },
      fail: (error) => {
        const message = String(error?.errMsg || error?.message || '')
        const code = /abort|cancel/i.test(message) || cancelled ? 'cancelled' : /timeout|超时/i.test(message) ? 'timeout' : 'network-failed'
        reject(createImportError(code, code === 'cancelled' ? '已取消解析' : code === 'timeout' ? '合同图片识别超时，请重试' : '文件上传失败，请检查网络', error))
      },
    })

    const startCloudUpload = async () => {
      onProgress?.(5)
      const fileBase64 = await readBase64File(file.path)
      if (cancelled) throw createImportError('cancelled', '已取消文件解析')
      onProgress?.(35)
      uploadTask = startCloudContainerRequest({
        path,
        method: 'POST',
        token: session.token,
        data: { fileName: file.name, fileBase64 },
        timeoutMs,
      })
      const response = await uploadTask.promise
      const data = parseUploadResponse(response?.data)
      if (response?.statusCode >= 200 && response?.statusCode < 300 && data?.ok && data?.text) {
        onProgress?.(100)
        resolve(data)
        return true
      }
      throw createImportError(
        response?.statusCode === 401 ? 'unauthorized' : response?.statusCode === 429 ? 'busy' : 'remote-failed',
        data?.message || `解析服务请求失败（${response?.statusCode || '未知'}）`,
        response,
      )
    }

    if (REMOTE_AI_CONFIG.transport === 'cloud' && isCloudContainerAvailable()) {
      ;(async () => {
        try {
          await startCloudUpload()
        } catch (error) {
          const message = String(error?.errMsg || error?.message || '')
          if (error?.code === 'cancelled' || /abort|cancel/i.test(message)) {
            reject(createImportError('cancelled', '已取消文件解析', error))
          } else if (isCloudContainerPlatformFailure(error)) {
            try {
              uploadTask = startDirectUpload()
            } catch (directError) {
              reject(createImportError('network-failed', '云托管调用失败，请将云托管域名加入小程序合法域名后重试', directError))
            }
          } else if (['unauthorized', 'busy', 'remote-failed'].includes(error?.code)) {
            reject(error)
          } else if (error?.code === 'timeout' || /timeout|超时/i.test(message)) {
            reject(createImportError('timeout', '合同图片识别超时，请重试', error))
          } else {
            reject(createImportError('network-failed', message || '文件上传失败，请稍后重试', error))
          }
        }
      })()
      return
    }

    uploadTask = startDirectUpload()
    uploadTask?.onProgressUpdate?.(({ progress }) => onProgress?.(Math.max(0, Math.min(100, Number(progress) || 0))))
  })

  const promise = (async () => {
    let session
    try {
      session = await ensureMiniappSession()
    } catch (error) {
      throw createImportError('remote-auth', error?.message || '微信登录失败', error)
    }
    if (cancelled) throw createImportError('cancelled', '已取消解析')
    try {
      return await uploadOnce(session)
    } catch (error) {
      if (error?.code !== 'unauthorized' || cancelled) throw error
      session = await ensureMiniappSession({ force: true })
      if (cancelled) throw createImportError('cancelled', '已取消解析')
      return uploadOnce(session)
    }
  })()

  return {
    promise,
    cancel() {
      cancelled = true
      uploadTask?.abort?.()
      uploadTask?.cancel?.()
    },
  }
}

export function startRemoteDocumentImport(file, options = {}) {
  return startAuthenticatedUpload({
    file: validateContractFile(file),
    path: '/api/miniapp/contract/parse',
    fieldName: 'document',
    ...options,
  })
}

export function startRemoteImageImport(file, options = {}) {
  return startAuthenticatedUpload({
    file: validateContractFile(file, CONTRACT_IMAGE_EXTENSIONS),
    path: '/api/miniapp/ocr/image',
    fieldName: 'image',
    timeoutMs: REMOTE_AI_CONFIG.ocrTimeoutMs,
    ...options,
  })
}

export async function importClipboardContractText() {
  let result
  try {
    result = await Taro.getClipboardData()
  } catch (error) {
    throw createImportError('clipboard-failed', '读取手机剪贴板失败', error)
  }
  const text = normalizeImportedContractText(result?.data)
  if (!text) throw createImportError('clipboard-empty', '剪贴板中没有合同正文')
  return { text, fileName: '手机剪贴板', size: text.length }
}

export function getContractImportError(error, { source = 'wechat', platform = '' } = {}) {
  const code = error?.code || ''
  const rawMessage = String(error?.cause?.errMsg || error?.errMsg || error?.message || '')
  if (code === 'cancelled' || /cancel/i.test(rawMessage)) return { cancelled: true }
  const capability = source === 'phone' ? 'clipboard' : source === 'camera' ? 'camera' : source === 'album' ? 'album' : 'chatFile'
  const capabilityFailure = getCapabilityFailure(error, capability)
  if (capabilityFailure.reason === 'privacy-blocked' || capabilityFailure.reason === 'permission-denied') {
    const title = source === 'phone' ? '读取手机文本失败' : source === 'camera' ? '拍照失败' : source === 'album' ? '相册选图失败' : '微信文件导入失败'
    return { title, content: capabilityFailure.content }
  }
  if (code === 'file-too-large') return { title: '文件过大', content: '请选择 8MB 以内的 TXT、MD、DOCX、PDF 或合同图片。' }
  if (code === 'unsupported-file') return { title: '格式不支持', content: '请选择 TXT、MD、DOCX、PDF、JPG、PNG 或 WEBP 文件。' }
  if (code === 'empty-file') return { title: '文件没有正文', content: '文件为空，或没有读取到可审查文本。请检查文件后重试。' }
  if (code === 'unsupported-encoding') return { title: '文本编码不支持', content: '请在 WPS 或文本编辑器中另存为 UTF-8 编码的 TXT 文件后重试。' }
  if (code === 'read-failed') return { title: '文件读取失败', content: '微信已经选到文件，但无法读取正文。请确认文件未损坏，并另存为 UTF-8 的 TXT/MD 后重试。' }
  if (code === 'remote-auth') return { title: '联网解析尚未就绪', content: error?.message || '微信登录或解析服务尚未配置，请稍后重试。TXT/MD 和手机粘贴仍可本地导入。' }
  if (code === 'timeout') return { title: '识别超时', content: '首次启动 OCR 可能较慢，请重新尝试；也可以换一张更清晰、裁剪后的合同图片。' }
  if (code === 'network-failed') {
    const detail = rawMessage && !/^文件上传失败/.test(rawMessage)
      ? `微信返回：${rawMessage.slice(0, 180)}`
      : '请检查网络和微信 request/uploadFile 合法域名配置后重试。'
    return { title: '上传失败', content: `${detail} TXT/MD 和手机粘贴仍可本地导入。` }
  }
  if (code === 'busy') return { title: '解析服务繁忙', content: '当前有其他文件正在识别，请稍后重试。' }
  if (code === 'remote-failed') return { title: '合同解析失败', content: error?.message || '文件可能已加密、损坏或没有可提取正文。' }
  if (source === 'phone' && code === 'clipboard-empty') {
    return {
      title: '剪贴板中没有合同正文',
      content: '请先在手机文件、WPS 或备忘录中打开合同，全选并复制正文，再返回点击“从手机粘贴”。也可以把 TXT/MD 发到微信聊天后导入。',
    }
  }
  if (source === 'phone') return { title: '读取手机文本失败', content: '请重新复制合同正文后再试，或改用微信聊天文件导入。' }
  if (platform === 'devtools' || /not support|not available|not implemented|system:/i.test(rawMessage)) {
    return {
      title: '开发者工具无法读取微信聊天文件',
      content: '这是模拟器能力限制。请点击开发者工具顶部“预览”，在真机微信中打开后，再从真实聊天或文件传输助手选择合同文件。',
    }
  }
  return {
    title: '微信文件导入失败',
    content: '请确认文件已发送到微信聊天或文件传输助手，并选择 TXT、MD、DOCX 或 PDF；也可以改用“手机粘贴”。',
  }
}
