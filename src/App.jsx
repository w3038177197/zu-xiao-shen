import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  BadgeCheck,
  Download,
  ShieldCheck,
} from 'lucide-react'
import './App.css'
import { demoContracts, sampleContract } from './data/demoContracts.js'
import { STORAGE_KEYS, workflowLabels } from './constants/appConfig.js'
import { OCR_REVIEW_WARNING_CONFIDENCE } from './constants/checkinConfig.js'
import { defaultDepositInputs, providerPresets } from './constants/aiConfig.js'
import { knowledgeBaseItems } from './data/knowledgeBase.js'
import { calculateDepositReturn } from './utils/money.js'
import { redactSensitiveText } from './utils/privacy.js'
import { clearCheckinPhotos, listCheckinPhotos } from './utils/checkinPhotoStore.js'
import AiAssistantPanel from './components/AiAssistantPanel.jsx'
import AnnouncementStrip from './components/AnnouncementStrip.jsx'
import AppSidebar from './components/AppSidebar.jsx'
import AppTopbar from './components/AppTopbar.jsx'
import CheckinInspection from './components/CheckinInspection.jsx'
import EvidencePack from './components/EvidencePack.jsx'
import { FindingItem, HighlightedContract } from './components/ReviewAtoms.jsx'
import ProposalHome from './components/ProposalHome.jsx'
import ReviewInputPanel from './components/ReviewInputPanel.jsx'
import RiskGuideModal from './components/RiskGuideModal.jsx'
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
  getDimensionScores,
  getRiskSummary,
  mergeFindings,
  mergeRevisionItems,
  resolveReviewProfile,
} from './features/contractReview.js'

const BUSINESS_CONTEXT_TABS = new Set(['review', 'evidence', 'checkin', 'subsidy'])
const MAX_REVIEW_CHARS = 200_000
const VALID_TABS = new Set(['proposal', 'review', 'evidence', 'checkin', 'subsidy', 'ai'])

function getInitialTab() {
  try {
    const value = new URLSearchParams(window.location.search).get('module') || window.location.hash.slice(1)
    return VALID_TABS.has(value) ? value : 'proposal'
  } catch {
    return 'proposal'
  }
}

function loadBoolean(key) {
  try { return localStorage.getItem(key) === 'true' } catch { return false }
}

function getOrCreateAccountId() {
  try {
    const existing = localStorage.getItem(STORAGE_KEYS.accountId)
    if (existing) return existing
    const id = `guest-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`
    localStorage.setItem(STORAGE_KEYS.accountId, id)
    return id
  } catch {
    return 'guest-anonymous'
  }
}

function loadReviewHistory() {
  try {
    const savedHistory = localStorage.getItem(STORAGE_KEYS.history) || localStorage.getItem(STORAGE_KEYS.historyLegacy)
    if (!savedHistory) return []

    const parsed = JSON.parse(savedHistory)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((item) => item && typeof item === 'object' && typeof item.contractText === 'string')
      .slice(0, 5)
      .map((item, index) => ({
        ...item,
        id: item.id || `restored-${index}`,
        title: typeof item.title === 'string' ? item.title : `审查记录 ${index + 1}`,
        score: Number.isFinite(Number(item.score)) ? Number(item.score) : 0,
        highCount: Number.isFinite(Number(item.highCount)) ? Number(item.highCount) : 0,
        mediumCount: Number.isFinite(Number(item.mediumCount)) ? Number(item.mediumCount) : 0,
        acceptedCount: Number.isFinite(Number(item.acceptedCount)) ? Number(item.acceptedCount) : 0,
      }))
  } catch {
    return []
  }
}

function loadAiFeedback() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.aiFeedback)
    return saved ? normalizeAiFeedback(JSON.parse(saved)) : createEmptyAiFeedback()
  } catch {
    return createEmptyAiFeedback()
  }
}

