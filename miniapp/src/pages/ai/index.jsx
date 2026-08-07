import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, ScrollView, Text, Textarea, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { buildLocalReply, formatMessageBlocks, loadAllModuleContext } from '../../features/aiAssistant'
import {
  buildRemoteAiPayload,
  getAvailableRemoteContextModules,
  getRemoteContextPreview,
  resolveRemoteContextModules,
} from '../../features/remoteAi'
import { REMOTE_AI_CONFIG, STORAGE_KEYS } from '../../constants/appConfig'
import { copyText } from '../../utils/copyText'
import { consumeAiTaskHandoff } from '../../utils/aiTaskHandoff'
import { hasHouseSwitchedSince } from '../../features/houseProfile'
import {
  clearMiniappSession,
  confirmRemoteConsent,
  fetchRemoteAiQuota,
  fetchRemoteAiServiceHealth,
  getRemoteAiError,
  getRemoteAiServiceState,
  getStoredRemoteAiQuota,
  hasRemoteConsent,
  startRemoteAiRequest,
} from '../../utils/remoteAiRequest'
import './index.css'

const quickPrompts = [
  '合同里押金条款应该重点看什么？',
  '房东要扣保洁费，我该怎么回复？',
  '入住验房需要拍哪些照片？',
  '毕业生租房补贴需要准备什么？',
]
const welcome = {
  role: 'assistant',
  content: '你好，我是租小审。可以问我合同、验房、押金、退租证据和补贴问题。\n我会优先联网回答；不可用时自动切换本地分析。',
  meta: '租房助手',
}

function loadChat() {
  try {
    const saved = Taro.getStorageSync(STORAGE_KEYS.aiChat)
    return Array.isArray(saved) && saved.length ? saved.slice(-40) : [welcome]
  } catch {
    return [welcome]
  }
}

