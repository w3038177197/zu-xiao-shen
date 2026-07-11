import {
  BadgeCheck,
  Bot,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  House,
  ShieldCheck,
} from 'lucide-react'

export default function AppSidebar({ activeTab, localOnlyMode, onClearAllData, onExportAllData, onSwitchModule, onToggleLocalOnly }) {
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
      <div className="sidebar-data-tools" aria-label="本地数据与隐私设置">
        <label className="privacy-toggle">
          <input type="checkbox" checked={localOnlyMode} onChange={(event) => onToggleLocalOnly(event.target.checked)} />
          <span>仅本地分析</span>
        </label>
        <small>{localOnlyMode ? '合同与对话不会发送到远端 AI；图片 OCR 使用本地浏览器处理。' : '开启后可避免合同正文和对话离开当前设备。'}</small>
        <div className="sidebar-data-actions">
          <button type="button" onClick={onExportAllData}>导出全部本地数据</button>
          <button type="button" onClick={onClearAllData}>清除全部数据</button>
        </div>
      </div>
    </aside>
  )
}
