import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Bot,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  Download,
  EyeOff,
  FileDiff,
  FileText,
  Fingerprint,
  Gavel,
  House,
  LockKeyhole,
  MessageSquareText,
  PlugZap,
  RefreshCw,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Send,
  UploadCloud,
  X,
} from 'lucide-react'
import './App.css'
import { LEGAL_DISCLAIMER } from './constants/legal.js'
import { demoContracts, sampleContract } from './data/demoContracts.js'
import { getSubsidyMatchScore, subsidyCities, subsidyPolicies } from './data/subsidyPolicies.js'
import { STORAGE_KEYS, workflowLabels } from './constants/appConfig.js'
import {
  CHECKIN_MAX_PHOTO_BYTES,
  CHECKIN_MAX_PHOTOS_PER_ITEM,
  CHECKIN_PHOTO_MAX_EDGE,
  CHECKIN_PHOTO_QUALITY,
  CONTRACT_IMAGE_MIME_PATTERN,
  CONTRACT_IMPORT_MAX_BYTES,
  CONTRACT_PDF_EXTENSIONS,
  CONTRACT_TEXT_EXTENSIONS,
  CONTRACT_WORD_EXTENSIONS,
  OCR_REVIEW_WARNING_CONFIDENCE,
  checkinItems,
  checkinRoomTypes,
  checkinRooms,
} from './constants/checkinConfig.js'
import { defaultDepositInputs, providerPresets } from './constants/aiConfig.js'
import { contractTypeOptions, partyRoleOptions, reviewDepthOptions } from './constants/reviewOptions.js'
import { aiReplySections, aiResponseSkills, knowledgeBaseItems } from './data/knowledgeBase.js'

function createEmptyCheckinRecord() {
  return { status: 'unchecked', defect: '', note: '', photos: [] }
}

function normalizeCheckinRecord(record) {
  const safeRecord = record && typeof record === 'object' ? record : {}
  const photos = Array.isArray(safeRecord.photos)
    ? safeRecord.photos
        .filter((photo) => photo && typeof photo.url === 'string')
        .slice(0, CHECKIN_MAX_PHOTOS_PER_ITEM)
        .map((photo) => ({
          id: photo.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: photo.name || '验房照片',
          url: photo.url,
          createdAt: photo.createdAt || '',
        }))
    : []

  return {
    status: ['good', 'defect', 'unchecked'].includes(safeRecord.status) ? safeRecord.status : 'unchecked',
    defect: typeof safeRecord.defect === 'string' ? safeRecord.defect : '',
    note: typeof safeRecord.note === 'string' ? safeRecord.note : '',
    photos,
  }
}

function createDefaultCheckinState() {
  return Object.fromEntries(
    checkinRooms.map((room) => [
      room.key,
      Object.fromEntries(
        checkinItems.map((item) => [
          item.key,
          createEmptyCheckinRecord(),
        ]),
      ),
    ]),
  )
}

function normalizeCheckinState(savedState) {
  return Object.fromEntries(
    checkinRooms.map((room) => [
      room.key,
      Object.fromEntries(
        checkinItems.map((item) => [
          item.key,
          normalizeCheckinRecord(savedState?.[room.key]?.[item.key]),
        ]),
      ),
    ]),
  )
}

function getCheckinStats(checkinData) {
  const records = checkinRooms.flatMap((room) => checkinItems.map((item) => checkinData[room.key]?.[item.key]))
  const checked = records.filter((record) => record?.status && record.status !== 'unchecked').length
  const defects = records.filter((record) => record?.status === 'defect').length
  const photos = records.reduce((total, record) => total + (Array.isArray(record?.photos) ? record.photos.length : 0), 0)
  const total = records.length

  return {
    checked,
    defects,
    photos,
    total,
    percent: total ? Math.round((checked / total) * 100) : 0,
  }
}

function getCheckinDefectRows(checkinData) {
  return checkinRooms.flatMap((room) =>
    checkinItems
      .filter((item) => checkinData[room.key]?.[item.key]?.status === 'defect')
      .map((item) => {
        const record = checkinData[room.key][item.key]
        const photoCount = Array.isArray(record.photos) ? record.photos.length : 0
        return {
          room: room.label,
          item: item.label,
          defect: record.defect || '疑似瑕疵',
          note: record.note || (photoCount ? '照片已作为留证' : '待补充说明'),
          photoCount,
        }
      }),
  )
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function loadImageFromDataUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('照片读取失败'))
    image.src = url
  })
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('照片压缩失败'))
      }
    }, type, quality)
  })
}

async function compressCheckinPhoto(file) {
  const dataUrl = await readFileAsDataUrl(file)
  const image = await loadImageFromDataUrl(dataUrl)
  const scale = Math.min(1, CHECKIN_PHOTO_MAX_EDGE / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height))

  if (scale >= 1 && file.size <= 900 * 1024) {
    return dataUrl
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale))
  canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale))
  const context = canvas.getContext('2d')

  if (!context) {
    return dataUrl
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const blob = await canvasToBlob(canvas, 'image/jpeg', CHECKIN_PHOTO_QUALITY)
  return readFileAsDataUrl(blob)
}

function getFileExtension(fileName) {
  return String(fileName || '').split('.').pop()?.toLowerCase() || ''
}

function isSupportedContractFile(file) {
  if (!file) return false

  const extension = getFileExtension(file.name)
  return (
    CONTRACT_TEXT_EXTENSIONS.includes(extension)
    || CONTRACT_WORD_EXTENSIONS.includes(extension)
    || CONTRACT_PDF_EXTENSIONS.includes(extension)
    || CONTRACT_IMAGE_MIME_PATTERN.test(file.type)
  )
}

function isUsableOcrText(text, confidence) {
  const normalized = String(text || '').trim()
  const readableChars = normalized.match(/[\p{Script=Han}A-Za-z]/gu) || []
  const digitOnly = normalized && /^[\d\s.,:;/-]+$/.test(normalized)

  return normalized.length >= 12 && readableChars.length >= 6 && !digitOnly && Number(confidence || 0) >= 35
}

async function extractPdfText(file) {
  const [{ default: pdfWorkerUrl }, pdfjsLib] = await Promise.all([
    import('pdfjs-dist/build/pdf.worker.mjs?url'),
    import('pdfjs-dist'),
  ])

  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const pages = await Promise.all(
    Array.from({ length: pdf.numPages }, async (_, index) => {
      const page = await pdf.getPage(index + 1)
      const content = await page.getTextContent()
      return content.items.map((item) => item.str).join(' ')
    }),
  )

  return pages.join('\n\n').trim()
}

async function extractDocxText(file) {
  const mammoth = await import('mammoth/mammoth.browser')
  const buffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })

  return String(result.value || '').trim()
}

async function extractImageTextWithOcr(file) {
  const formData = new FormData()
  formData.append('image', file)

  const response = await fetch('/api/ocr/image', {
    method: 'POST',
    body: formData,
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data?.message || '图片 OCR 识别失败，请确认后端代理已启动')
  }

  const text = String(data.text || '').trim()
  const confidence = Number(data.confidence || 0)

  if (!isUsableOcrText(text, confidence)) {
    throw new Error(`图片 OCR 结果过弱，置信度 ${confidence || 0}%，请换更清晰的照片或改用文本粘贴`)
  }

  return {
    text,
    confidence,
    mode: data.mode || 'offline-tesseract',
  }
}

async function extractContractTextFromFile(file) {
  if (!file) {
    throw new Error('请选择要导入的合同文件')
  }
  if (file.size > CONTRACT_IMPORT_MAX_BYTES) {
    throw new Error('文件超过 8MB，请压缩后再上传')
  }
  if (!isSupportedContractFile(file)) {
    throw new Error('当前支持 TXT、MD、DOCX、PDF 和图片格式')
  }

  const extension = getFileExtension(file.name)

  if (CONTRACT_TEXT_EXTENSIONS.includes(extension)) {
    return {
      text: (await file.text()).trim(),
      type: '文本文件',
      source: 'TXT / MD',
    }
  }

  if (CONTRACT_WORD_EXTENSIONS.includes(extension)) {
    return {
      text: await extractDocxText(file),
      type: 'Word 合同',
      source: 'Word',
    }
  }

  if (CONTRACT_PDF_EXTENSIONS.includes(extension)) {
    return {
      text: await extractPdfText(file),
      type: 'PDF 合同',
      source: 'PDF',
    }
  }

  if (CONTRACT_IMAGE_MIME_PATTERN.test(file.type)) {
    const result = await extractImageTextWithOcr(file)

    return {
      text: result.text,
      type: `图片 OCR 合同（置信度 ${result.confidence || 0}%）`,
      source: '图片 OCR',
      confidence: result.confidence || 0,
      mode: result.mode,
    }
  }

  throw new Error('当前支持 TXT、MD、DOCX、PDF 和图片格式')
}

// Legacy service-contract rules are retained only as a fallback when users manually
// switch the contract type away from the rental review workflow.
const riskRules = [
  {
    id: 'payment-delay',
    title: '付款周期过长且免责',
    level: 'high',
    score: 24,
    icon: CircleDollarSign,
    levelText: '高风险',
    keywords: ['90 个工作日', '延期付款', '不承担违约责任', '客户回款'],
    explain: '付款触发条件过晚，且甲方把内部流程、客户回款等原因排除在违约责任之外，乙方现金流风险较高。',
    suggestion: '建议改为阶段付款，并写明逾期付款的违约责任。',
    replaceFrom:
      '乙方完成全部工作并经甲方最终验收后 90 个工作日内，甲方向乙方支付全部费用。甲方如因内部流程、客户回款或预算调整导致延期付款，不承担违约责任。',
    replacement:
      '甲方应按项目阶段支付费用：合同签署后 5 个工作日内支付 40%，乙方提交最终成果并经确认后 10 个工作日内支付剩余 60%。甲方逾期付款的，应按应付款金额每日万分之五承担违约责任。',
  },
  {
    id: 'unilateral-termination',
    title: '单方解除权不对等',
    level: 'high',
    score: 22,
    icon: Gavel,
    levelText: '高风险',
    keywords: ['单方解除合同', '无需承担任何赔偿责任', '不得单方解除'],
    explain: '一方可以无成本解除合同，另一方没有相同权利，容易造成投入无法回收。',
    suggestion: '建议加入对等解除机制和已完成工作结算规则。',
    replaceFrom:
      '甲方可根据自身业务需要单方解除合同，且无需承担任何赔偿责任。乙方不得单方解除合同。',
    replacement:
      '任一方需提前 10 个工作日书面通知对方后方可解除合同。合同解除时，甲方应按照乙方已完成并交付的工作量结算费用；因一方违约导致解除的，违约方应赔偿守约方因此产生的合理损失。',
  },
  {
    id: 'ip-overreach',
    title: '知识产权归属过宽',
    level: 'high',
    score: 18,
    icon: Fingerprint,
    levelText: '高风险',
    keywords: ['全部成果', '草稿', '源文件', '知识产权均归甲方所有', '不得以任何方式展示'],
    explain: '条款覆盖草稿、源文件和创意方案，且限制乙方案例展示，超出常见交付范围。',
    suggestion: '建议限定为已付款且最终确认的交付成果。',
    replaceFrom:
      '乙方在本项目中形成的全部成果、草稿、源文件、创意方案及相关知识产权均归甲方所有。乙方不得以任何方式展示、复用或作为案例公开。',
    replacement:
      '甲方在足额支付对应费用后，取得双方最终确认交付成果的使用权。乙方保留未被采用方案、通用方法、底层工具和既有素材的权利。乙方可在不披露甲方商业秘密的前提下，将项目作为案例展示。',
  },
  {
    id: 'confidentiality-penalty',
    title: '保密违约金明显偏高',
    level: 'medium',
    score: 12,
    icon: LockKeyhole,
    levelText: '中风险',
    keywords: ['永久保密义务', '五倍的违约金', '全部损失'],
    explain: '永久保密和五倍违约金会显著加重乙方责任，且“全部损失”边界不清。',
    suggestion: '建议写清保密范围、期限和责任上限。',
    replaceFrom:
      '乙方对合作过程中获知的全部信息承担永久保密义务。乙方如违反保密义务，应向甲方支付合同金额五倍的违约金，并赔偿甲方全部损失。',
    replacement:
      '乙方仅对甲方明确标识或合理应认定为保密的信息承担保密义务，保密期限为合同终止后 3 年。乙方违反保密义务造成甲方实际损失的，应在合同金额范围内承担赔偿责任。',
  },
  {
    id: 'acceptance-unclear',
    title: '验收标准不明确',
    level: 'medium',
    score: 10,
    icon: ClipboardCheck,
    levelText: '中风险',
    keywords: ['未书面确认前', '视为项目未通过验收', '3 日内完成修改'],
    explain: '验收完全依赖一方书面确认，没有客观标准和默认通过机制，可能导致无限修改。',
    suggestion: '建议写明验收标准、反馈次数和默认通过机制。',
    replaceFrom:
      '乙方应在甲方通知后 3 日内完成修改。甲方未书面确认前，视为项目未通过验收。',
    replacement:
      '甲方应在收到交付成果后 5 个工作日内提出书面验收意见。甲方逾期未反馈的，视为验收通过。每阶段修改以 2 轮为限，超出范围的新增需求由双方另行确认费用和周期。',
  },
  {
    id: 'jurisdiction',
    title: '管辖地点可能不利',
    level: 'low',
    score: 6,
    icon: Scale,
    levelText: '低风险',
    keywords: ['甲方所在地人民法院'],
    explain: '争议解决地点偏向甲方，可能增加另一方维权成本。',
    suggestion: '可协商改为双方都可接受的地点或机构。',
    replaceFrom: '双方发生争议的，应提交甲方所在地人民法院诉讼解决。',
    replacement: '双方发生争议的，应优先友好协商；协商不成的，可提交合同履行地有管辖权的人民法院诉讼解决。',
  },
]

const riskDetails = {
  'payment-delay': {
    dimension: '付款',
    priority: 'P0',
    evidence: '付款周期长达 90 个工作日，且内部流程、客户回款、预算调整均被排除在违约责任之外。',
    legalBasis: '参考《民法典》合同编关于履行期限、违约责任与公平原则的规定。',
    negotiation: '可以先提出阶段付款方案，再让对方选择节点比例，而不是直接争论是否付款。',
  },
  'unilateral-termination': {
    dimension: '解除',
    priority: 'P0',
    evidence: '甲方可单方解除且无需赔偿，乙方没有对等解除权。',
    legalBasis: '参考《民法典》关于合同解除、违约损害赔偿与权利义务对等的基本规则。',
    negotiation: '建议把重点放在“已完成工作应结算”，比单纯要求删除解除权更容易被接受。',
  },
  'ip-overreach': {
    dimension: '知识产权',
    priority: 'P1',
    evidence: '草稿、源文件、创意方案和全部知识产权均归甲方，且限制乙方案例展示。',
    legalBasis: '参考著作权归属、委托创作成果交付范围和商业秘密保护边界。',
    negotiation: '可以区分最终交付成果、未采用方案、通用方法和既有素材，降低对方顾虑。',
  },
  'confidentiality-penalty': {
    dimension: '保密',
    priority: 'P1',
    evidence: '永久保密、五倍违约金和全部损失并列，责任上限不清。',
    legalBasis: '参考违约金调整、实际损失证明和保密义务合理期限的裁判思路。',
    negotiation: '不要否认保密义务，改为要求限定范围、期限和赔偿上限。',
  },
  'acceptance-unclear': {
    dimension: '验收',
    priority: 'P1',
    evidence: '未书面确认前视为项目未通过验收，缺少默认通过和修改轮次限制。',
    legalBasis: '参考合同履行中的验收标准、通知义务和诚实信用原则。',
    negotiation: '建议要求写明反馈窗口和修改轮次，避免项目进入无限返工。',
  },
  jurisdiction: {
    dimension: '管辖',
    priority: 'P2',
    evidence: '争议提交甲方所在地法院，可能增加另一方维权成本。',
    legalBasis: '参考民事诉讼管辖规则和合同履行地约定。',
    negotiation: '可提出合同履行地或双方均可接受的中立地点作为折中方案。',
  },
}

const scoreDimensions = ['租期', '租金', '押金', '解除', '维修', '居住权', '费用', '违约责任', '管辖', '格式条款', '权属']
const RISK_SCORE_SCALE = 0.62
const RISK_SCORE_DISPLAY_CAP = 88

function softenRiskScore(rawScore, maxScore = RISK_SCORE_DISPLAY_CAP) {
  const numericScore = Number(rawScore)
  if (!Number.isFinite(numericScore) || numericScore <= 0) return 0

  return Math.min(maxScore, Math.round(numericScore * RISK_SCORE_SCALE))
}

function getPlatformApiEndpoint() {
  return '/api/ai/chat'
}

function parseAiContent(content) {
  if (!content) return null

  try {
    return JSON.parse(content)
  } catch {
    const jsonBlock = content.match(/\{[\s\S]*\}/)
    if (!jsonBlock) return { summary: content }

    try {
      return JSON.parse(jsonBlock[0])
    } catch {
      return { summary: content }
    }
  }
}

function extractAssistantContent(data) {
  const message = data?.choices?.[0]?.message
  const content = message?.content
  if (Array.isArray(content)) {
    return content.map((item) => item.text || item.content || '').join('')
  }

  if (content) return content

  const reasoningContent = message?.reasoning_content || ''
  if (/\{[\s\S]*\}/.test(reasoningContent)) return reasoningContent

  return data?.output_text || ''
}

function extractAssistantChatContent(data) {
  const message = data?.choices?.[0]?.message
  const content = message?.content
  if (Array.isArray(content)) {
    return content.map((item) => item.text || item.content || '').join('')
  }

  return content || data?.output_text || message?.reasoning_content || ''
}