function App() {
  const [contractText, setContractText] = useState(sampleContract)
  const [selectedDemoContractId, setSelectedDemoContractId] = useState(demoContracts[0].id)
  const [activeTab, setActiveTab] = useState(getInitialTab)
  const [lastBusinessTab, setLastBusinessTab] = useState('proposal')
  const [showGuide, setShowGuide] = useState(false)
  const evidenceRef = useRef(null)
  const workspaceRef = useRef(null)
  const findingsListRef = useRef(null)
  const guideTriggerRef = useRef(null)
  const guideCloseRef = useRef(null)
  const pendingScrollRestoreRef = useRef(null)
  const pendingModuleEntryRef = useRef(null)
  const pendingModuleScrollRef = useRef(false)
  const pendingModuleScrollTargetRef = useRef(null)
  const moduleActivationTimerRef = useRef(null)
  const moduleTransitionTimerRef = useRef(null)
  const reviewRequestIdRef = useRef(0)
  const reviewAbortControllerRef = useRef(null)
  const importAbortControllerRef = useRef(null)
  const aiAbortControllerRef = useRef(null)
  const lastAiPromptRef = useRef('')
  const lastImportFileRef = useRef(null)
  const [localOnlyMode, setLocalOnlyMode] = useState(() => loadBoolean(STORAGE_KEYS.localOnlyMode))
  const [reviewStage, setReviewStage] = useState('idle')
  const [importStage, setImportStage] = useState('idle')
  const [aiStage, setAiStage] = useState('idle')
  const [quota, setQuota] = useState(null)
  const [importError, setImportError] = useState(false)
  const [acceptedIds, setAcceptedIds] = useState(() => new Set())
  const [acceptedRevisionItems, setAcceptedRevisionItems] = useState([])
  const [reviewHistory, setReviewHistory] = useState(loadReviewHistory)
  const [statusMessage, setStatusMessage] = useState('')
  const [isExportingDocx, setIsExportingDocx] = useState(false)
  const [isExportingReportDocx, setIsExportingReportDocx] = useState(false)
  const [aiMessages, setAiMessages] = useState(() => [createAiWelcomeMessage()])
  const [aiDraft, setAiDraft] = useState('')
  const [aiSending, setAiSending] = useState(false)
  const [aiKnowledgeHits, setAiKnowledgeHits] = useState([])
  const [aiFeedback, setAiFeedback] = useState(loadAiFeedback)
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
  const deferredContractText = useDeferredValue(contractText)
  const reviewText = useMemo(() => cleanContractTextForReview(deferredContractText), [deferredContractText])
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
  const aiContextTab = activeTab === 'ai' ? lastBusinessTab : activeTab
  const aiFeedbackText = `反馈：${aiFeedback.helpful} 有帮助 / ${aiFeedback.needsWork} 需改进`
  const importedIsOcr = Boolean(importedContractMeta?.source === '图片 OCR' || importedContractMeta?.type?.includes('OCR'))
  const importedConfidence = Number(importedContractMeta?.confidence || 0)
  const importedNeedsManualCheck = importedIsOcr && importedConfidence < OCR_REVIEW_WARNING_CONFIDENCE

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.localOnlyMode, String(localOnlyMode)) } catch { /* optional */ }
  }, [localOnlyMode])

  useEffect(() => {
    const syncUrl = () => {
      const params = new URLSearchParams(window.location.search)
      params.set('module', activeTab)
      window.history.replaceState({ module: activeTab }, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`)
    }
    syncUrl()
    const onPopState = () => setActiveTab(getInitialTab())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [activeTab])

  useEffect(() => {
    const loadQuota = async () => {
      try {
        const response = await fetch('/api/ai/quota', { headers: { 'x-rental-safe-account': getOrCreateAccountId() } })
        if (response.ok) setQuota(await response.json())
      } catch { /* offline is handled by local fallback */ }
    }
    loadQuota()
  }, [])
  const getStickyOffset = useCallback(() => ['.sidebar', '.announcement-strip'].reduce((total, selector) => {
    const element = document.querySelector(selector)
    if (!element) return total

    const style = window.getComputedStyle(element)
    const isVisible = style.display !== 'none' && style.visibility !== 'hidden'
    const isSticky = style.position === 'sticky' || style.position === 'fixed'

    return isVisible && isSticky ? total + element.getBoundingClientRect().height : total
  }, 0), [])

  const scrollPageTo = useCallback((top, behavior = 'auto') => {
    if (behavior === 'smooth') {
      window.scrollTo({ top, left: 0, behavior: 'smooth' })
      return
    }

    const previousScrollBehavior = document.documentElement.style.scrollBehavior
    document.documentElement.style.scrollBehavior = 'auto'
    window.scrollTo({ top, left: 0, behavior: 'auto' })
    document.documentElement.style.scrollBehavior = previousScrollBehavior
  }, [])

  const alignWorkspaceTop = useCallback((behavior = 'auto') => {
    const anchor = workspaceRef.current?.querySelector('.topbar h1') || workspaceRef.current
    if (!anchor) return

    scrollPageTo(Math.max(0, anchor.getBoundingClientRect().top + window.scrollY - getStickyOffset() - 16), behavior)
  }, [getStickyOffset, scrollPageTo])

  const alignElementBelowSticky = useCallback((selector, behavior = 'auto') => {
    const element = document.querySelector(selector)
    if (!element) return

    scrollPageTo(Math.max(0, element.getBoundingClientRect().top + window.scrollY - getStickyOffset() - 14), behavior)
  }, [getStickyOffset, scrollPageTo])

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
    try {
      localStorage.setItem(STORAGE_KEYS.aiFeedback, JSON.stringify(aiFeedback))
    } catch {
      // Feedback persistence is optional in restricted storage environments.
    }
  }, [aiFeedback])

  useLayoutEffect(() => {
    const shouldAnimateModuleEntry = pendingModuleEntryRef.current === activeTab
    const shouldAlignModuleTop = pendingModuleScrollRef.current
    if (!shouldAnimateModuleEntry && !shouldAlignModuleTop) return undefined

    const moduleScrollTarget = pendingModuleScrollTargetRef.current
    pendingModuleEntryRef.current = null
    pendingModuleScrollRef.current = false
    pendingModuleScrollTargetRef.current = null
    let firstFrameId = 0
    let secondFrameId = 0
    let alignTimeoutId = 0
    const alignModuleView = () => {
      if (moduleScrollTarget) {
        alignElementBelowSticky(moduleScrollTarget)
        return
      }

      alignWorkspaceTop()
    }

    if (shouldAlignModuleTop) {
      alignModuleView()
      firstFrameId = window.requestAnimationFrame(() => {
        alignModuleView()
        secondFrameId = window.requestAnimationFrame(alignModuleView)
      })
      alignTimeoutId = window.setTimeout(alignModuleView, 260)
    }

    if (!shouldAnimateModuleEntry) return undefined

    setModuleEntering(true)

    window.clearTimeout(moduleTransitionTimerRef.current)
    moduleTransitionTimerRef.current = window.setTimeout(() => {
      setModuleEntering(false)
    }, 520)

    return () => {
      window.cancelAnimationFrame(firstFrameId)
      window.cancelAnimationFrame(secondFrameId)
      window.clearTimeout(alignTimeoutId)
      window.clearTimeout(moduleTransitionTimerRef.current)
    }
  }, [activeTab, alignElementBelowSticky, alignWorkspaceTop])

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
    const previousBodyOverflow = document.body.style.overflow
    const previousBodyPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    guideCloseRef.current?.focus({ preventScroll: true })

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setShowGuide(false)
        return
      }

      if (event.key === 'Tab') {
        const modal = document.querySelector('.guide-modal')
        const focusable = modal
          ? [...modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
          : []
        if (!focusable.length) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      document.body.style.overflow = previousBodyOverflow
      document.body.style.paddingRight = previousBodyPaddingRight
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
    const visualGap = 0
    const top = anchor ? Math.max(0, anchor.getBoundingClientRect().top + window.scrollY - getStickyOffset() - visualGap) : 0
    const shouldPrepareAtTop = anchor && window.scrollY > top + 24

    window.clearTimeout(moduleTransitionTimerRef.current)
    window.clearTimeout(moduleActivationTimerRef.current)

    const activateModule = () => {
      pendingModuleEntryRef.current = tab
      pendingModuleScrollRef.current = true
      pendingModuleScrollTargetRef.current = options.scrollTarget || null

      if (BUSINESS_CONTEXT_TABS.has(tab)) {
        setLastBusinessTab(tab)
      } else if (tab === 'ai' && BUSINESS_CONTEXT_TABS.has(activeTab)) {
        setLastBusinessTab(activeTab)
      }

      setActiveTab(tab)
    }

    if (shouldPrepareAtTop) {
      scrollPageTo(top)
    }

    activateModule()
    if (!shouldPrepareAtTop && anchor) {
      alignWorkspaceTop(prefersReducedMotion ? 'auto' : 'smooth')
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

  const returnToDemoRoute = () => {
    navigateToModule('proposal', {
      message: '已返回首页演示路线，可继续选择下一步',
      scrollTarget: '.proposal-demo-route',
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
    const sourceTab = BUSINESS_CONTEXT_TABS.has(activeTab) ? activeTab : lastBusinessTab

    navigateToModule('ai', {
      message: `已进入系统 AI 助手，当前接入：${workflowLabels[sourceTab] || sourceTab}`,
    })
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

  const cancelPendingReview = () => {
    const hadPendingReview = Boolean(reviewAbortControllerRef.current) || isReviewing
    if (!hadPendingReview) return false

    reviewRequestIdRef.current += 1
    reviewAbortControllerRef.current?.abort()
    reviewAbortControllerRef.current = null
    setReviewStage('idle')
    setIsReviewing(false)
    return true
  }

  const cancelAiChat = () => {
    if (!aiSending) return
    aiAbortControllerRef.current?.abort()
    aiAbortControllerRef.current = null
    setAiSending(false)
    setAiStage('idle')
    setStatusMessage('AI 对话已取消，可点击重试继续上一条问题')
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
    setAiStage(localOnlyMode ? 'local' : 'rag')
    lastAiPromptRef.current = prompt
    aiAbortControllerRef.current = new AbortController()
    setStatusMessage('系统 AI 正在检索知识库并读取当前业务上下文')

    let ragItems = []

    try {
      ragItems = localOnlyMode ? knowledgeBaseItems.slice(0, 5) : await searchAiKnowledge(
        buildRagSearchQuery({
          prompt,
          activeTab: aiContextTab,
          reviewText,
          findings,
        }),
        5,
        { signal: aiAbortControllerRef.current.signal },
      )
      setAiKnowledgeHits(ragItems)

      if (localOnlyMode) {
        const fallbackReply = createLocalAiFallbackReply({ prompt, activeTab: aiContextTab, findings, depositResult, ragItems })
        setAiMessages([...nextMessages, { id: nextAssistantId, role: 'assistant', content: fallbackReply }])
        setStatusMessage('仅本地分析模式已生成规则库回复，未发送任何远端请求')
        return
      }
      setAiStage('model')

      const systemContext = redactSensitiveText(buildSystemAiContext({
        activeTab: aiContextTab,
        reviewText: redactSensitiveText(reviewText),
        effectiveReviewProfile,
        findings,
        summary,
        acceptedIds,
        revisionItems,
        depositInputs,
        depositResult,
        reviewHistory,
      }))
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
            content: redactSensitiveText(buildRagContextPrompt(ragItems)),
          },
          ...nextMessages.slice(-12).map((message) => ({
            role: message.role,
            content: redactSensitiveText(message.content),
          })),
        ],
        { temperature: 0.2, maxTokens: 1200, signal: aiAbortControllerRef.current.signal },
      )

      const reply = normalizeAiReplyText(extractAssistantChatContent(response)) || '我暂时没有拿到明确回复，请再把问题说具体一点。'
      setAiMessages([...nextMessages, { id: nextAssistantId, role: 'assistant', content: reply }])
      setStatusMessage(`系统 AI 已结合当前业务上下文和 ${ragItems.length} 条知识库内容回复`)
    } catch (error) {
      if (error?.name === 'AbortError') {
        setAiMessages(nextMessages)
        return
      }
      const fallbackReply = createLocalAiFallbackReply({
        prompt,
        activeTab: aiContextTab,
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
      aiAbortControllerRef.current = null
      setAiStage('idle')
      setAiSending(false)
    }
  }

  const sendAiDraft = () => {
    submitAiChat(aiDraft)
  }

  const retryAiChat = () => {
    if (lastAiPromptRef.current && !aiSending) submitAiChat(lastAiPromptRef.current)
  }

  const updateReviewProfile = (field, value) => {
    cancelPendingReview()
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
      signal: options.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-rental-safe-account': getOrCreateAccountId(),
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

    if (response.headers.get('x-ai-quota-limit')) {
      setQuota({
        used: Number(response.headers.get('x-ai-quota-limit')) - Number(response.headers.get('x-ai-quota-remaining') || 0),
        limit: Number(response.headers.get('x-ai-quota-limit')),
        remaining: Number(response.headers.get('x-ai-quota-remaining') || 0),
      })
    }

    if (!response.ok) {
      const message = data?.error?.message || data?.message || `接口请求失败：HTTP ${response.status}`
      throw new Error(message)
    }

    return data
  }

  const startReview = async () => {
    if (isReviewing) return

    const trimmedText = reviewText.trim()
    setAcceptedIds(new Set())
    setAcceptedRevisionItems([])

    if (!trimmedText) {
      setAiFindings(null)
      setAiQualityReport(null)
      setStatusMessage('请先粘贴合同正文')
      return
    }

    const requestId = reviewRequestIdRef.current + 1
    const controller = new AbortController()
    reviewRequestIdRef.current = requestId
    reviewAbortControllerRef.current?.abort()
    reviewAbortControllerRef.current = controller
    setIsReviewing(true)
    setReviewStage(localOnlyMode ? 'local' : 'rag')
    setStatusMessage('正在检索知识库并调用平台 AI 模型审查合同')

    try {
      const aiReviewText = redactSensitiveText(trimmedText)
      const ragItems = localOnlyMode ? [] : await searchAiKnowledge(
        buildRagSearchQuery({
          prompt: '租房合同审查 押金 维修 涨租 解除 违约 入户 管辖',
          activeTab: 'review',
          reviewText: aiReviewText,
          findings: localFindings,
        }),
        6,
        { signal: controller.signal },
      )
      if (reviewRequestIdRef.current !== requestId) return

      setAiKnowledgeHits(ragItems)

      if (localOnlyMode) {
        setAiFindings(null)
        setAiQualityReport(null)
        setStatusMessage(`本地规则审查完成，发现 ${localFindings.length} 个风险点；未发送合同内容`)
        return
      }

      setReviewStage('model')

      const data = await callAiModel(
        [
          {
            role: 'system',
            content:
              '你是严谨的租房合同解读助手，擅长识别押金、涨租、维修、入户、解除、违约金和管辖风险。必须只返回合法 JSON，且证据必须来自原文。',
          },
          { role: 'user', content: createAiReviewPrompt(aiReviewText, effectiveReviewProfile, ragItems) },
        ],
        { signal: controller.signal },
      )
      if (reviewRequestIdRef.current !== requestId) return

      const parsed = parseAiContent(extractAssistantContent(data))
      const nextFindings = normalizeAiFindings(parsed, aiReviewText)
      const qualityReport = buildAiQualityReport(parsed, aiReviewText, nextFindings)

      setAiFindings(nextFindings)
      setAiQualityReport(qualityReport)
      setStatusMessage(
        qualityReport.rejectedCount
          ? `AI 审查完成，保留 ${nextFindings.length} 条，过滤 ${qualityReport.rejectedCount} 条无证据风险`
          : nextFindings.length
            ? `AI 审查完成，发现 ${nextFindings.length} 个风险点`
            : 'AI 审查完成，未发现明显风险',
      )
    } catch (error) {
      if (error?.name === 'AbortError' || reviewRequestIdRef.current !== requestId) return

      setAiFindings(null)
      setAiQualityReport(null)
      setStatusMessage('AI 审查失败，已自动切换为本地规则结果')
    } finally {
      if (reviewRequestIdRef.current === requestId) {
        reviewAbortControllerRef.current = null
        setReviewStage('idle')
        setIsReviewing(false)
      }
    }
  }

  const replaceContractText = (nextText, options = {}) => {
    const canceledReview = cancelPendingReview()
    const rawText = String(nextText || '')
    const boundedText = rawText.slice(0, MAX_REVIEW_CHARS)
    setFindingListMinHeight(0)
    setContractText(boundedText)
    setAcceptedIds(new Set())
    setAcceptedRevisionItems([])
    setAiFindings(null)
    setAiQualityReport(null)

    if (options.importMeta) {
      setImportedContractMeta(options.importMeta)
    } else if (options.clearImportMeta !== false) {
      setImportedContractMeta(null)
    }

    if (boundedText.length < rawText.length) {
      setStatusMessage(`合同正文过长，已保留前 ${MAX_REVIEW_CHARS.toLocaleString('zh-CN')} 字`)
    } else if (options.statusMessage) {
      setStatusMessage(options.statusMessage)
    } else if (canceledReview) {
      setStatusMessage('合同内容已变化，已取消上一轮 AI 审查')
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
    lastImportFileRef.current = file
    setImportError(false)
    const controller = new AbortController()
    importAbortControllerRef.current = controller
    setImportStage('解析文件')
    setStatusMessage(`正在解析合同文件：${file.name}`)

    try {
      const { extractContractTextFromFile } = await import('./utils/fileImport.js')
      setImportStage(file.type.startsWith('image/') ? (localOnlyMode ? '本地 OCR' : '上传 OCR') : '提取文本')
      const result = await extractContractTextFromFile(file, { signal: controller.signal, localOnly: localOnlyMode })
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
      setImportError(true)
      setStatusMessage(`合同导入失败：${error.message}`)
    } finally {
      importAbortControllerRef.current = null
      setImportStage('idle')
      setIsImportingContract(false)
    }
  }

  const cancelContractImport = () => {
    importAbortControllerRef.current?.abort()
  }

  const retryContractImport = () => {
    if (lastImportFileRef.current && !isImportingContract) importContractFile(lastImportFileRef.current)
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

  const prepareReviewDemo = () => {
    const contract = selectedDemoContract || demoContracts[0]
    setSelectedDemoContractId(contract.id)
    replaceContractText(contract.text, {
      statusMessage: `已载入演示合同并准备本地规则审查：${contract.title}`,
    })
    setReviewProfile((current) => ({ ...current, contractType: 'lease' }))
    navigateToModule('review', {
      message: '已进入租房审查演示，页面会先展示本地规则风险；如需 AI 结果，可点击“开始审查”',
    })
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

    if (!window.confirm('确定清空最近 5 次审查记录吗？清空后无法恢复。')) return

    setReviewHistory([])

    try {
      localStorage.removeItem(STORAGE_KEYS.history)
      localStorage.removeItem(STORAGE_KEYS.historyLegacy)
    } catch {
      // localStorage may be unavailable in private browsing or restricted environments.
    }

    setStatusMessage('已清空本地审查历史')
  }

  const exportAllLocalData = async () => {
    const localStorageData = {}
    try {
      Object.keys(localStorage).forEach((key) => { localStorageData[key] = localStorage.getItem(key) })
    } catch { /* restricted storage */ }
    const photos = await listCheckinPhotos().catch(() => [])
    const payload = { exportedAt: new Date().toISOString(), localStorage: localStorageData, checkinPhotos: photos }
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `租小审-本地数据-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setStatusMessage('全部本地数据已导出为 JSON 文件')
  }

  const clearAllLocalData = async () => {
    if (!window.confirm('确定清除全部本地合同、证据、验房照片和 AI 反馈吗？此操作无法撤销。')) return
    try { localStorage.clear() } catch { /* restricted storage */ }
    await clearCheckinPhotos().catch(() => {})
    window.location.reload()
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
      const { downloadTextDocx } = await import('./utils/docxExport.js')
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
      const { buildContractDocxBlob, downloadBlob } = await import('./utils/docxExport.js')
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

  return (
    <main className="app-shell">
      <a className="skip-link" href="#main-workspace">跳到主内容</a>
      <AppSidebar
        activeTab={activeTab}
        localOnlyMode={localOnlyMode}
        onClearAllData={clearAllLocalData}
        onExportAllData={exportAllLocalData}
        onSwitchModule={switchModuleFromNav}
        onToggleLocalOnly={setLocalOnlyMode}
      />
      <AnnouncementStrip guideTriggerRef={guideTriggerRef} onOpenGuide={openRiskGuide} />

      {showGuide && (
        <RiskGuideModal closeRef={guideCloseRef} onClose={() => setShowGuide(false)} onJump={jumpFromGuide} />
      )}

      <section
        className={`workspace ${moduleEntering ? 'module-entering' : ''}`}
        id="main-workspace"
        ref={workspaceRef}
        tabIndex={-1}
      >
        <AppTopbar
          activeTab={activeTab}
          findingsCount={findings.length}
          revisionItemsCount={revisionItems.length}
          onBackToDemoRoute={returnToDemoRoute}
        />

        {statusMessage && (
          <div className="status-toast" role="status" aria-live="polite">
            {statusMessage}
          </div>
        )}

        <div className="mobile-read-notice" role="note">
          <strong>移动端查看模式</strong>
          <span>租房合同解读属于重阅读场景，建议在电脑端完成修改与导出，手机端更适合查看结论。</span>
        </div>

        {activeTab === 'evidence' ? (
          <EvidencePack onStatus={setStatusMessage} />
        ) : activeTab === 'checkin' ? (
          <CheckinInspection onStatus={setStatusMessage} />
        ) : activeTab === 'subsidy' ? (
          <SubsidyMatcher onStatus={setStatusMessage} />
        ) : activeTab === 'ai' ? (
          <AiAssistantPanel
            activeTab={aiContextTab}
            aiConfig={aiConfig}
            aiDraft={aiDraft}
            aiFeedback={aiFeedback}
            aiFeedbackText={aiFeedbackText}
            aiKnowledgeHits={aiKnowledgeHits}
            aiMessages={aiMessages}
            aiSending={aiSending}
            aiStage={aiStage}
            localOnlyMode={localOnlyMode}
            quota={quota}
            modelConnectionLabel={modelConnectionLabel}
            onDraftChange={setAiDraft}
            onRateMessage={rateAiMessage}
            onResetChat={resetAiChat}
            onCancel={cancelAiChat}
            onRetry={retryAiChat}
            onSendDraft={sendAiDraft}
          />
        ) : activeTab === 'review' ? (
          <div className="review-layout">
            <ReviewInputPanel
              contractText={contractText}
              effectiveReviewProfile={effectiveReviewProfile}
              handleContractFileChange={handleContractFileChange}
              handleContractFileDrop={handleContractFileDrop}
              handleContractTextChange={handleContractTextChange}
              importedConfidence={importedConfidence}
              importedContractMeta={importedContractMeta}
              importedIsOcr={importedIsOcr}
              importedNeedsManualCheck={importedNeedsManualCheck}
              importError={importError}
              isImportingContract={isImportingContract}
              importStage={importStage}
              localOnlyMode={localOnlyMode}
              onCancelImport={cancelContractImport}
              onCancelReview={cancelPendingReview}
              onRetryImport={retryContractImport}
              isReviewing={isReviewing}
              reviewStage={reviewStage}
              loadDemoContract={loadDemoContract}
              onClearImportMeta={() => setImportedContractMeta(null)}
              resetContractText={resetContractText}
              reviewProfile={reviewProfile}
              reviewText={reviewText}
              selectedDemoContract={selectedDemoContract}
              selectedDemoContractId={selectedDemoContractId}
              setSelectedDemoContractId={setSelectedDemoContractId}
              startReview={startReview}
              updateReviewProfile={updateReviewProfile}
            />

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
          <ProposalHome
            depositInputs={depositInputs}
            depositResult={depositResult}
            onDepositInputChange={updateDepositInput}
            onEnterModule={enterModuleFromCard}
            onOpenGuide={openRiskGuide}
            onOpenAiExpert={openAiExpert}
            onPrepareReviewDemo={prepareReviewDemo}
          />
        )}
      </section>
    </main>
  )
}

export default App
