import Taro from '@tarojs/taro'
import { showCapabilityFailure } from './privacyAuth.js'

export function copyText(value, successTitle = '已复制') {
  const data = String(value || '').trim()
  if (!data) {
    Taro.showToast({ title: '暂无可复制内容', icon: 'none' })
    return false
  }

  return new Promise((resolve) => {
    let settled = false
    const finish = async (copied, error) => {
      if (settled) return
      settled = true
      if (copied) {
        Taro.showToast({ title: successTitle, icon: 'success' })
      } else {
        console.error('setClipboardData failed:', error)
        await showCapabilityFailure(error, 'clipboard', '复制失败')
      }
      resolve(copied)
    }

    try {
      const request = Taro.setClipboardData({
        data,
        success: () => finish(true),
        fail: (error) => finish(false, error),
      })
      if (request?.then) request.then(() => finish(true), (error) => finish(false, error))
    } catch (error) {
      finish(false, error)
    }
  })
}
