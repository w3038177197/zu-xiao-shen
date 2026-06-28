import { formatAiMessageBlocks } from '../features/aiAssistant.js'

export default function AiMessageContent({ content }) {
  const blocks = formatAiMessageBlocks(content)

  return (
    <div className="ai-message-content">
      {blocks.map((block, blockIndex) => (
        <section className="ai-message-section" key={`${block.title || 'paragraph'}-${blockIndex}`}>
          {block.title && <strong className="ai-message-section-title">{block.title}</strong>}
          {block.lines.map((line, lineIndex) => (
            <p className={`ai-message-line ${line.marker ? 'listed' : ''}`} key={`${line.text}-${lineIndex}`}>
              {line.marker && <em>{line.marker}</em>}
              <span>{line.text}</span>
            </p>
          ))}
        </section>
      ))}
    </div>
  )
}
