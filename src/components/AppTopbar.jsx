import { Settings } from 'lucide-react'

function getTopbarCopy(activeTab, { findingsCount, revisionItemsCount }) {
  return {
    review: {
      kicker: 'Rental Contract Copilot',
      title: '租房签字前，先让 AI 帮你看一遍',
      subtitle: '聚焦押金、涨租、维修、入户、管辖和违约金，把租房合同里的坑讲成大白话。',
      stage: '合同审查',
      state: `${findingsCount} 个风险点`,
      action: revisionItemsCount ? `${revisionItemsCount} 条已采纳建议` : '可生成审查报告',
    },
    evidence: {
      kicker: 'Move-out Evidence Kit',
      title: '退租前，把证据包整理好',
      subtitle: '把合同、照片、沟通记录和费用凭证整理成可导出的证据摘要，减少押金争议中的材料遗漏。',
      stage: '退租证据包',
      state: '证据材料整理',
      action: '合同、照片和沟通记录统一汇总',
    },
    checkin: {
      kicker: 'Check-in Inspection',
      title: '入住当天先验房，退租时才有底稿',
      subtitle: '按房间记录墙面、门窗、家具家电和水电燃气状态，生成可发给房东确认的验房报告。',
      stage: '入住验房',
      state: '入住状态基准',
      action: '生成可确认的验房记录',
    },
    subsidy: {
      kicker: 'Rental Subsidy',
      title: '毕业生租房补贴，先把线索筛出来',
      subtitle: '按城市和个人情况匹配补贴线索，只展示当前城市，避免不同地区政策混在一起。',
      stage: '补贴匹配',
      state: '城市政策线索',
      action: '只展示当前城市官方入口',
    },
    proposal: {
      kicker: '首页',
      title: '租小审使用总览',
      subtitle: '先选择当前租房阶段，再进入补贴、审查、验房或退租证据处理。',
      stage: '使用总览',
      state: '四个模块入口',
      action: '串联审查、验房、证据和补贴',
    },
  }[activeTab]
}

export default function AppTopbar({ activeTab, findingsCount, revisionItemsCount, onOpenAiExpert }) {
  const topbarCopy = getTopbarCopy(activeTab, { findingsCount, revisionItemsCount })

  return (
    <header className="topbar">
      <div className="hero-copy">
        <p className="section-kicker">{topbarCopy.kicker}</p>
        <h1>{topbarCopy.title}</h1>
        <p className="hero-subtitle">{topbarCopy.subtitle}</p>
      </div>
      <div className="topbar-actions">
        <button className="runtime-status-button" type="button" onClick={onOpenAiExpert}>
          <span className="runtime-dot" aria-hidden="true" />
          <span>系统 AI 助手</span>
          <Settings size={15} aria-hidden="true" />
        </button>
        <div className="module-status-card" aria-label="当前模块状态">
          <span>{topbarCopy.stage}</span>
          <strong>{topbarCopy.state}</strong>
          <p>{topbarCopy.action}</p>
        </div>
      </div>
    </header>
  )
}