function createMessageId(prefix = 'msg') {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function createAiWelcomeMessage() {
  return {
    id: 'assistant-welcome',
    role: 'assistant',
    content: '我是租小审系统 AI，已经接入合同审查、退租证据包、入住验房和补贴匹配。你可以直接问我当前页面、当前合同或下一步怎么处理。',
  }
}

function createEmptyAiFeedback() {
  return {
    helpful: 0,
    needsWork: 0,
    byMessage: {},
  }
}

function normalizeAiFeedback(value) {
  const next = createEmptyAiFeedback()

  if (!value || typeof value !== 'object') return next

  next.byMessage = value.byMessage && typeof value.byMessage === 'object' ? value.byMessage : {}
  next.helpful = Object.values(next.byMessage).filter((rating) => rating === 'helpful').length
  next.needsWork = Object.values(next.byMessage).filter((rating) => rating === 'needsWork').length

  return next
}

function normalizeAiFindings(data, sourceText) {
  const risks = Array.isArray(data?.risks) ? data.risks : []

  return risks.slice(0, 16).map((risk, index) => {
    const level = ['high', 'medium', 'low'].includes(risk.level) ? risk.level : 'medium'
    const dimension = risk.dimension || '综合'
    const title = risk.title || `${dimension}风险 ${index + 1}`
    const keywords = Array.isArray(risk.keywords) ? risk.keywords.filter(Boolean) : []
    const hits = keywords.filter((keyword) => sourceText.includes(keyword))
    const evidence = typeof risk.evidence === 'string' ? risk.evidence.trim() : ''
    const replaceFrom = typeof risk.replaceFrom === 'string' ? risk.replaceFrom.trim() : ''
    const verifiedEvidence = evidence && sourceText.includes(evidence)
    const verifiedReplaceFrom = replaceFrom && sourceText.includes(replaceFrom)

    return {
      id: risk.id || `ai-risk-${index + 1}`,
      title,
      level,
      score: Number(risk.score) || (level === 'high' ? 20 : level === 'medium' ? 12 : 6),
      icon: AlertTriangle,
      levelText: risk.levelText || (level === 'high' ? '高风险' : level === 'medium' ? '中风险' : '低风险'),
      keywords,
      hits,
      explain: risk.explain || risk.reason || 'AI 已识别该条款存在潜在风险，建议结合业务背景复核。',
      suggestion: risk.suggestion || '建议补充更明确、对等、可执行的合同表述。',
      replaceFrom: verifiedReplaceFrom ? replaceFrom : verifiedEvidence ? evidence : hits[0] || '',
      replacement: risk.replacement || risk.rewrite || risk.suggestion || '建议由法务结合交易背景补充替代条款。',
      dimension,
      priority: risk.priority || (level === 'high' ? 'P0' : level === 'medium' ? 'P1' : 'P2'),
      evidence: verifiedEvidence ? evidence : verifiedReplaceFrom ? replaceFrom : hits.join('、'),
      legalBasis: risk.legalBasis || '建议结合《民法典》合同编及相关司法裁判规则复核。',
      negotiation: risk.negotiation || '建议先提出可执行替代方案，再与对方协商风险分担。',
    }
  }).filter((risk) => risk.evidence && (risk.hits.length > 0 || sourceText.includes(risk.evidence)))
}

function buildAiQualityReport(data, sourceText, acceptedFindings) {
  const risks = Array.isArray(data?.risks) ? data.risks : []
  const contractType = String(data?.contractType || data?.type || '')
  const verifiedRawCount = risks.filter((risk) => {
    const evidence = typeof risk.evidence === 'string' ? risk.evidence.trim() : ''
    const replaceFrom = typeof risk.replaceFrom === 'string' ? risk.replaceFrom.trim() : ''
    const keywords = Array.isArray(risk.keywords) ? risk.keywords : []

    return (
      (evidence && sourceText.includes(evidence)) ||
      (replaceFrom && sourceText.includes(replaceFrom)) ||
      keywords.some((keyword) => sourceText.includes(keyword))
    )
  }).length
  const rejectedCount = Math.max(0, risks.length - acceptedFindings.length)
  const typeMismatch = /服务|外包|知识产权|项目/.test(contractType) && detectContractType(sourceText) === 'lease'
  const tone = typeMismatch || rejectedCount > 0 ? 'warning' : 'safe'

  return {
    rawCount: risks.length,
    verifiedRawCount,
    acceptedCount: acceptedFindings.length,
    rejectedCount,
    typeMismatch,
    tone,
    contractType,
  }
}

function createAiReviewPrompt(contractText, profile, ragItems = []) {
  const ragContext = Array.isArray(ragItems) && ragItems.length ? `\n${buildRagContextPrompt(ragItems)}\n` : ''

  return `请审查下面这份中文合同。只返回 JSON，不要 Markdown，不要解释 JSON 以外的内容。

${createKnowledgePrompt(profile)}
${ragContext}

JSON 格式必须为：
{
  "contractType": "房屋租赁合同",
  "summary": "一句话总结",
  "risks": [
    {
      "id": "risk-1",
      "title": "风险标题",
      "level": "high 或 medium 或 low",
      "levelText": "高风险 或 中风险 或 低风险",
      "dimension": "租期/租金/押金/解除/维修/居住权/违约责任/费用/管辖/格式条款/权属/综合",
      "priority": "P0/P1/P2",
      "score": 20,
      "keywords": ["用于高亮的原文关键词"],
      "explain": "风险解释",
      "suggestion": "修改建议",
      "evidence": "合同中的证据片段",
      "legalBasis": "法律或审查依据",
      "negotiation": "谈判话术",
      "replaceFrom": "可被替换的原文片段",
      "replacement": "建议替代条款"
    }
  ]
}

硬性要求：
1. evidence 必须逐字摘自合同原文，不能概括，不能编造。
2. keywords 必须全部来自合同原文，用于高亮。
3. replaceFrom 如果填写，必须逐字等于合同原文中的一段。
4. 不要输出与合同类型无关的模板风险。

合同正文：
${contractText}`
}

const proposalValueCards = [
  {
    icon: CircleDollarSign,
    title: '补贴匹配',
    label: '01',
    tab: 'subsidy',
    text: '按城市和个人情况筛官方补贴线索，先判断有没有资格。',
  },
  {
    icon: FileText,
    title: '租房审查',
    label: '02',
    tab: 'review',
    text: '标出押金、涨租、维修、违约金等关键风险。',
  },
  {
    icon: BadgeCheck,
    title: '入住验房',
    label: '03',
    tab: 'checkin',
    text: '记录房屋初始状态，避免旧问题变成租客责任。',
  },
  {
    icon: ClipboardCheck,
    title: '退租证据包',
    label: '04',
    tab: 'evidence',
    text: '整理证据包和话术，让押金争议有材料可讲。',
  },
]

const riskGuideSteps = [
  {
    icon: Search,
    step: '01',
    title: '选择入口',
    text: '从首页先判断问题类型：补贴、合同、交房、退租分别进入对应模块。',
    output: '定位当前要处理的租房风险',
  },
  {
    icon: FileText,
    step: '02',
    title: '填写材料',
    text: '补充城市和个人情况，粘贴合同，记录房屋状态，整理退租费用与证据。',
    output: '形成可计算、可审查的基础材料',
  },
  {
    icon: BadgeCheck,
    step: '03',
    title: '查看结果',
    text: '系统会给出政策线索、风险条款、验房缺口和押金争议提醒。',
    output: '知道哪些内容需要补、改、留证',
  },
  {
    icon: Download,
    step: '04',
    title: '导出沟通',
    text: '把结论、证据清单和沟通话术整理出来，用于签约前确认或退租协商。',
    output: '拿到可以直接使用的行动材料',
  },
]

const proposalNextIdeas = [
  '合同拍照识别：手机拍合同，自动提取条款并进入审查。',
  '城市政策更新：补贴入口和申请条件定期维护，减少过期信息。',
  '押金争议导出：把验房、票据、聊天记录整理成 PDF 或 Word。',
  '租金行情参考：用周边租金帮助用户判断续租涨价是否合理。',
]

const evidenceGroupMeta = {
  contract: {
    title: '合同文件',
    Icon: FileText,
    items: ['租赁合同原件或电子版', '押金收据或转账记录', '租金支付记录或银行流水'],
  },
  photos: {
    title: '房屋照片',
    Icon: UploadCloud,
    items: ['入住时房屋整体状况照片', '入住时家电家具状况照片', '退租时房屋整体状况照片', '退租时家电家具状况照片'],
  },
  chat: {
    title: '沟通记录',
    Icon: MessageSquareText,
    items: ['与房东或中介的聊天记录截图', '退租通知发送记录', '维修、押金、交接事项沟通记录'],
  },
  expense: {
    title: '费用凭证',
    Icon: CircleDollarSign,
    items: ['水电燃气缴费凭证', '物业费或宽带费缴纳凭证', '维修、保洁或其他费用凭证'],
  },
}

const evidenceActions = [
  { title: '整理合同和押金凭证', desc: '把租赁合同、押金收据、租金支付记录统一保存。' },
  { title: '拍摄退租现状照片', desc: '覆盖客厅、卧室、厨房、卫生间、门锁、墙面和家电家具。' },
  { title: '导出沟通记录', desc: '重点保留退租通知、维修争议、押金扣款和交接时间确认。' },
  { title: '结清并留存费用凭证', desc: '水电燃气、物业、宽带等费用尽量取得账单或转账记录。' },
  { title: '预约现场交接', desc: '提前确认交接时间、在场人员、钥匙门禁卡数量和押金退还方式。' },
  { title: '发送押金退还说明', desc: '用书面方式发送，要求对方明确扣款依据和退还时间。' },
]

const evidenceToolTabs = [
  { value: 'deposit', label: '押金退还' },
  { value: 'repair', label: '维修争议' },
  { value: 'handover', label: '退租交接' },
]

const defaultEvidenceFormData = {
  address: '阳光花园3栋2单元601室',
  deposit: '3800',
  monthlyRent: '3800',
  landlordName: '',
  landlordPhone: '',
  checkinDate: '',
  checkoutDate: '',
  handoverDate: '',
  handoverTime: '',
  repairItem: '',
  repairCost: '',
  notes: '',
}

function createEmptyEvidenceState() {
  return Object.fromEntries(Object.entries(evidenceGroupMeta).map(([group, meta]) => [group, meta.items.map(() => false)]))
}

function createDefaultEvidencePackState() {
  return {
    formData: defaultEvidenceFormData,
    evidence: createEmptyEvidenceState(),
    actions: evidenceActions.map(() => false),
    communicationText: '',
  }
}

function normalizeEvidencePackState(savedState) {
  const defaults = createDefaultEvidencePackState()
  const savedEvidence = savedState?.evidence || {}

  return {
    formData: { ...defaults.formData, ...(savedState?.formData || {}) },
    evidence: Object.fromEntries(
      Object.entries(evidenceGroupMeta).map(([group, meta]) => {
        const savedGroup = Array.isArray(savedEvidence[group]) ? savedEvidence[group] : []
        return [group, meta.items.map((_, index) => Boolean(savedGroup[index]))]
      }),
    ),
    actions: evidenceActions.map((_, index) => Boolean(savedState?.actions?.[index])),
    communicationText: typeof savedState?.communicationText === 'string' ? savedState.communicationText : '',
  }
}

function loadEvidencePackState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.evidencePack)
    return saved ? normalizeEvidencePackState(JSON.parse(saved)) : createDefaultEvidencePackState()
  } catch {
    return createDefaultEvidencePackState()
  }
}

function loadCheckinInspectionState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.checkinInspection)
    return saved ? normalizeCheckinState(JSON.parse(saved)) : createDefaultCheckinState()
  } catch {
    return createDefaultCheckinState()
  }
}

function createDefaultSubsidyMatcherState() {
  return {
    city: '杭州',
    profile: '我是2026年应届本科毕业生，刚到杭州工作，公司已缴纳社保，目前租房居住，本市无房。',
  }
}

function normalizeSubsidyMatcherState(savedState) {
  const defaults = createDefaultSubsidyMatcherState()

  return {
    city: subsidyCities.includes(savedState?.city) ? savedState.city : defaults.city,
    profile: typeof savedState?.profile === 'string' ? savedState.profile : defaults.profile,
  }
}

function loadSubsidyMatcherState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.subsidyMatcher)
    return saved ? normalizeSubsidyMatcherState(JSON.parse(saved)) : createDefaultSubsidyMatcherState()
  } catch {
    return createDefaultSubsidyMatcherState()
  }
}

function buildAiResponseSkillPrompt() {
  return [
    '【已加载 AI 回复技能】',
    ...aiResponseSkills.map((skill, index) => `${index + 1}. ${skill.title}：${skill.rule}`),
    '【回复样式硬性要求】',
    '1. 必须先给结论，再给风险和行动建议。',
    '2. 必须使用“依据”栏目，列出至少 1 条知识库命中标题或系统内置规则；没有命中时要说明依据不足并建议核实。',
    '3. 优先使用这些栏目：结论、重点风险、建议动作、可发给房东的话、依据。没有必要的栏目不要硬凑。',
    '4. 不要输出 Markdown 装饰符号，包括 **、###、---、代码块、表格和连续项目符号。',
    '5. 每段尽量短，语气专业克制，不使用夸张表达，不编造法律结论。',
    '6. 涉及政策、补贴或法规时，提醒以官方最新页面和经办部门口径为准。',
  ].join('\n')
}

function buildLocalKnowledgeContext() {
  return knowledgeBaseItems
    .map((item, index) => `${index + 1}. ${item.title}（${item.tag}）：${item.text}`)
    .join('\n')
}

function pickLocalKnowledgeForPrompt(prompt, activeTab) {
  const query = `${prompt} ${workflowLabels[activeTab] || activeTab}`
  const normalizedQuery = query.toLowerCase()
  const rawTokens = normalizedQuery.match(/[\u4e00-\u9fa5]{2,}|[a-z0-9-]{2,}/gi) || []
  const gramTokens = rawTokens.flatMap((token) => {
    if (!/^[\u4e00-\u9fa5]+$/.test(token)) return [token]
    const grams = []
    for (let size = 2; size <= Math.min(4, token.length); size += 1) {
      for (let index = 0; index <= token.length - size; index += 1) {
        grams.push(token.slice(index, index + size))
      }
    }
    return grams
  })
  const queryTokens = Array.from(new Set([...rawTokens, ...gramTokens]))

  const matches = knowledgeBaseItems
    .map((item) => {
      const haystack = `${item.title} ${item.tag} ${item.text}`.toLowerCase()
      const directScore = [item.title, item.tag].some((value) => normalizedQuery.includes(String(value).toLowerCase())) ? 8 : 0
      const score = queryTokens.reduce((total, token) => (haystack.includes(token.toLowerCase()) ? total + 1 : total), directScore)
      return { ...item, score }
    })
    .sort((a, b) => b.score - a.score)

  const picked = matches.filter((item) => item.score > 0).slice(0, 3)
  return picked.length ? picked : knowledgeBaseItems.slice(0, 3)
}

function createLocalAiFallbackReply({ prompt, activeTab, findings, depositResult, ragItems }) {
  const topFinding = findings[0]
  const knowledge = (Array.isArray(ragItems) && ragItems.length ? ragItems : pickLocalKnowledgeForPrompt(prompt, activeTab)).slice(0, 3)

  const riskLine = topFinding
    ? `当前最值得先处理的是“${topFinding.title}”，证据片段是“${compactText(topFinding.evidence, 72)}”。`
    : '当前页面没有明显高风险结论，但仍建议按材料、证据、沟通三个方向核对。'

  const moduleAction = {
    review: '先把合同里押金、维修、涨租、解除、入户和违约金条款逐条过一遍，优先修改会直接影响钱和居住安全的内容。',
    evidence: '先补齐押金付款、费用结清、交接照片、维修票据、聊天记录和钥匙交还记录，再和房东确认扣款明细。',
    checkin: '先拍墙面地板、门窗门锁、家具家电和水电燃气表读数，并把已有瑕疵发给房东或中介确认。',
    subsidy: '先确认城市、学历、社保、无房、劳动合同和申报入口，政策结果以官方最新页面和经办部门口径为准。',
    proposal: '先用首页四个入口演示完整链路：补贴匹配、租房审查、入住验房、退租证据包。',
  }[activeTab] || '先明确当前问题属于补贴、合同、入住验房还是退租押金，再进入对应模块处理。'

  return normalizeAiReplyText([
    '结论：当前模型暂时不可用，我先按本地知识库和当前页面数据给你可执行建议。',
    `重点风险：${riskLine}`,
    `建议动作：${moduleAction}`,
    `押金提醒：当前押金估算预计应退 ${formatMoney(depositResult.estimatedReturn)}。如对方要扣款，要求提供照片、维修清单、票据和扣款依据。`,
    `依据：${knowledge
      .map((item) => {
        const source = item.source || item.sourceName || '租小审内置知识库'
        const scope = item.scope ? `，适用范围：${item.scope}` : ''
        const updatedAt = item.updatedAt ? `，更新：${item.updatedAt}` : ''
        return `${item.title}（${source}${scope}${updatedAt}）：${item.text}`
      })
      .join('；')}`,
    '下一步：把对方要求、合同原文或扣款明细发给系统 AI，我会继续按证据和话术帮你拆解。',
  ].join('\n'))
}

