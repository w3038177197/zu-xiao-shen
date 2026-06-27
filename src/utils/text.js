export function formatEvidenceDate(value) {
  if (!value) return '待确认'
  return value
}

export function compactText(text, maxLength = 1200) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized

  return `${normalized.slice(0, maxLength)}...`
}
