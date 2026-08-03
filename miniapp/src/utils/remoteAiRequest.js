import Taro from '@tarojs/taro'
import { REMOTE_AI_CONFIG, STORAGE_KEYS } from '../constants/appConfig.js'
import { normalizeRemoteAiResponse, normalizeRemoteContractReviewResponse } from '../features/remoteAi.js'
import { isCloudContainerAvailable, startCloudContainerRequest } from './cloudContainer.js'

let sessionPromise = null
const SERVICE_FAILURE_THRESHOLD = 3
const SERVICE_COOLDOWN_MS = 30_000
let serviceState = { consecutiveFailures: 0, retryAt: 0, lastCode: '' }

export function hasRemoteConsent() {
  try {
    return Taro.getStorageSync(STORAGE_KEYS.aiRemoteConsent) === true
  } catch {
    return false
  }
}

export async function confirmRemoteConsent() {
  if (hasRemoteConsent()) return true
  const result = await Taro.showModal({
    title: '启用联网 AI',
    content: '联网模式会把本次问题，以及你在当前页面选择或生成的资料摘要，发送至租小审服务端和模型服务商。合同全文、照片内容和附件文件不会随 AI 问答发送。是否继续？',
    confirmText: '同意启用',
    cancelText: '继续本地',
  })
  if (!result.confirm) return false
  try {
    Taro.setStorageSync(STORAGE_KEYS.aiRemoteConsent, true)
  } catch {
    Taro.showToast({ title: '无法保存联网授权，请清理本地空间后重试', icon: 'none' })
    return false
  }
  return true
}

function createRemoteError(message, code, extra = {}) {
  const error = new Error(message)
  error.code = code
  Object.assign(error, extra)
  return error
}

function normalizeRequestFailure(reason) {
  if (reason?.code === 'cancelled') return createRemoteError('已取消联网回答', 'cancelled', { cause: reason })
  if (reason?.code === 'timeout') return createRemoteError('联网 AI 响应超时，已切换本地分析', 'timeout', { cause: reason })
  const raw = String(reason?.errMsg || reason?.message || '')
  if (/abort|cancel/i.test(raw)) return createRemoteError('已取消联网回答', 'cancelled', { cause: reason })
  if (/domain list|合法域名|url not in domain/i.test(raw)) {
    return createRemoteError('联网服务域名尚未加入微信 request 合法域名，请完成后台配置后重试', 'domain', { cause: reason })
  }
  if (/ssl|certificate|证书/i.test(raw)) {
    return createRemoteError('联网服务 HTTPS 证书校验失败，请稍后重试', 'certificate', { cause: reason })
  }
  if (/timeout/i.test(raw)) return createRemoteError('联网 AI 响应超时，已切换本地分析', 'timeout', { cause: reason })
  return createRemoteError('网络连接失败，请检查网络后重试', 'network', { cause: reason })
}

function readSession() {
  try {
    const value = Taro.getStorageSync(STORAGE_KEYS.aiSession)
    const session = typeof value === 'string' ? JSON.parse(value) : value
    if (!session?.token || Number(session.expiresAt) <= Date.now() + 60_000) return null
    return session
  } catch {
    return null
  }
}

function saveSession(session) {
  Taro.setStorageSync(STORAGE_KEYS.aiSession, session)
  return session
}

export function clearMiniappSession() {
  try {
    Taro.removeStorageSync(STORAGE_KEYS.aiSession)
  } catch {
    // A failed cleanup should not block the next login attempt.
  }
}

export function clearRemoteAiServiceState() {
  serviceState = { consecutiveFailures: 0, retryAt: 0, lastCode: '' }
}

export function getRemoteAiServiceState(now = Date.now()) {
  const retryAt = Number(serviceState.retryAt) || 0
  return {
    ...serviceState,
    coolingDown: retryAt > now,
    retryAfterSeconds: retryAt > now ? Math.max(1, Math.ceil((retryAt - now) / 1_000)) : 0,
  }
}

function recordRemoteSuccess() {
  clearRemoteAiServiceState()
}

function recordRemoteFailure(error) {
  const code = String(error?.code || '')
  if (!['network', 'timeout', 'certificate', 'http'].includes(code)) return
  const consecutiveFailures = serviceState.consecutiveFailures + 1
  serviceState = {
    consecutiveFailures,
    lastCode: code,
    retryAt: consecutiveFailures >= SERVICE_FAILURE_THRESHOLD ? Date.now() + SERVICE_COOLDOWN_MS : 0,
  }
}

