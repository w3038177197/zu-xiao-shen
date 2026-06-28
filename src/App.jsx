import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
      const { extractContractTextFromFile } = await import('./utils/fileImport.js')
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
      <AppSidebar activeTab={activeTab} onSwitchModule={switchModuleFromNav} />
      <AnnouncementStrip guideTriggerRef={guideTriggerRef} onOpenGuide={openRiskGuide} />

      {showGuide && (
        <RiskGuideModal closeRef={guideCloseRef} onClose={() => setShowGuide(false)} onJump={jumpFromGuide} />
      )}

      <section className={`workspace ${moduleEntering ? 'module-entering' : ''}`} ref={workspaceRef}>
        <AppTopbar
          activeTab={activeTab}
          findingsCount={findings.length}
          revisionItemsCount={revisionItems.length}
          onOpenAiExpert={openAiExpert}
        />

        {statusMessage && <div className="status-toast">{statusMessage}</div>}

        <div className="mobile-read-notice">
          <strong>移动端查看模式</strong>
          <span>租房合同解读属于重阅读场景，建议在电脑端完成修改与导出，手机端更适合查看结论。</span>
        </div>

        {showAiConfig && (
          <AiAssistantPanel
            activeTab={activeTab}
            aiConfig={aiConfig}
            aiDraft={aiDraft}
            aiFeedback={aiFeedback}
            aiFeedbackText={aiFeedbackText}
            aiKnowledgeHits={aiKnowledgeHits}
            aiMessages={aiMessages}
            aiSending={aiSending}
            modelConnectionLabel={modelConnectionLabel}
            onClose={closeAiExpert}
            onDraftChange={setAiDraft}
            onRateMessage={rateAiMessage}
            onResetChat={resetAiChat}
            onSendDraft={sendAiDraft}
          />
        )}

        {activeTab === 'evidence' ? (
          <EvidencePack onStatus={setStatusMessage} />
        ) : activeTab === 'checkin' ? (
          <CheckinInspection onStatus={setStatusMessage} />
        ) : activeTab === 'subsidy' ? (
          <SubsidyMatcher onStatus={setStatusMessage} />
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
              isImportingContract={isImportingContract}
              isReviewing={isReviewing}
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
            onOpenAiExpert={openAiExpert}
          />
        )}
      </section>
    </main>
  )
}

export default App
