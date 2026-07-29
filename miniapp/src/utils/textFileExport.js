import Taro from '@tarojs/taro'
import { getMiniappErrorMessage } from './privacyAuth.js'

// 文件名非法字符：\ / : * ? " < > |
const ILLEGAL_CHARS = /[\\/:*?"<>|]/g
const MAX_FILENAME_LENGTH = 80
const TXT_EXT = '.txt'

// 清理文件名非法字符并限制长度，保证结果始终以 .txt 结尾
export function sanitizeFileName(name) {
  const cleaned = String(name || '').replace(ILLEGAL_CHARS, '_').trim()
  let safe = cleaned || '导出文件'
  // 去掉已存在的 .txt 扩展名，后面统一补
  if (safe.toLowerCase().endsWith(TXT_EXT)) {
    safe = safe.slice(0, -TXT_EXT.length)
  }
  if (safe.length + TXT_EXT.length > MAX_FILENAME_LENGTH) {
    safe = safe.slice(0, MAX_FILENAME_LENGTH - TXT_EXT.length)
  }
  return safe + TXT_EXT
}

// 统一 TXT 文件导出：写入 -> 微信分享
// 返回 { ok: true, filePath } 或 { ok: false, reason, filePath?, error? }
export async function exportTextToFile(fileName, content) {
  if (content == null || String(content).trim() === '') {
    Taro.showToast({ title: '内容为空，无法导出', icon: 'none' })
    return { ok: false, reason: 'empty-content' }
  }

  const safeName = sanitizeFileName(fileName)
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

  // 写入成功后通过微信文件分享界面发送或保存
  try {
    await new Promise((resolve, reject) => {
      Taro.shareFileMessage({
        filePath,
        fileName: safeName,
        success: resolve,
        fail: reject,
      })
    })
    return { ok: true, filePath }
  } catch (error) {
    const msg = getMiniappErrorMessage(error)
    // 用户取消分享
    if (msg.includes('cancel') || msg.includes('user cancel') || msg.includes('share:cancel')) {
      return { ok: false, reason: 'share-cancelled', filePath }
    }
    console.error('shareFileMessage failed:', error)
    Taro.showModal({
      title: 'TXT 已生成，分享未完成',
      content: msg
        ? `文件已保留在小程序本地，但微信没有打开分享面板。\n\n微信返回：${msg}\n\n请检查微信版本和网络后重试，也可以使用页面上的“复制文本”。`
        : '文件已保留在小程序本地，但微信没有打开分享面板。请检查微信版本和网络后重试，也可以使用页面上的“复制文本”。',
      showCancel: false,
    })
    return { ok: false, reason: 'share-failed', filePath, error }
  }
}
