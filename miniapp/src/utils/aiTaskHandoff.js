import Taro from '@tarojs/taro'
import { STORAGE_KEYS } from '../constants/appConfig.js'
import { createAiTaskHandoff, normalizeAiTaskHandoff } from '../features/remoteAi.js'

export async function openAiTask(taskKey) {
  const task = createAiTaskHandoff(taskKey)
  if (!task) return false
  try {
    Taro.setStorageSync(STORAGE_KEYS.aiTaskHandoff, task)
    await Taro.navigateTo({ url: '/pages/ai/index' })
    return true
  } catch {
    try { Taro.removeStorageSync(STORAGE_KEYS.aiTaskHandoff) } catch { /* Best-effort cleanup. */ }
    Taro.showToast({ title: '暂时无法打开 AI 助手，请重试', icon: 'none' })
    return false
  }
}

export function consumeAiTaskHandoff(now = Date.now()) {
  try {
    const value = Taro.getStorageSync(STORAGE_KEYS.aiTaskHandoff)
    Taro.removeStorageSync(STORAGE_KEYS.aiTaskHandoff)
    return normalizeAiTaskHandoff(value, now)
  } catch {
    return null
  }
}