function startJsonRequest({ path, method = 'GET', data, token, timeoutMs = REMOTE_AI_CONFIG.requestTimeoutMs }) {
  if (REMOTE_AI_CONFIG.transport === 'cloud' && isCloudContainerAvailable()) {
    const cloudRequest = startCloudContainerRequest({ path, method, data, token, timeoutMs })
    let settled = false
    let rejectPromise = null
    const promise = new Promise((resolve, reject) => {
      rejectPromise = reject
      cloudRequest.promise.then((response) => {
        if (settled) return
        settled = true
        const statusCode = Number(response?.statusCode) || 0
        if (statusCode >= 200 && statusCode < 300) {
          resolve(response.data)
          return
        }
        reject(createRemoteError(
          response?.data?.message || `服务请求失败（${statusCode || '未知'}）`,
          statusCode === 401 ? 'unauthorized' : statusCode === 429 ? 'quota' : 'http',
          { statusCode, quota: response?.data?.quota || null },
        ))
      }).catch((error) => {
        if (settled) return
        settled = true
        reject(normalizeRequestFailure(error))
      })
    })
    return {
      promise,
      cancel() {
        if (settled) return
        settled = true
        cloudRequest.cancel()
        rejectPromise?.(createRemoteError('已取消联网回答', 'cancelled'))
      },
    }
  }

  let task = null
  let timer = 0
  let settled = false
  let rejectPromise = null

  const promise = new Promise((resolve, reject) => {
    rejectPromise = reject
    const finish = (callback, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      callback(value)
    }
    try {
      task = Taro.request({
        url: `${REMOTE_AI_CONFIG.apiBaseUrl}${path}`,
        method,
        data,
        header: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        success: (response) => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            finish(resolve, response.data)
            return
          }
          finish(reject, createRemoteError(
            response.data?.message || `服务请求失败（${response.statusCode}）`,
            response.statusCode === 401 ? 'unauthorized' : response.statusCode === 429 ? 'quota' : 'http',
            { statusCode: response.statusCode, quota: response.data?.quota || null },
          ))
        },
        fail: (reason) => {
          finish(reject, normalizeRequestFailure(reason))
        },
      })
      if (!settled) {
        timer = setTimeout(() => {
          task?.abort?.()
          finish(reject, createRemoteError('联网 AI 响应超时，已切换本地分析', 'timeout'))
        }, Math.max(5_000, Number(timeoutMs) || REMOTE_AI_CONFIG.requestTimeoutMs))
      }
    } catch (error) {
      finish(reject, createRemoteError('无法发起网络请求，请稍后重试', 'network', { cause: error }))
    }
  })

  return {
    promise,
    cancel() {
      if (settled) return
      task?.abort?.()
      if (!settled && rejectPromise) {
        settled = true
        clearTimeout(timer)
        rejectPromise(createRemoteError('已取消联网回答', 'cancelled'))
      }
    },
  }
}

export async function ensureMiniappSession({ force = false } = {}) {
  if (!REMOTE_AI_CONFIG.enabled) throw createRemoteError('联网 AI 未启用，已使用本地分析', 'disabled')
  if (!force) {
    const current = readSession()
    if (current) return current
    if (sessionPromise) return sessionPromise
  }

  sessionPromise = (async () => {
    if (force) clearMiniappSession()
    let loginResult
    try {
      loginResult = await Taro.login()
    } catch (error) {
      throw createRemoteError('微信登录失败，请重新进入小程序后再试', 'login', { cause: error })
    }
    if (!loginResult?.code) throw createRemoteError('微信登录凭证为空，请重新进入小程序后再试', 'login')
    const request = startJsonRequest({
      path: '/api/auth/wx-login',
      method: 'POST',
      data: { code: loginResult.code },
      timeoutMs: 15_000,
    })
    const result = await request.promise
    if (!result?.token || !result?.expiresAt) throw createRemoteError('服务端未返回有效登录状态', 'login')
    return saveSession({ token: result.token, expiresAt: result.expiresAt, quota: result.quota || null })
  })()

  try {
    return await sessionPromise
  } finally {
    sessionPromise = null
  }
}