function normalizeAiReplyText(text) {
  const sectionPattern = aiReplySections.join('|')

  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1（$2）')
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[a-z]*|```/gi, '').trim())
    .replace(/^[ \t]*[-*_\u2014]{3,}[ \t]*$/gm, '')
    .replace(/^[ \t]{0,3}#{1,6}[ \t]*/gm, '')
    .replace(/^[ \t]*>[ \t]?/gm, '')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/~~([^~\n]+)~~/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/^[ \t]*[-*•]\s+/gm, '')
    .replace(new RegExp(`([。；;!?！？])\\s*(${sectionPattern})\\s*[：:]\\s*`, 'g'), '$1\n$2：')
    .replace(new RegExp(`(^|\\n)\\s*(${sectionPattern})\\s*[：:]\\s*`, 'g'), '$1$2：')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function formatAiMessageBlocks(content) {
  const normalized = normalizeAiReplyText(content)
  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (!lines.length) {
    return [{ title: '', lines: [{ marker: '', text: '暂无内容' }] }]
  }

  const blocks = []
  let current = { title: '', lines: [] }
  const sectionPattern = new RegExp(`^(${aiReplySections.join('|')})[：:]?\\s*(.*)$`)

  const flush = () => {
    if (current.title || current.lines.length) {
      blocks.push(current)
    }
  }

  lines.forEach((rawLine) => {
    const sectionMatch = rawLine.match(sectionPattern)
    if (sectionMatch) {
      flush()
      current = { title: sectionMatch[1], lines: [] }
      if (sectionMatch[2]) {
        current.lines.push({ marker: '', text: sectionMatch[2] })
      }
      return
    }

    const orderedMatch = rawLine.match(/^(\d+)[.、)]\s*(.+)$/)
    const cnOrderedMatch = rawLine.match(/^([一二三四五六七八九十]+)[.、)]\s*(.+)$/)
    if (orderedMatch) {
      current.lines.push({ marker: orderedMatch[1], text: orderedMatch[2] })
      return
    }
    if (cnOrderedMatch) {
      current.lines.push({ marker: cnOrderedMatch[1], text: cnOrderedMatch[2] })
      return
    }

    current.lines.push({ marker: '', text: rawLine })
  })

  flush()
  return blocks
}

function buildRagSearchQuery({ prompt, activeTab, reviewText, findings }) {
  const riskText = findings
    .slice(0, 5)
    .map((finding) => `${finding.title} ${finding.evidence || ''}`)
    .join(' ')

  return compactText(
    [
      prompt,
      `当前模块：${workflowLabels[activeTab] || activeTab}`,
      `合同摘要：${reviewText || ''}`,
      `风险线索：${riskText}`,
    ].join('\n'),
    1400,
  )
}

function buildRagContextPrompt(items) {
  const rows = Array.isArray(items) ? items : []
  if (!rows.length) {
    return `【知识库检索】未命中专门条目。可使用内置知识库回答：\n${buildLocalKnowledgeContext()}`
  }

  return [
    '【知识库检索命中】',
    ...rows.map((item, index) => {
      const source = item.source || item.sourceName || '租小审内置知识库'
      const url = item.sourceUrl ? `｜链接：${item.sourceUrl}` : ''
      const scope = item.scope ? `｜适用范围：${item.scope}` : ''
      const updatedAt = item.updatedAt ? `｜更新：${item.updatedAt}` : ''
      return `${index + 1}. ${item.title}（${item.tag || '知识'}）｜来源：${source}${scope}${updatedAt}${url}\n要点：${item.text}`
    }),
    '回答时必须在“依据”栏目引用这些命中标题；没有依据的判断要说明需要进一步核实。',
  ].join('\n')
}

async function searchAiKnowledge(query, limit = 5) {
  try {
    const response = await fetch(`/api/rag/search?q=${encodeURIComponent(query)}&limit=${limit}`)
    const data = await response.json().catch(() => ({}))

    if (!response.ok || !Array.isArray(data.items)) {
      throw new Error(data?.message || '知识库检索失败')
    }

    return data.items
  } catch {
    return knowledgeBaseItems.slice(0, limit).map((item, index) => ({
      ...item,
      id: `local-knowledge-${index + 1}`,
      source: '租小审内置知识库',
      sourceUrl: '',
      score: 0,
    }))
  }
}

function AiMessageContent({ content }) {
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

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term))
}

function extractEvidenceSnippet(text, keywords) {
  const keyword = keywords.find((term) => text.includes(term))

  if (!keyword) return ''

  const index = text.indexOf(keyword)
  const start = Math.max(0, index - 52)
  const end = Math.min(text.length, index + keyword.length + 96)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < text.length ? '...' : ''

  return `${prefix}${text.slice(start, end).trim()}${suffix}`
}

function extractClauseAroundKeyword(text, keywords) {
  const source = String(text ?? '')
  const matchedKeywords = keywords.filter((term) => source.includes(term))
  const keyword = matchedKeywords[0]

  if (!keyword) return ''

  const indexes = matchedKeywords.map((term) => source.indexOf(term)).filter((index) => index >= 0)
  const index = Math.min(...indexes)
  const lastIndex = Math.max(...matchedKeywords.map((term) => source.indexOf(term) + term.length))
  const boundaryPattern = /[。！？；\n]/g
  let start = 0
  let end = source.length
  let match = boundaryPattern.exec(source)

  while (match && match.index < index) {
    start = match.index + 1
    match = boundaryPattern.exec(source)
  }

  if (match && match.index >= lastIndex) {
    end = match.index + 1
  } else {
    while (match && match.index < lastIndex) {
      match = boundaryPattern.exec(source)
    }
    if (match) {
      end = match.index + 1
    }
  }

  const clause = source.slice(start, end).trim()

  if (!clause) return ''
  if (clause.length <= 500) return clause

  const snippet = extractEvidenceSnippet(source, [keyword]).replace(/^\.\.\./, '').replace(/\.\.\.$/, '').trim()
  return snippet
}

function cleanContractTextForReview(text) {
  return String(text ?? '')
    .replace(/\n*【[^】]+修改建议】[\s\S]*?(?=\n\n【[^】]+修改建议】|$)/g, '')
    .replace(/\n*【补充修订条款】[\s\S]*$/g, '')
    .replace(/\n*补充修订条款[\s\S]*$/g, '')
    .trim()
}

function normalizeForLooseMatch(value) {
  return String(value ?? '').replace(/\s+/g, '')
}

function findLooseTextRange(text, needle) {
  const source = String(text ?? '')
  const target = normalizeForLooseMatch(needle)
  if (!source || !target) return null

  let normalizedIndex = 0
  const indexMap = []

  for (let index = 0; index < source.length; index += 1) {
    if (/\s/.test(source[index])) continue
    indexMap[normalizedIndex] = index
    normalizedIndex += 1
  }

  const compactSource = normalizeForLooseMatch(source)
  const compactStart = compactSource.indexOf(target)
  if (compactStart < 0) return null

  const start = indexMap[compactStart]
  const end = indexMap[compactStart + target.length - 1] + 1
  return Number.isFinite(start) && Number.isFinite(end) ? { start, end } : null
}

function appendRevisionClause(text, item) {
  const draft = String(text ?? '').trim()
  const title = item.title || '补充修订建议'
  const replacement = item.replacement || item.suggestion || '建议结合合同原文补充更明确、对等、可执行的条款。'
  const hasSection = draft.includes('【补充修订条款】')
  const block = hasSection ? `\n${title}：${replacement}` : `\n\n【补充修订条款】\n${title}：${replacement}`

  if (draft.includes(`${title}：${replacement}`)) return draft
  return `${draft}${block}`
}

function applyRevisionItem(text, item, options = {}) {
  const draft = String(text ?? '')
  const rawCandidates = [item.replaceFrom, item.evidence].filter(Boolean)
  const meaningfulCandidates = rawCandidates.filter((candidate) => normalizeForLooseMatch(candidate).length >= 12)

  if (item.replacement && draft.includes(item.replacement)) {
    return { text: draft, mode: 'unchanged' }
  }

  for (const candidate of meaningfulCandidates) {
    if (draft.includes(candidate)) {
      return { text: draft.replace(candidate, item.replacement), mode: 'exact' }
    }
  }

  for (const candidate of meaningfulCandidates) {
    const range = findLooseTextRange(draft, candidate)
    if (range) {
      return {
        text: `${draft.slice(0, range.start)}${item.replacement}${draft.slice(range.end)}`,
        mode: 'loose',
      }
    }
  }

  const currentClause = Array.isArray(item.hits) ? extractClauseAroundKeyword(draft, item.hits) : ''
  if (currentClause && !rawCandidates.includes(currentClause)) {
    if (draft.includes(currentClause)) {
      return { text: draft.replace(currentClause, item.replacement), mode: 'clause' }
    }

    const range = findLooseTextRange(draft, currentClause)
    if (range) {
      return {
        text: `${draft.slice(0, range.start)}${item.replacement}${draft.slice(range.end)}`,
        mode: 'clause',
      }
    }
  }

  for (const candidate of rawCandidates) {
    if (draft.includes(candidate)) {
      return { text: draft.replace(candidate, item.replacement), mode: 'exact' }
    }
  }

  if (options.appendIfMissing) {
    const appendedText = appendRevisionClause(draft, item)
    return { text: appendedText, mode: appendedText === draft ? 'unchanged' : 'appended' }
  }

  return { text: draft, mode: 'unchanged' }
}

function applyRevisionItemToText(text, item, options = {}) {
  return applyRevisionItem(text, item, options).text
}

function mergeRevisionItems(current, items) {
  const next = [...current]
  const knownIds = new Set(next.map((item) => item.id))

  items.forEach((item) => {
    if (!item?.id || knownIds.has(item.id)) return
    next.push(item)
    knownIds.add(item.id)
  })

  return next
}

function normalizeComparableText(value) {
  return cleanContractTextForReview(value)
    .replace(/^\.\.\./, '')
    .replace(/\.\.\.$/, '')
    .replace(/\s+/g, '')
}

function findingsOverlap(first, second) {
  if (!first || !second) return false
  if (first.id && first.id === second.id) return true

  const firstEvidence = normalizeComparableText(first.replaceFrom || first.evidence)
  const secondEvidence = normalizeComparableText(second.replaceFrom || second.evidence)

  if (
    firstEvidence.length >= 16
    && secondEvidence.length >= 16
    && (firstEvidence.includes(secondEvidence) || secondEvidence.includes(firstEvidence))
  ) {
    return true
  }

  const firstHits = new Set(Array.isArray(first.hits) ? first.hits : [])
  const secondHits = Array.isArray(second.hits) ? second.hits : []
  const sharedHits = secondHits.filter((hit) => firstHits.has(hit))

  return sharedHits.length >= 2 && first.dimension === second.dimension
}

function mergeFindings(baseFindings, extraFindings) {
  const merged = [...baseFindings]

  extraFindings.forEach((finding) => {
    if (!merged.some((existing) => findingsOverlap(existing, finding))) {
      merged.push(finding)
    }
  })

  return merged
}

function detectContractType(text) {
  const leaseSignals = ['房屋租赁合同', '出租方', '承租方', '月租金', '押一付三', '押金', '租期', '水、电、燃气']
  const serviceSignals = ['服务内容', '交付成果', '验收', '知识产权', '源文件', '创意方案', '项目阶段']
  const purchaseSignals = ['采购', '供货', '货物', '收货', '质保', '发票']
  const employmentSignals = ['劳动合同', '用人单位', '劳动者', '试用期', '工资', '社会保险']

  const score = (signals) => signals.filter((signal) => text.includes(signal)).length
  const scores = [
    { value: 'lease', score: score(leaseSignals) },
    { value: 'service', score: score(serviceSignals) },
    { value: 'purchase', score: score(purchaseSignals) },
    { value: 'employment', score: score(employmentSignals) },
  ].sort((a, b) => b.score - a.score)

  return scores[0].score >= 2 ? scores[0].value : 'lease'
}

function resolveReviewProfile(profile, text) {
  const detectedContractType = detectContractType(text)

  return {
    ...profile,
    detectedContractType,
    contractType: profile.contractType === 'auto' ? detectedContractType : profile.contractType,
  }
}

function getContractTypeLabel(value) {
  return contractTypeOptions.find((item) => item.value === value)?.label || value
}

function makeProfessionalFinding({
  id,
  title,
  level = 'medium',
  score = 10,
  dimension = '综合',
  priority = 'P1',
  keywords = [],
  explain,
  suggestion,
  evidence,
  legalBasis,
  negotiation,
  replacement,
  replaceFrom,
  minHits,
}) {
  return {
    id,
    title,
    level,
    score,
    icon: AlertTriangle,
    levelText: level === 'high' ? '高风险' : level === 'medium' ? '中风险' : '低风险',
    keywords,
    hits: keywords,
    matched: true,
    dimension,
    priority,
    explain,
    suggestion,
    replaceFrom: replaceFrom || evidence,
    replacement,
    evidence,
    legalBasis,
    negotiation,
    minHits,
  }
}

function makeLeaseFinding({
  id,
  title,
  level = 'medium',
  score = 10,
  dimension,
  priority = 'P1',
  keywords,
  explain,
  suggestion,
  evidence,
  legalBasis = '参考《民法典》合同编关于租赁合同、格式条款、公平原则、违约责任和合同解除的规则。',
  negotiation,
  replacement,
  replaceFrom,
  minHits,
}) {
  return makeProfessionalFinding({
    id,
    title,
    level,
    score,
    dimension,
    priority,
    keywords,
    explain,
    suggestion,
    evidence,
    legalBasis,
    negotiation,
    replacement,
    replaceFrom,
    minHits,
  })
}

function getLeaseFindings(text) {
  const findings = []
  const add = (finding) => {
    const hits = finding.keywords.filter((keyword) => text.includes(keyword))
    const minHits = finding.minHits || 1

    if (hits.length < minHits) return

    const hasExactEvidence = text.includes(finding.evidence)
    const fallbackClause = hasExactEvidence ? '' : extractClauseAroundKeyword(text, hits)
    findings.push({
      ...finding,
      evidence: hasExactEvidence ? finding.evidence : fallbackClause || extractEvidenceSnippet(text, hits),
      hits,
      replaceFrom: hasExactEvidence ? finding.replaceFrom : fallbackClause,
    })
  }

  add(makeLeaseFinding({
    id: 'lease-auto-renewal-rent-up',
    title: '自动续租并固定涨租',
    level: 'medium',
    score: 10,
    dimension: '租期',
    priority: 'P1',
    keywords: ['自动续期12个月', '上调8%'],
    evidence: '合同到期前30日，如双方均未提出异议，本合同自动续期12个月，续期租金在当期基础上上调8%。',
    explain: '到期沉默即自动续租，且租金自动上调，会让承租人因未及时提出异议而承担新的租期和涨租成本。',
    suggestion: '建议改为到期前双方书面确认续租，租金另行协商，不应默认涨租。',
    negotiation: '可接受优先续租权，但不要接受“沉默续租 + 自动涨价”的组合。',
    replacement: '合同期满后如需续租，双方应在期满前30日另行书面确认续租期限和租金标准；未达成书面一致的，本合同到期终止。',
  }))

  add(makeLeaseFinding({
    id: 'lease-termination-asymmetry',
    title: '提前解除权明显不对等',
    level: 'high',
    score: 16,
    dimension: '解除',
    priority: 'P0',
    keywords: ['提前退租须提前60日', '相当于2个月租金', '提前15日通知乙方即可'],
    evidence: '乙方提前退租须提前60日书面通知甲方，并支付违约金（相当于2个月租金）。甲方因出售房屋等自身原因需提前解除合同的，提前15日通知乙方即可，双方按实际居住天数结算租金。',
    explain: '承租人提前退租成本高，出租人因自身原因解除却几乎无赔偿，权利义务严重失衡。',
    suggestion: '建议设置对等提前通知期限和对等违约金，出租人提前解除也应补偿搬家等合理损失。',
    negotiation: '重点争取“出租人提前解除也支付同等违约金”，这是租赁合同的核心保护。',
    replacement: '任一方因自身原因提前解除合同的，应提前30日书面通知对方，并向对方支付相当于1个月租金的违约金；因甲方提前解除导致乙方搬迁的，甲方还应承担合理搬家费用。',
  }))

  add(makeLeaseFinding({
    id: 'lease-unilateral-rent-adjustment',
    title: '出租方单方调价并没收押金',
    level: 'high',
    score: 18,
    dimension: '租金',
    priority: 'P0',
    keywords: ['上涨超过20%', '相应调整租金', '15日内搬离', '押金不予返还'],
    evidence: '租赁期间如周边同户型租金均价上涨超过20%，甲方有权要求乙方按上涨比例相应调整租金。乙方如不接受调整，须在15日内搬离，押金不予返还。',
    explain: '租期内赋予出租方单方涨租权，且承租人不同意就要搬离并损失押金，风险很高。',
    suggestion: '建议删除租期内单方调价权，租金在固定租期内保持不变。',
    negotiation: '租金是租赁合同核心条款，固定租期内不应由一方单方改变。',
    replacement: '租赁期限内月租金保持不变。合同期满续租时，双方可根据市场情况另行协商租金标准。',
  }))

  add(makeLeaseFinding({
    id: 'lease-daily-late-fee-5-percent',
    title: '日息 5% 滞纳金过高',
    level: 'high',
    score: 18,
    dimension: '违约责任',
    priority: 'P0',
    keywords: ['每逾期一日', '月租金5%', '滞纳金'],
    minHits: 2,
    evidence: '乙方逾期支付租金，每逾期一日加收月租金5%作为滞纳金。',
    explain: '按月租金每日 5% 计算，逾期 20 天就相当于一个月租金，明显偏高。',
    suggestion: '建议改为每日万分之三至万分之五，或设置总额上限。',
    negotiation: '可以承认逾期应承担责任，但要求费用与实际损失相当。',
    replacement: '乙方逾期支付租金的，每逾期一日按逾期金额的万分之五向甲方支付违约金，违约金总额最高不超过当期应付租金的20%。',
  }))

  add(makeLeaseFinding({
    id: 'lease-lockout-forfeiture',
    title: '逾期换锁收房并没收全部款项',
    level: 'high',
    score: 20,
    dimension: '居住权',
    priority: 'P0',
    keywords: ['逾期超过7日', '换锁收回房屋', '已收租金及押金不予退还'],
    evidence: '逾期超过7日的，甲方有权换锁收回房屋，已收租金及押金不予退还。',
    explain: '出租方自行换锁收房容易引发居住权、财物和程序争议，且没收全部款项过重。',
    suggestion: '建议改为书面催告、合理宽限期和依法解除，不应自行换锁。',
    negotiation: '要求保留催告和协商窗口，避免出租人单方强制处置房屋和财物。',
    replacement: '乙方逾期支付租金超过7日的，甲方应先书面催告并给予不少于7日宽限期；宽限期届满仍未支付的，甲方可依法解除合同并按实际损失主张违约责任。',
  }))

  add(makeLeaseFinding({
    id: 'lease-deposit-return-delay',
    title: '押金退还周期过长',
    level: 'medium',
    score: 9,
    dimension: '押金',
    priority: 'P1',
    keywords: ['45个工作日内退还押金'],
    evidence: '合同终止且乙方已结清费用、交还钥匙后，甲方在45个工作日内退还押金。',
    explain: '押金退还周期接近两个月，承租人资金被占用时间过长。',
    suggestion: '建议改为交房验收后 3 至 7 个工作日内退还。',
    negotiation: '押金只用于担保未结清费用和损坏，不应长期占用。',
    replacement: '合同终止并完成交房验收、费用结清后，甲方应在7个工作日内无息退还剩余押金。',
  }))

  add(makeLeaseFinding({
    id: 'lease-arbitrary-deposit-deduction',
    title: '押金扣款项目过宽',
    level: 'high',
    score: 16,
    dimension: '押金',
    priority: 'P0',
    keywords: ['全屋保洁费（不低于400元）', '家具家电折旧补偿', '甲方认定的其他合理扣款'],
    evidence: '退还时甲方可扣除以下费用：房屋及设施维修费、全屋保洁费（不低于400元）、墙面修补粉刷费、家具家电折旧补偿、以及甲方认定的其他合理扣款。',
    explain: '扣款项目包含固定保洁费、折旧补偿和出租方单方认定事项，押金可能被任意扣减。',
    suggestion: '建议扣款限于实际损坏、未结清费用，并要求提供票据或维修凭证。',
    negotiation: '要求“实际发生、合理必要、凭证支持”三项条件同时满足。',
    replacement: '押金仅可用于抵扣乙方未结清费用或因乙方原因造成的实际损坏维修费。甲方扣款应提供照片、维修清单和有效票据，正常使用损耗不得从押金中扣除。',
  }))

  add(makeLeaseFinding({
    id: 'lease-cleaning-repair-no-voucher',
    title: '保洁维修扣款缺少凭证边界',
    level: 'medium',
    score: 11,
    dimension: '费用',
    priority: 'P1',
    keywords: ['保洁费', '维修费', '从押金中扣除'],
    minHits: 2,
    evidence: '退还时甲方可扣除以下费用：房屋及设施维修费、全屋保洁费（不低于400元）、墙面修补粉刷费、家具家电折旧补偿、以及甲方认定的其他合理扣款。',
    explain: '保洁、维修、粉刷等费用如果没有照片、清单、票据和责任归属，退租时容易变成固定扣款。',
    suggestion: '建议写明扣款必须基于实际损坏或未结费用，并提供照片、明细和有效票据。',
    negotiation: '可以承担自己造成的损坏，但不接受无明细、无票据或固定金额扣押金。',
    replacement: '甲方主张保洁、维修、粉刷等费用扣款的，应提供交接照片、费用明细、维修或保洁票据，并说明该费用系乙方原因造成且实际发生；无法提供有效凭证的，不得从押金中扣除。',
  }))

  add(makeLeaseFinding({
    id: 'lease-appliance-depreciation-deduction',
    title: '家具家电折旧转嫁给租客',
    level: 'medium',
    score: 10,
    dimension: '押金',
    priority: 'P1',
    keywords: ['家具家电折旧补偿', '押金', '扣除'],
    minHits: 2,
    evidence: '退还时甲方可扣除以下费用：房屋及设施维修费、全屋保洁费（不低于400元）、墙面修补粉刷费、家具家电折旧补偿、以及甲方认定的其他合理扣款。',
    explain: '家具家电正常折旧属于租赁使用中的自然损耗，不应当然由承租人从押金中补偿。',
    suggestion: '建议区分自然折旧和人为损坏，只有承租人原因造成的实际损坏才可扣款。',
    negotiation: '退租时先按入住验房照片和设备清单核对，正常老化不应算承租人责任。',
    replacement: '家具家电因正常使用产生的自然折旧不作为扣款依据；因乙方不当使用造成损坏的，乙方按维修实际支出承担责任，甲方应提供照片、维修清单和票据。',
  }))

  add(makeLeaseFinding({
    id: 'lease-all-maintenance-tenant',
    title: '自然损耗维修全部转嫁承租人',
    level: 'high',
    score: 16,
    dimension: '维修',
    priority: 'P0',
    keywords: ['任何问题的，由乙方自行维修并承担费用', '自然原因造成的损坏，同样由乙方负责'],
    evidence: '租赁期内房屋及附属设施出现任何问题的，由乙方自行维修并承担费用。因水管老化、墙体开裂等自然原因造成的损坏，同样由乙方负责。',
    explain: '水管老化、墙体开裂等非承租人原因造成的问题也由承租人承担，明显加重承租人责任。',
    suggestion: '建议区分人为损坏和自然损耗，房屋主体、老化和设备自然故障由出租人维修。',
    negotiation: '承租人可承担人为损坏，不应承担房屋老化和结构问题。',
    replacement: '因房屋主体结构、管线老化、设备自然损耗或非乙方原因造成的维修费用由甲方承担；因乙方不当使用造成的损坏由乙方承担。',
  }))

  add(makeLeaseFinding({
    id: 'lease-landlord-entry-no-consent',
    title: '出租方可不经同意进入房屋',
    level: 'high',
    score: 18,
    dimension: '居住权',
    priority: 'P0',
    keywords: ['进入房屋进行检查', '带人看房', '无需另行征得乙方同意'],
    evidence: '甲方及中介人员有权在合理时间进入房屋进行检查、维修或带人看房，无需另行征得乙方同意。',
    explain: '租赁期间承租人享有房屋占有和安宁居住利益，出租方未经同意进入房屋风险很高。',
    suggestion: '建议要求提前通知并经承租人确认，紧急维修除外。',
    negotiation: '检查和带看可以配合，但必须提前预约并尊重居住安全和隐私。',
    replacement: '甲方或中介需进入房屋检查、维修或带看时，应至少提前24小时通知乙方并取得乙方同意；紧急抢修等特殊情况除外。',
  }))

  add(makeLeaseFinding({
    id: 'lease-pet-forfeiture-no-cure',
    title: '宠物违约直接没收押金',
    level: 'medium',
    score: 11,
    dimension: '违约责任',
    priority: 'P1',
    keywords: ['不得饲养宠物', '立即解除合同', '没收押金'],
    minHits: 2,
    evidence: '乙方不得饲养宠物，如有违反甲方有权立即解除合同并没收押金。',
    explain: '宠物限制可以约定，但直接解除并没收全部押金缺少整改期和实际损失边界，责任偏重。',
    suggestion: '建议改为事先书面同意机制，违规时先通知整改，押金只赔偿实际损坏。',
    negotiation: '如果确实不养宠物，也建议保留“实际损失 + 整改期”表述，避免轻微争议被无限放大。',
    replacement: '未经甲方书面同意，乙方不得饲养宠物。乙方违反约定的，甲方应先书面通知整改；如造成房屋或设施实际损坏，乙方按有效凭证承担修复费用。',
  }))

  add(makeLeaseFinding({
    id: 'lease-sublet-share-overbroad',
    title: '转租合住限制过宽',
    level: 'medium',
    score: 10,
    dimension: '居住权',
    priority: 'P1',
    keywords: ['不得以任何形式转租', '与他人合住', '视为严重违约'],
    minHits: 2,
    evidence: '乙方不得以任何形式转租、转借或与他人合住，否则视为严重违约。',
    explain: '禁止转租有合理性，但把临时同住、家庭成员居住等都直接列为严重违约，边界过宽。',
    suggestion: '建议区分转租、转借、长期新增居住人和短期访客，并允许经书面同意调整居住人。',
    negotiation: '可承诺不擅自转租牟利，但应保留家庭成员、短期访客和经同意合住的空间。',
    replacement: '未经甲方书面同意，乙方不得将房屋转租、转借或用于经营性合租。乙方新增长期共同居住人的，应提前告知甲方并经书面确认；正常亲友短期探访不视为转租或严重违约。',
  }))

  add(makeLeaseFinding({
    id: 'lease-excessive-restoration',
    title: '退租恢复义务过重',
    level: 'medium',
    score: 10,
    dimension: '押金',
    priority: 'P1',
    keywords: ['全屋墙面重新粉刷', '全部区域深度保洁', '费用按市场价从押金中扣除'],
    evidence: '退租交房时，乙方须将全屋恢复至出租前的整洁状态，包括全屋墙面重新粉刷（白色乳胶漆）、全部区域深度保洁。如甲方认为恢复不到位，由甲方安排第三方处理，费用按市场价从押金中扣除。',
    explain: '要求退租必然全屋粉刷和深度保洁，且由出租方单方判断，容易扩大扣押金范围。',
    suggestion: '建议限于非正常使用造成的损坏，正常使用痕迹不应要求全屋翻新。',
    negotiation: '可承诺基本清洁交付，但不接受把正常折旧变成翻新义务。',
    replacement: '乙方退租时应保持房屋基本清洁并返还钥匙。正常使用损耗不构成违约；因乙方原因造成明显损坏的，乙方按实际维修费用承担责任。',
  }))

  add(makeLeaseFinding({
    id: 'lease-decoration-use-overrestriction',
    title: '装修改造限制过细',
    level: 'low',
    score: 7,
    dimension: '居住权',
    priority: 'P2',
    keywords: ['不得对房屋进行任何形式的装修改造', '墙面打孔', '更换家具位置'],
    minHits: 2,
    evidence: '乙方不得对房屋进行任何形式的装修改造，包括但不限于墙面打孔、贴墙纸、更换家具位置。',
    explain: '禁止破坏结构合理，但把移动家具、轻微安装也全部禁止，可能影响正常居住使用。',
    suggestion: '建议把限制范围收窄到结构改造、破坏性装修和不可恢复行为。',
    negotiation: '可承诺退租恢复原状，但希望保留合理布置家具和非破坏性使用空间。',
    replacement: '未经甲方书面同意，乙方不得进行改变房屋结构、损坏墙体或影响安全的装修改造。乙方可在不损坏房屋和设施的前提下合理摆放家具；退租时按交接清单返还。',
  }))

  add(makeLeaseFinding({
    id: 'lease-utility-no-voucher',
    title: '杂费收费缺少凭证',
    level: 'medium',
    score: 9,
    dimension: '费用',
    priority: 'P1',
    keywords: ['不得要求提供原始缴费凭证'],
    evidence: '甲方每季度抄表后通知乙方缴费，乙方不得要求提供原始缴费凭证。',
    explain: '水电燃气费用由出租方通知但不提供原始凭证，承租人难以核对真实成本。',
    suggestion: '建议要求提供账单、缴费记录或物业/供水供电单位凭证。',
    negotiation: '费用可由承租人承担，但应透明可核验。',
    replacement: '甲方代收水、电、燃气、物业等费用的，应向乙方提供抄表记录、缴费账单或有效凭证，乙方核对无误后支付。',
  }))

  add(makeLeaseFinding({
    id: 'lease-broad-default-six-months',
    title: '违约情形过宽且违约金过高',
    level: 'high',
    score: 18,
    dimension: '违约责任',
    priority: 'P0',
    keywords: ['相当于6个月租金的违约金', '其他甲方认为影响房屋价值的行为'],
    evidence: '乙方有下列情形之一的，甲方有权立即解除合同、收回房屋，押金及剩余租金不予退还，并有权要求乙方另行赔偿相当于6个月租金的违约金： 　　（1）擅自转租或转借的； 　　（2）拖欠租金超过3天的； 　　（3）利用房屋从事违法活动的； 　　（4）擅自饲养宠物的； 　　（5）擅自改动房屋结构的； 　　（6）其他甲方认为影响房屋价值的行为。',
    explain: '违约情形包含出租方主观判断，且同时没收押金、剩余租金并追加 6 个月违约金，责任叠加过重。',
    suggestion: '建议删除主观兜底项，违约金改为与实际损失相当，并设置整改期。',
    negotiation: '可接受严重违约解除，但普通违约应先通知整改。',
    replacement: '乙方严重违约且经甲方书面催告后仍未整改的，甲方可解除合同并要求乙方承担实际损失；违约金最高不超过1个月租金，已收但未发生的租金应据实退还。',
  }))

  add(makeLeaseFinding({
    id: 'lease-landlord-loss-exclusion',
    title: '出租方违约责任被排除',
    level: 'medium',
    score: 12,
    dimension: '违约责任',
    priority: 'P1',
    keywords: ['仅退还剩余租金', '不承担搬家费、误工费等其他任何损失'],
    evidence: '因甲方原因导致乙方无法继续居住的，甲方仅退还剩余租金，不承担搬家费、误工费等其他任何损失。',
    explain: '出租方原因导致无法居住时，只退剩余租金不足以覆盖承租人的搬迁和替代租房损失。',
    suggestion: '建议至少承担合理搬家费、临时住宿差价和同等违约金。',
    negotiation: '这类损失是出租方违约的直接后果，应保留合理赔偿空间。',
    replacement: '因甲方原因导致乙方无法继续居住的，甲方应退还剩余租金和押金，并赔偿乙方因此产生的合理搬家费、临时住宿费及其他直接损失。',
  }))

  add(makeLeaseFinding({
    id: 'lease-overbroad-exemption',
    title: '免责事由过宽',
    level: 'medium',
    score: 12,
    dimension: '解除',
    priority: 'P1',
    keywords: ['甲方债务纠纷', '邻居投诉', '物业公司干涉', '甲方不承担违约责任'],
    evidence: '因政府征收、拆迁、房屋被司法查封、甲方债务纠纷、邻居投诉、物业公司干涉等非甲方主观意愿所能控制的原因，造成合同无法继续履行的，甲方不承担违约责任，仅按乙方实际居住天数结算应退租金。',
    explain: '把甲方债务纠纷、邻居投诉、物业干涉等都列为免责，范围明显过宽。',
    suggestion: '建议只保留法定不可抗力或非双方原因，甲方自身债务和权属问题不应免责。',
    negotiation: '区分不可抗力和出租方自身风险，不能把所有外部争议都转嫁给承租人。',
    replacement: '因不可抗力或依法征收拆迁导致合同无法履行的，双方按实际居住天数结算；因甲方权属、债务、抵押、查封或管理原因导致无法居住的，甲方应承担违约责任。',
  }))

  add(makeLeaseFinding({
    id: 'lease-unfavorable-jurisdiction',
    title: '管辖地点偏向出租方',
    level: 'low',
    score: 7,
    dimension: '管辖',
    priority: 'P2',
    keywords: ['甲方户籍所在地人民法院'],
    evidence: '双方发生争议协商不成的，应向甲方户籍所在地人民法院起诉。',
    explain: '约定到出租方户籍所在地起诉，可能增加承租人维权成本，且不一定与房屋所在地一致。',
    suggestion: '建议改为房屋所在地法院或合同履行地法院。',
    negotiation: '房屋所在地与证据、现场勘验更相关，也更中立。',
    replacement: '双方发生争议协商不成的，应向房屋所在地有管辖权的人民法院提起诉讼。',
  }))

  add(makeLeaseFinding({
    id: 'lease-format-clause-waiver',
    title: '签字即放弃异议且解释权归出租方',
    level: 'medium',
    score: 12,
    dimension: '格式条款',
    priority: 'P1',
    keywords: ['不得以"未注意"或"不理解"', '本合同解释权归甲方'],
    evidence: '乙方签字即视为已充分阅读并完全同意本合同全部内容，此后不得以"未注意"或"不理解"为由对任何条款提出异议。本合同解释权归甲方。',
    replaceFrom: '乙方签字即视为已充分阅读并完全同意本合同全部内容，此后不得以"未注意"或"不理解"为由对任何条款提出异议。本合同解释权归甲方。',
    explain: '该条款试图排除承租人对格式条款的异议，并把解释权单方交给出租方，容易削弱承租人救济。',
    suggestion: '建议删除单方解释权，改为双方协商解释，争议由法院依法判断。',
    negotiation: '合同解释不能由一方最终决定，尤其是格式条款。',
    replacement: '双方确认已阅读并理解本合同内容。对合同条款理解发生争议的，应按照法律规定、合同目的、交易习惯和公平原则解释。',
  }))

  add(makeLeaseFinding({
    id: 'lease-title-defect-no-liability',
    title: '房屋权属问题责任不足',
    level: 'medium',
    score: 9,
    dimension: '权属',
    priority: 'P1',
    keywords: ['房屋权属问题', '双方互不追究'],
    evidence: '如因房屋权属问题导致乙方无法继续居住的，甲方退还剩余租金，双方互不追究。',
    explain: '如果因出租方权属瑕疵导致无法居住，仅退剩余租金不能覆盖承租人搬迁等直接损失。',
    suggestion: '建议要求出租方保证有权出租，并对权属瑕疵承担违约责任。',
    negotiation: '房屋权属是出租方基础义务，不能只退未住期间租金。',
    replacement: '甲方应保证其对房屋享有合法出租权。因权属瑕疵导致乙方无法使用房屋的，甲方应退还剩余租金和押金，并赔偿乙方因此产生的合理直接损失。',
  }))

  return findings
}

function getProfessionalFindings(text, profile) {
  if (!text.trim()) return []
  if (profile.contractType === 'lease') return getLeaseFindings(text)

  const findings = []
  const strictMode = profile.reviewDepth === 'strict'
  const isServiceContract = profile.contractType === 'service'

  if (!includesAny(text, ['责任上限', '赔偿上限', '累计赔偿', '最高赔偿', '不超过合同金额'])) {
    findings.push(
      makeProfessionalFinding({
        id: 'liability-cap-missing',
        title: '缺少责任上限约定',
        level: strictMode ? 'high' : 'medium',
        score: strictMode ? 16 : 11,
        dimension: '违约责任',
        priority: strictMode ? 'P0' : 'P1',
        keywords: ['违约', '赔偿'].filter((keyword) => text.includes(keyword)),
        explain: '合同没有明确累计赔偿责任上限，发生争议时可能导致赔偿边界不可控。',
        suggestion: '建议补充责任上限，并保留故意、重大过失、保密和知识产权侵权等例外。',
        evidence: '未检出“责任上限、赔偿上限、累计赔偿、最高赔偿”等边界表述。',
        legalBasis: '参考民法典合同编关于违约责任、损失赔偿和公平原则的规则。',
        negotiation: '可先提出“以合同金额为上限”的通用方案，再接受对重大过失和保密侵权设置例外。',
        replacement:
          '除因故意、重大过失、侵犯知识产权或违反保密义务造成的损失外，任一方在本合同项下的累计赔偿责任以本合同已支付或应支付金额为上限。',
      }),
    )
  }

  if (
    includesAny(text, ['个人信息', '用户数据', '客户数据', '敏感信息', '数据'])
    && !includesAny(text, ['处理目的', '最小必要', '授权同意', '删除', '脱敏', '安全措施'])
  ) {
    findings.push(
      makeProfessionalFinding({
        id: 'personal-data-boundary',
        title: '数据处理边界不足',
        level: 'high',
        score: 18,
        dimension: '数据合规',
        priority: 'P0',
        keywords: ['个人信息', '用户数据', '客户数据', '数据'].filter((keyword) => text.includes(keyword)),
        explain: '合同涉及数据或个人信息，但缺少处理目的、范围、授权、安全措施和删除机制。',
        suggestion: '建议补充数据处理附件或专门条款，明确最小必要、授权基础、保存期限和删除义务。',
        evidence: '检出数据相关表述，但未检出处理目的、最小必要、授权同意、删除或安全措施。',
        legalBasis: '参考个人信息保护法关于合法、正当、必要、诚信和最小必要处理原则的要求。',
        negotiation: '可要求对方提供数据清单和处理目的，先锁定“能用什么数据、用到什么时候、如何删除”。',
        replacement:
          '双方处理个人信息或客户数据时，应限于履行本合同所必需的目的和最小范围，并采取合理安全措施。未经数据提供方书面同意，任何一方不得超范围使用、披露或转让相关数据；合同终止后应按要求返还、删除或匿名化处理。',
      }),
    )
  }

  if (
    includesAny(text, ['调整服务范围', '新增需求', '变更', '无条件配合'])
    && !includesAny(text, ['变更单', '书面确认', '费用和周期', '另行确认'])
  ) {
    findings.push(
      makeProfessionalFinding({
        id: 'change-control-missing',
        title: '需求变更控制不足',
        level: 'medium',
        score: 12,
        dimension: '履行',
        priority: 'P1',
        keywords: ['调整服务范围', '新增需求', '变更', '无条件配合'].filter((keyword) => text.includes(keyword)),
        explain: '合同允许服务范围或需求变化，但没有约定变更确认、费用调整和交付周期。',
        suggestion: '建议加入变更单机制，任何新增或调整需求都需书面确认费用、周期和交付物。',
        evidence: '检出变更或无条件配合表述，但未检出变更单、书面确认、费用和周期安排。',
        legalBasis: '参考合同履行中诚实信用、协作履行和合同目的解释规则。',
        negotiation: '不要直接拒绝配合，可以改为“可配合，但需确认费用、排期和验收标准”。',
        replacement:
          '任何新增需求、服务范围调整或交付标准变更，均应由双方以书面变更单确认对应费用、交付周期和验收标准；未经确认的变更不视为乙方当然义务。',
      }),
    )
  }

  if (isServiceContract && !includesAny(text, ['交付清单', '交付成果', '源文件范围', '验收标准'])) {
    findings.push(
      makeProfessionalFinding({
        id: 'deliverable-list-missing',
        title: '交付物清单不够明确',
        level: 'medium',
        score: 10,
        dimension: '验收',
        priority: 'P1',
        keywords: ['服务', '交付'].filter((keyword) => text.includes(keyword)),
        explain: '服务类合同如果没有明确交付清单和验收标准，后续容易产生范围争议。',
        suggestion: '建议列明文件格式、数量、版本、源文件范围、验收标准和交付方式。',
        evidence: '服务合同画像下，未检出交付清单、交付成果、源文件范围或验收标准。',
        legalBasis: '参考合同条款解释应结合合同性质、目的、交易习惯和履行行为的规则。',
        negotiation: '可以把交付清单作为附件，避免在正文中反复拉扯范围。',
        replacement:
          '交付成果以附件《交付物清单》为准，清单应明确交付物名称、数量、格式、版本、源文件范围、交付方式和验收标准。清单外新增事项由双方另行书面确认。',
      }),
    )
  }

  if (!includesAny(text, ['通知地址', '电子邮件', '送达', '书面通知', '联系人'])) {
    findings.push(
      makeProfessionalFinding({
        id: 'notice-service-missing',
        title: '通知送达机制缺失',
        level: 'low',
        score: 6,
        dimension: '证据',
        priority: 'P2',
        keywords: [],
        explain: '合同未约定通知方式和送达规则，解除、催告、验收反馈等关键动作可能难以举证。',
        suggestion: '建议写明联系人、邮箱、地址、送达时间和变更通知义务。',
        evidence: '未检出通知地址、电子邮件、送达、书面通知或联系人条款。',
        legalBasis: '参考合同履行和争议解决中的通知、催告与证据留存要求。',
        negotiation: '这是低对抗条款，通常可作为“提高沟通效率”的中性补充提出。',
        replacement:
          '双方确认本合同载明的联系人、电子邮箱和通讯地址为有效通知方式。通知发送至约定邮箱或地址后视为送达；任一方变更联系方式的，应提前书面通知对方。',
      }),
    )
  }

  return findings
}

function createKnowledgePrompt(profile) {
  const contractType = getContractTypeLabel(profile.contractType)
  const partyRole = partyRoleOptions.find((item) => item.value === profile.partyRole)?.label
  const reviewDepth = reviewDepthOptions.find((item) => item.value === profile.reviewDepth)?.label
  const knowledgeLines = knowledgeBaseItems.map((item) => `- ${item.title}（${item.tag}）：${item.text}`).join('\n')
  if (profile.contractType === 'lease') {
    return `审查画像：
- 合同类型：${contractType}
- 我方身份：${partyRole}
- 审查强度：${reviewDepth}

内置知识库：
${knowledgeLines}

房屋租赁合同必须重点检查：自动续租涨租、单方调价、押金扣款和退还周期、保洁维修扣款凭证、家具家电自然折旧、维修责任归属、出租人入户权、宠物违约责任、转租合住边界、装修恢复义务、逾期滞纳金比例、换锁收房条款、提前解除不对等、剩余租金没收、违约金过高、杂费凭证、管辖地偏好、格式条款效力、权属瑕疵责任、退租恢复义务、免责范围过宽。`
  }

  return `审查画像：
- 合同类型：${contractType}
- 我方身份：${partyRole}
- 审查强度：${reviewDepth}

内置知识库：
${knowledgeLines}

请优先检查：付款与验收、解除权对等、违约责任上限、知识产权归属、保密期限与违约金、个人信息/数据处理、管辖与通知送达、需求变更控制、证据留存。`
}

function analyzeContract(text, profile = { contractType: 'lease', partyRole: 'partyB', reviewDepth: 'strict' }) {
  const reviewText = cleanContractTextForReview(text)
  const lowerText = reviewText.toLowerCase()

  const baseFindings =
    profile.contractType === 'service'
      ? riskRules
          .map((rule) => {
            const hits = rule.keywords.filter((keyword) =>
              lowerText.includes(keyword.toLowerCase()),
            )

            return {
              ...rule,
              ...riskDetails[rule.id],
              hits,
              matched: hits.length > 0,
            }
          })
          .filter((rule) => rule.matched)
      : []

  return [...baseFindings, ...getProfessionalFindings(reviewText, profile)]
}

function getRiskSummary(findings) {
  const rawScore = findings.reduce((total, item) => total + item.score, 0)
  const score = softenRiskScore(rawScore)
  const highCount = findings.filter((item) => item.level === 'high').length
  const mediumCount = findings.filter((item) => item.level === 'medium').length

  if (score >= 70) {
    return { score, label: '高风险', tone: 'danger', advice: '建议先修核心条款，再进入签署。', highCount, mediumCount }
  }

  if (score >= 35) {
    return { score, label: '需重点关注', tone: 'warning', advice: '主要风险可通过补充条款降低。', highCount, mediumCount }
  }

  return { score, label: '低风险', tone: 'safe', advice: '未发现明显高风险，仍建议人工复核。', highCount, mediumCount }
}

function getDimensionScores(findings) {
  return scoreDimensions.map((dimension) => {
    const rawScore = findings
      .filter((finding) => finding.dimension === dimension)
      .reduce((total, finding) => total + finding.score * 3, 0)
    const score = softenRiskScore(rawScore)

    return {
      dimension,
      score,
      tone: score >= 70 ? 'high' : score >= 35 ? 'medium' : 'low',
    }
  })
}

function createRevisedContractDraft(contractText, revisionItems) {
  const cleanText = cleanContractTextForReview(contractText)
  return revisionItems.reduce((draft, item) => applyRevisionItemToText(draft, item, { appendIfMissing: true }), cleanText).trim()
}

function parseMoney(value) {
  const amount = Number(String(value).replace(/[^\d.]/g, ''))
  return Number.isFinite(amount) ? amount : 0
}

function formatMoney(value) {
  return `${Math.max(0, Math.round(value)).toLocaleString('zh-CN')} 元`
}

function calculateDepositReturn(inputs) {
  const depositAmount = parseMoney(inputs.depositAmount)
  const unpaidFees = parseMoney(inputs.unpaidFees)
  const repairCost = parseMoney(inputs.repairCost)
  const cleaningCost = parseMoney(inputs.cleaningCost)
  const hasVoucher = inputs.hasVoucher === 'yes'
  const normalWear = inputs.normalWear === 'yes'
  const documentedDamageDeduction = hasVoucher && !normalWear ? repairCost + cleaningCost : 0
  const totalDeduction = Math.min(depositAmount, unpaidFees + documentedDamageDeduction)
  const estimatedReturn = Math.max(0, depositAmount - totalDeduction)
  const warning = !hasVoucher && (repairCost > 0 || cleaningCost > 0)
    ? '房东未提供票据时，维修和保洁扣款建议要求照片、清单和发票。'
    : normalWear
      ? '正常使用损耗通常不应从押金中随意扣除。'
      : '存在非正常损坏且有凭证时，可按实际损失协商扣除。'

  return {
    estimatedReturn,
    totalDeduction,
    warning,
  }
}

function formatEvidenceDate(value) {
  if (!value) return '待确认'
  return value
}

function compactText(text, maxLength = 1200) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized

  return `${normalized.slice(0, maxLength)}...`
}

function getEvidenceContextSummary(state) {
  const evidenceState = normalizeEvidencePackState(state)
  const values = Object.values(evidenceState.evidence).flat()
  const checked = values.filter(Boolean).length
  const total = values.length
  const percent = total ? Math.round((checked / total) * 100) : 0
  const missingGroups = Object.entries(evidenceGroupMeta)
    .map(([group, meta]) => {
      const missing = meta.items.filter((_, index) => !evidenceState.evidence[group][index])
      return missing.length ? `${meta.title}缺${missing.length}项` : ''
    })
    .filter(Boolean)

  return [
    `完整度：${percent}%（${checked}/${total}）`,
    `地址：${evidenceState.formData.address || '待填写'}`,
    `押金：${evidenceState.formData.deposit || '待填写'} 元，月租：${evidenceState.formData.monthlyRent || '待填写'} 元`,
    `退租/交接：${formatEvidenceDate(evidenceState.formData.checkoutDate)} / ${formatEvidenceDate(evidenceState.formData.handoverDate)} ${evidenceState.formData.handoverTime || ''}`.trim(),
    `缺口：${missingGroups.slice(0, 5).join('；') || '暂无明显缺口'}`,
    `沟通说明：${compactText(evidenceState.communicationText || '尚未生成', 260)}`,
  ].join('\n')
}

function getCheckinContextSummary(checkinData) {
  const state = checkinData || createDefaultCheckinState()
  const stats = getCheckinStats(state)
  const defectRows = getCheckinDefectRows(state)

  return [
    `完成度：${stats.percent}%（${stats.checked}/${stats.total}）`,
    `疑似瑕疵：${stats.defects} 处`,
    `已上传验房照片：${stats.photos} 张`,
    `瑕疵摘要：${defectRows.length ? defectRows.slice(0, 6).map((row) => `${row.room}-${row.item}：${row.defect}（${row.note}；照片${row.photoCount}张）`).join('；') : '暂无明显瑕疵'}`,
  ].join('\n')
}

function getSubsidyContextSummary(state) {
  const subsidyState = normalizeSubsidyMatcherState(state)
  const matches = subsidyPolicies
    .filter((item) => item.city === subsidyState.city)
    .map((policy) => ({
      ...policy,
      matchScore: getSubsidyMatchScore(policy, subsidyState.profile),
    }))
    .sort((a, b) => b.matchScore - a.matchScore)

  return [
    `城市：${subsidyState.city}`,
    `个人情况：${compactText(subsidyState.profile, 260)}`,
    `政策线索：${matches.slice(0, 3).map((policy) => `${policy.policy}（${policy.matchScore}%｜${policy.status}）`).join('；') || '暂无匹配政策'}`,
  ].join('\n')
}

function buildSystemAiContext({
  activeTab,
  reviewText,
  effectiveReviewProfile,
  findings,
  summary,
  acceptedIds,
  revisionItems,
  depositInputs,
  depositResult,
  reviewHistory,
}) {
  const evidenceState = loadEvidencePackState()
  const checkinState = loadCheckinInspectionState()
  const subsidyState = loadSubsidyMatcherState()
  const topFindings = findings.slice(0, 6).map((finding) => `${finding.levelText || finding.level}：${finding.title}｜证据：${compactText(finding.evidence, 90)}`)
  const acceptedCount = acceptedIds.size

  return [
    '【租小审系统上下文】',
    `当前模块：${workflowLabels[activeTab] || activeTab}`,
    `合同审查画像：${getContractTypeLabel(effectiveReviewProfile.contractType)}｜${partyRoleOptions.find((item) => item.value === effectiveReviewProfile.partyRole)?.label || effectiveReviewProfile.partyRole}｜${reviewDepthOptions.find((item) => item.value === effectiveReviewProfile.reviewDepth)?.label || effectiveReviewProfile.reviewDepth}`,
    `合同正文摘要：${compactText(reviewText || '暂无合同正文', 1200)}`,
    `风险概览：${summary.label}，评分 ${summary.score}/100，高风险 ${summary.highCount}，中风险 ${summary.mediumCount}，已采纳 ${acceptedCount}`,
    `主要风险：${topFindings.join('；') || '暂无明显风险'}`,
    `已采纳修改：${revisionItems.map((item) => item.title).join('；') || '暂无'}`,
    `押金估算：押金 ${depositInputs.depositAmount || '0'}，未结费用 ${depositInputs.unpaidFees || '0'}，维修扣款 ${depositInputs.repairCost || '0'}，保洁扣款 ${depositInputs.cleaningCost || '0'}，预计应退 ${formatMoney(depositResult.estimatedReturn)}，提示：${depositResult.warning}`,
    '【退租证据包】',
    getEvidenceContextSummary(evidenceState),
    '【入住验房】',
    getCheckinContextSummary(checkinState),
    '【补贴匹配】',
    getSubsidyContextSummary(subsidyState),
    `【审查历史】最近 ${reviewHistory.length} 条：${reviewHistory.slice(0, 3).map((item) => `${item.title}（${item.score}分，高风险${item.highCount}）`).join('；') || '暂无'}`,
  ].join('\n')
}

function buildEvidenceCommunication(type, formData) {
  const address = formData.address || 'XX小区XX栋XX室'
  const deposit = formData.deposit || 'XXXX'
  const checkin = formatEvidenceDate(formData.checkinDate)
  const checkout = formatEvidenceDate(formData.checkoutDate)
  const handoverDate = formatEvidenceDate(formData.handoverDate)
  const handoverTime = formData.handoverTime || '待协商'
  const repairItem = formData.repairItem || '房屋维修事项'
  const repairCost = formData.repairCost || '待确认'
  const notes = formData.notes || '房屋已按合同约定完成基础清洁，家电家具按现状交接。'

  if (type === 'repair') {
    return `尊敬的房东/中介：

您好。

关于${address}的${repairItem}，我已整理维修前后照片、沟通记录和费用凭证。当前维修费用为人民币${repairCost}元。

为便于核对，请您确认以下事项：
1. 该维修是否属于自然损耗、房屋老化或非承租人原因造成；
2. 如需从押金中扣除，请提供维修清单、照片、报价或有效票据；
3. 如属于出租方维修义务，请确认费用承担方式和处理时间。

我会配合合理核验，但不接受无凭证、无明细或将正常使用损耗直接从押金中扣除。

谢谢。`
  }

  if (type === 'handover') {
    return `尊敬的房东/中介：

您好。

我是${address}的承租人，计划于${handoverDate} ${handoverTime}办理退租交接。

交接时建议双方共同确认：
1. 房屋整体状况和重点设施状态；
2. 水、电、燃气、物业等费用结清情况；
3. 钥匙、门禁卡、遥控器等物品交还数量；
4. 押金退还金额、扣款依据和退还时间。

备注事项：${notes}

请您确认上述时间是否方便。如需调整，请回复可交接时间。`
  }

  return `尊敬的房东/中介：

您好。

我是${address}的承租人，入住时间为${checkin}，退租时间为${checkout}。根据租赁合同和实际交接情况，现申请退还押金人民币${deposit}元。

我已准备以下材料用于核对：
1. 租赁合同、押金收据或转账记录；
2. 入住和退租时房屋、家具、家电照片；
3. 水电燃气等费用结清凭证；
4. 与退租、维修、押金相关的沟通记录。

如您认为需要扣除押金，请提供明确扣款项目、金额、照片、维修清单和有效票据。正常使用损耗不应作为任意扣款依据。

请您在完成交接核对后确认押金退还安排。谢谢。`
}

function createEvidencePackageText({ formData, evidence, actions, communicationText }) {
  const selectedLines = []
  const missingLines = []

  Object.entries(evidenceGroupMeta).forEach(([group, meta]) => {
    meta.items.forEach((item, index) => {
      const line = `${meta.title}：${item}`
      if (evidence[group][index]) {
        selectedLines.push(line)
      } else {
        missingLines.push(line)
      }
    })
  })

  const actionLines = evidenceActions.map((item, index) => `${actions[index] ? '[已完成]' : '[待完成]'} ${item.title}：${item.desc}`)

  return [
    '租小审 退租证据包摘要',
    `生成时间：${new Date().toLocaleString()}`,
    '',
    '一、退租基础信息',
    `房屋地址：${formData.address || '待填写'}`,
    `押金金额：${formData.deposit || '待填写'} 元`,
    `月租金：${formData.monthlyRent || '待填写'} 元`,
    `房东/中介：${formData.landlordName || '待填写'}`,
    `联系电话：${formData.landlordPhone || '待填写'}`,
    `入住日期：${formatEvidenceDate(formData.checkinDate)}`,
    `退租日期：${formatEvidenceDate(formData.checkoutDate)}`,
    `交接时间：${formatEvidenceDate(formData.handoverDate)} ${formData.handoverTime || ''}`.trim(),
    '',
    '二、已收集证据',
    selectedLines.length ? selectedLines.join('\n') : '暂无已勾选证据。',
    '',
    '三、待补齐证据',
    missingLines.length ? missingLines.join('\n') : '证据清单已全部勾选。',
    '',
    '四、下一步行动',
    actionLines.join('\n'),
    '',
    '五、沟通说明',
    communicationText || '尚未生成沟通说明。',
    '',
    LEGAL_DISCLAIMER,
  ].join('\n')
}

function getEvidenceGapAdvice(evidenceStats, evidence) {
  const missingGroups = Object.entries(evidenceGroupMeta)
    .map(([group, meta]) => {
      const missingItems = meta.items.filter((_, index) => !evidence[group][index])
      return {
        group,
        title: meta.title,
        missingItems,
      }
    })
    .filter((item) => item.missingItems.length > 0)

  const firstMissing = missingGroups[0]?.missingItems[0] || '证据清单已完整'
  const summary = evidenceStats.percent >= 80
    ? '证据包已接近完整，可以进入交接和押金退还沟通。'
    : evidenceStats.percent >= 50
      ? '证据包已有基础材料，建议优先补齐照片和费用凭证。'
      : '证据链还比较薄，建议先补合同、押金凭证和退租照片。'

  return {
    summary,
    firstMissing,
    missingGroups,
  }
}

async function copyTextToClipboard(text) {
  if (!text) return false

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return true
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  const success = document.execCommand('copy')
  document.body.removeChild(textarea)
  return success
}

async function buildContractDocxBlob(contractDraft) {
  const {
    AlignmentType,
    Document,
    Packer,
    Paragraph,
    TextRun,
    convertInchesToTwip,
  } = await import('docx')

  const lines = String(contractDraft ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
    .split('\n')

  const createTextRun = (text, options = {}) =>
    new TextRun({
      text,
      font: 'SimSun',
      size: options.size || 24,
      bold: options.bold || false,
    })

  const children = lines
    .map((line, index) => {
      const trimmed = line.trim()
      if (!trimmed) {
        return new Paragraph({
          children: [createTextRun('')],
          spacing: { after: 120 },
        })
      }

      if (index === 0) {
        return new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 320 },
          children: [createTextRun(trimmed, { bold: true, size: 36 })],
        })
      }

      if (/^[一二三四五六七八九十]+、/.test(trimmed)) {
        return new Paragraph({
          spacing: { before: 220, after: 100 },
          children: [createTextRun(trimmed, { bold: true, size: 25 })],
        })
      }

      const isSignatureLine = /^(甲方|乙方|日期|签字|联系电话|身份证号|经甲、乙双方)/.test(trimmed)

      return new Paragraph({
        alignment: isSignatureLine ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
        indent: isSignatureLine ? undefined : { firstLine: 480 },
        spacing: { after: 160, line: 444 },
        children: [createTextRun(trimmed)],
      })
    })

  const document = new Document({
    title: '租小审-优化合同',
    creator: '租小审',
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.86),
              right: convertInchesToTwip(0.71),
              bottom: convertInchesToTwip(0.79),
              left: convertInchesToTwip(0.71),
            },
          },
        },
        children,
      },
    ],
  })

  return Packer.toBlob(document)
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function buildTextReportDocxBlob(reportText, title = '租小审报告') {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    TextRun,
    convertInchesToTwip,
  } = await import('docx')
  const lines = String(reportText || title)
    .replace(/\r\n/g, '\n')
    .trim()
    .split('\n')

  const createRun = (text, options = {}) =>
    new TextRun({
      text,
      font: 'SimSun',
      size: options.size || 23,
      bold: options.bold || false,
      color: options.color || '171713',
    })

  const children = lines.map((line, index) => {
    const trimmed = line.trim()

    if (!trimmed) {
      return new Paragraph({
        children: [createRun('')],
        spacing: { after: 80 },
      })
    }

    if (index === 0) {
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        heading: HeadingLevel.TITLE,
        spacing: { after: 260 },
        border: {
          bottom: {
            color: '08D36C',
            size: 8,
            space: 12,
            style: BorderStyle.SINGLE,
          },
        },
        children: [createRun(trimmed, { bold: true, size: 34 })],
      })
    }

    if (/^[一二三四五六七八九十]+、/.test(trimmed)) {
      return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
        children: [createRun(trimmed, { bold: true, size: 27 })],
      })
    }

    if (/^\d+\./.test(trimmed)) {
      return new Paragraph({
        spacing: { before: 120, after: 80, line: 390 },
        children: [createRun(trimmed, { bold: true, size: 24 })],
      })
    }

    const isMetaLine = /^(生成时间|房屋类型|验房完成度|疑似瑕疵|已上传照片|合同类型|用户身份|审查深度|综合风险值|高风险|中风险|低风险|原文摘要)/.test(trimmed)

    return new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: isMetaLine ? 90 : 140, line: 420 },
      indent: isMetaLine ? undefined : { firstLine: 420 },
      children: [createRun(trimmed, { bold: isMetaLine })],
    })
  })

  const document = new Document({
    title,
    creator: '租小审',
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.78),
              right: convertInchesToTwip(0.72),
              bottom: convertInchesToTwip(0.78),
              left: convertInchesToTwip(0.72),
            },
          },
        },
        children,
      },
    ],
  })

  return Packer.toBlob(document)
}

function createReportText({ summary, findings, revisionItems, contractText, reviewProfile }) {
  const contractType = contractTypeOptions.find((item) => item.value === reviewProfile.contractType)?.label
  const partyRole = partyRoleOptions.find((item) => item.value === reviewProfile.partyRole)?.label
  const reviewDepth = reviewDepthOptions.find((item) => item.value === reviewProfile.reviewDepth)?.label
  const riskLines = findings
    .map((finding, index) => {
      const details = riskDetails[finding.id]
      const priority = finding.priority || details?.priority || 'P2'
      const evidence = finding.evidence || details?.evidence || finding.hits.join('、')
      const negotiation = finding.negotiation || details?.negotiation || '建议结合交易背景与对方协商。'
      return [
        `${index + 1}. ${finding.title}（${finding.levelText}，${priority}）`,
        `风险解释：${finding.explain}`,
        `证据片段：${evidence}`,
        `修改建议：${finding.suggestion}`,
        `谈判话术：${negotiation}`,
      ].join('\n')
    })
    .join('\n\n')

  const revisionLines = revisionItems.length
    ? revisionItems
        .map((item, index) =>
          [
            `${index + 1}. ${item.title}`,
            `原风险：${item.evidence}`,
            `建议替换：${item.replacement}`,
          ].join('\n'),
        )
        .join('\n\n')
    : '暂无已采纳修改。'
  const revisedDraft = revisionItems.length
    ? createRevisedContractDraft(contractText, revisionItems)
    : '暂无修订版合同草案。'

  return [
    '租小审 AI 租房合同解读报告',
    `生成时间：${new Date().toLocaleString()}`,
    '',
    `合同类型：${contractType}`,
    `我方身份：${partyRole}`,
    `审查强度：${reviewDepth}`,
    `知识库：民法典租赁规则、商品房屋租赁管理办法、租房常见陷阱库、押金纠纷裁判思路、租客维权指南、租房谈判策略`,
    '',
    `综合评分：${summary.score}/100`,
    `风险结论：${summary.label}`,
    `审查建议：${summary.advice}`,
    '',
    '一、风险清单',
    riskLines || '未发现明显风险。',
    '',
    '二、已采纳修改说明',
    revisionLines,
    '',
    '三、修订版合同草案',
    revisedDraft,
    '',
    '四、当前合同文本',
    contractText || '暂无合同正文。',
    '',
    LEGAL_DISCLAIMER,
  ].join('\n')
}

function HighlightedContract({ text, findings }) {
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

function LegalDisclaimer({ compact = false }) {
  return (
    <div className={`legal-disclaimer ${compact ? 'compact' : ''}`} role="note">
      <AlertTriangle size={16} aria-hidden="true" />
      <span>{LEGAL_DISCLAIMER}</span>
    </div>
  )
}

function FindingItem({ finding, accepted, onApply }) {
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

function EvidencePack({ onStatus }) {
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
      const blob = await buildTextReportDocxBlob(evidencePackageText, '租小审-退租证据包')
      downloadBlob(blob, `租小审-退租证据包-${new Date().toISOString().slice(0, 10)}.docx`)
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

function CheckinInspection({ onStatus }) {
  const [roomType, setRoomType] = useState('studio')
  const [activeRoom, setActiveRoom] = useState(checkinRooms[0].key)
  const [checkinData, setCheckinData] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.checkinInspection)
    if (!saved) return createDefaultCheckinState()

    try {
      return normalizeCheckinState(JSON.parse(saved))
    } catch {
      return createDefaultCheckinState()
    }
  })
  const [report, setReport] = useState('')
  const [isExportingCheckinDocx, setIsExportingCheckinDocx] = useState(false)

  const stats = useMemo(() => getCheckinStats(checkinData), [checkinData])
  const defectRows = useMemo(() => getCheckinDefectRows(checkinData), [checkinData])
  const selectedRoomType = checkinRoomTypes.find((item) => item.value === roomType)?.label || '租住房屋'
  const activeRoomLabel = checkinRooms.find((room) => room.key === activeRoom)?.label || '当前房间'

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.checkinInspection, JSON.stringify(checkinData))
    } catch {
      onStatus('验房照片较多，本地保存空间不足，请删除部分照片后再继续')
    }
  }, [checkinData, onStatus])

  const updateRecord = (roomKey, itemKey, patch) => {
    setCheckinData((current) => ({
      ...current,
      [roomKey]: {
        ...current[roomKey],
        [itemKey]: {
          ...normalizeCheckinRecord(current[roomKey]?.[itemKey]),
          ...patch,
        },
      },
    }))
  }

  const uploadCheckinPhotos = async (roomKey, item, files) => {
    const incomingFiles = Array.from(files || [])
    const selectedFiles = incomingFiles.filter((file) => file.type.startsWith('image/'))
    const acceptedFiles = selectedFiles.filter((file) => file.size <= CHECKIN_MAX_PHOTO_BYTES)
    const currentPhotos = checkinData[roomKey]?.[item.key]?.photos || []
    const availableSlots = Math.max(0, CHECKIN_MAX_PHOTOS_PER_ITEM - currentPhotos.length)
    const filesToRead = acceptedFiles.slice(0, availableSlots)
    const roomLabel = checkinRooms.find((room) => room.key === roomKey)?.label || activeRoomLabel
    const oversizedCount = selectedFiles.length - acceptedFiles.length
    const skippedByLimit = Math.max(0, acceptedFiles.length - filesToRead.length)

    if (!selectedFiles.length) {
      onStatus('请选择图片格式的验房照片')
      return
    }
    if (!filesToRead.length) {
      onStatus(oversizedCount ? '照片超过 6MB，请压缩后再上传' : `${roomLabel}-${item.label} 已达到 ${CHECKIN_MAX_PHOTOS_PER_ITEM} 张照片上限`)
      return
    }

    try {
      const photos = await Promise.all(
        filesToRead.map(async (file) => ({
          id: `${Date.now()}-${file.name}-${Math.random().toString(16).slice(2)}`,
          name: file.name,
          url: await compressCheckinPhoto(file),
          createdAt: new Date().toLocaleString(),
        })),
      )

      setCheckinData((current) => {
        const currentRecord = normalizeCheckinRecord(current[roomKey]?.[item.key])

        return {
          ...current,
          [roomKey]: {
            ...current[roomKey],
            [item.key]: {
              ...currentRecord,
              photos: [...currentRecord.photos, ...photos].slice(0, CHECKIN_MAX_PHOTOS_PER_ITEM),
              note: currentRecord.note || (currentRecord.status === 'defect' ? '' : `已上传${roomLabel}-${item.label}照片`),
            },
          },
        }
      })

      const skippedText = [
        oversizedCount ? `${oversizedCount} 张超过 6MB 已跳过` : '',
        skippedByLimit ? `${skippedByLimit} 张超过上限未添加` : '',
      ].filter(Boolean).join('，')
      onStatus(`已上传 ${photos.length} 张${roomLabel}-${item.label}照片${skippedText ? `，${skippedText}` : ''}`)
    } catch {
      onStatus('照片读取失败，请重新选择图片')
    }
  }

  const removeCheckinPhoto = (roomKey, itemKey, photoId) => {
    const currentPhotos = checkinData[roomKey]?.[itemKey]?.photos || []
    updateRecord(roomKey, itemKey, {
      photos: currentPhotos.filter((photo) => photo.id !== photoId),
    })
    onStatus('已删除验房照片')
  }

  const resetCheckin = () => {
    setCheckinData(createDefaultCheckinState())
    setReport('')
    onStatus('入住验房记录已重置')
  }

  const generateReport = () => {
    const defectSummary = defectRows.length
      ? defectRows.map((row) => `${row.room}-${row.item}：${row.defect}（${row.note}；照片${row.photoCount}张）`).join('\n')
      : '本次验房未记录明显瑕疵。'
    const nextReport = [
      '租小审入住验房报告',
      `生成时间：${new Date().toLocaleString()}`,
      `房屋类型：${selectedRoomType}`,
      `验房完成度：${stats.checked}/${stats.total}`,
      `疑似瑕疵：${stats.defects} 处`,
      `已上传照片：${stats.photos} 张`,
      '',
      '一、瑕疵记录',
      defectSummary,
      '',
      '二、发给房东/中介的确认话术',
      defectRows.length
        ? `您好，我今天入住${selectedRoomType}时已按房间拍摄并整理验房记录。记录中标注了${defectRows.slice(0, 3).map((row) => row.defect).join('、')}等疑似入住前已存在情况。麻烦确认这些问题为入住时现状，后续退租时不作为我的责任扣除押金。`
        : `您好，我今天入住${selectedRoomType}时已按房间拍摄了入住验房照片。当前未发现明显瑕疵，我会保留全屋照片和水电燃气表读数，作为退租时双方核对的基准。麻烦确认收到，谢谢。`,
      '',
      LEGAL_DISCLAIMER,
    ].join('\n')

    setReport(nextReport)
    onStatus(`入住验房报告已生成，发现 ${stats.defects} 处疑似瑕疵`)
  }

  const exportReport = async () => {
    if (isExportingCheckinDocx) return

    const content = report || '请先生成入住验房报告。'
    setIsExportingCheckinDocx(true)
    onStatus('正在生成 Word 入住验房报告')

    try {
      const blob = await buildTextReportDocxBlob(content, '租小审-入住验房报告')
      downloadBlob(blob, `租小审-入住验房报告-${new Date().toISOString().slice(0, 10)}.docx`)
      onStatus('入住验房报告已生成 DOCX，可下载 Word')
    } catch (error) {
      onStatus(`入住验房报告 DOCX 生成失败：${error.message}`)
    } finally {
      setIsExportingCheckinDocx(false)
    }
  }

  return (
    <div className="checkin-inspection">
      <section className="checkin-hero work-panel">
        <div>
          <p className="section-kicker">Check-in Inspection</p>
          <h2>入住当天先验房，退租时才有对比基准</h2>
          <p>按房屋类型和房间逐项记录状态，疑似瑕疵会自动汇总成房东确认话术和验房报告。</p>
          <div className="checkin-hero-actions">
            <button className="primary-button" type="button" onClick={generateReport}>
              <Sparkles size={17} aria-hidden="true" />
              生成验房报告
            </button>
            <button className="ghost-button" type="button" onClick={exportReport} disabled={isExportingCheckinDocx}>
              <Download size={17} aria-hidden="true" />
              {isExportingCheckinDocx ? '正在生成 Word' : '导出 Word 报告'}
            </button>
          </div>
        </div>
        <div className={`evidence-score ${stats.percent >= 80 ? 'safe' : stats.percent >= 50 ? 'warning' : 'danger'}`}>
          <strong>{stats.percent}%</strong>
          <span>验房完成度</span>
          <em>{stats.defects} 处疑似瑕疵</em>
        </div>
      </section>

      <section className="work-panel checkin-type-panel">
        <div className="panel-head compact">
          <div>
            <h2>选择房屋类型</h2>
            <p>不同房源重点不同，整租看全屋，合租要看公共区边界。</p>
          </div>
        </div>
        <div className="checkin-type-grid">
          {checkinRoomTypes.map((item) => (
            <button className={roomType === item.value ? 'active' : ''} key={item.value} type="button" onClick={() => setRoomType(item.value)}>
              <strong>{item.label}</strong>
              <span>{item.desc}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="work-panel checkin-workbench">
        <div className="panel-head compact">
          <div>
            <h2>逐房间验房记录</h2>
            <p>标记正常、疑似瑕疵，并补充具体说明。</p>
          </div>
          <button className="ghost-button compact-button" type="button" onClick={resetCheckin}>
            重置验房
          </button>
        </div>
        <div className="checkin-room-tabs" role="tablist" aria-label="验房房间">
          {checkinRooms.map((room) => {
            const defectCount = checkinItems.filter((item) => checkinData[room.key][item.key].status === 'defect').length
            return (
              <button className={activeRoom === room.key ? 'active' : ''} key={room.key} type="button" onClick={() => setActiveRoom(room.key)}>
                {room.label}
                {defectCount > 0 && <em>{defectCount}</em>}
              </button>
            )
          })}
        </div>
        <div className="checkin-item-list">
          {checkinItems.map((item) => {
            const record = normalizeCheckinRecord(checkinData[activeRoom]?.[item.key])
            const inputValue = record.status === 'defect' ? record.defect : record.note
            return (
              <article className={`checkin-item ${record.status}`} key={item.key}>
                <div className="checkin-item-main">
                  <strong>{item.label}</strong>
                  <span>{item.desc}</span>
                </div>
                <div className="checkin-status-row">
                  {[
                    { value: 'good', label: '正常' },
                    { value: 'defect', label: '有瑕疵' },
                    { value: 'unchecked', label: '待确认' },
                  ].map((option) => (
                    <button
                      className={record.status === option.value ? 'active' : ''}
                      key={option.value}
                      type="button"
                      onClick={() => updateRecord(activeRoom, item.key, { status: option.value })}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="checkin-detail-cell">
                  <input
                    value={inputValue}
                    onChange={(event) =>
                      updateRecord(activeRoom, item.key, record.status === 'defect' ? { defect: event.target.value } : { note: event.target.value })
                    }
                    placeholder={record.status === 'defect' ? item.defectPlaceholder : item.notePlaceholder}
                  />
                  <p className="checkin-item-advice">{record.status === 'defect' ? item.defectAdvice : item.photoHint}</p>
                  {record.status === 'defect' ? (
                    <div className="checkin-defect-tips" aria-label={`${item.label}瑕疵留证建议`}>
                      {item.defectSuggestions.map((suggestion) => (
                        <span key={suggestion}>{suggestion}</span>
                      ))}
                    </div>
                  ) : null}
                  <div className="checkin-photo-tools">
                    <label className="checkin-inline-upload">
                      <UploadCloud size={15} aria-hidden="true" />
                      <span>{record.photos.length ? `继续上传照片 (${record.photos.length}/${CHECKIN_MAX_PHOTOS_PER_ITEM})` : '上传该部位照片'}</span>
                      <input
                        accept="image/*"
                        multiple
                        type="file"
                        onChange={(event) => {
                          uploadCheckinPhotos(activeRoom, item, event.target.files)
                          event.target.value = ''
                        }}
                      />
                    </label>
                    <small>{item.photoHint}</small>
                  </div>
                  {record.photos.length ? (
                    <div className="checkin-inline-photos" aria-label={`${activeRoomLabel}-${item.label}照片`}>
                      {record.photos.map((photo, index) => (
                        <figure key={photo.id}>
                          <img alt={`${activeRoomLabel}${item.label}验房照片${index + 1}`} src={photo.url} />
                          <figcaption>
                            <strong>照片 {index + 1}</strong>
                            <span>{photo.createdAt || photo.name}</span>
                          </figcaption>
                          <button type="button" onClick={() => removeCheckinPhoto(activeRoom, item.key, photo.id)}>
                            删除
                          </button>
                        </figure>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="work-panel checkin-report-panel">
        <div className="panel-head compact">
          <div>
            <h2>押金自保验房报告</h2>
            <p>生成后可作为退租证据包里的“入住状态基准”。</p>
          </div>
        </div>
        {report ? (
          <div className="checkin-report-grid">
            <div className="checkin-report-summary">
              <strong>{stats.defects} 处</strong>
              <span>疑似瑕疵已记录</span>
              <p>{stats.checked}/{stats.total} 项完成验房，已上传 {stats.photos} 张照片</p>
            </div>
            <div className="checkin-defect-list">
              {defectRows.length ? (
                defectRows.map((row) => (
                  <div key={`${row.room}-${row.item}`}>
                    <strong>{row.room} · {row.item}</strong>
                    <span>{row.defect}，{row.note}，照片 {row.photoCount} 张</span>
                  </div>
                ))
              ) : (
                <div>
                  <strong>暂无明显瑕疵</strong>
                  <span>建议仍保留全屋照片和表读数。</span>
                </div>
              )}
            </div>
            <div className="communication-preview checkin-script">
              <pre>{report}</pre>
            </div>
          </div>
        ) : (
          <p className="empty-note">点击“生成验房报告”后，这里会展示瑕疵汇总和可发给房东的确认话术。</p>
        )}
      </section>
    </div>
  )
}

function SubsidyMatcher({ onStatus }) {
  const [initialState] = useState(() => loadSubsidyMatcherState())
  const [city, setCity] = useState(initialState.city)
  const [profile, setProfile] = useState(initialState.profile)
  const selectedPolicies = useMemo(() => subsidyPolicies.filter((item) => item.city === city), [city])
  const policyMatches = useMemo(
    () =>
      selectedPolicies
        .map((policy) => ({
          ...policy,
          matchScore: getSubsidyMatchScore(policy, profile),
        }))
        .sort((a, b) => b.matchScore - a.matchScore),
    [profile, selectedPolicies],
  )
  const matchScore = policyMatches[0]?.matchScore || 0

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.subsidyMatcher, JSON.stringify({ city, profile }))
  }, [city, profile])

  const matchPolicy = () => {
    onStatus(`已匹配${city}${policyMatches.length}条官方补贴/安居线索，最高匹配度 ${matchScore}%`)
  }

  return (
    <div className="subsidy-layout">
      <section className="work-panel subsidy-hero">
        <div>
          <p className="section-kicker">Rental Subsidy</p>
          <h2>毕业生租房补贴线索匹配</h2>
          <p>按城市和个人情况快速整理可能相关的租房补贴入口。政策口径会变化，正式申请前仍需以官方最新发布为准。</p>
        </div>
        <div className={`evidence-score ${matchScore >= 80 ? 'safe' : matchScore >= 65 ? 'warning' : 'danger'}`}>
          <strong>{matchScore}%</strong>
          <span>最高匹配度</span>
          <em>{city} · {policyMatches.length}条</em>
        </div>
      </section>

      <section className="work-panel subsidy-panel">
        <div className="panel-head">
          <div>
            <h2>填写基础情况</h2>
            <p>选择城市后只展示该城市政策线索，避免杭州页面混入其他地区。</p>
          </div>
          <button className="primary-button compact-button" type="button" onClick={matchPolicy}>
            <Search size={15} aria-hidden="true" />
            匹配补贴线索
          </button>
        </div>
        <div className="config-grid">
          <label className="field">
            <span>城市</span>
            <select value={city} onChange={(event) => setCity(event.target.value)}>
              {subsidyCities.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="field subsidy-profile-field">
            <span>个人情况</span>
            <textarea value={profile} onChange={(event) => setProfile(event.target.value)} />
          </label>
        </div>
      </section>

      <section className="work-panel subsidy-result-panel">
        <div className="panel-head compact">
          <div>
            <h2>{city}官方政策卡片</h2>
            <p>当前只显示所选城市。每张卡片都绑定官方来源，点击卡片可跳转到政策官网或申报入口。</p>
          </div>
          <span className="knowledge-count">{matchScore}%</span>
        </div>
        <div className="subsidy-result-grid">
          {policyMatches.map((policy) => (
            <a className="subsidy-policy-card" href={policy.applyUrl || policy.sourceUrl} key={`${policy.city}-${policy.policy}`} target="_blank" rel="noreferrer">
              <div className="subsidy-card-head">
                <span>{policy.type}</span>
                <em>{policy.matchScore}%</em>
              </div>
              <strong>{policy.policy}</strong>
              <p>{policy.amount}</p>
              <dl>
                <div>
                  <dt>常见条件</dt>
                  <dd>{policy.condition}</dd>
                </div>
                <div>
                  <dt>官方依据</dt>
                  <dd>{policy.sourceName} · 核对 {policy.checkedAt}</dd>
                </div>
              </dl>
              <div className="subsidy-materials">
                {policy.materials.slice(0, 6).map((item) => (
                  <span key={item}>
                    <Check size={14} aria-hidden="true" />
                    {item}
                  </span>
                ))}
              </div>
              <div className="subsidy-card-foot">
                <span>{policy.status}</span>
                <strong>打开官网 →</strong>
              </div>
            </a>
          ))}
        </div>
        <div className="footer-note">
          提示：补贴政策属于强时效信息。本页只收录已绑定官方链接的政策卡片，提交申请前仍应以跳转后的官方页面、申报系统和经办部门最新口径为准。
        </div>
      </section>
    </div>
  )
}

function App() {
  const [contractText, setContractText] = useState(sampleContract)
  const [selectedDemoContractId, setSelectedDemoContractId] = useState(demoContracts[0].id)
  const [activeTab, setActiveTab] = useState('proposal')
  const [showAiConfig, setShowAiConfig] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const evidenceRef = useRef(null)
  const workspaceRef = useRef(null)
  const findingsListRef = useRef(null)
  const guideTriggerRef = useRef(null)
  const guideCloseRef = useRef(null)
  const pendingScrollRestoreRef = useRef(null)
  const pendingModuleEntryRef = useRef(null)
  const moduleActivationTimerRef = useRef(null)
  const moduleTransitionTimerRef = useRef(null)
  const [acceptedIds, setAcceptedIds] = useState(() => new Set())
  const [acceptedRevisionItems, setAcceptedRevisionItems] = useState([])
  const [reviewHistory, setReviewHistory] = useState(() => {
    const savedHistory = localStorage.getItem(STORAGE_KEYS.history) || localStorage.getItem(STORAGE_KEYS.historyLegacy)
    if (!savedHistory) return []

    try {
      return JSON.parse(savedHistory)
    } catch {
      return []
    }
  })
  const [statusMessage, setStatusMessage] = useState('')
  const [isExportingDocx, setIsExportingDocx] = useState(false)
  const [isExportingReportDocx, setIsExportingReportDocx] = useState(false)
  const [aiMessages, setAiMessages] = useState(() => [createAiWelcomeMessage()])
  const [aiDraft, setAiDraft] = useState('')
  const [aiSending, setAiSending] = useState(false)
  const [aiKnowledgeHits, setAiKnowledgeHits] = useState([])
  const [aiFeedback, setAiFeedback] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.aiFeedback)
    if (!saved) return createEmptyAiFeedback()

    try {
      return normalizeAiFeedback(JSON.parse(saved))
    } catch {
      return createEmptyAiFeedback()
    }
  })
  const [aiConfig] = useState(() => {
    const defaultPreset = providerPresets.DeepSeek
    return {
      accessMode: 'platform',
      provider: 'DeepSeek',
      baseUrl: defaultPreset.baseUrl,
      model: defaultPreset.defaultModel,
      apiKey: '',
    }
  })
  const [aiFindings, setAiFindings] = useState(null)
  const [aiQualityReport, setAiQualityReport] = useState(null)
  const [findingListMinHeight, setFindingListMinHeight] = useState(0)
  const [moduleEntering, setModuleEntering] = useState(false)
  const [isReviewing, setIsReviewing] = useState(false)
  const [isImportingContract, setIsImportingContract] = useState(false)
  const [importedContractMeta, setImportedContractMeta] = useState(null)
  const [reviewProfile, setReviewProfile] = useState({
    contractType: 'lease',
    partyRole: 'partyB',
    reviewDepth: 'strict',
  })
  const [depositInputs, setDepositInputs] = useState(defaultDepositInputs)
  const reviewText = useMemo(() => cleanContractTextForReview(contractText), [contractText])
  const effectiveReviewProfile = useMemo(
    () => resolveReviewProfile(reviewProfile, reviewText),
    [reviewProfile, reviewText],
  )
  const localFindings = useMemo(() => analyzeContract(reviewText, effectiveReviewProfile), [reviewText, effectiveReviewProfile])
  const findings = useMemo(
    () => (aiFindings ? mergeFindings(aiFindings, localFindings) : localFindings),
    [aiFindings, localFindings],
  )
  const visibleFindings = useMemo(() => findings.filter((finding) => !acceptedIds.has(finding.id)), [findings, acceptedIds])
  const summary = useMemo(() => getRiskSummary(findings), [findings])
  const dimensionScores = useMemo(() => getDimensionScores(findings), [findings])
  const revisionItems = acceptedRevisionItems
  const revisedContractDraft = useMemo(() => createRevisedContractDraft(contractText, revisionItems), [contractText, revisionItems])
  const depositResult = useMemo(() => calculateDepositReturn(depositInputs), [depositInputs])
  const selectedDemoContract = useMemo(
    () => demoContracts.find((contract) => contract.id === selectedDemoContractId) || demoContracts[0],
    [selectedDemoContractId],
  )
  const allFindingsAccepted = findings.length > 0 && visibleFindings.length === 0
  const visibleKnowledgeItems = useMemo(
    () => (aiKnowledgeHits.length ? aiKnowledgeHits : knowledgeBaseItems),
    [aiKnowledgeHits],
  )
  const knowledgePanelDescription = aiKnowledgeHits.length
    ? '优先展示本次 RAG 命中的依据，AI 回复会先引用这些内容。'
    : '本地规则与 AI Prompt 会共同引用这些租房审查依据。'
  const aiFeedbackText = `反馈：${aiFeedback.helpful} 有帮助 / ${aiFeedback.needsWork} 需改进`
  const importedIsOcr = Boolean(importedContractMeta?.source === '图片 OCR' || importedContractMeta?.type?.includes('OCR'))
  const importedConfidence = Number(importedContractMeta?.confidence || 0)
  const importedNeedsManualCheck = importedIsOcr && importedConfidence < OCR_REVIEW_WARNING_CONFIDENCE

  useEffect(() => {
    try {
      if (reviewHistory.length) {
        localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(reviewHistory))
      } else {
        localStorage.removeItem(STORAGE_KEYS.history)
      }
    } catch {
      // localStorage may be unavailable in private browsing or restricted environments.
    }
  }, [reviewHistory])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.aiFeedback, JSON.stringify(aiFeedback))
  }, [aiFeedback])

  useLayoutEffect(() => {
    const shouldAnimateModuleEntry = pendingModuleEntryRef.current === activeTab
    if (!shouldAnimateModuleEntry) return undefined

    pendingModuleEntryRef.current = null
    setModuleEntering(true)

    window.clearTimeout(moduleTransitionTimerRef.current)
    moduleTransitionTimerRef.current = window.setTimeout(() => {
      setModuleEntering(false)
    }, 520)

    return () => {
      window.clearTimeout(moduleTransitionTimerRef.current)
    }
  }, [activeTab])

  useLayoutEffect(() => {
    const restore = pendingScrollRestoreRef.current
    if (!restore) return undefined

    const restoreScroll = () => {
      const anchor = findingsListRef.current
      if (!anchor) {
        window.scrollTo({
          top: restore.scrollY,
          left: restore.scrollX,
          behavior: 'auto',
        })
        return
      }

      const nextTop = anchor.getBoundingClientRect().top
      const delta = nextTop - restore.anchorTop

      if (Math.abs(delta) > 1) {
        window.scrollBy({
          top: delta,
          left: 0,
          behavior: 'auto',
        })
      }
    }

    restoreScroll()
    const firstFrameId = window.requestAnimationFrame(() => {
      restoreScroll()
      window.requestAnimationFrame(restoreScroll)
    })
    const timeoutId = window.setTimeout(restoreScroll, 120)

    pendingScrollRestoreRef.current = null

    return () => {
      window.cancelAnimationFrame(firstFrameId)
      window.clearTimeout(timeoutId)
    }
  }, [findingListMinHeight, visibleFindings.length])

  useEffect(() => {
    if (!showGuide) return undefined

    const previouslyFocused = document.activeElement
    guideCloseRef.current?.focus({ preventScroll: true })

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setShowGuide(false)
      }
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus({ preventScroll: true })
      }
    }
  }, [showGuide])

  const activeProviderPreset = providerPresets[aiConfig.provider] || providerPresets.DeepSeek
  const modelConnectionLabel = `${activeProviderPreset.label} 平台模型`
  const openRiskGuide = () => {
    setShowGuide(true)
  }

  const navigateToModule = (tab, options = {}) => {
    const anchor = workspaceRef.current
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const stickyOffset = ['.sidebar', '.announcement-strip'].reduce((total, selector) => {
      const element = document.querySelector(selector)
      if (!element) return total

      const style = window.getComputedStyle(element)
      const isVisible = style.display !== 'none' && style.visibility !== 'hidden'
      const isSticky = style.position === 'sticky' || style.position === 'fixed'

      return isVisible && isSticky ? total + element.getBoundingClientRect().height : total
    }, 0)
    const visualGap = 0
    const top = anchor ? Math.max(0, anchor.getBoundingClientRect().top + window.scrollY - stickyOffset - visualGap) : 0
    const shouldPrepareAtTop = anchor && window.scrollY > top + 24

    window.clearTimeout(moduleTransitionTimerRef.current)
    window.clearTimeout(moduleActivationTimerRef.current)

    const activateModule = () => {
      pendingModuleEntryRef.current = tab
      setActiveTab(tab)
    }

    if (shouldPrepareAtTop) {
      window.scrollTo({
        top,
        left: 0,
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      })
      moduleActivationTimerRef.current = window.setTimeout(activateModule, prefersReducedMotion ? 0 : 220)
    } else {
      activateModule()
      if (anchor) {
        window.scrollTo({
          top,
          left: 0,
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
        })
      }
    }

    if (options.closeGuide) {
      setShowGuide(false)
    }
    if (options.message) {
      setStatusMessage(options.message)
    }
  }

  const jumpFromGuide = (tab) => {
    navigateToModule(tab, {
      closeGuide: true,
      message: `已进入${workflowLabels[tab] || tab}首页，可以按避坑流程继续操作`,
    })
  }

  const enterModuleFromCard = (tab) => {
    navigateToModule(tab, {
      message: `正在进入${workflowLabels[tab] || tab}首页`,
    })
  }

  const switchModuleFromNav = (tab) => {
    navigateToModule(tab)
  }

  const openAiExpert = () => {
    setShowAiConfig(true)
    setStatusMessage(`已打开系统 AI，当前接入：${workflowLabels[activeTab] || activeTab}`)
  }

  const closeAiExpert = () => {
    setShowAiConfig(false)
  }

  const resetAiChat = () => {
    setAiMessages([createAiWelcomeMessage()])
    setAiKnowledgeHits([])
  }

  const rateAiMessage = (messageId, rating) => {
    setAiFeedback((current) => {
      const nextByMessage = { ...current.byMessage, [messageId]: rating }
      return normalizeAiFeedback({ byMessage: nextByMessage })
    })
    setStatusMessage(`已记录 AI 回复反馈：${rating === 'helpful' ? '有帮助' : '需改进'}`)
  }

  const updateDepositInput = (field, value) => {
    setDepositInputs((current) => ({ ...current, [field]: value }))
  }

  const submitAiChat = async (rawPrompt) => {
    const prompt = String(rawPrompt || '').trim()
    if (!prompt || aiSending) return

    const nextUserMessage = { id: createMessageId('user'), role: 'user', content: prompt }
    const nextAssistantId = createMessageId('assistant')
    const nextMessages = [...aiMessages, nextUserMessage]

    setAiMessages([
      ...nextMessages,
      { id: nextAssistantId, role: 'assistant', content: '正在思考中…', pending: true },
    ])
    setAiDraft('')
    setAiSending(true)
    setStatusMessage('系统 AI 正在检索知识库并读取当前业务上下文')

    let ragItems = []

    try {
      ragItems = await searchAiKnowledge(
        buildRagSearchQuery({
          prompt,
          activeTab,
          reviewText,
          findings,
        }),
        5,
      )
      setAiKnowledgeHits(ragItems)

      const systemContext = buildSystemAiContext({
        activeTab,
        reviewText,
        effectiveReviewProfile,
        findings,
        summary,
        acceptedIds,
        revisionItems,
        depositInputs,
        depositResult,
        reviewHistory,
      })
      const response = await callAiModel(
        [
          {
            role: 'system',
            content:
              '你是“租小审系统 AI”，已经接入整个租小审产品。你可以使用系统上下文回答合同审查、押金估算、退租证据包、入住验房、补贴匹配和参赛提案问题。回答时优先结合当前模块、合同原文、证据状态和知识库命中条目，给出能直接执行的建议。保持简洁、准确、专业、可操作；不要输出与租房无关的内容；不要编造法律条文或政策口径。',
          },
          {
            role: 'system',
            content: buildAiResponseSkillPrompt(),
          },
          {
            role: 'system',
            content: systemContext,
          },
          {
            role: 'system',
            content: buildRagContextPrompt(ragItems),
          },
          ...nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        ],
        { temperature: 0.2, maxTokens: 1200 },
      )

      const reply = normalizeAiReplyText(extractAssistantChatContent(response)) || '我暂时没有拿到明确回复，请再把问题说具体一点。'
      setAiMessages([...nextMessages, { id: nextAssistantId, role: 'assistant', content: reply }])
      setStatusMessage(`系统 AI 已结合当前业务上下文和 ${ragItems.length} 条知识库内容回复`)
    } catch (error) {
      const fallbackReply = createLocalAiFallbackReply({
        prompt,
        activeTab,
        findings,
        depositResult,
        ragItems,
      })
      setAiMessages([
        ...nextMessages,
        {
          id: nextAssistantId,
          role: 'assistant',
          content: fallbackReply,
        },
      ])
      setStatusMessage(`模型暂时不可用，已切换本地知识库兜底：${error.message}`)
    } finally {
      setAiSending(false)
    }
  }

  const sendAiDraft = () => {
    submitAiChat(aiDraft)
  }

  const updateReviewProfile = (field, value) => {
    setFindingListMinHeight(0)
    setReviewProfile((current) => ({ ...current, [field]: value }))
    setAiFindings(null)
    setAiQualityReport(null)
    setAcceptedIds(new Set())
    setAcceptedRevisionItems([])
    setStatusMessage('已切换审查知识库，当前结果使用本地规则重新计算')
  }

  const callAiModel = async (messages, options = {}) => {
    const response = await fetch(getPlatformApiEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: aiConfig.provider,
        model: aiConfig.model.trim(),
        temperature: options.temperature ?? 0.2,
        maxTokens: options.maxTokens ?? 2200,
        messages,
      }),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      const message = data?.error?.message || data?.message || `接口请求失败：HTTP ${response.status}`
      throw new Error(message)
    }

    return data
  }

  const startReview = async () => {
    const trimmedText = reviewText.trim()
    setAcceptedIds(new Set())
    setAcceptedRevisionItems([])

    if (!trimmedText) {
      setAiFindings(null)
      setAiQualityReport(null)
      setStatusMessage('请先粘贴合同正文')
      return
    }

    setIsReviewing(true)
    setStatusMessage('正在检索知识库并调用平台 AI 模型审查合同')

    try {
      const ragItems = await searchAiKnowledge(
        buildRagSearchQuery({
          prompt: '租房合同审查 押金 维修 涨租 解除 违约 入户 管辖',
          activeTab: 'review',
          reviewText: trimmedText,
          findings: localFindings,
        }),
        6,
      )
      setAiKnowledgeHits(ragItems)

      const data = await callAiModel([
        {
          role: 'system',
          content:
            '你是严谨的租房合同解读助手，擅长识别押金、涨租、维修、入户、解除、违约金和管辖风险。必须只返回合法 JSON，且证据必须来自原文。',
        },
        { role: 'user', content: createAiReviewPrompt(trimmedText, effectiveReviewProfile, ragItems) },
      ])
      const parsed = parseAiContent(extractAssistantContent(data))
      const nextFindings = normalizeAiFindings(parsed, trimmedText)
      const qualityReport = buildAiQualityReport(parsed, trimmedText, nextFindings)

      setAiFindings(nextFindings)
      setAiQualityReport(qualityReport)
      setStatusMessage(
        qualityReport.rejectedCount
          ? `AI 审查完成，保留 ${nextFindings.length} 条，过滤 ${qualityReport.rejectedCount} 条无证据风险`
          : nextFindings.length
            ? `AI 审查完成，发现 ${nextFindings.length} 个风险点`
            : 'AI 审查完成，未发现明显风险',
      )
    } catch {
      setAiFindings(null)
      setAiQualityReport(null)
      setStatusMessage('AI 审查失败，已自动切换为本地规则结果')
    } finally {
      setIsReviewing(false)
    }
  }

  const replaceContractText = (nextText, options = {}) => {
    setFindingListMinHeight(0)
    setContractText(nextText)
    setAcceptedIds(new Set())
    setAcceptedRevisionItems([])
    setAiFindings(null)
    setAiQualityReport(null)

    if (options.importMeta) {
      setImportedContractMeta(options.importMeta)
    } else if (options.clearImportMeta !== false) {
      setImportedContractMeta(null)
    }

    if (options.statusMessage) {
      setStatusMessage(options.statusMessage)
    }
  }

  const resetContractText = (nextText) => {
    replaceContractText(nextText, {
      statusMessage: '已重置合同版本和采纳状态',
    })
  }

  const handleContractTextChange = (nextText) => {
    replaceContractText(nextText, {
      statusMessage: importedContractMeta ? '已切换为手动编辑，导入状态已清除' : undefined,
    })
  }

  const importContractFile = async (file) => {
    if (!file || isImportingContract) return

    setIsImportingContract(true)
    setStatusMessage(`正在解析合同文件：${file.name}`)

    try {
      const result = await extractContractTextFromFile(file)
      const importedText = String(result.text || '').trim()

      if (!importedText) {
        throw new Error('没有识别到可用合同文字，请换一个更清晰的文件或直接粘贴正文')
      }

      replaceContractText(importedText, {
        importMeta: {
          name: file.name,
          source: result.source || result.type,
          type: result.type,
          size: importedText.length,
          confidence: result.confidence,
          mode: result.mode,
          importedAt: new Date().toISOString(),
        },
        statusMessage: `已导入${result.type}：${file.name}，共 ${importedText.length} 字`,
      })
      setReviewProfile((current) => ({ ...current, contractType: 'lease' }))
    } catch (error) {
      setStatusMessage(`合同导入失败：${error.message}`)
    } finally {
      setIsImportingContract(false)
    }
  }

  const handleContractFileChange = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    importContractFile(file)
  }

  const handleContractFileDrop = (event) => {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    importContractFile(file)
  }

  const loadDemoContract = (contract = selectedDemoContract) => {
    setSelectedDemoContractId(contract.id)
    resetContractText(contract.text)
    setReviewProfile((current) => ({ ...current, contractType: 'lease' }))
    setStatusMessage(`已载入演示合同：${contract.title}`)
  }

  const saveHistorySnapshot = () => {
    const snapshot = {
      id: Date.now(),
      title: `审查记录 ${new Date().toLocaleTimeString()}`,
      score: summary.score,
      highCount: summary.highCount,
      mediumCount: summary.mediumCount,
      acceptedCount: acceptedIds.size,
      contractText,
    }

    setReviewHistory((current) => [snapshot, ...current].slice(0, 5))
    setStatusMessage('已保存到本地审查历史')
  }

  const clearReviewHistory = () => {
    if (!reviewHistory.length) {
      setStatusMessage('当前没有可清空的审查历史')
      return
    }

    setReviewHistory([])

    try {
      localStorage.removeItem(STORAGE_KEYS.history)
      localStorage.removeItem(STORAGE_KEYS.historyLegacy)
    } catch {
      // localStorage may be unavailable in private browsing or restricted environments.
    }

    setStatusMessage('已清空本地审查历史')
  }

  const restoreHistorySnapshot = (snapshot) => {
    replaceContractText(snapshot.contractText, {
      statusMessage: `已恢复 ${snapshot.title}`,
    })
  }

  const exportReport = async () => {
    if (isExportingReportDocx) return

    setIsExportingReportDocx(true)
    setStatusMessage('正在生成 Word 租房解读报告')

    try {
      const report = createReportText({ summary, findings, revisionItems, contractText: reviewText, reviewProfile: effectiveReviewProfile })
      const blob = await buildTextReportDocxBlob(report, '租小审-解读报告')
      downloadBlob(blob, `租小审-解读报告-${new Date().toISOString().slice(0, 10)}.docx`)
      saveHistorySnapshot()
      setStatusMessage('租房解读报告已生成 DOCX，可下载 Word')
    } catch (error) {
      setStatusMessage(`租房解读报告 DOCX 生成失败：${error.message}`)
    } finally {
      setIsExportingReportDocx(false)
    }
  }

  const exportRevisedDraft = async () => {
    if (isExportingDocx) return

    setIsExportingDocx(true)
    setStatusMessage('正在生成 DOCX 优化合同')

    try {
      const blob = await buildContractDocxBlob(revisedContractDraft)
      downloadBlob(blob, `租小审-优化合同-${new Date().toISOString().slice(0, 10)}.docx`)
      setStatusMessage('优化版合同已生成 DOCX，可下载 Word')
    } catch (error) {
      setStatusMessage(`DOCX 生成失败：${error.message}`)
    } finally {
      setIsExportingDocx(false)
    }
  }

  const applySuggestion = (finding) => {
    if (acceptedIds.has(finding.id)) return

    const result = applyRevisionItem(contractText, finding, { appendIfMissing: true })
    setContractText(result.text)
    setAiFindings(null)
    setAiQualityReport(null)
    setAcceptedIds((current) => new Set(current).add(finding.id))
    setAcceptedRevisionItems((current) => mergeRevisionItems(current, [finding]))

    if (result.mode === 'appended') {
      setStatusMessage(`已采纳：${finding.title}，已作为补充修订条款加入草案`)
      return
    }

    setStatusMessage(`已采纳：${finding.title}`)
  }

  const applyAllSuggestions = () => {
    if (!visibleFindings.length || allFindingsAccepted) return

    const currentListHeight = findingsListRef.current?.getBoundingClientRect().height || 0
    const currentListTop = findingsListRef.current?.getBoundingClientRect().top || 0
    pendingScrollRestoreRef.current = {
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      anchorTop: currentListTop,
    }

    if (currentListHeight > 0) {
      setFindingListMinHeight(Math.ceil(currentListHeight))
    }

    let nextText = contractText
    let directCount = 0
    let appendedCount = 0
    let unchangedCount = 0

    visibleFindings.forEach((finding) => {
      const result = applyRevisionItem(nextText, finding, { appendIfMissing: true })
      nextText = result.text

      if (result.mode === 'exact' || result.mode === 'loose') {
        directCount += 1
      } else if (result.mode === 'appended') {
        appendedCount += 1
      } else {
        unchangedCount += 1
      }
    })

    setContractText(nextText)
    setAiFindings(null)
    setAiQualityReport(null)
    setAcceptedIds((current) => {
      const merged = new Set(current)
      visibleFindings.forEach((finding) => merged.add(finding.id))
      return merged
    })
    setAcceptedRevisionItems((current) => mergeRevisionItems(current, visibleFindings))

    const newAcceptedCount = visibleFindings.length
    const detailText = [
      directCount ? `${directCount} 条直接改写` : '',
      appendedCount ? `${appendedCount} 条补充到修订条款` : '',
      unchangedCount ? `${unchangedCount} 条已在草案中` : '',
    ].filter(Boolean).join('，')

    setStatusMessage(
      detailText
        ? `已采纳 ${newAcceptedCount} 条，其中 ${detailText}`
        : '已采纳全部风险修改建议',
    )
  }

  const topbarCopy = {
    review: {
      kicker: 'Rental Contract Copilot',
      title: '租房签字前，先让 AI 帮你看一遍',
      subtitle: '聚焦押金、涨租、维修、入户、管辖和违约金，把租房合同里的坑讲成大白话。',
      stage: '合同审查',
      state: `${findings.length} 个风险点`,
      action: revisionItems.length ? `${revisionItems.length} 条已采纳建议` : '可生成审查报告',
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

  return (
    <main className="app-shell">
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
          <button className={activeTab === 'proposal' ? 'active' : ''} type="button" onClick={() => switchModuleFromNav('proposal')}>
            <House size={18} aria-hidden="true" />
            首页
          </button>
          <button className={activeTab === 'subsidy' ? 'active' : ''} type="button" onClick={() => switchModuleFromNav('subsidy')}>
            <CircleDollarSign size={18} aria-hidden="true" />
            补贴匹配
          </button>
          <button className={activeTab === 'review' ? 'active' : ''} type="button" onClick={() => switchModuleFromNav('review')}>
            <FileText size={18} aria-hidden="true" />
            租房审查
          </button>
          <button className={activeTab === 'checkin' ? 'active' : ''} type="button" onClick={() => switchModuleFromNav('checkin')}>
            <BadgeCheck size={18} aria-hidden="true" />
            入住验房
          </button>
          <button className={activeTab === 'evidence' ? 'active' : ''} type="button" onClick={() => switchModuleFromNav('evidence')}>
            <ClipboardCheck size={18} aria-hidden="true" />
            退租证据包
          </button>
        </nav>

        <div className="sidebar-panel">
          <span className="panel-label">定位</span>
          <h2>社会服务赛道</h2>
          <p>帮租客在签字前看懂押金、涨租、维修和违约条款里的坑。</p>
        </div>
      </aside>

      <div className="announcement-strip">
        <span>● 演示不断线</span>
        <strong>模型暂不可用时，会自动切换本地租房规则和知识库兜底</strong>
        <button className="announcement-link" type="button" ref={guideTriggerRef} onClick={openRiskGuide}>
          查看避坑流程
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>

      {showGuide && (
        <div className="guide-backdrop" role="presentation" onMouseDown={() => setShowGuide(false)}>
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
                ref={guideCloseRef}
                onClick={() => setShowGuide(false)}
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
                      <button className="guide-step-action" type="button" onClick={() => jumpFromGuide(entry.tab)}>
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
      )}

      <section className={`workspace ${moduleEntering ? 'module-entering' : ''}`} ref={workspaceRef}>
        <header className="topbar">
          <div className="hero-copy">
            <p className="section-kicker">{topbarCopy.kicker}</p>
            <h1>{topbarCopy.title}</h1>
            <p className="hero-subtitle">{topbarCopy.subtitle}</p>
          </div>
          <div className="topbar-actions">
            <button className="runtime-status-button" type="button" onClick={openAiExpert}>
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

        {statusMessage && <div className="status-toast">{statusMessage}</div>}

        <div className="mobile-read-notice">
          <strong>移动端查看模式</strong>
          <span>租房合同解读属于重阅读场景，建议在电脑端完成修改与导出，手机端更适合查看结论。</span>
        </div>

        {showAiConfig && (
          <section className="ai-chat-panel runtime-api-panel" aria-label="租房专家 AI 对话">
            <div className="ai-chat-header">
              <div className="ai-config-title">
                <span className="ai-config-icon">
                  <Bot size={20} aria-hidden="true" />
                </span>
                <div>
                  <p className="runtime-kicker">System Copilot</p>
                  <h2>租小审系统 AI</h2>
                  <p>已接入合同审查、退租证据包、入住验房、押金估算和补贴匹配，会自动读取当前系统上下文。</p>
                </div>
              </div>
              <div className="ai-config-status">
                <span className="model-status">
                  <PlugZap size={16} aria-hidden="true" />
                  {modelConnectionLabel}
                </span>
                <button className="ghost-button compact-button" type="button" onClick={closeAiExpert}>
                  关闭
                </button>
              </div>
            </div>

            <div className="ai-chat-meta">
              <span>后端代理：{getPlatformApiEndpoint()}</span>
              <span>当前模块：{workflowLabels[activeTab] || activeTab}</span>
              <span>身份：租小审系统助手</span>
              <span>回复技能：{aiResponseSkills.length} 个</span>
              <span>知识库命中：{aiKnowledgeHits.length ? `${aiKnowledgeHits.length} 条` : '待检索'}</span>
              <span>{aiFeedbackText}</span>
              <span>默认模型：{aiConfig.model}</span>
            </div>

            <div className="ai-chat-thread" aria-label="AI 对话记录">
              {aiMessages.map((message) => (
                <article key={message.id} className={`ai-chat-bubble ${message.role === 'user' ? 'user' : 'assistant'} ${message.pending ? 'pending' : ''}`}>
                  <span>{message.role === 'user' ? '我' : '租房专家 AI'}</span>
                  <AiMessageContent content={message.content} />
                  {message.role === 'assistant' && !message.pending && message.id !== 'assistant-welcome' ? (
                    <div className="ai-feedback" aria-label="AI 回复反馈">
                      <button
                        className={aiFeedback.byMessage[message.id] === 'helpful' ? 'active' : ''}
                        type="button"
                        onClick={() => rateAiMessage(message.id, 'helpful')}
                      >
                        有帮助
                      </button>
                      <button
                        className={aiFeedback.byMessage[message.id] === 'needsWork' ? 'active' : ''}
                        type="button"
                        onClick={() => rateAiMessage(message.id, 'needsWork')}
                      >
                        需改进
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>

            <div className="ai-chat-composer">
              <textarea
                value={aiDraft}
                onChange={(event) => setAiDraft(event.target.value)}
                placeholder="直接问系统 AI，比如：结合当前页面，我下一步应该先处理什么？"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    sendAiDraft()
                  }
                }}
              />
              <div className="config-actions ai-chat-actions">
                <button className="ghost-button" type="button" onClick={resetAiChat} disabled={aiSending}>
                  清空对话
                </button>
                <button className="primary-button" type="button" onClick={sendAiDraft} disabled={aiSending || !aiDraft.trim()}>
                  <Send size={17} aria-hidden="true" />
                  {aiSending ? '发送中...' : '发送'}
                </button>
              </div>
            </div>

            <div className="security-callout">
              <EyeOff size={17} aria-hidden="true" />
              <span>这里不再让用户选模型或填 Key。AI 会通过后端模型读取当前系统上下文并给出建议。</span>
            </div>
            <LegalDisclaimer compact />
          </section>
        )}

        {activeTab === 'evidence' ? (
          <EvidencePack onStatus={setStatusMessage} />
        ) : activeTab === 'checkin' ? (
          <CheckinInspection onStatus={setStatusMessage} />
        ) : activeTab === 'subsidy' ? (
          <SubsidyMatcher onStatus={setStatusMessage} />
        ) : activeTab === 'review' ? (
          <div className="review-layout">
            <section className="work-panel input-panel">
              <div className="panel-head">
                <div>
                  <h2>租房合同输入</h2>
                  <p>粘贴租房合同或载入示例合同，系统会优先按租客视角严格审查。</p>
                </div>
                <span>{contractText.length} 字</span>
              </div>

              <label
                className={`upload-drop ${isImportingContract ? 'importing' : ''}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleContractFileDrop}
              >
                <UploadCloud size={24} aria-hidden="true" />
                <strong>{isImportingContract ? '正在解析合同...' : '拖入 PDF / Word / 图片租房合同'}</strong>
                <span>支持 TXT、MD、DOCX、PDF 和图片 OCR，导入后会写入下方合同正文</span>
                <input
                  accept=".txt,.md,.docx,.pdf,image/*"
                  aria-label="上传合同"
                  disabled={isImportingContract}
                  onChange={handleContractFileChange}
                  type="file"
                />
              </label>

              {importedContractMeta && (
                <div className={`contract-import-card ${importedNeedsManualCheck ? 'needs-check' : ''}`} aria-label="已导入合同状态">
                  <div className="contract-import-head">
                    <span className="contract-import-icon">
                      <FileText size={18} aria-hidden="true" />
                    </span>
                    <div>
                      <strong>已导入：{importedContractMeta.name}</strong>
                      <p>
                        {importedNeedsManualCheck
                          ? 'OCR 识别结果需要人工核对，确认正文无误后再进入审查。'
                          : '合同正文已写入编辑区，可以直接开始审查。'}
                      </p>
                    </div>
                  </div>
                  <dl className="contract-import-meta">
                    <div>
                      <dt>来源</dt>
                      <dd>{importedContractMeta.source}</dd>
                    </div>
                    <div>
                      <dt>字数</dt>
                      <dd>{importedContractMeta.size} 字</dd>
                    </div>
                    {importedIsOcr && (
                      <div>
                        <dt>OCR 置信度</dt>
                        <dd>{importedConfidence}%</dd>
                      </div>
                    )}
                  </dl>
                  {importedIsOcr && (
                    <p className="contract-import-note">
                      {importedNeedsManualCheck
                        ? '图片合同可能存在漏字、错字或换行错位，请先对照原图检查金额、日期、押金和解除条款。'
                        : '图片 OCR 结果可信度较高，仍建议快速核对金额、日期和押金条款。'}
                    </p>
                  )}
                  <div className="contract-import-actions">
                    <button className="primary-button compact-button" type="button" onClick={startReview} disabled={isReviewing || !reviewText.trim()}>
                      {isReviewing ? <RefreshCw className="spin-icon" size={15} aria-hidden="true" /> : <Bot size={15} aria-hidden="true" />}
                      {isReviewing ? '审查中...' : '开始审查这份合同'}
                    </button>
                    {importedIsOcr && (
                      <button className="ghost-button compact-button" type="button" onClick={() => setImportedContractMeta(null)}>
                        我已核对正文
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="review-profile" aria-label="租房合同审查画像">
                <label>
                  <span>合同类型</span>
                  <select value={reviewProfile.contractType} onChange={(event) => updateReviewProfile('contractType', event.target.value)}>
                    {contractTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>我方身份</span>
                  <select value={reviewProfile.partyRole} onChange={(event) => updateReviewProfile('partyRole', event.target.value)}>
                    {partyRoleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>审查强度</span>
                  <select value={reviewProfile.reviewDepth} onChange={(event) => updateReviewProfile('reviewDepth', event.target.value)}>
                    {reviewDepthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="detected-type">
                <span>当前知识库</span>
                <strong>{getContractTypeLabel(effectiveReviewProfile.contractType)}</strong>
                {reviewProfile.contractType === 'auto' && <em>自动识别</em>}
              </div>

              <div className={`demo-contract-picker ${contractText.trim() ? '' : 'empty'}`} aria-label="演示合同模板">
                <div className="demo-contract-copy">
                  <FileText size={18} aria-hidden="true" />
                  <div>
                    <strong>{contractText.trim() ? '演示合同模板' : '合同已清空，可载入演示合同'}</strong>
                    <span>{selectedDemoContract.description}</span>
                  </div>
                </div>
                <div className="demo-contract-controls">
                  <label>
                    <span>模板</span>
                    <select value={selectedDemoContractId} onChange={(event) => setSelectedDemoContractId(event.target.value)}>
                      {demoContracts.map((contract) => (
                        <option key={contract.id} value={contract.id}>
                          {contract.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="primary-button compact-button" type="button" onClick={() => loadDemoContract()}>
                    <Sparkles size={15} aria-hidden="true" />
                    载入演示合同
                  </button>
                </div>
                <div className="demo-contract-list">
                  {demoContracts.map((contract) => (
                    <button
                      className={contract.id === selectedDemoContractId ? 'active' : ''}
                      key={contract.id}
                      type="button"
                      onClick={() => loadDemoContract(contract)}
                    >
                      <strong>{contract.title}</strong>
                      <span>{contract.tag}</span>
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={contractText}
                onChange={(event) => handleContractTextChange(event.target.value)}
                placeholder="在这里粘贴租房合同正文，系统会自动识别押金、涨租、维修、解除等风险条款..."
              />

              <div className="input-actions">
                <button className="ghost-button" type="button" onClick={() => resetContractText('')}>
                  清空
                </button>
                <button className="primary-button" type="button" onClick={startReview} disabled={isReviewing}>
                  {isReviewing ? <RefreshCw className="spin-icon" size={17} aria-hidden="true" /> : <Bot size={17} aria-hidden="true" />}
                  {isReviewing ? '审查中...' : '开始审查'}
                </button>
              </div>

              <div className="review-scope" aria-label="审查范围">
                <div className="scope-chip">
                  <ClipboardCheck size={17} aria-hidden="true" />
                  <div>
                    <strong>租房条款筛选</strong>
                    <span>押金、涨租、维修</span>
                  </div>
                </div>
                <div className="scope-chip">
                  <Scale size={17} aria-hidden="true" />
                  <div>
                    <strong>风险定级</strong>
                    <span>高、中、低风险</span>
                  </div>
                </div>
                <div className="scope-chip">
                  <FileText size={17} aria-hidden="true" />
                  <div>
                    <strong>谈判输出</strong>
                    <span>替代条款和话术</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="work-panel summary-panel">
              {aiQualityReport && (
                <div className={`quality-panel ${aiQualityReport.tone}`} role="status">
                  <div>
                    <strong>AI 质量自检</strong>
                    <span>
                      返回 {aiQualityReport.rawCount} 条，证据命中 {aiQualityReport.verifiedRawCount} 条，保留 {aiQualityReport.acceptedCount} 条，过滤 {aiQualityReport.rejectedCount} 条
                    </span>
                  </div>
                  {aiQualityReport.typeMismatch && (
                    <p>模型疑似识别成“{aiQualityReport.contractType}”，已按租房合同证据规则拦截。</p>
                  )}
                </div>
              )}

              <div className={`summary-card ${summary.tone}`}>
                <div>
                  <p className="eyebrow">租房风险值</p>
                  <div className="score-line">
                    <strong>{summary.score}</strong>
                    <span>/ 100</span>
                  </div>
                  <h2>{summary.label}</h2>
                  <p>{summary.advice} 分数越高，代表需要优先处理的风险越多。</p>
                  <button className="ghost-button compact-button" type="button" onClick={exportReport} disabled={isExportingReportDocx}>
                    <Download size={15} aria-hidden="true" />
                    {isExportingReportDocx ? '正在生成 Word' : '导出 Word 报告'}
                  </button>
                </div>
                <div className="score-ring" style={{ '--score': `${summary.score * 3.6}deg` }} aria-label={`风险分 ${summary.score}`}>
                  <ShieldCheck size={34} aria-hidden="true" />
                </div>
              </div>

              <LegalDisclaimer />

              <div className="metric-row">
                <div>
                  <strong>{findings.length}</strong>
                  <span>租房坑点</span>
                </div>
                <div>
                  <strong>{summary.highCount}</strong>
                  <span>高风险</span>
                </div>
                <div>
                  <strong>{summary.mediumCount}</strong>
                  <span>中风险</span>
                </div>
                <div>
                  <strong>{acceptedIds.size}</strong>
                  <span>已采纳</span>
                </div>
                <div>
                  <strong>{visibleFindings.length}</strong>
                  <span>待处理</span>
                </div>
              </div>

              <div className="dimension-panel" aria-label="分项风险评分">
                {dimensionScores.map((item) => (
                  <div className="dimension-item" key={item.dimension}>
                    <div>
                      <span>{item.dimension}</span>
                      <strong>{item.score}</strong>
                    </div>
                    <meter className={item.tone} min="0" max="100" value={item.score}>
                      {item.score}
                    </meter>
                  </div>
                ))}
              </div>

              <div className="knowledge-panel" aria-label="租房安心知识库">
                <div className="panel-head compact">
                  <div>
                    <h2>租房安心知识库</h2>
                    <p>{knowledgePanelDescription}</p>
                  </div>
                  <span className="knowledge-count">
                    {aiKnowledgeHits.length ? `命中 ${visibleKnowledgeItems.length} 条` : `${knowledgeBaseItems.length} 组`}
                  </span>
                </div>
                <div className="knowledge-grid">
                  {visibleKnowledgeItems.map((item) => {
                    const matchedKeywords = Array.isArray(item.matchedKeywords) ? item.matchedKeywords.slice(0, 6) : []
                    const score = Number.isFinite(Number(item.score)) ? Number(item.score) : null

                    return (
                      <article className={`knowledge-item ${aiKnowledgeHits.length ? 'hit' : ''}`} key={item.id || item.title}>
                        <span>{item.tag}</span>
                        <strong>{item.title}</strong>
                        <p>{item.text}</p>
                        {(item.scope || item.updatedAt || item.riskLevel) && (
                          <div className="knowledge-meta">
                            {item.scope && <small>适用：{item.scope}</small>}
                            {item.updatedAt && <small>更新：{item.updatedAt}</small>}
                            {item.riskLevel && <small>风险：{item.riskLevel}</small>}
                          </div>
                        )}
                        {matchedKeywords.length ? (
                          <div className="knowledge-matches">
                            {matchedKeywords.map((keyword) => (
                              <small key={keyword}>{keyword}</small>
                            ))}
                          </div>
                        ) : null}
                        <div className="knowledge-source-row">
                          {item.sourceUrl ? (
                            <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                              {item.source || '查看来源'}
                            </a>
                          ) : (
                            <em>{item.source || '租小审内置知识库'}</em>
                          )}
                          {score !== null && <small className="knowledge-score">匹配 {score.toFixed(1)}</small>}
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>

              <div className="evidence-card" ref={evidenceRef}>
                <div className="panel-head compact">
                  <div>
                    <h2>证据高亮</h2>
                    <p>被标记的文本是风险判断依据。</p>
                  </div>
                </div>
                <HighlightedContract text={contractText || '暂无合同正文'} findings={findings} />
              </div>

              <div className="diff-card">
                <div className="panel-head compact">
                  <div>
                    <h2>修改对比</h2>
                    <p>展示已采纳建议对应的原风险和替换条款。</p>
                  </div>
                  {revisionItems.length > 0 && (
                    <button className="ghost-button compact-button" type="button" onClick={exportRevisedDraft} disabled={isExportingDocx}>
                      {isExportingDocx ? '正在生成 DOCX' : '下载优化合同 DOCX'}
                    </button>
                  )}
                </div>
                {revisionItems.length ? (
                  <>
                    <div className="diff-list">
                      {revisionItems.map((item) => (
                        <article className="diff-item" key={item.id}>
                          <span>{item.priority}</span>
                          <div>
                            <strong>{item.title}</strong>
                            <p className="diff-before">{item.evidence}</p>
                            <p className="diff-after">{item.replacement}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                    <div className="draft-preview">
                      <div>
                        <strong>修订版合同草案</strong>
                        <span>{revisionItems.length} 项已并入草案</span>
                      </div>
                      <pre>{revisedContractDraft}</pre>
                    </div>
                  </>
                ) : (
                  <p className="empty-note">采纳建议后，这里会显示修改前后的对比。</p>
                )}
              </div>

              <div className="history-card">
                <div className="panel-head compact">
                  <div>
                    <h2>审查历史</h2>
                    <p>本地保留最近 5 次审查，便于回溯和演示。</p>
                  </div>
                  <div className="panel-actions">
                    <button
                      className="ghost-button compact-button"
                      type="button"
                      onClick={clearReviewHistory}
                      disabled={!reviewHistory.length}
                    >
                      清空历史
                    </button>
                    <button className="ghost-button compact-button" type="button" onClick={saveHistorySnapshot}>
                      保存当前
                    </button>
                  </div>
                </div>
                {reviewHistory.length ? (
                  <div className="history-list">
                    {reviewHistory.map((item) => (
                      <button type="button" key={item.id} onClick={() => restoreHistorySnapshot(item)}>
                        <strong>{item.title}</strong>
                        <span>{item.score} 分 · 高风险 {item.highCount} · 已采纳 {item.acceptedCount}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="empty-note">暂无历史记录，导出报告或点击保存当前后会自动出现。</p>
                )}
              </div>
            </section>

            <section className="work-panel findings-panel">
              <div className="panel-head">
                <div>
                  <h2>租房风险解释与话术</h2>
                  <p>每个坑点都附带原文证据、大白话解释、替代条款和谈判话术。</p>
                </div>
                <div className="panel-actions">
                  <button className="apply-all-button" type="button" onClick={applyAllSuggestions} disabled={!visibleFindings.length || allFindingsAccepted}>
                    <BadgeCheck size={17} aria-hidden="true" />
                    {allFindingsAccepted ? '已全部采纳' : '全部采纳'}
                  </button>
                </div>
              </div>

              <div
                className={`finding-list ${findingListMinHeight ? 'height-locked' : ''}`}
                ref={findingsListRef}
                style={findingListMinHeight ? { minHeight: findingListMinHeight } : undefined}
              >
                {visibleFindings.length ? (
                  visibleFindings.map((finding) => (
                    <FindingItem
                      accepted={false}
                      finding={finding}
                      key={finding.id}
                      onApply={applySuggestion}
                    />
                  ))
                ) : findings.length ? (
                  <p className="empty-note empty-findings">当前建议已全部采纳，已采纳内容可在左侧修订草案中查看和导出。</p>
                ) : (
                  <p className="empty-note empty-findings">暂无风险点。建议仍由人工复核关键金额、期限、解除和争议解决条款。</p>
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="proposal-layout">
            <section className="proposal-card proposal-hero">
              <div className="proposal-hero-copy">
                <p className="section-kicker">使用总览</p>
                <h2>租小审：租房全流程风控助手</h2>
                <p>
                  给普通租客的签约、入住、退租和补贴申请助手，把复杂风险翻成能直接行动的下一步。
                </p>
                <div className="proposal-action-row">
                  <button className="primary-button proposal-primary-action" type="button" onClick={() => enterModuleFromCard('review')}>
                    立即体验租房审查
                    <ArrowRight size={17} aria-hidden="true" />
                  </button>
                  <button className="ghost-button proposal-secondary-action" type="button" onClick={openAiExpert}>
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
                    <button className="proposal-focus-item" key={card.title} type="button" onClick={() => enterModuleFromCard(card.tab)}>
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
                          onChange={(event) => updateDepositInput('depositAmount', event.target.value)}
                        />
                      </label>
                      <label>
                        <span>未结清费用</span>
                        <input
                          inputMode="decimal"
                          value={depositInputs.unpaidFees}
                          onChange={(event) => updateDepositInput('unpaidFees', event.target.value)}
                        />
                      </label>
                      <label>
                        <span>维修扣款</span>
                        <input
                          inputMode="decimal"
                          value={depositInputs.repairCost}
                          onChange={(event) => updateDepositInput('repairCost', event.target.value)}
                        />
                      </label>
                      <label>
                        <span>保洁扣款</span>
                        <input
                          inputMode="decimal"
                          value={depositInputs.cleaningCost}
                          onChange={(event) => updateDepositInput('cleaningCost', event.target.value)}
                        />
                      </label>
                      <label>
                        <span>是否有票据</span>
                        <select value={depositInputs.hasVoucher} onChange={(event) => updateDepositInput('hasVoucher', event.target.value)}>
                          <option value="no">无票据或清单</option>
                          <option value="yes">有照片、清单和票据</option>
                        </select>
                      </label>
                      <label>
                        <span>是否正常损耗</span>
                        <select value={depositInputs.normalWear} onChange={(event) => updateDepositInput('normalWear', event.target.value)}>
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
        )}
      </section>
    </main>
  )
}

export default App
