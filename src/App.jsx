import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  CircleDollarSign,
  ClipboardCheck,
  Download,
  EyeOff,
  FileText,
  House,
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
import { demoContracts, sampleContract } from './data/demoContracts.js'
import { STORAGE_KEYS, workflowLabels } from './constants/appConfig.js'
import { OCR_REVIEW_WARNING_CONFIDENCE } from './constants/checkinConfig.js'
import { defaultDepositInputs, providerPresets } from './constants/aiConfig.js'
import { contractTypeOptions, partyRoleOptions, reviewDepthOptions } from './constants/reviewOptions.js'
import { aiResponseSkills, knowledgeBaseItems } from './data/knowledgeBase.js'
import { extractContractTextFromFile } from './utils/fileImport.js'
import { calculateDepositReturn, formatMoney } from './utils/money.js'
import {
  buildContractDocxBlob,
  downloadBlob,
  downloadTextDocx,
} from './utils/docxExport.js'
import AiMessageContent from './components/AiMessageContent.jsx'
import CheckinInspection from './components/CheckinInspection.jsx'
import EvidencePack from './components/EvidencePack.jsx'
import { FindingItem, HighlightedContract, LegalDisclaimer } from './components/ReviewAtoms.jsx'
import SubsidyMatcher from './components/SubsidyMatcher.jsx'
import {
  buildAiQualityReport,
  buildAiResponseSkillPrompt,
  buildRagContextPrompt,
  buildRagSearchQuery,
  buildSystemAiContext,
  createAiReviewPrompt,
  createAiWelcomeMessage,
  createEmptyAiFeedback,
  createLocalAiFallbackReply,
  createMessageId,
  extractAssistantChatContent,
  extractAssistantContent,
  getPlatformApiEndpoint,
  normalizeAiFeedback,
  normalizeAiFindings,
  normalizeAiReplyText,
  parseAiContent,
  searchAiKnowledge,
} from './features/aiAssistant.js'
import {
  analyzeContract,
  applyRevisionItem,
  cleanContractTextForReview,
  createReportText,
  createRevisedContractDraft,
  getContractTypeLabel,
  getDimensionScores,
  getRiskSummary,
  mergeFindings,
  mergeRevisionItems,
  resolveReviewProfile,
} from './features/contractReview.js'

// Legacy service-contract rules are retained only as a fallback when users manually
// switch the contract type away from the rental review workflow.
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
      await downloadTextDocx('租小审-解读报告', report)
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
