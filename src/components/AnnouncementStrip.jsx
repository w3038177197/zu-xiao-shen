import { ArrowRight } from 'lucide-react'

export default function AnnouncementStrip({ guideTriggerRef, onOpenGuide }) {
  return (
    <div className="announcement-strip">
      <span>● 演示不断线</span>
      <strong>模型暂不可用时，会自动切换本地租房规则和知识库兜底</strong>
      <button className="announcement-link" type="button" ref={guideTriggerRef} onClick={onOpenGuide}>
        查看避坑流程
        <ArrowRight size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