export default function AiAssistant() {
  const [messages, setMessages] = useState(loadChat)
  const [draft, setDraft] = useState('')
  const [context, setContext] = useState(loadAllModuleContext)
  const [remoteConsent, setRemoteConsent] = useState(hasRemoteConsent)
  const [selectedContextModules, setSelectedContextModules] = useState([])
  const [isSending, setIsSending] = useState(false)
  const [quota, setQuota] = useState(getStoredRemoteAiQuota)
  const [lastFailed, setLastFailed] = useState(null)
  const [statusHint, setStatusHint] = useState('')
  const [serviceStatus, setServiceStatus] = useState(getRemoteAiServiceState)
  const [serviceReady, setServiceReady] = useState(null)
  const [showContextOptions, setShowContextOptions] = useState(false)
  const pendingRef = useRef(null)
  const sendPreparingRef = useRef(false)
  // 记录页面最近一次可见时间，用于检测房源切换后重载聊天记录。
  // AI 页是 navigateTo 进入不销毁，切换房源后若不重载 messages，
  // 旧房源聊天会随 useEffect [messages] 写回 storage，覆盖新房源 aiChat。
  const loadedAtRef = useRef(Date.now())

  useEffect(() => {
    try {
      Taro.setStorageSync(STORAGE_KEYS.aiChat, messages.slice(-40))
    } catch {
      // Storage can be unavailable or full; the current chat remains usable.
    }
  }, [messages])

  useEffect(() => () => pendingRef.current?.cancel(), [])

  useEffect(() => {
    let active = true
    fetchRemoteAiServiceHealth().then((health) => {
      if (!active) return null
      if (!health.supportsMiniappApi) {
        setServiceReady(false)
        setStatusHint('联网后端版本待部署，当前继续使用本地分析')
        return null
      }
      if (!health.authConfigured) {
        setServiceReady(false)
        setStatusHint('微信登录服务尚未配置，当前继续使用本地分析')
        return null
      }
      if (!health.modelConfigured) {
        setServiceReady(false)
        setStatusHint('模型服务尚未配置，当前继续使用本地分析')
        return null
      }
      setServiceReady(true)
      return hasRemoteConsent() ? fetchRemoteAiQuota() : null
    }).then((nextQuota) => {
      if (!nextQuota) return
      if (!active) return
      setQuota(nextQuota)
      setServiceStatus(getRemoteAiServiceState())
      setStatusHint('')
    }).catch((error) => {
      if (!active) return
      const detail = getRemoteAiError(error)
      setServiceReady(null)
      setServiceStatus(getRemoteAiServiceState())
      setStatusHint(`联网状态暂不可确认：${detail.message}；发送时会直接尝试联网`)
    })
    return () => { active = false }
  }, [])

  Taro.useShareAppMessage(() => ({ title: '租小审：租房问题随时问', path: '/pages/ai/index' }))
  Taro.useDidShow(() => {
    // 房源切换重载：与合同/验房/证据/补贴页保持一致，避免跨房源聊天串档
    if (hasHouseSwitchedSince(loadedAtRef.current)) {
      setMessages(loadChat())
    }
    loadedAtRef.current = Date.now()
    const nextContext = loadAllModuleContext()
    const task = consumeAiTaskHandoff()
    setContext(nextContext)
    const availableModules = getAvailableRemoteContextModules(nextContext).map((item) => item.key)
    if (!task) {
      setSelectedContextModules(availableModules)
      return
    }
    const available = new Set(availableModules)
    const selectedModules = task.modules.filter((key) => available.has(key))
    setDraft(task.prompt)
    setSelectedContextModules(selectedModules)
    setShowContextOptions(true)
    setStatusHint(selectedModules.length
      ? `${task.label}已准备，请确认资料范围后发送`
      : `${task.label}已准备，当前没有可携带的模块资料`)
  })

  const contextLabel = useMemo(() => {
    const resolved = resolveRemoteContextModules(context, selectedContextModules)
    if (resolved.length) return `已选择 ${resolved.length} 类资料`
    return '仅发送当前问题'
  }, [context, selectedContextModules])

  const availableRemoteModules = useMemo(() => getAvailableRemoteContextModules(context), [context])
  const effectiveContextModules = useMemo(
    () => resolveRemoteContextModules(context, selectedContextModules),
    [context, selectedContextModules]
  )

  useEffect(() => {
    const availableKeys = availableRemoteModules.map((item) => item.key)
    const available = new Set(availableKeys)
    setSelectedContextModules((current) => {
      const next = current.filter((key) => available.has(key))
      return next.length ? next : availableKeys
    })
  }, [availableRemoteModules])

  const appendRemoteReply = (result) => {
    setMessages((current) => [...current, {
      role: 'assistant',
      content: result.reply,
      meta: 'AI生成 · 联网',
      aiGenerated: true,
      citations: result.citations,
    }])
    setQuota(result.quota)
    setLastFailed(null)
    setServiceReady(true)
    setStatusHint(result.replayed ? '已恢复上次联网回答，未重复消耗额度' : '')
  }

  const runRemote = async ({ payload, prompt, currentContext, addFallback, force = false }) => {
    setIsSending(true)
    setStatusHint('正在连接联网 AI…')
    const request = startRemoteAiRequest(payload, { force })
    pendingRef.current = request
    try {
      appendRemoteReply(await request.promise)
      setServiceStatus(getRemoteAiServiceState())
    } catch (error) {
      const detail = getRemoteAiError(error)
      setServiceStatus(getRemoteAiServiceState())
      setServiceReady(false)
      if (detail.quota) setQuota(detail.quota)
      if (detail.cancelled) {
        setStatusHint('已取消联网回答')
        return
      }

      const fallback = buildLocalReply({ prompt, context: currentContext })
      if (addFallback) {
        setMessages((current) => [...current, { role: 'assistant', content: fallback, meta: '本地降级' }])
      }
      setLastFailed(detail.retryable ? { payload, prompt, currentContext } : null)
      setStatusHint(detail.code === 'quota'
        ? '今日联网额度已用完，已使用本地回答'
        : detail.code === 'service-cooldown'
          ? `${detail.message}`
          : `${detail.message}，已使用本地回答`)
      Taro.showToast({ title: detail.code === 'quota' ? '今日额度已用完' : '联网失败，已本地回答', icon: 'none' })
    } finally {
      if (pendingRef.current === request) pendingRef.current = null
      setIsSending(false)
    }
  }

  const send = async (value = draft) => {
    const prompt = value.trim()
    if (!prompt || isSending || sendPreparingRef.current) return
    sendPreparingRef.current = true
    try {
      const nextContext = loadAllModuleContext()
      setContext(nextContext)
      setDraft('')
      setLastFailed(null)

      if (!REMOTE_AI_CONFIG.enabled) {
        const reply = buildLocalReply({ prompt, context: nextContext })
        setMessages((current) => [...current, { role: 'user', content: prompt }, { role: 'assistant', content: reply, meta: '本地降级' }])
        setStatusHint('联网 AI 未启用，本次已使用本地回答')
        return
      }

      try {
        if (!await confirmRemoteConsent()) {
          const reply = buildLocalReply({ prompt, context: nextContext })
          setMessages((current) => [...current, { role: 'user', content: prompt }, { role: 'assistant', content: reply, meta: '本地分析' }])
          setStatusHint('未启用联网 AI，本次已使用本地回答')
          return
        }
        setRemoteConsent(true)
      } catch {
        const reply = buildLocalReply({ prompt, context: nextContext })
        setMessages((current) => [...current, { role: 'user', content: prompt }, { role: 'assistant', content: reply, meta: '本地降级' }])
        setStatusHint('联网授权未完成，本次已使用本地回答')
        return
      }

      const contextModules = resolveRemoteContextModules(nextContext, selectedContextModules)
      const payload = buildRemoteAiPayload({ prompt, messages, context: nextContext, selectedModules: contextModules })
      setMessages((current) => [...current, { role: 'user', content: prompt }])
      if (contextModules.length && !selectedContextModules.length) {
        setSelectedContextModules(contextModules)
        setStatusHint('已自动携带当前房源可用资料摘要，不发送合同全文、照片或附件')
      }
      await runRemote({ payload, prompt, currentContext: nextContext, addFallback: true })
    } finally {
      sendPreparingRef.current = false
    }
  }

  const revokeRemote = () => {
    Taro.showModal({
      title: '撤销联网 AI 授权',
      content: '将退出联网模式，并清除本机保存的短期登录会话。以后仍可重新启用。',
      confirmText: '确认撤销',
      confirmColor: '#8a453e',
      success: ({ confirm }) => {
        if (!confirm) return
        clearMiniappSession()
        try {
          Taro.removeStorageSync(STORAGE_KEYS.aiRemoteConsent)
          Taro.removeStorageSync(STORAGE_KEYS.aiMode)
        } catch { /* The in-memory consent still changes immediately. */ }
        setRemoteConsent(false)
        setSelectedContextModules([])
        setQuota(null)
        setStatusHint('已撤销联网授权，下次发送前会再次询问')
      },
    })
  }

  const retryRemote = async () => {
    if (!lastFailed || isSending) return
    await runRemote({ ...lastFailed, addFallback: false, force: true })
  }

  const cancelRemote = () => {
    pendingRef.current?.cancel()
  }

  const clear = () => {
    Taro.showModal({
      title: '清空对话',
      content: '本机保存的聊天记录将被清空，是否继续？',
      success: ({ confirm }) => {
        if (!confirm) return
        pendingRef.current?.cancel()
        setMessages([welcome])
        setLastFailed(null)
        setStatusHint('')
      },
    })
  }

  const copyMessage = (message) => {
    const prefix = message.aiGenerated ? '【AI生成内容，仅供参考】\n' : ''
    const references = message.citations?.length
      ? `\n\n参考来源：\n${message.citations.map((item) => `- ${item.title} · ${item.source}${item.sourceUrl ? `\n  ${item.sourceUrl}` : ''}`).join('\n')}`
      : ''
    copyText(`${prefix}${message.content}${references}`, '回复与来源已复制')
  }

  const showModeInfo = () => {
    Taro.showModal({
      title: 'AI 数据范围',
      content: `本次发送内容预览：\n\n${getRemoteContextPreview(context, effectiveContextModules)}\n\n不会发送合同全文、照片内容、附件文件或本地文件路径；手机号、证件号、银行卡号、邮箱、姓名和地址会在本机及服务端再次脱敏。联网不可用时自动使用本地分析。`,
      showCancel: false,
    })
  }

  const toggleRemoteContext = (key) => {
    if (isSending) return
    setSelectedContextModules((current) => current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key])
  }

  return (
    <View className='ai-page'>
      <View className='context-strip'>
        <View className='context-top'>
          <View className='context-mode'><Text className={`status-dot ${serviceReady === null ? 'checking' : serviceReady === false ? 'fallback' : 'remote'}`} /><Text>{serviceReady === null ? '正在检查 AI 服务' : '联网 AI · 失败自动本地'}</Text></View>
          <Button className='context-scope' aria-expanded={showContextOptions} onClick={() => setShowContextOptions((current) => !current)}>资料范围 · {effectiveContextModules.length}</Button>
          <Button className='context-clear' aria-label='清空对话' disabled={messages.length === 1 && !isSending} onClick={clear}>清空</Button>
        </View>
        {showContextOptions ? <View className='remote-options'>
          <View className='remote-options-head'>
            <Text className='remote-options-title'>{contextLabel}</Text>
            <Button className='context-preview' disabled={isSending} onClick={showModeInfo}>发送前预览</Button>
          </View>
          {availableRemoteModules.length ? <ScrollView className='remote-module-scroll' scrollX enhanced showScrollbar={false}>
            <View className='remote-module-list'>
              {availableRemoteModules.map((item) => {
                const selected = selectedContextModules.includes(item.key)
                return <Button key={item.key} className={`summary-toggle ${selected ? 'active' : ''}`} aria-checked={selected} disabled={isSending} onClick={() => toggleRemoteContext(item.key)}>{selected ? '✓ ' : ''}{item.label}</Button>
              })}
            </View>
          </ScrollView> : <Text className='remote-context-empty'>当前没有可携带的业务资料，仍可直接提问</Text>}
          <View className='remote-meta-row'>
            {quota
              ? <Text className='quota-label'>今日剩余 {quota.remaining}/{quota.limit}</Text>
              : <Text className='quota-label'>{serviceReady === false ? '额度未连接' : '发送时连接服务'}</Text>}
            {serviceReady === false ? <Text className='service-unavailable'>自动本地保障</Text> : null}
            {serviceStatus.coolingDown ? <Text className='service-degraded'>服务降级 {serviceStatus.retryAfterSeconds}s</Text> : null}
            {remoteConsent ? <Button className='remote-revoke' disabled={isSending} onClick={revokeRemote}>撤销授权</Button> : null}
          </View>
        </View> : null}
      </View>
      <ScrollView className='chat-thread' scrollY enhanced showScrollbar={false} scrollWithAnimation scrollIntoView={`message-${messages.length - 1}`}>
        {messages.map((message, index) => <View id={`message-${index}`} key={`${message.role}-${index}`} className={`message ${message.role}`}>
          {message.role === 'assistant' ? <View className='message-head'><Text className='message-role'>租小审 · {message.meta || '助手'}</Text></View> : null}
          {message.role === 'assistant' ? <View className='message-blocks'>{formatMessageBlocks(message.content).map((block, blockIndex) => <View className='message-block' key={blockIndex}>{block.title ? <Text className='block-title'>{block.title}</Text> : null}{block.lines.map((line, lineIndex) => <Text className='block-line' key={lineIndex}>{line}</Text>)}</View>)}</View> : <Text className='message-content'>{message.content}</Text>}
          {message.citations?.length ? <View className='citation-list'><Text className='citation-title'>参考来源</Text>{message.citations.map((citation) => <View className='citation-row' key={`${citation.id}-${citation.title}`}><Text className='citation-item'>{citation.title} · {citation.source}</Text>{citation.sourceUrl ? <Button className='citation-copy' aria-label={`复制来源：${citation.title}`} onClick={() => copyText(citation.sourceUrl, '来源链接已复制')}>复制链接</Button> : null}</View>)}</View> : null}
          {message.role === 'assistant' && index > 0 ? <View className='message-actions'><Button className='message-copy' aria-label='复制回复' onClick={() => copyMessage(message)}>复制回复</Button></View> : null}
        </View>)}
        {isSending ? <View className='message assistant pending-message'><Text className='message-role'>租小审 · AI生成</Text><Text className='pending-copy'>正在核对资料并生成回答…</Text></View> : null}
        {messages.length === 1 ? <View className='quick-panel'><Text className='quick-title'>你可以这样问</Text><View className='quick-list'>{quickPrompts.map((item) => <Button key={item} onClick={() => send(item)}>{item}</Button>)}</View></View> : null}
      </ScrollView>
      {lastFailed ? <View className='retry-strip'><Text>联网回答未完成，当前已保留本地结果</Text><Button disabled={isSending} onClick={retryRemote}>重试联网</Button></View> : null}
      <View className='composer'>
        <View className='composer-row'>
          <Textarea className='composer-input' aria-label='输入租房问题' name='aiPrompt' value={draft} maxlength={1000} adjustPosition cursorSpacing={20} showConfirmBar={false} confirmType='send' disabled={isSending} placeholder='输入合同条款或你的问题…' onInput={(event) => setDraft(event.detail.value)} onConfirm={() => send()} />
          <Button className={isSending ? 'send-button cancel' : 'send-button'} aria-label={isSending ? '取消联网回答' : '发送消息'} disabled={!isSending && !draft.trim()} onClick={isSending ? cancelRemote : () => send()}>{isSending ? '停' : '↑'}</Button>
        </View>
        <Text className='composer-note'>{statusHint || `优先联网 AI · ${effectiveContextModules.length ? `携带 ${effectiveContextModules.length} 类已预览资料` : '失败自动本地回答'}`}</Text>
      </View>
    </View>
  )
}
