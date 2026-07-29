import Taro from '@tarojs/taro'

// 附件大小上限 10MB，与小程序 chooseMessageFile 常用限制一致
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic']
const ACCEPTED_EXTENSIONS = [...IMAGE_EXTENSIONS, 'pdf', 'doc', 'docx', 'txt', 'md']

function extOf(name) {
  const lower = String(name || '').toLowerCase()
  const idx = lower.lastIndexOf('.')
  return idx >= 0 ? lower.slice(idx + 1) : ''
}

function genId() {
  return `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function detectFileType(fileName) {
  return IMAGE_EXTENSIONS.includes(extOf(fileName)) ? 'image' : 'file'
}

// 将临时文件持久化为小程序本地文件，重启后仍可访问
export async function persistAttachment(tempFilePath, source, originName = '', declaredSize = 0) {
  const fallbackName = source === 'album' ? '相册图片.jpg' : '附件'
  let fileName = originName || String(tempFilePath || '').split('/').pop() || fallbackName
  if (source === 'album' && !IMAGE_EXTENSIONS.includes(extOf(fileName))) fileName = fallbackName
  const ext = extOf(fileName)

  if (ext && !ACCEPTED_EXTENSIONS.includes(ext)) {
    throw new Error(`暂不支持 .${ext} 文件，请选择图片、PDF、Word 或 TXT`)
  }

  let size = Math.max(0, Number(declaredSize) || 0)
  if (size > ATTACHMENT_MAX_BYTES) {
    throw new Error('文件超过 10MB，请选择更小的文件')
  }
  try {
    const info = await Taro.getFileInfo({ filePath: tempFilePath })
    size = Math.max(size, Number(info.size) || 0)
  } catch {
    // getFileInfo 在个别机型或临时路径上会失败，此时允许 size 为 0 继续保存
  }

  if (size > ATTACHMENT_MAX_BYTES) {
    throw new Error('文件超过 10MB，请选择更小的文件')
  }

  const { savedFilePath } = await Taro.saveFile({ tempFilePath })
  try {
    const savedInfo = await Taro.getFileInfo({ filePath: savedFilePath })
    size = Math.max(size, Number(savedInfo.size) || 0)
    if (size > ATTACHMENT_MAX_BYTES) {
      await removePersistedFile(savedFilePath)
      throw new Error('文件超过 10MB，请选择更小的文件')
    }
  } catch (error) {
    if (String(error?.message || '').includes('超过 10MB')) throw error
    // 个别机型无法读取持久路径信息时，沿用选择结果或临时路径取得的大小。
  }

  return {
    id: genId(),
    fileName,
    fileType: detectFileType(fileName),
    size,
    localPath: savedFilePath,
    source,
    createdAt: new Date().toISOString(),
  }
}

export async function removePersistedFile(localPath) {
  if (!localPath) return { ok: true, reason: 'empty' }
  try {
    await Taro.removeSavedFile({ filePath: localPath })
    return { ok: true, reason: 'removed' }
  } catch (error) {
    const message = String(error?.errMsg || error?.message || '')
    // 文件不存在（已被系统清理或从未持久化），允许继续删除记录
    if (message.includes('not exist') || message.includes('not found') || message.includes('no such file')) {
      return { ok: true, reason: 'not-exist' }
    }
    console.error('removeSavedFile failed:', error)
    return { ok: false, reason: 'error', error }
  }
}

export function pickImageFromAlbum() {
  return new Promise((resolve, reject) => {
    Taro.chooseImage({
      count: 1,
      sourceType: ['album'],
      sizeType: ['compressed'],
      success: ({ tempFilePaths = [], tempFiles = [] }) => {
        const path = tempFilePaths[0]
        if (!path) {
          reject(new Error('未选择图片'))
          return
        }
        const pathName = String(path).split('/').pop() || ''
        resolve({
          tempFilePath: path,
          fileName: IMAGE_EXTENSIONS.includes(extOf(pathName)) ? pathName : '相册图片.jpg',
          size: Number(tempFiles[0]?.size) || 0,
        })
      },
      fail: (error) => reject(error),
    })
  })
}

export function pickFileFromChat() {
  return new Promise((resolve, reject) => {
    Taro.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ACCEPTED_EXTENSIONS,
      success: ({ tempFiles = [] }) => {
        const file = tempFiles[0]
        if (!file) {
          reject(new Error('未选择文件'))
          return
        }
        const fileName = file.name || '附件'
        const extension = extOf(fileName)
        if (!extension || !ACCEPTED_EXTENSIONS.includes(extension)) {
          reject(new Error('暂不支持此文件，请选择图片、PDF、Word 或 TXT'))
          return
        }
        if (Number(file.size) > ATTACHMENT_MAX_BYTES) {
          reject(new Error('文件超过 10MB，请选择更小的文件'))
          return
        }
        resolve({ tempFilePath: file.path, fileName, size: Number(file.size) || 0 })
      },
      fail: (error) => reject(error),
    })
  })
}

export function previewImageAttachment(attachment, allImageAttachments = []) {
  if (!attachment || attachment.fileType !== 'image') return false
  const urls = (Array.isArray(allImageAttachments) ? allImageAttachments : [])
    .map((item) => item.localPath)
    .filter(Boolean)
  Taro.previewImage({
    current: attachment.localPath,
    urls: urls.length ? urls : [attachment.localPath],
  })
  return true
}

export function openFileAttachment(attachment) {
  return new Promise((resolve) => {
    Taro.openDocument({
      filePath: attachment.localPath,
      showMenu: true,
      success: () => resolve(true),
      fail: () => {
        Taro.showToast({ title: '暂不支持预览此文件', icon: 'none' })
        resolve(false)
      },
    })
  })
}

export function formatSize(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}