function startAuthenticatedAiRequest(payload, { force = false, timeoutMs, normalize = normalizeRemoteAiResponse } = {}) {
  let activeRequest = null
  let session = null
  let cancelled = false
  let rejectCancellation = null
  const cancellation = new Promise((_, reject) => {
    rejectCancellation = reject
  })
  const waitUntilCancelled = (promise) => Promise.race([promise, cancellation])

  const promise = (async () => {
    const currentService = getRemoteAiServiceState()
    if (!force && currentService.coolingDown) {
      throw createRemoteError(
        `联网服务连续失败，已暂停请求 ${currentService.retryAfterSeconds} 秒并使用本地分析`,
        'service-cooldown',
        { retryAfterSeconds: currentService.retryAfterSeconds },
      )
    }
    session = await waitUntilCancelled(ensureMiniappSession())
    if (cancelled) throw createRemoteError('已取消联网回答', 'cancelled')

    for (let attempt = 0; attempt < 2; attempt += 1) {
      activeRequest = startJsonRequest({
        path: '/api/miniapp/ai/chat',
        method: 'POST',
        data: payload,
        token: session.token,
        timeoutMs,
      })
      try {
        const result = normalize(await waitUntilCancelled(activeRequest.promise))
        recordRemoteSuccess()
        saveSession({ ...session, quota: result.quota || session.quota })
        return result
      } catch (error) {
        if (error.code !== 'unauthorized' || attempt > 0) throw error
        session = await waitUntilCancelled(ensureMiniappSession({ force: true }))
      }
    }
    throw createRemoteError('登录状态校验失败，请稍后重试', 'unauthorized')
  })().catch((error) => {
    if (!cancelled) recordRemoteFailure(error)
    throw error
  })

  return {
    requestId: payload.requestId,
    promise,
    cancel() {
      if (cancelled) return
      cancelled = true
      activeRequest?.cancel()
      if (session?.token && payload?.requestId) {
        startJsonRequest({
          path: '/api/miniapp/ai/cancel',
          method: 'POST',
          data: { requestId: payload.requestId },
          token: session.token,
          timeoutMs: 5_000,
        }).promise.catch(() => {})
      }
      rejectCancellation?.(createRemoteError('已取消联网回答', 'cancelled'))
    },
  }
}


export function startRemoteAiRequest(payload, options = {}) {
  return startAuthenticatedAiRequest(payload, options)
}

export function startRemoteContractReviewRequest(payload, options = {}) {
  return startAuthenticatedAiRequest(payload, {
    ...options,
    timeoutMs: REMOTE_AI_CONFIG.contractReviewTimeoutMs,
    normalize: normalizeRemoteContractReviewResponse,
  })
}

export function getStoredRemoteAiQuota() {
  return readSession()?.quota || null
}

export async function fetchRemoteAiServiceHealth() {
  const request = startJsonRequest({ path: '/api/health', timeoutMs: 15_000 })
  try {
    const data = await request.promise
    const supportsMiniappApi = Number(data?.miniappApiVersion) >= 3
      || typeof data?.miniappAuthConfigured === 'boolean'
    const status = {
      reachable: data?.ok === true,
      supportsMiniappApi,
      authConfigured: data?.miniappAuthConfigured === true,
      modelConfigured: data?.hasApiKey === true,
      usagePersistent: data?.miniappUsagePersistent === true,
      usageStore: String(data?.miniappUsageStore || ''),
    }
    return {
      ...status,
      ready: status.reachable && status.supportsMiniappApi && status.authConfigured && status.modelConfigured,
    }
  } catch (error) {
    recordRemoteFailure(error)
    throw error
  }
}

export async function fetchRemoteSubsidyPolicies(city) {
  const request = startJsonRequest({
    path: `/api/subsidy/policies?city=${encodeURIComponent(String(city || '').trim())}`,
    timeoutMs: 12_000,
  })
  const data = await request.promise
  if (!Array.isArray(data?.policies)) throw createRemoteError('政策服务返回的数据无效', 'http')
  return data
}

export async function fetchRemoteAiQuota() {
  let session = await ensureMiniappSession()
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const request = startJsonRequest({ path: '/api/miniapp/ai/quota', token: session.token, timeoutMs: 15_000 })
    try {
      const quota = await request.promise
      saveSession({ ...session, quota })
      recordRemoteSuccess()
      return quota
    } catch (error) {
      if (error.code !== 'unauthorized' || attempt > 0) {
        recordRemoteFailure(error)
        throw error
      }
      session = await ensureMiniappSession({ force: true })
    }
  }
  throw createRemoteError('登录状态校验失败，请稍后重试', 'unauthorized')
}

export function getRemoteAiError(error) {
  const code = String(error?.code || '')
  return {
    code,
    cancelled: code === 'cancelled',
    retryable: ['network', 'timeout', 'certificate', 'http', 'login', 'unauthorized', 'service-cooldown'].includes(code),
    quota: error?.quota || null,
    retryAfterSeconds: Number(error?.retryAfterSeconds) || 0,
    message: error?.message || '联网 AI 暂时不可用',
  }
}
