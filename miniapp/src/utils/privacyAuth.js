import Taro from '@tarojs/taro'

const CAPABILITY_META = {
  clipboard: {
    declaration: '剪切板',
    action: '复制官网链接、报告与沟通文本，或读取你主动复制的合同正文',
  },
  camera: {
    declaration: '摄像头',
    action: '拍摄入住验房照片（仅保存在本机）；如用户选择对合同拍照进行 OCR 识别，将在逐次确认后上传服务端识别文字，原始图片仅在内存中处理，不写入磁盘、不持久化保存；请求处理结束后释放相关内存',
  },
  album: {
    declaration: '选中的照片或视频信息',
    action: '从手机相册选择验房或证据照片（仅保存在本机）；如用户选择从相册选择合同图片进行 OCR 识别，将在逐次确认后上传服务端识别文字，原始图片仅在内存中处理，不写入磁盘、不持久化保存；请求处理结束后释放相关内存',
  },
  chatFile: {
    declaration: '选中的文件',
    action: '从微信聊天或文件传输助手选择合同和证据附件：TXT/MD 和证据附件仅保存在本机；DOCX/PDF 合同会在逐次确认后上传服务端提取文字，原始文件仅在内存中处理，不写入磁盘、不持久化保存；请求处理结束后释放相关内存',
  },
  fileShare: {
    declaration: '文件分享',
    action: '把本地生成的 TXT 报告转发到微信聊天',
  },
}

export function getMiniappErrorMessage(error) {
  return String(
    error?.cause?.errMsg
      || error?.cause?.message
      || error?.errMsg
      || error?.message
      || '',
  ).trim()
}

export function isUserCancellation(error) {
  return /cancel|canceled|cancelled/i.test(getMiniappErrorMessage(error))
}

export function isPrivacyBlocked(error) {
  return /privacy|not\s+declared|undeclared|api\s*scope|未声明|隐私协议/i.test(getMiniappErrorMessage(error))
}

function isPrivacyDeclarationMissing(error) {
  return /not\s+declared|undeclared|api\s*scope|未声明|not\s+configured/i.test(getMiniappErrorMessage(error))
}

function isPermissionDenied(error) {
  return /auth\s*deny|authorize[^:]*:fail|permission\s*(?:denied|is not authorized)|system permission|camera permission|无权限|权限被拒绝/i.test(getMiniappErrorMessage(error))
}

export function getCapabilityFailure(error, capability = 'clipboard') {
  const meta = CAPABILITY_META[capability] || CAPABILITY_META.clipboard
  const rawMessage = getMiniappErrorMessage(error)

  if (isUserCancellation(error)) {
    return { cancelled: true, reason: 'cancelled', rawMessage }
  }

  if (isPrivacyBlocked(error)) {
    const declarationMissing = isPrivacyDeclarationMissing(error)
    return {
      cancelled: false,
      reason: 'privacy-blocked',
      title: declarationMissing ? '当前体验版缺少隐私用途配置' : '需要同意隐私保护指引',
      content: declarationMissing
        ? `“${meta.action}”需要声明“${meta.declaration}”用途。手机里的小程序设置页无法补开，需由管理员在微信公众平台完成声明并重新生成体验版。`
        : `请重新发起操作，并在租小审的隐私提示中同意“${meta.declaration}”用途。若没有出现授权提示，需由管理员核对微信公众平台配置。`,
      rawMessage,
    }
  }

  if (isPermissionDenied(error)) {
    return {
      cancelled: false,
      reason: 'permission-denied',
      title: '需要允许微信使用相关权限',
      content: `请在微信或系统设置中允许“${meta.action}”，返回小程序后再试。`,
      rawMessage,
    }
  }

  return {
    cancelled: false,
    reason: 'api-failed',
    title: '操作没有完成',
    content: rawMessage ? `微信返回：${rawMessage}` : `暂时无法${meta.action}，请稍后重试。`,
    rawMessage,
  }
}

function callOptionalPromise(factory, fallback) {
  try {
    const request = factory()
    return request?.then ? request : Promise.resolve(fallback)
  } catch {
    return Promise.resolve(fallback)
  }
}

export async function showCapabilityFailure(error, capability, fallbackTitle = '') {
  const detail = getCapabilityFailure(error, capability)
  if (detail.cancelled) return detail

  if (detail.reason === 'permission-denied') {
    const modal = await callOptionalPromise(() => Taro.showModal({
      title: fallbackTitle || detail.title,
      content: detail.content,
      confirmText: '去设置',
      cancelText: '暂不',
    }), { confirm: false })
    if (modal?.confirm) await callOptionalPromise(() => Taro.openSetting(), null)
    return detail
  }

  await callOptionalPromise(() => Taro.showModal({
    title: fallbackTitle || detail.title,
    content: detail.content,
    showCancel: false,
  }), null)
  return detail
}

export const WECHAT_PRIVACY_DECLARATIONS = Object.freeze([
  CAPABILITY_META.clipboard,
  CAPABILITY_META.album,
  CAPABILITY_META.camera,
  CAPABILITY_META.chatFile,
])
