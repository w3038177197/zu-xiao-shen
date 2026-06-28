import { ArrowRight, Bot, ShieldCheck } from 'lucide-react'
import { proposalNextIdeas, proposalValueCards } from '../data/proposalContent.jsx'
import { formatMoney } from '../utils/money.js'

export default function ProposalHome({
  depositInputs,
  depositResult,
  onDepositInputChange,
  onEnterModule,
  onOpenAiExpert,
}) {
  return (
    <div className="proposal-layout">
      <section className="proposal-card proposal-hero">
        <div className="proposal-hero-copy">
          <p className="section-kicker">使用总览</p>
          <h2>租小审：租房全流程风控助手</h2>
          <p>
            给普通租客的签约、入住、退租和补贴申请助手，把复杂风险翻成能直接行动的下一步。
          </p>
          <div className="proposal-action-row">
            <button className="primary-button proposal-primary-action" type="button" onClick={() => onEnterModule('review')}>
              立即体验租房审查
              <ArrowRight size={17} aria-hidden="true" />
            </button>
            <button className="ghost-button proposal-secondary-action" type="button" onClick={onOpenAiExpert}>
              打开系统 AI 助手
              <Bot size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="proposal-reliability-note" aria-label="模型兜底说明">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>即使线上模型接口暂不可用，合同风险识别仍会使用本地规则和知识库继续演示。</span>
          </div>
          <div className="proposal-tag-row" aria-label="项目关键词">
            <span>社会服务</span>
            <span>租客权益</span>
            <span>AI 风控</span>
          </div>
        </div>
        <aside className="proposal-brief-panel" aria-label="项目定位">
          <span>项目一句话</span>
          <strong>先看懂合同，再决定怎么签。</strong>
          <p>不是替用户打官司，而是在损失发生前提醒：哪条有问题、为什么有问题、下一步怎么谈。</p>
          <dl>
            <div>
              <dt>服务对象</dt>
              <dd>毕业生、第一次租房人群、租房弱势群体</dd>
            </div>
            <div>
              <dt>核心价值</dt>
              <dd>看懂条款、保留证据、少丢押金</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="proposal-card proposal-focus">
        <div className="proposal-section-head compact">
          <div>
            <span>核心入口</span>
            <h2>从首页直接进入四个核心模块</h2>
          </div>
        </div>
        <div className="proposal-focus-grid" aria-label="项目核心入口">
          {proposalValueCards.map((card) => {
            const Icon = card.icon
            return (
              <button className="proposal-focus-item" key={card.title} type="button" onClick={() => onEnterModule(card.tab)}>
                <span>{card.label}</span>
                <Icon size={21} aria-hidden="true" />
                <strong>{card.title}</strong>
                <p>{card.text}</p>
              </button>
            )
          })}
        </div>
      </section>

      <section className="proposal-card proposal-buildout">
        <div className="proposal-section-head compact">
          <div>
            <span>延展方向</span>
            <h2>核心链路已完成，后续继续围绕退租押金做深</h2>
          </div>
        </div>
        <div className="proposal-buildout-grid">
          <div className="proposal-deposit-panel">
            <div className="deposit-prototype" aria-label="押金计算器">
              <div>
                <span>退租押金计算器</span>
                <strong>预计应退押金：{formatMoney(depositResult.estimatedReturn)}</strong>
                <p>{depositResult.warning}</p>
                <em>预计可扣：{formatMoney(depositResult.totalDeduction)}</em>
              </div>
              <div className="deposit-grid">
                <label>
                  <span>押金金额</span>
                  <input
                    inputMode="decimal"
                    value={depositInputs.depositAmount}
                    onChange={(event) => onDepositInputChange('depositAmount', event.target.value)}
                  />
                </label>
                <label>
                  <span>未结清费用</span>
                  <input
                    inputMode="decimal"
                    value={depositInputs.unpaidFees}
                    onChange={(event) => onDepositInputChange('unpaidFees', event.target.value)}
                  />
                </label>
                <label>
                  <span>维修扣款</span>
                  <input
                    inputMode="decimal"
                    value={depositInputs.repairCost}
                    onChange={(event) => onDepositInputChange('repairCost', event.target.value)}
                  />
                </label>
                <label>
                  <span>保洁扣款</span>
                  <input
                    inputMode="decimal"
                    value={depositInputs.cleaningCost}
                    onChange={(event) => onDepositInputChange('cleaningCost', event.target.value)}
                  />
                </label>
                <label>
                  <span>是否有票据</span>
                  <select value={depositInputs.hasVoucher} onChange={(event) => onDepositInputChange('hasVoucher', event.target.value)}>
                    <option value="no">无票据或清单</option>
                    <option value="yes">有照片、清单和票据</option>
                  </select>
                </label>
                <label>
                  <span>是否正常损耗</span>
                  <select value={depositInputs.normalWear} onChange={(event) => onDepositInputChange('normalWear', event.target.value)}>
                    <option value="yes">是，仅正常使用损耗</option>
                    <option value="no">否，存在非正常损坏</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
          <div className="proposal-next-list" aria-label="继续开发想法">
            {proposalNextIdeas.map((item, index) => (
              <div className="proposal-next-item" key={item}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>
        <a className="trae-link-button secondary" href="https://www.trae.cn/community" target="_blank" rel="noreferrer">
          查看项目参赛入口
          <ArrowRight size={16} aria-hidden="true" />
        </a>
      </section>
    </div>
  )
}
