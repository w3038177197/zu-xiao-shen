import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BadgeCheck, Check, ClipboardCheck, Download, FileDiff, MessageSquareText, Sparkles } from 'lucide-react'
import { STORAGE_KEYS } from '../constants/appConfig.js'
import { copyTextToClipboard } from '../utils/clipboard.js'
import { LegalDisclaimer } from './ReviewAtoms.jsx'
import {
  buildEvidenceCommunication,
  createDefaultEvidencePackState,
  createEvidencePackageText,
  evidenceActions,
  evidenceGroupMeta,
  evidenceToolTabs,
  getEvidenceGapAdvice,
  loadEvidencePackState,
} from '../features/evidencePack.js'

export default function EvidencePack({ onStatus }) {
  const [initialState] = useState(() => loadEvidencePackState())
  const [tab, setTab] = useState('info')
  const [toolType, setToolType] = useState('deposit')
  const [formData, setFormData] = useState(initialState.formData)
  const [evidence, setEvidence] = useState(initialState.evidence)
  const [actions, setActions] = useState(initialState.actions)
  const [communicationText, setCommunicationText] = useState(initialState.communicationText)
  const [isExportingEvidenceDocx, setIsExportingEvidenceDocx] = useState(false)

  const evidenceStats = useMemo(() => {
    const values = Object.values(evidence).flat()
    const checked = values.filter(Boolean).length
    const total = values.length
    return {
      checked,
      total,
      percent: total ? Math.round((checked / total) * 100) : 0,
    }
  }, [evidence])
  const evidenceAdvice = useMemo(() => getEvidenceGapAdvice(evidenceStats, evidence), [evidenceStats, evidence])
  const evidencePackageText = useMemo(
    () => createEvidencePackageText({ formData, evidence, actions, communicationText }),
    [actions, communicationText, evidence, formData],
  )

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.evidencePack, JSON.stringify({ formData, evidence, actions, communicationText }))
  }, [actions, communicationText, evidence, formData])

  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }))
  }

  const toggleEvidence = (group, index) => {
    setEvidence((current) => ({
      ...current,
      [group]: current[group].map((value, currentIndex) => (currentIndex === index ? !value : value)),
    }))
  }

  const toggleAction = (index) => {
    setActions((current) => current.map((value, currentIndex) => (currentIndex === index ? !value : value)))
  }

  const generateCommunication = () => {
    const nextText = buildEvidenceCommunication(toolType, formData)
    setCommunicationText(nextText)
    onStatus('已生成退租沟通说明')
  }

  const exportEvidencePackage = async () => {
    if (isExportingEvidenceDocx) return

    setIsExportingEvidenceDocx(true)
    onStatus('正在生成 Word 退租证据包')

    try {
      const { downloadTextDocx } = await import('../utils/docxExport.js')
      await downloadTextDocx('租小审-退租证据包', evidencePackageText)
      onStatus('退租证据包已生成 DOCX，可下载 Word')
    } catch (error) {
      onStatus(`退租证据包 DOCX 生成失败：${error.message}`)
    } finally {
      setIsExportingEvidenceDocx(false)
    }
  }

  const copyCommunication = async () => {
    if (!communicationText) {
      onStatus('请先生成沟通说明')
      return
    }

    await copyTextToClipboard(communicationText)
    onStatus('沟通说明已复制')
  }

  const copyEvidencePackage = async () => {
    await copyTextToClipboard(evidencePackageText)
    onStatus('退租证据包摘要已复制')
  }

  const resetEvidencePack = () => {
    const nextState = createDefaultEvidencePackState()
    setFormData(nextState.formData)
    setEvidence(nextState.evidence)
    setActions(nextState.actions)
    setCommunicationText(nextState.communicationText)
    onStatus('退租证据包已重置')
  }

  const progressTone = evidenceStats.percent >= 80 ? 'safe' : evidenceStats.percent >= 50 ? 'warning' : 'danger'

  return (
    <div className="evidence-pack">
      <section className="evidence-hero work-panel">
        <div>
          <p className="section-kicker">Move-out Evidence Kit</p>
          <h2>退租证据包助手</h2>
          <p>把退租时最容易遗漏的合同、照片、聊天记录和费用凭证整理成可勾选、可导出的证据包。</p>
          <div className="evidence-hero-note">
            <span>自动保存</span>
            <strong>{evidenceAdvice.summary}</strong>
          </div>
          <LegalDisclaimer compact />
        </div>
        <div className={`evidence-score ${progressTone}`}>
          <strong>{evidenceStats.percent}%</strong>
          <span>证据完整度</span>
          <em>{evidenceStats.checked}/{evidenceStats.total} 项已收集</em>
        </div>
      </section>

      <div className="evidence-tabs" role="tablist" aria-label="退租证据包功能">
        {[
          { key: 'info', label: '退租信息', Icon: ClipboardCheck },
          { key: 'checklist', label: '证据清单', Icon: FileDiff },
          { key: 'tool', label: '沟通生成器', Icon: MessageSquareText },
          { key: 'actions', label: '行动清单', Icon: BadgeCheck },
        ].map((item) => {
          const Icon = item.Icon
          return (
            <button
              className={`evidence-tab ${tab === item.key ? 'active' : ''}`}
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
            >
              <Icon size={16} aria-hidden="true" />
              {item.label}
            </button>
          )
        })}
      </div>

      {tab === 'info' && (
        <section className="work-panel evidence-section">
          <div className="panel-head">
            <div>
              <h2>退租信息录入</h2>
              <p>基础信息会用于生成沟通说明和证据包摘要。</p>
            </div>
            <div className="panel-actions">
              <button className="ghost-button compact-button" type="button" onClick={copyEvidencePackage}>
                <ClipboardCheck size={15} aria-hidden="true" />
                复制摘要
              </button>
              <button className="ghost-button compact-button" type="button" onClick={resetEvidencePack}>
                重置
              </button>
              <button className="primary-button compact-button" type="button" onClick={exportEvidencePackage} disabled={isExportingEvidenceDocx}>
                <Download size={15} aria-hidden="true" />
                {isExportingEvidenceDocx ? '正在生成 Word' : '导出 Word 证据包'}
              </button>
            </div>
          </div>
          <div className="evidence-form-grid">
            {[
              { key: 'address', label: '房屋地址', placeholder: '如：阳光花园3栋2单元601室' },
              { key: 'deposit', label: '押金金额', placeholder: '如：3800' },
              { key: 'monthlyRent', label: '月租金', placeholder: '如：3800' },
              { key: 'landlordName', label: '房东/中介名称', placeholder: '如：恒业房产' },
              { key: 'landlordPhone', label: '联系电话', placeholder: '如：138xxxxxxxx' },
              { key: 'repairItem', label: '争议维修事项', placeholder: '如：空调不制冷、墙面扣款' },
              { key: 'repairCost', label: '维修/扣款金额', placeholder: '如：400' },
            ].map((field) => (
              <label className="field" key={field.key}>
                <span>{field.label}</span>
                <input value={formData[field.key]} onChange={(event) => updateField(field.key, event.target.value)} placeholder={field.placeholder} />
              </label>
            ))}
            <label className="field">
              <span>入住日期</span>
              <input type="date" value={formData.checkinDate} onChange={(event) => updateField('checkinDate', event.target.value)} />
            </label>
            <label className="field">
              <span>退租日期</span>
              <input type="date" value={formData.checkoutDate} onChange={(event) => updateField('checkoutDate', event.target.value)} />
            </label>
            <label className="field">
              <span>交接日期</span>
              <input type="date" value={formData.handoverDate} onChange={(event) => updateField('handoverDate', event.target.value)} />
            </label>
            <label className="field">
              <span>交接时间</span>
              <input type="time" value={formData.handoverTime} onChange={(event) => updateField('handoverTime', event.target.value)} />
            </label>
            <label className="field evidence-note-field">
              <span>备注事项</span>
              <textarea value={formData.notes} onChange={(event) => updateField('notes', event.target.value)} placeholder="如：房屋已完成基础清洁，钥匙和门禁卡齐全。" />
            </label>
          </div>
        </section>
      )}

      {tab === 'checklist' && (
        <section className="work-panel evidence-section">
          <div className="panel-head">
            <div>
              <h2>退租证据清单</h2>
              <p>逐项勾选已收集材料，完整度会实时更新。</p>
            </div>
            <span className="knowledge-count">{evidenceStats.checked}/{evidenceStats.total}</span>
          </div>
          <div className="evidence-progress">
            <div>
              <strong>证据完整度</strong>
              <span>{evidenceStats.percent}%</span>
            </div>
            <meter className={progressTone} min="0" max="100" value={evidenceStats.percent}>{evidenceStats.percent}</meter>
          </div>
          <div className="evidence-advice">
            <AlertTriangle size={17} aria-hidden="true" />
            <div>
              <strong>优先补齐：{evidenceAdvice.firstMissing}</strong>
              <p>{evidenceAdvice.summary}</p>
            </div>
          </div>
          <div className="evidence-group-grid">
            {Object.entries(evidenceGroupMeta).map(([group, meta]) => {
              const Icon = meta.Icon
              const checkedCount = evidence[group].filter(Boolean).length
              return (
                <article className="evidence-group-card" key={group}>
                  <div className="evidence-group-head">
                    <span>
                      <Icon size={17} aria-hidden="true" />
                      {meta.title}
                    </span>
                    <em>{checkedCount}/{meta.items.length}</em>
                  </div>
                  <div className="evidence-item-list">
                    {meta.items.map((item, index) => (
                      <label className={evidence[group][index] ? 'checked' : ''} key={item}>
                        <input checked={evidence[group][index]} type="checkbox" onChange={() => toggleEvidence(group, index)} />
                        <span>{item}</span>
                        <strong>{evidence[group][index] ? '已收集' : '待补齐'}</strong>
                      </label>
                    ))}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {tab === 'tool' && (
        <section className="work-panel evidence-section">
          <div className="panel-head">
            <div>
              <h2>沟通说明生成器</h2>
              <p>生成押金退还、维修争议、退租交接三类可复制文本。</p>
            </div>
            <div className="panel-actions">
              <button className="ghost-button compact-button" type="button" onClick={copyCommunication}>
                <ClipboardCheck size={15} aria-hidden="true" />
                复制文本
              </button>
              <button className="primary-button compact-button" type="button" onClick={generateCommunication}>
                <Sparkles size={16} aria-hidden="true" />
                生成说明
              </button>
            </div>
          </div>
          <div className="evidence-tool-tabs">
            {evidenceToolTabs.map((item) => (
              <button
                className={toolType === item.value ? 'active' : ''}
                key={item.value}
                type="button"
                onClick={() => {
                  setToolType(item.value)
                  setCommunicationText('')
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="communication-preview">
            <pre>{communicationText || '点击“生成说明”后，这里会生成可复制的沟通文本。'}</pre>
          </div>
        </section>
      )}

      {tab === 'actions' && (
        <section className="work-panel evidence-section">
          <div className="panel-head">
            <div>
              <h2>下一步行动清单</h2>
              <p>按顺序完成这些动作，退租交接会更有证据链。</p>
            </div>
            <span className="knowledge-count">{actions.filter(Boolean).length}/{actions.length}</span>
          </div>
          <div className="evidence-action-list">
            {evidenceActions.map((item, index) => (
              <button className={actions[index] ? 'done' : ''} key={item.title} type="button" onClick={() => toggleAction(index)}>
                <span>{actions[index] ? <Check size={15} aria-hidden="true" /> : index + 1}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
