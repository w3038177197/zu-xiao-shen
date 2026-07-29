import Taro from '@tarojs/taro'
import { CLOUD_CONTAINER_CONFIG } from '../constants/appConfig.js'

let initPromise = null

function getCloudClient() {
  const cloud = Taro.cloud || globalThis.wx?.cloud
  return cloud?.callContainer ? cloud : null
}

export function isCloudContainerAvailable() {
  return Boolean(getCloudClient())
}

export function initCloudContainer() {
  const cloud = getCloudClient()
  if (!cloud) {
    const error = new Error('当前运行环境不支持微信云托管')
    error.code = 'cloud-unavailable'
    return Promise.reject(error)
  }
  if (initPromise) return initPromise
  initPromise = Promise.resolve(cloud.init?.({ env: CLOUD_CONTAINER_CONFIG.envId }))
    .then(() => cloud)
    .catch((error) => {
      initPromise = null
      throw error
    })
  return initPromise
}

export function startCloudContainerRequest({ path, method = 'GET', data, token, timeoutMs = 45_000 }) {
  let settled = false
  let timer = 0
  let rejectPromise

  const promise = new Promise((resolve, reject) => {
    rejectPromise = reject
    const finish = (callback, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      callback(value)
    }

    initCloudContainer()
      .then((cloud) => cloud.callContainer({
        config: { env: CLOUD_CONTAINER_CONFIG.envId },
        path,
        method,
        data,
        timeout: Math.max(5_000, Number(timeoutMs) || 45_000),
        header: {
          'Content-Type': 'application/json',
          'X-WX-SERVICE': CLOUD_CONTAINER_CONFIG.serviceName,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }))
      .then((response) => finish(resolve, response))
      .catch((error) => finish(reject, error))

    timer = setTimeout(() => {
      finish(reject, Object.assign(new Error('云托管请求超时'), { code: 'timeout' }))
    }, Math.max(5_000, Number(timeoutMs) || 45_000))
  })

  return {
    promise,
    cancel() {
      if (settled) return
      finishCancellation()
    },
  }

  function finishCancellation() {
    settled = true
    clearTimeout(timer)
    rejectPromise?.(Object.assign(new Error('已取消云托管请求'), { code: 'cancelled' }))
  }
}
