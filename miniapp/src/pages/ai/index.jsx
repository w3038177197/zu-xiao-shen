import { useEffect, useMemo, useState } from 'react'
import { Button, ScrollView, Text, Textarea, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { buildLocalReply, formatMessageBlocks } from '../../features/aiAssistant'
import { analyzeContract, cleanContractTextForReview, getRiskSummary } from '../../features/contractReview'
import './index.css'

const CONTRACT_KEY = 'zu-xiao-shen-contract-draft'
const CHAT_KEY = 'zu-xiao-shen-mini-ai-chat'
const quickPrompts = [
  '合同里押金条款应该重点看什么？',
  '房东要扣保洁费，我该怎么回复？',
  '入住验房需要拍哪些照片？',
  '毕业生租房补贴需要准备什么？',
]
const welcome = { role: 'assistant', content: '结论：我是租小审本地 AI，可以回答合同、押金、验房、退租证据和补贴问题。\n下一步：如果你已粘贴合同，我会自动结合本地审查结果回答。' }

function loadChat() {
  try {
    const saved = Taro.getStorageSync(CHAT_KEY)
    return Array.isArray(saved) && saved.length ? saved.slice(-40) : [welcome]
  } catch {
    return [welcome]
  }
}

function loadReviewContext() {
  try {
    const contractText = String(Taro.getStorageSync(CONTRACT_KEY) || '')
    if (!contractText.trim()) return { contractText: '', findings: [], summary: null }
    const findings = analyzeContract(cleanContractTextForReview(contractText))
    return { contractText, findings, summary: getRiskSummary(findings) }
  } catch {
    return { contractText: '', findings: [], summary: null }
  }
}

export default function AiAssistant() {
  const [messages, setMessages] = useState(loadChat)
  const [draft, setDraft] = useState('')
  const [context, setContext] = useState(loadReviewContext)

  useEffect(() => {
    try {
      Taro.setStorageSync(CHAT_KEY, messages.slice(-40))
    } catch {
      // Storage can be unavailable or full; the current chat remains usable.
    }
  }, [messages])

  Taro.useShareAppMessage(() => ({ title: '租小审：租房问题随时问', path: '/pages/ai/index' }))

  const contextLabel = useMemo(() => {
    if (!context.contractText) return '未关联合同'
    if (!context.summary) return '已关联合同正文'
    return `合同 ${context.summary.score} 分 · ${context.summary.label}`
  }, [context])

  const send = (value = draft) => {
    const prompt = value.trim()
    if (!prompt) return
    const nextContext = loadReviewContext()
    setContext(nextContext)
    const reply = buildLocalReply({ prompt, ...nextContext })
    setMessages((current) => [...current, { role: 'user', content: prompt }, { role: 'assistant', content: reply, meta: '本地知识库' }])
    setDraft('')
  }

  const clear = () => {
    Taro.showModal({
      title: '清空对话',
      content: '本机保存的聊天记录将被清空，是否继续？',
      success: ({ confirm }) => {
        if (confirm) setMessages([welcome])
      },
    })
  }

  const copyMessage = (content) => {
    Taro.setClipboardData({ data: content, success: () => Taro.showToast({ title: '回复已复制', icon: 'success' }) })
  }

  return (
    <View className='ai-page'>
      <View className='ai-hero'>
        <View><Text className='eyebrow'>租房 AI 助手</Text><Text className='page-title'>租房问题，直接问</Text><Text className='page-copy'>结合当前合同，给出证据清单、沟通话术和下一步。</Text></View>
        <View className='hero-badges'><Text className='local-badge'>仅本地分析</Text><Text className='context-badge'>{contextLabel}</Text></View>
      </View>
      <ScrollView className='chat-thread' scrollY scrollIntoView={`message-${messages.length - 1}`}>
        <View className='quick-list'>{quickPrompts.map((item) => <Text key={item} onClick={() => send(item)}>{item}</Text>)}</View>
        {messages.map((message, index) => <View id={`message-${index}`} key={`${message.role}-${index}`} className={`message ${message.role}`}>
          <View className='message-head'><Text className='message-role'>{message.role === 'user' ? '我' : `租小审 AI${message.meta ? ` · ${message.meta}` : ''}`}</Text>{message.role === 'assistant' && index > 0 ? <Text className='message-copy' onClick={() => copyMessage(message.content)}>复制</Text> : null}</View>
          {message.role === 'assistant' ? <View className='message-blocks'>{formatMessageBlocks(message.content).map((block, blockIndex) => <View className='message-block' key={blockIndex}>{block.title ? <Text className='block-title'>{block.title}</Text> : null}{block.lines.map((line, lineIndex) => <Text className='block-line' key={lineIndex}>{line}</Text>)}</View>)}</View> : <Text className='message-content'>{message.content}</Text>}
        </View>)}
      </ScrollView>
      <View className='composer'><Textarea value={draft} maxlength={1000} placeholder='输入合同条款或你的问题…' onInput={(event) => setDraft(event.detail.value)} /><View className='composer-actions'><Button onClick={clear}>重置</Button><Button className='send-button' disabled={!draft.trim()} onClick={() => send()}>发送</Button></View></View>
    </View>
  )
}
