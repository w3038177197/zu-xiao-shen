import { createHmac, timingSafeEqual } from 'node:crypto'

const TOKEN_VERSION = 1
const DEFAULT_TTL_SECONDS = 2 * 60 * 60
const MAX_TTL_SECONDS = 7 * 24 * 60 * 60

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function decodeJson(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
}

function sign(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''))
  const rightBuffer = Buffer.from(String(right || ''))
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export function isValidMiniappSessionSecret(secret) {
  return typeof secret === 'string' && secret.length >= 32
}

export function createMiniappSessionToken({ openid, unionid = '', now = Date.now(), ttlSeconds = DEFAULT_TTL_SECONDS }, secret) {
  if (!isValidMiniappSessionSecret(secret)) throw new Error('MINIAPP_SESSION_SECRET must contain at least 32 characters')
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(String(openid || ''))) throw new Error('openid is invalid')

  const issuedAt = Math.floor(now / 1000)
  const safeTtl = Math.max(300, Math.min(Number(ttlSeconds) || DEFAULT_TTL_SECONDS, MAX_TTL_SECONDS))
  const header = encodeJson({ alg: 'HS256', typ: 'ZXS', v: TOKEN_VERSION })
  const payload = encodeJson({
    sub: openid,
    ...(unionid ? { uid: unionid } : {}),
    iat: issuedAt,
    exp: issuedAt + safeTtl,
    aud: 'zu-xiao-shen-miniapp',
  })
  const unsigned = `${header}.${payload}`
  return {
    token: `${unsigned}.${sign(unsigned, secret)}`,
    expiresAt: (issuedAt + safeTtl) * 1000,
  }
}

export function verifyMiniappSessionToken(token, secret, { now = Date.now() } = {}) {
  if (!isValidMiniappSessionSecret(secret)) return { ok: false, reason: 'session-not-configured' }
  const parts = String(token || '').split('.')
  if (parts.length !== 3) return { ok: false, reason: 'malformed' }

  const [headerPart, payloadPart, signature] = parts
  const unsigned = `${headerPart}.${payloadPart}`
  if (!safeEqual(signature, sign(unsigned, secret))) return { ok: false, reason: 'signature' }

  try {
    const header = decodeJson(headerPart)
    const payload = decodeJson(payloadPart)
    const nowSeconds = Math.floor(now / 1000)
    if (header?.alg !== 'HS256' || header?.typ !== 'ZXS' || header?.v !== TOKEN_VERSION) return { ok: false, reason: 'header' }
    if (payload?.aud !== 'zu-xiao-shen-miniapp') return { ok: false, reason: 'audience' }
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(String(payload?.sub || ''))) return { ok: false, reason: 'subject' }
    if (!Number.isFinite(payload?.exp) || payload.exp <= nowSeconds) return { ok: false, reason: 'expired' }
    if (!Number.isFinite(payload?.iat) || payload.iat > nowSeconds + 60) return { ok: false, reason: 'issued-at' }
    return { ok: true, openid: payload.sub, unionid: payload.uid || '', expiresAt: payload.exp * 1000 }
  } catch {
    return { ok: false, reason: 'payload' }
  }
}

export function getBearerToken(request) {
  const authorization = String(request?.get?.('authorization') || request?.headers?.authorization || '').trim()
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : ''
}

export function getCloudContainerIdentity(headers = {}, expectedAppId = '') {
  const directOpenid = String(headers['x-wx-openid'] || '').trim()
  const reusedOpenid = String(headers['x-wx-from-openid'] || '').trim()
  const openid = directOpenid || reusedOpenid
  if (!openid) return null

  const appId = String(directOpenid ? headers['x-wx-appid'] : headers['x-wx-from-appid'] || '').trim()
  if (!expectedAppId || appId !== expectedAppId || !/^[A-Za-z0-9_-]{8,128}$/.test(openid)) {
    const error = new Error('微信云托管用户身份校验失败')
    error.status = 401
    throw error
  }

  const unionid = String(directOpenid ? headers['x-wx-unionid'] : headers['x-wx-from-unionid'] || '').trim()
  return { openid, unionid: /^[A-Za-z0-9_-]{8,128}$/.test(unionid) ? unionid : '' }
}

export async function exchangeWechatLoginCode({
  code,
  appId,
  appSecret,
  fetchImpl = fetch,
  timeoutMs = 10_000,
}) {
  const safeCode = String(code || '').trim()
  if (!/^[A-Za-z0-9_-]{8,256}$/.test(safeCode)) {
    const error = new Error('微信登录凭证无效，请重新进入小程序后再试')
    error.status = 400
    throw error
  }
  if (!appId || !appSecret) {
    const error = new Error('微信登录服务尚未配置')
    error.status = 503
    throw error
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Math.max(1_000, Math.min(Number(timeoutMs) || 10_000, 30_000)))
  const query = new URLSearchParams({
    appid: appId,
    secret: appSecret,
    js_code: safeCode,
    grant_type: 'authorization_code',
  })

  try {
    const response = await fetchImpl(`https://api.weixin.qq.com/sns/jscode2session?${query}`, { signal: controller.signal })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || data.errcode || !data.openid) {
      const error = new Error(data.errmsg || '微信登录校验失败')
      error.status = response.ok ? 401 : 502
      error.code = data.errcode || 'wechat-upstream-error'
      throw error
    }
    return { openid: String(data.openid), unionid: String(data.unionid || '') }
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('微信登录服务响应超时，请稍后重试')
      timeoutError.status = 504
      throw timeoutError
    }
    if (error instanceof TypeError) {
      const networkError = new Error('微信登录服务网络连接失败，请稍后重试')
      networkError.status = 502
      networkError.cause = error
      throw networkError
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
