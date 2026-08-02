import Taro from '@tarojs/taro'
import { getMiniappErrorMessage } from './privacyAuth.js'

// 文件名非法字符：\ / : * ? " < > |
const ILLEGAL_CHARS = /[\\/:*?"<>|]/g
const MAX_FILENAME_LENGTH = 80
const TXT_EXT = '.txt'
const JSON_EXT = '.json'

// 清理文件名非法字符并限制长度，默认导出 .txt；备份可指定 .json
export function sanitizeFileName(name, extension = TXT_EXT) {
  const safeExt = extension === JSON_EXT ? JSON_EXT : TXT_EXT
  const cleaned = String(name || '').replace(ILLEGAL_CHARS, '_').trim()
  let safe = cleaned || '导出文件'
  // 去掉已存在的目标扩展名，后面统一补
  if (safe.toLowerCase().endsWith(safeExt)) {
    safe = safe.slice(0, -safeExt.length)
  }
  if (safe.length + safeExt.length > MAX_FILENAME_LENGTH) {
    safe = safe.slice(0, MAX_FILENAME_LENGTH - safeExt.length)
  }
  return safe + safeExt
}

export async function prepareTextFile(fileName, content, { extension = TXT_EXT } = {}) {
  if (content == null || String(content).trim() === '') {
    Taro.showToast({ title: '内容为空，无法导出', icon: 'none' })
    return { ok: false, reason: 'empty-content' }
  }

  const safeName = sanitizeFileName(fileName, extension)
  const filePath = `${Taro.env.USER_DATA_PATH}/${safeName}`
  const fs = Taro.getFileSystemManager()

  try {
    await new Promise((resolve, reject) => {
      fs.writeFile({
        filePath,
        data: String(content),
        encoding: 'utf8',
        success: resolve,
        fail: reject,
      })
    })
  } catch (error) {
    const msg = getMiniappErrorMessage(error)
    if (msg.includes('disk full') || msg.includes('no space') || msg.includes('quota')) {
      Taro.showToast({ title: '存储空间不足，请清理后重试', icon: 'none' })
    } else {
      Taro.showToast({ title: '文件写入失败，请重试', icon: 'none' })
    }
    return { ok: false, reason: 'write-failed', error }
  }

  return { ok: true, filePath, fileName: safeName }
}

// 其他页面仍可一次调用完成导出；首页使用 prepareTextFile 后由第二次点击直接分享。
export async function exportTextToFile(fileName, content, options = {}) {
  const prepared = await prepareTextFile(fileName, content, options)
  if (!prepared.ok) return prepared

  try {
    await new Promise((resolve, reject) => {
      Taro.shareFileMessage({
        filePath: prepared.filePath,
        fileName: prepared.fileName,
        success: resolve,
        fail: reject,
      })
    })
    return prepared
  } catch (error) {
    const msg = getMiniappErrorMessage(error)
    // 用户取消分享
    if (msg.includes('cancel') || msg.includes('user cancel') || msg.includes('share:cancel')) {
      return { ...prepared, ok: false, reason: 'share-cancelled' }
    }
    console.error('shareFileMessage failed:', error)
    Taro.showModal({
      title: 'TXT 已生成，分享未完成',
      content: msg
        ? `文件已保留在小程序本地，但微信没有打开分享面板。\n\n微信返回：${msg}\n\n请检查微信版本和网络后重试，也可以使用页面上的“复制文本”。`
        : '文件已保留在小程序本地，但微信没有打开分享面板。请检查微信版本和网络后重试，也可以使用页面上的“复制文本”。',
      showCancel: false,
    })
    return { ...prepared, ok: false, reason: 'share-failed', error }
  }
}
