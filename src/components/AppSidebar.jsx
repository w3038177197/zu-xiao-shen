import {
  BadgeCheck,
  Bot,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  House,
  ShieldCheck,
} from 'lucide-react'

export default function AppSidebar({ activeTab, onSwitchModule }) {
  return (
    <aside className="sidebar" aria-label="租小审导航">
      <div className="brand">
        <div className="brand-mark">
          <ShieldCheck size={26} aria-hidden="true" />
        </div>
        <div className="brand-copy">
          <strong>租小审</strong>
          <span>租房全流程风控助手</span>
        </div>
      </div>

      <nav className="nav-list">
        <button
          className={activeTab === 'proposal' ? 'active' : ''}
          type="button"
          aria-current={activeTab === 'proposal' ? 'page' : undefined}
          onClick={() => onSwitchModule('proposal')}
        >
          <House size={18} aria-hidden="true" />
          首页
        </button>
        <button
          className={activeTab === 'subsidy' ? 'active' : ''}
          type="button"
          aria-current={activeTab === 'subsidy' ? 'page' : undefined}
          onClick={() => onSwitchModule('subsidy')}
        >
          <CircleDollarSign size={18} aria-hidden="true" />
          补贴匹配
        </button>
        <button
          className={activeTab === 'review' ? 'active' : ''}
          type="button"
          aria-current={activeTab === 'review' ? 'page' : undefined}
          onClick={() => onSwitchModule('review')}
        >
          <FileText size={18} aria-hidden="true" />
          租房审查
        </button>
        <button
          className={activeTab === 'checkin' ? 'active' : ''}
          type="button"
          aria-current={activeTab === 'checkin' ? 'page' : undefined}
          onClick={() => onSwitchModule('checkin')}
        >
          <BadgeCheck size={18} aria-hidden="true" />
          入住验房
        </button>
        <button
          className={activeTab === 'evidence' ? 'active' : ''}
          type="button"
          aria-current={activeTab === 'evidence' ? 'page' : undefined}
          onClick={() => onSwitchModule('evidence')}
        >
          <ClipboardCheck size={18} aria-hidden="true" />
          退租证据包
        </button>
        <button
          className={activeTab === 'ai' ? 'active' : ''}
          type="button"
          aria-current={activeTab === 'ai' ? 'page' : undefined}
          onClick={() => onSwitchModule('ai')}
        >
          <Bot size={18} aria-hidden="true" />
          AI 助手
        </button>
      </nav>

      <div className="sidebar-panel">
        <span className="panel-label">定位</span>
        <h2>社会服务赛道</h2>
        <p>帮租客在签字前看懂押金、涨租、维修和违约条款里的坑。</p>
      </div>
    </aside>
  )
}
