import { useState } from 'react'
import { Button, ScrollView, Text, Textarea, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.css'

const quickPrompts = [
  '合同里押金条款应该重点看什么？',
  '房东要扣保洁费，我该怎么回复？',
  '入住验房需要拍哪些照片？',
  '毕业生租房补贴需要准备什么？',
]

const welcome = { role: 'assistant', content: '我是租小审系统 AI。你可以直接问合同审查、押金扣款、入住验房、退租证据和补贴申请。当前默认仅在本地生成建议。' }

function localReply(prompt) {
  if (/押金|扣款|保洁/.test(prompt)) return '先要求对方提供扣款项目、金额、现场照片、维修或保洁清单及有效票据。正常使用损耗不应直接从押金中扣除。建议书面回复：“我愿意配合合理核验，请先提供逐项明细和凭证；无凭证或属于正常损耗的项目，请勿从押金中扣除。”'
  if (/验房|照片|入住/.test(prompt)) return '优先拍摄带时间信息的全景和近景：墙面地面、门窗锁具、水电燃气表、卫浴渗漏、厨房设备、家具家电序列号。发现瑕疵时同时拍位置全景和细节，并在当天用微信发给房东确认。'
  if (/补贴|毕业|社保/.test(prompt)) return '先确认城市、毕业年份和学历，再准备身份证明、学历证明、劳动合同、社保记录、租赁合同和无房证明。政策变化快，请到“补贴匹配”页复制官方入口并核对最新申报窗口。'
  if (/合同|条款|签/.test(prompt)) return '先逐条检查押金退还期限、租期内涨租、维修责任、出租方入户、提前解除、违约金、费用凭证和争议管辖。尤其警惕“出租方单方认定”“押金不退”“无需通知即可入户”等不对等表述。'
  return '建议先判断问题处于签约、入住、居住中还是退租阶段，再收集合同原文、付款凭证、现场照片和书面沟通。把具体条款或扣款明细发来，我可以继续按“风险、证据、行动、话术”帮你拆解。'
}

export default function AiAssistant() {
  const [messages, setMessages] = useState([welcome])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const send = (value = draft) => {
    const prompt = value.trim()
    if (!prompt || sending) return
    const userMessage = { role: 'user', content: prompt }
    setSending(true)
    setMessages((current) => [...current, userMessage])
    setDraft('')
    setTimeout(() => {
      setMessages((current) => [...current, { role: 'assistant', content: localReply(prompt) }])
      setSending(false)
    }, 350)
  }

  const clear = () => {
    setMessages([welcome])
    Taro.showToast({ title: '对话已重置', icon: 'success' })
  }

  return (
    <View className='ai-page'>
      <View className='ai-hero'><View><Text className='eyebrow'>租房 AI 助手</Text><Text className='page-title'>租房问题，直接问</Text><Text className='page-copy'>围绕当前租房阶段给出能执行的证据清单、沟通话术和下一步。</Text></View><Text className='local-badge'>仅本地分析</Text></View>
      <ScrollView className='chat-thread' scrollY scrollIntoView={`message-${messages.length - 1}`}>
        <View className='quick-list'>{quickPrompts.map((item) => <Text key={item} onClick={() => send(item)}>{item}</Text>)}</View>
        {messages.map((message, index) => <View id={`message-${index}`} key={`${message.role}-${index}`} className={`message ${message.role}`}><Text className='message-role'>{message.role === 'user' ? '我' : '租小审 AI'}</Text><Text className='message-content'>{message.content}</Text></View>)}
        {sending && <View className='message assistant'><Text className='message-role'>租小审 AI</Text><Text className='message-content'>正在整理建议…</Text></View>}
      </ScrollView>
      <View className='composer'><Textarea value={draft} maxlength={1000} placeholder='输入合同条款、扣款明细或你的问题…' onInput={(event) => setDraft(event.detail.value)} /><View className='composer-actions'><Button onClick={clear}>重置</Button><Button className='send-button' disabled={!draft.trim() || sending} onClick={() => send()}>发送</Button></View></View>
    </View>
  )
}
