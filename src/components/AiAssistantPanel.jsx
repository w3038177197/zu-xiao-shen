import { Bot, EyeOff, PlugZap, Send } from 'lucide-react'
import { workflowLabels } from '../constants/appConfig.js'
import { aiResponseSkills } from '../data/knowledgeBase.js'
import { getPlatformApiEndpoint } from '../features/aiAssistant.js'
import AiMessageContent from './AiMessageContent.jsx'

export default function AiAssistantPanel({
  activeTab,
  aiConfig,
  aiDraft,
  aiFeedback,
  aiFeedbackText,
  aiKnowledgeHits,
  aiMessages,
  aiSending,
  modelConnectionLabel,
  onClose,
  onDraftChange,
  onRateMessage,
  onResetChat,
  onSendDraft,
}) {
  return (
    <section className="ai-chat-panel runtime-api-panel" aria-label="租房专家 AI 对话">
      <div className="ai-chat-header">
        <div className="ai-config-title">
          <span className="ai-config-icon">
            <Bot size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="runtime-kicker">System Copilot</p>
            <h2>租小审系统 AI</h2>
            <p>已接入合同审查、退租证据包、入住验房、押金估算和补贴匹配，会自动读取当前系统上下文。</p>
          </div>
        </div>
        <div className="ai-config-status">
          <span className="model-status">
            <PlugZap size={16} aria-hidden="true" />
            {modelConnectionLabel}
          </span>
          <button className="ghost-button compact-button" type="button" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>

      <div className="ai-chat-meta">
        <span>后端代理：{getPlatformApiEndpoint()}</span>
        <span>当前模块：{workflowLabels[activeTab] || activeTab}</span>
        <span>身份：租小审系统助手</span>
        <span>回复技能：{aiResponseSkills.length} 个</span>
        <span>知识库命中：{aiKnowledgeHits.length ? `${aiKnowledgeHits.length} 条` : '待检索'}</span>
        <span>{aiFeedbackText}</span>
        <span>默认模型：{aiConfig.model}</span>
      </div>

      <div className="ai-chat-thread" aria-label="AI 对话记录">
        {aiMessages.map((message) => (
          <article key={message.id} className={`ai-chat-bubble ${message.role === 'user' ? 'user' : 'assistant'} ${message.pending ? 'pending' : ''}`}>
            <span>{message.role === 'user' ? '我' : '租房专家 AI'}</span>
            <AiMessageContent content={message.content} />
            {message.role === 'assistant' && !message.pending && message.id !== 'assistant-welcome' ? (
              <div className="ai-feedback" aria-label="AI 回复反馈">
                <button
                  className={aiFeedback.byMessage[message.id] === 'helpful' ? 'active' : ''}
                  type="button"
                  onClick={() => onRateMessage(message.id, 'helpful')}
                >
                  有帮助
                </button>
                <button
                  className={aiFeedback.byMessage[message.id] === 'needsWork' ? 'active' : ''}
                  type="button"
                  onClick={() => onRateMessage(message.id, 'needsWork')}
                >
                  需改进
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <div className="ai-chat-composer">
        <textarea
          value={aiDraft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="直接问系统 AI，比如：结合当前页面，我下一步应该先处理什么？"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              onSendDraft()
            }
          }}
        />
        <div className="config-actions ai-chat-actions">
          <button className="ghost-button" type="button" onClick={onResetChat} disabled={aiSending}>
            清空对话
          </button>
          <button className="primary-button" type="button" onClick={onSendDraft} disabled={aiSending || !aiDraft.trim()}>
            <Send size={17} aria-hidden="true" />
            {aiSending ? '发送中...' : '发送'}
          </button>
        </div>
      </div>

      <div className="security-callout">
        <EyeOff size={17} aria-hidden="true" />
        <span>这里不再让用户选模型或填 Key。AI 会通过后端模型读取当前系统上下文并给出建议。</span>
      </div>
    </section>
  )
}
