import { X } from 'lucide-react'
import { proposalValueCards, riskGuideSteps } from '../data/proposalContent.jsx'

export default function RiskGuideModal({ closeRef, onClose, onJump }) {
  return (
    <div className="guide-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="guide-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="risk-guide-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="guide-header">
          <div>
            <p className="runtime-kicker">Flow Tutorial</p>
            <h2 id="risk-guide-title">租小审避坑流程</h2>
            <p>按四步完成一次租房风险检查，从找补贴到退租留证都能顺着走。</p>
          </div>
          <button
            className="guide-close"
            type="button"
            aria-label="关闭避坑流程教程"
            ref={closeRef}
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="guide-note" aria-label="给租小审用户的话">
          <div>
            <span>给正在使用租小审的你</span>
            <h3>先把眼前这一步看清楚</h3>
          </div>
          <p>
            不用一次弄懂所有租房规则。你只需要按当前阶段放入必要材料，系统会把合同风险、验房缺口、押金争议和补贴线索拆成能执行的下一步。重要决定仍以合同原文、书面沟通和当地政策为准，租小审帮你先看清、先留证、先沟通。
          </p>
        </div>

        <div className="guide-step-grid">
          {riskGuideSteps.map((item, index) => {
            const StepIcon = item.icon
            const entry = proposalValueCards[index]
            const EntryIcon = entry.icon
            return (
              <article className="guide-step" key={item.title}>
                <div className="guide-step-icon">
                  <StepIcon size={19} aria-hidden="true" />
                </div>
                <div className="guide-step-body">
                  <div>
                    <span>{item.step}</span>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                    <strong>{item.output}</strong>
                  </div>
                  <button className="guide-step-action" type="button" onClick={() => onJump(entry.tab)}>
                    <EntryIcon size={16} aria-hidden="true" />
                    <span>{entry.title}</span>
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
