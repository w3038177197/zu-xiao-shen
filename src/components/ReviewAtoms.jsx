import { useMemo } from 'react'
import { AlertTriangle, Check, Sparkles } from 'lucide-react'
import { LEGAL_DISCLAIMER } from '../constants/legal.js'

export function HighlightedContract({ text, findings }) {
  const highlighted = useMemo(() => {
    const segments = [{ text, risk: null }]

    findings.forEach((finding) => {
      finding.hits.forEach((hit) => {
        for (let i = 0; i < segments.length; i += 1) {
          const segment = segments[i]
          if (segment.risk || !segment.text.includes(hit)) continue

          const parts = segment.text.split(hit)
          if (parts.length <= 1) continue

          const replacement = []
          parts.forEach((part, index) => {
            if (part) replacement.push({ text: part, risk: null })
            if (index < parts.length - 1) replacement.push({ text: hit, risk: finding.level })
          })

          segments.splice(i, 1, ...replacement)
          i += replacement.length - 1
        }
      })
    })

    return segments
  }, [findings, text])

  return (
    <div className="contract-view" aria-label="合同风险高亮预览">
      {highlighted.map((segment, index) =>
        segment.risk ? (
          <mark className={`risk-mark ${segment.risk}`} key={`${segment.text}-${index}`}>
            {segment.text}
          </mark>
        ) : (
          <span key={`${segment.text}-${index}`}>{segment.text}</span>
        ),
      )}
    </div>
  )
}

export function LegalDisclaimer({ compact = false }) {
  return (
    <div className={`legal-disclaimer ${compact ? 'compact' : ''}`} role="note">
      <AlertTriangle size={16} aria-hidden="true" />
      <span>{LEGAL_DISCLAIMER}</span>
    </div>
  )
}

export function FindingItem({ finding, accepted, onApply }) {
  const Icon = finding.icon

  return (
    <article className={`finding ${finding.level}`}>
      <div className="finding-heading">
        <span className="finding-icon">
          <Icon size={18} aria-hidden="true" />
        </span>
        <div>
          <div className="finding-title">{finding.title}</div>
          <div className="finding-meta">
            {finding.priority} · {finding.dimension} · 命中 {finding.hits.length} 个关键词
          </div>
        </div>
        <span className={`risk-badge ${finding.level}`}>{finding.levelText}</span>
      </div>
      <p>{finding.explain}</p>
      <div className="finding-evidence">
        <strong>证据片段</strong>
        <span>{finding.evidence}</span>
      </div>
      <div className="finding-law">
        <strong>依据</strong>
        <span>{finding.legalBasis}</span>
      </div>
      <div className="suggestion">
        <span>建议</span>
        {finding.suggestion}
      </div>
      <div className="negotiation-tip">
        <span>谈判话术</span>
        {finding.negotiation}
      </div>
      <button
        className={`apply-button ${accepted ? 'accepted' : ''}`}
        disabled={accepted}
        type="button"
        onClick={() => onApply(finding)}
      >
        {accepted ? <Check size={16} aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
        {accepted ? '已采纳修改' : '采纳并改写合同'}
      </button>
    </article>
  )
}
