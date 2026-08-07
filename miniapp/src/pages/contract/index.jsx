import { Component } from 'react'
import { Button, Picker, ScrollView, Text, Textarea, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { demoContracts } from '../../shared/demoContracts.js'
import { contractTypeOptions, partyRoleOptions, reviewDepthOptions } from '../../shared/reviewOptions.js'
import {
  analyzeContract,
  cleanContractTextForReview,
  createRevisedContractDraft,
  getDimensionScores,
  getRiskSummary,
  groupFindingsByTheme,
  mergeFindings,
  mergeRevisionItems,
  resolveReviewProfile,
} from '../../features/contractReview'
import { createReviewHistoryEntry, saveReviewHistory } from '../../features/reviewHistory'
import { saveReviewFeedback } from '../../features/reviewFeedback'
import { createDebouncedSaver } from '../../utils/debounceSave'
import { copyText as copyToClipboard } from '../../utils/copyText'
import {
  CONTRACT_TEXT_EXTENSIONS,
  chooseContractImage,
  chooseWechatContractFile,
  getContractImportError,
  importClipboardContractText,
  importLocalContractFile,
  startRemoteDocumentImport,
  startRemoteImageImport,
} from '../../utils/contractTextImport'
import { buildRemoteContractReviewPayload } from '../../features/remoteAi'
import { exportRevisedContract } from '../../utils/revisedContractExport'
import {
  getRemoteAiError,
  startRemoteContractReviewRequest,
} from '../../utils/remoteAiRequest'
import { getActiveHouseId, hasHouseSwitchedSince } from '../../features/houseProfile'
import './index.css'

const STORAGE_KEY = 'zu-xiao-shen-contract-draft'
const HISTORY_KEY = 'zu-xiao-shen-review-history'
const PROFILE_KEY = 'zu-xiao-shen-review-profile'
const DEFAULT_PROFILE = { contractType: 'lease', partyRole: 'partyB', reviewDepth: 'strict' }

const levelText = (level) => (level === 'high' ? '高风险' : level === 'medium' ? '中风险' : '低风险')

function loadStored(key, fallback) {
  try {
    const saved = Taro.getStorageSync(key)
    return saved || fallback
  } catch {
    return fallback
  }
}

export default class ContractReview extends Component {
  draftSaver = createDebouncedSaver((contractText) => Taro.setStorageSync(STORAGE_KEY, contractText))

  activeImportTask = null

  activeReviewTask = null

  reviewRun = 0
  importRun = 0

  state = {
    contractText: '',
    findings: [],
    summary: null,
    dimensions: [],
    adoptedItems: [],
    revisedDraft: '',
    activeProfile: null,
    profile: { ...DEFAULT_PROFILE },
    history: [],
    isAnalyzing: false,
    analysisStage: 'idle',
    isImporting: false,
    importProgress: null,
    expandedIndex: -1,
    showHistory: false,
    operationNotice: '',
    lastImportSource: '',
    lastAnalysisFailed: false,
    isExportingRevised: false,
  }

  componentDidMount() {
    const savedProfile = loadStored(PROFILE_KEY, DEFAULT_PROFILE)
    const savedHistory = loadStored(HISTORY_KEY, [])
    this.setState({
      contractText: loadStored(STORAGE_KEY, ''),
      history: Array.isArray(savedHistory) ? savedHistory.slice(0, 8) : [],
      profile: { ...DEFAULT_PROFILE, ...(typeof savedProfile === 'object' ? savedProfile : {}) },
    })
    this.loadedAt = Date.now()
  }

  componentDidShow() {
    if (!hasHouseSwitchedSince(this.loadedAt || 0)) return
    this.cancelActiveReview()
    this.draftSaver.cancel()
    // 取消进行中的导入任务，避免旧房源导入结果在切换后写入新房源草稿
    this.activeImportTask?.cancel?.()
    this.activeImportTask = null
    const savedProfile = loadStored(PROFILE_KEY, DEFAULT_PROFILE)
    const savedHistory = loadStored(HISTORY_KEY, [])
    this.setState({
      contractText: loadStored(STORAGE_KEY, ''),
      history: Array.isArray(savedHistory) ? savedHistory.slice(0, 8) : [],
      profile: { ...DEFAULT_PROFILE, ...(typeof savedProfile === 'object' ? savedProfile : {}) },
      findings: [],
      summary: null,
      dimensions: [],
      adoptedItems: [],
      revisedDraft: '',
      activeProfile: null,
      isAnalyzing: false,
      analysisStage: 'idle',
      // 同步重置导入状态，与 componentWillUnmount 保持一致
      isImporting: false,
      importProgress: null,
    })
    this.loadedAt = Date.now()
  }

  componentDidHide() {
    this.activeImportTask?.cancel?.()
    this.activeImportTask = null
    this.importRun += 1
    this.draftSaver.flush()
  }

  componentWillUnmount() {
    this.activeImportTask?.cancel?.()
    this.activeImportTask = null
    this.importRun += 1
    this.cancelActiveReview()
    if (globalThis.__ZU_XIAO_SHEN_CLEARING__) this.draftSaver.cancel()
    else this.draftSaver.flush()
  }

  onShareAppMessage() {
    return { title: '租小审：签合同前，先把押金和涨租条款过一遍', path: '/pages/contract/index' }
  }

  cancelActiveReview = () => {
    this.reviewRun += 1
    this.activeReviewTask?.cancel?.()
    this.activeReviewTask = null
  }

  updateContract = (contractText, extra = {}) => {
    this.cancelActiveReview()
    this.setState({ contractText, findings: [], summary: null, dimensions: [], adoptedItems: [], revisedDraft: '', activeProfile: null, isAnalyzing: false, analysisStage: 'idle', lastAnalysisFailed: false, ...extra })
    this.draftSaver.schedule(contractText)
  }

  updateProfile = (key, value) => {
    this.cancelActiveReview()
    this.setState((previous) => {
      const profile = { ...previous.profile, [key]: value }
      Taro.setStorageSync(PROFILE_KEY, profile)
      return { profile, findings: [], summary: null, dimensions: [], adoptedItems: [], revisedDraft: '', activeProfile: null, isAnalyzing: false, analysisStage: 'idle', lastAnalysisFailed: false }
    })
  }

  // 接收本次审查计算出的完整结果，不依赖 this.state（setState 异步，this.state 此时仍是旧值）
  pushHistory = (reviewResult) => {
    const entry = createReviewHistoryEntry(reviewResult)
    const result = saveReviewHistory([entry, ...this.state.history])
    if (result.ok) this.setState({ history: result.history })
    return result.ok ? (result.degraded ? 'summary' : 'saved') : 'failed'
  }

  restoreHistory = (entry) => {
    if (!entry?.snapshot) {
      Taro.showToast({ title: '该记录无快照，无法恢复', icon: 'none' })
      return
    }
    this.cancelActiveReview()
    const snap = entry.snapshot
    const currentDraft = this.state.contractText
    // 先取消尚未执行的 draftSaver，避免它把恢复前的旧草稿写入 Storage
    this.draftSaver.cancel()
    // 同步持久化合同草稿和审查画像，保证退出重进后仍是恢复结果
    const previousDraft = loadStored(STORAGE_KEY, '')
    const previousProfile = loadStored(PROFILE_KEY, DEFAULT_PROFILE)
    try {
      Taro.setStorageSync(STORAGE_KEY, snap.contractText || '')
      Taro.setStorageSync(PROFILE_KEY, snap.profile || { ...DEFAULT_PROFILE })
    } catch {
      try {
        Taro.setStorageSync(STORAGE_KEY, previousDraft)
        Taro.setStorageSync(PROFILE_KEY, previousProfile)
      } catch { /* 保留当前界面，不再继续写入 */ }
      this.draftSaver.schedule(currentDraft)
      Taro.showToast({ title: '恢复失败，请清理存储空间后重试', icon: 'none' })
      return
    }
    this.setState({
      contractText: snap.contractText || '',
      findings: snap.findings || [],
      summary: snap.summary || null,
      dimensions: snap.dimensions || [],
      adoptedItems: snap.adoptedItems || [],
      revisedDraft: snap.revisedDraft || '',
      activeProfile: snap.activeProfile || null,
      profile: { ...DEFAULT_PROFILE, ...(snap.profile || {}) },
      isAnalyzing: false,
      analysisStage: 'idle',
      expandedIndex: -1,
    })
    Taro.showToast({ title: `已恢复 ${entry.time} 的审查`, icon: 'none' })
  }

  deleteHistoryItem = (entryId) => {
    Taro.showModal({
      title: '删除该条记录',
      content: '删除后无法恢复，是否继续？',
      success: ({ confirm }) => {
        if (!confirm) return
        this.setState((previous) => {
          const history = previous.history.filter((item) => item.id !== entryId)
          Taro.setStorageSync(HISTORY_KEY, history)
          return { history }
        })
        Taro.showToast({ title: '已删除', icon: 'success' })
      },
    })
  }

  handleAnalyze = async () => {
    const contractText = this.state.contractText.trim()
    if (!contractText) {
      Taro.showToast({ title: '请先粘贴或导入合同', icon: 'none' })
      return
    }
    if (this.draftSaver.flush() === false) {
      Taro.showToast({ title: '合同暂未保存，请稍后重试', icon: 'none' })
      return
    }

    const run = ++this.reviewRun
    const reviewHouseId = getActiveHouseId()
    const isCurrentReviewRun = () => run === this.reviewRun && getActiveHouseId() === reviewHouseId
    const profile = { ...this.state.profile }
    this.setState({ isAnalyzing: true, analysisStage: 'prepare', operationNotice: '', lastAnalysisFailed: false })
    const useAi = contractText.length <= 60_000
    if (!isCurrentReviewRun()) return
    this.setState({ analysisStage: 'local' })
    let localResult
    try {
      const cleanText = cleanContractTextForReview(contractText)
      const activeProfile = resolveReviewProfile(profile, cleanText)
      const findings = analyzeContract(cleanText, activeProfile)
      const summary = getRiskSummary(findings)
      const dimensions = getDimensionScores(findings).filter((item) => item.score > 0)
      localResult = { contractText, findings, summary, dimensions, adoptedItems: [], revisedDraft: '', activeProfile, profile }
    } catch (error) {
      console.error('本地审查失败:', error)
      if (!isCurrentReviewRun()) return
      this.setState({
        isAnalyzing: false,
        analysisStage: 'idle',
        operationNotice: '本地审查失败，当前合同内容没有被修改。请重试；如果仍失败，可先导出或复制合同正文。',
        lastAnalysisFailed: true,
      })
      Taro.showToast({ title: '审查失败，请重试', icon: 'none' })
      return
    }

    const finishReview = (result, operationNotice = '') => {
      if (!isCurrentReviewRun()) return
      this.setState({
        ...result,
        isAnalyzing: false,
        analysisStage: 'idle',
        operationNotice,
        lastAnalysisFailed: false,
        expandedIndex: -1,
      })
      const historyStatus = this.pushHistory(result)
      const title = historyStatus === 'failed'
        ? '审查完成，但历史未保存'
        : historyStatus === 'summary'
          ? '审查完成，仅保存历史摘要'
          : `发现 ${result.findings.length} 个风险点`
      Taro.showToast({ title, icon: result.findings.length || historyStatus !== 'saved' ? 'none' : 'success' })
    }

    try {
      if (!useAi) {
        finishReview(localResult, '合同超过 60000 字，本次已保留本地规则审查结果；请按章节拆分后进行综合审查。')
        return
      }
      if (!isCurrentReviewRun()) return
      const payload = buildRemoteContractReviewPayload({ contractText, profile: localResult.activeProfile, localFindings: localResult.findings })
      const request = startRemoteContractReviewRequest(payload)
      this.activeReviewTask = request
      this.setState({ analysisStage: 'ai' })
      const remoteResult = await request.promise
      if (!isCurrentReviewRun() || this.activeReviewTask !== request) return
      const findings = mergeFindings(localResult.findings, remoteResult.findings)
      const result = {
        ...localResult,
        findings,
        summary: getRiskSummary(findings),
        dimensions: getDimensionScores(findings).filter((item) => item.score > 0),
      }
      finishReview(result, remoteResult.partial
        ? `综合审查已完成 ${remoteResult.chunksReviewed}/${remoteResult.chunksTotal} 个 AI 分段，其余分段暂时失败；已合并成功分段和本地结果。`
        : remoteResult.findings.length
          ? `综合审查完成：本地规则与 AI 已协作核验，AI 补充 ${Math.max(0, findings.length - localResult.findings.length)} 个风险点。`
        : '综合审查完成：AI 已结合本地线索和知识库核验，未补充有可靠原文证据的新风险。')
    } catch (error) {
      if (!isCurrentReviewRun()) return
      const failure = getRemoteAiError(error)
      finishReview(localResult, failure.cancelled
        ? '综合审查已取消，本地规则审查结果已保留。'
        : `AI 协作核验未完成：${failure.message}。本地规则审查结果已保留。`)
    } finally {
      if (run === this.reviewRun) this.activeReviewTask = null
    }
  }

  cancelAiReview = () => {
    this.activeReviewTask?.cancel?.()
  }

  retryAnalyze = () => {
    if (this.state.isAnalyzing) return
    this.handleAnalyze()
  }

  loadDemo = (index) => {
    const demo = demoContracts[index]
    if (!demo) return
    this.updateContract(demo.text)
    Taro.showToast({ title: `已载入：${demo.title}`, icon: 'none' })
  }

  getDevicePlatform = () => {
    try {
      return Taro.getDeviceInfo()?.platform || ''
    } catch {
      return ''
    }
  }

  applyImportedContract = ({ text, fileName }) => {
    const apply = () => {
      this.updateContract(text)
      Taro.showToast({ title: '合同正文已导入', icon: 'success' })
    }
    if (!this.state.contractText.trim() || this.state.contractText.trim() === text.trim()) {
      apply()
      return
    }
    Taro.showModal({
      title: '替换当前合同正文？',
      content: `将使用“${fileName}”替换输入框中的现有内容，原内容仍可在替换前复制备份。`,
      confirmText: '确认替换',
      success: ({ confirm }) => {
        if (confirm) apply()
      },
    })
  }

  showImportFailure = (error, source) => {
    const detail = getContractImportError(error, { source, platform: this.getDevicePlatform() })
    if (detail.cancelled) return
    console.error('合同导入失败:', error)
    this.setState({ operationNotice: `${detail.title}：${detail.content}`, lastImportSource: source || '' })
    Taro.showModal({ title: detail.title, content: detail.content, showCancel: false })
  }

  confirmRemoteParse = async (fileName) => {
    try {
      const result = await Taro.showModal({
        title: '上传解析合同？',
        content: `“${String(fileName || '合同文件').slice(0, 36)}”将上传至租小审服务端；合同图片会交由智谱视觉模型提取正文，失败时使用本地 OCR。原始文件仅在请求内存中处理，不写入磁盘、不持久化保存。解析完成后仍在本机审查。`,
        confirmText: '上传解析',
        cancelText: '暂不上传',
      })
      return Boolean(result.confirm)
    } catch {
      return false
    }
  }

  runRemoteImport = async (file, startImport = startRemoteDocumentImport) => {
    if (!await this.confirmRemoteParse(file.name)) return
    const run = ++this.importRun
    this.setState({ importProgress: { fileName: file.name, progress: 0 } })
    const options = {
      onProgress: (progress) => {
        if (run === this.importRun) this.setState({ importProgress: { fileName: file.name, progress } })
      },
    }
    const task = startImport(file, options)
    this.activeImportTask = task
    const result = await task.promise
    if (run !== this.importRun || this.activeImportTask !== task) return
    this.applyImportedContract({ ...result, fileName: result.fileName || file.name })
  }

  chooseWechatFile = async () => {
    if (this.state.isImporting) return
    this.setState({ isImporting: true })
    try {
      const file = await chooseWechatContractFile()
      if (CONTRACT_TEXT_EXTENSIONS.includes(file.extension)) {
        this.applyImportedContract(await importLocalContractFile(file))
      } else {
        await this.runRemoteImport(file)
      }
    } catch (error) {
      this.showImportFailure(error, 'wechat')
    } finally {
      this.activeImportTask = null
      this.setState({ isImporting: false, importProgress: null })
    }
  }

  cancelImport = () => {
    this.activeImportTask?.cancel?.()
  }

  importFromImage = async (sourceType) => {
    if (this.state.isImporting) return
    this.setState({ isImporting: true })
    try {
      const file = await chooseContractImage(sourceType)
      await this.runRemoteImport(file, startRemoteImageImport)
    } catch (error) {
      this.showImportFailure(error, sourceType)
    } finally {
      this.activeImportTask = null
      this.setState({ isImporting: false, importProgress: null })
    }
  }

  retryLastImport = () => {
    const source = this.state.lastImportSource
    this.setState({ operationNotice: '', lastImportSource: '' })
    if (!source || this.state.isImporting) return
    if (source === 'wechat') this.chooseWechatFile()
    else if (source === 'phone') this.importFromPhone()
    else if (source === 'camera' || source === 'album') this.importFromImage(source)
  }

  importFromPhone = async () => {
    if (this.state.isImporting) return
    this.setState({ isImporting: true })
    try {
      this.applyImportedContract(await importClipboardContractText())
    } catch (error) {
      this.showImportFailure(error, 'phone')
    } finally {
      this.setState({ isImporting: false })
    }
  }

  handleAdopt = (finding) => {
    if (!finding.replacement) return
    this.setState((previous) => {
      const adoptedItems = mergeRevisionItems(previous.adoptedItems, [finding])
      return { adoptedItems, revisedDraft: createRevisedContractDraft(previous.contractText, adoptedItems) }
    })
    Taro.showToast({ title: '已采纳，修订稿已更新', icon: 'success' })
  }

  handleFindingFeedback = (finding, type) => {
    const result = saveReviewFeedback({ findingId: finding.id, type, contractType: this.state.activeProfile?.contractType || this.state.profile.contractType })
    if (result.ok) this.setState({ operationNotice: type === 'accurate' ? '已记录为识别准确' : '已记录为需要人工复核' })
    else this.setState({ operationNotice: '反馈保存失败，请稍后重试' })
  }

  handleAdoptAll = () => {
    const adoptedIds = new Set(this.state.adoptedItems.map((item) => item.id))
    const pending = this.state.findings.filter((finding) => finding.replacement && !adoptedIds.has(finding.id))
    if (!pending.length) {
      Taro.showToast({ title: '没有可采纳的修改建议', icon: 'none' })
      return
    }
    this.setState((previous) => {
      const adoptedItems = mergeRevisionItems(previous.adoptedItems, pending)
      return { adoptedItems, revisedDraft: createRevisedContractDraft(previous.contractText, adoptedItems) }
    })
    Taro.showToast({ title: `已采纳 ${pending.length} 条建议`, icon: 'success' })
  }

  handleWriteBack = () => {
    if (!this.state.revisedDraft) return
    Taro.showModal({
      title: '写回编辑区',
      content: '将用修订版草案替换当前合同正文，是否继续？',
      success: ({ confirm }) => {
        if (confirm) this.updateContract(this.state.revisedDraft)
      },
    })
  }

  handleExportRevised = async () => {
    if (!this.state.revisedDraft || this.state.isExportingRevised) return
    this.setState({ isExportingRevised: true })
    try {
      const result = await exportRevisedContract(this.state.revisedDraft)
      if (result.ok) Taro.showToast({ title: '修订合同已导出', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: error?.message || '修订合同导出失败', icon: 'none' })
    } finally {
      this.setState({ isExportingRevised: false })
    }
  }

  copyText = (data, title = '已复制') => {
    copyToClipboard(data, title)
  }

  clearHistory = () => {
    Taro.showModal({
      title: '清空审查记录',
      content: '此操作无法撤销，是否继续？',
      success: ({ confirm }) => {
        if (!confirm) return
        Taro.setStorageSync(HISTORY_KEY, [])
        this.setState({ history: [] })
      },
    })
  }

  handleReset = () => {
    Taro.showModal({
      title: '清空合同',
      content: '将清空合同正文和当前审查结果，是否继续？',
      success: ({ confirm }) => {
        if (!confirm) return
        this.draftSaver.cancel()
        this.updateContract('', { expandedIndex: -1, operationNotice: '', lastImportSource: '' })
        this.draftSaver.flush()
      },
    })
  }

  renderProfilePicker = (label, options, key) => {
    const index = Math.max(0, options.findIndex((item) => item.value === this.state.profile[key]))
    return (
      <View className='profile-field' key={key}>
        <Text className='field-label'>{label}</Text>
        <Picker aria-label={label} range={options.map((item) => item.label)} value={index} onChange={(event) => this.updateProfile(key, options[Number(event.detail.value)].value)}>
          <View className='picker-value'>{options[index]?.label}<Text className='chevron'>⌄</Text></View>
        </Picker>
      </View>
    )
  }

  render() {
    const { contractText, findings, summary, dimensions, adoptedItems, revisedDraft, profile, history, isAnalyzing, analysisStage, isImporting, importProgress, expandedIndex, showHistory, operationNotice, lastImportSource, lastAnalysisFailed, isExportingRevised } = this.state
    const adoptedIds = new Set(adoptedItems.map((item) => item.id))
    const pendingFindings = findings.filter((finding) => !adoptedIds.has(finding.id))
    const activeSummary = adoptedItems.length ? getRiskSummary(pendingFindings) : summary
    const activeDimensions = adoptedItems.length ? getDimensionScores(pendingFindings).filter((item) => item.score > 0) : dimensions
    const lowCount = Math.max(0, pendingFindings.length - (activeSummary?.highCount || 0) - (activeSummary?.mediumCount || 0))
    const groupedFindings = groupFindingsByTheme(pendingFindings)
    const pendingAdoptableCount = pendingFindings.filter((finding) => finding.replacement).length
    const reviewDepthHint = reviewDepthOptions.find((item) => item.value === profile.reviewDepth)?.desc
    const operationNoticeIsError = lastAnalysisFailed || Boolean(lastImportSource) || /失败|未完成|已取消|超过 60000 字/.test(operationNotice)

    return (
      <ScrollView scrollY enableFlex className='page contract-page'>
        <View className='card hero-card'>
          <Text className='eyebrow'>合同审查</Text>
          <Text className='page-title'>先看懂合同，再决定怎么签</Text>
          <Text className='body-text'>标出押金、涨租、维修、入户和违约责任，把风险翻译成可直接沟通的修改建议。</Text>
          <View className='privacy-note'>
            <View className='privacy-indicator'>✓</View>
            <Text>本地规则与 AI 一次协作审查；合同文字双重脱敏，合同图片和附件仅在确认后用于提取正文</Text>
          </View>
        </View>

        <View className='card input-card'>
          <View className='card-header'>
            <View>
              <Text className='eyebrow'>审查材料</Text>
              <Text className='section-title'>合同正文</Text>
            </View>
            <View className='input-header-actions'>
              <Text className='char-count'>{contractText.length.toLocaleString()} 字</Text>
              {contractText ? <Button className='input-clear' aria-label='清空合同正文' disabled={isImporting || isAnalyzing} onClick={this.handleReset}>清空</Button> : null}
            </View>
          </View>
          <Textarea
            className='contract-input'
            aria-label='合同正文'
            name='contractText'
            adjustPosition
            cursorSpacing={20}
            placeholder='粘贴正文，或导入 TXT、MD、DOCX、PDF…'
            value={contractText}
            onInput={(event) => this.updateContract(event.detail.value)}
            maxlength={-1}
          />
          {contractText.length > 60000 ? <Text className='caption contract-size-warning'>合同超过 60000 字，本地规则仍可审查，但 AI 全文复核需按章节分段。</Text> : null}
          {operationNotice ? (
            <View className={`operation-notice ${operationNoticeIsError ? 'is-error' : 'is-success'}`} aria-live='polite'>
              <Text>{operationNotice}</Text>
              <View className='operation-notice-actions'>
                {lastAnalysisFailed ? <Button aria-label='重试混合审查' disabled={isAnalyzing} onClick={this.retryAnalyze}>重试审查</Button> : null}
                {lastImportSource ? <Button aria-label='重试上次导入' disabled={isImporting} onClick={this.retryLastImport}>重试</Button> : null}
                <Button aria-label='关闭错误提示' onClick={() => this.setState({ operationNotice: '' })}>关闭</Button>
              </View>
            </View>
          ) : null}
          <View className='secondary-actions'>
            <Button className='btn-secondary' disabled={isImporting} onClick={this.importFromPhone}>手机粘贴</Button>
            <Button className='btn-secondary' disabled={isImporting} onClick={this.chooseWechatFile}>选择文件/最近文件</Button>
            <Button className='btn-secondary' disabled={isImporting} onClick={() => this.importFromImage('camera')}>拍照识别</Button>
            <Button className='btn-secondary' disabled={isImporting} onClick={() => this.importFromImage('album')}>相册识别</Button>
            <Picker className='demo-picker' aria-label='选择演示合同' range={demoContracts.map((item) => item.title)} onChange={(event) => this.loadDemo(Number(event.detail.value))}>
              <Button className='btn-secondary demo-picker-button'>载入演示合同</Button>
            </Picker>
          </View>
          {importProgress ? (
            <View className='import-progress'>
              <View className='import-progress-head'>
                <Text>{importProgress.fileName}</Text>
                <Text>{importProgress.progress || '连接中'}{importProgress.progress ? '%' : ''}</Text>
              </View>
              <View className='import-progress-track'><View className='import-progress-fill' style={{ width: `${importProgress.progress || 8}%` }} /></View>
              <Button className='btn-danger import-cancel' onClick={this.cancelImport}>取消解析</Button>
            </View>
          ) : null}
          <Text className='caption import-help'>TXT/MD 在本机读取；DOCX/PDF 和合同图片可在确认后上传提取正文。图片请尽量正对纸面、光线均匀并避免反光。</Text>
          <View className='profile-grid'>
            {this.renderProfilePicker('合同类型', contractTypeOptions, 'contractType')}
            {this.renderProfilePicker('审查角色', partyRoleOptions, 'partyRole')}
            {this.renderProfilePicker('审查深度', reviewDepthOptions, 'reviewDepth')}
          </View>
          {reviewDepthHint ? <Text className='caption review-depth-hint'>当前档位：{reviewDepthHint}</Text> : null}
        </View>

        <Text className='review-data-note'>点击“开始综合审查”即同意将双重脱敏后的合同文字发送至租小审服务端和模型服务商进行 AI 核验。</Text>
        <View className='sticky-actions'>
          <Button className='btn-primary' onClick={this.handleAnalyze} disabled={isAnalyzing || !contractText.trim()}>{isAnalyzing ? (analysisStage === 'prepare' ? '准备综合审查…' : analysisStage === 'ai' ? 'AI 协作核验中…' : '本地规则扫描中…') : '开始综合审查'}</Button>
          {isAnalyzing && analysisStage === 'ai' && this.activeReviewTask ? <Button className='btn-danger' onClick={this.cancelAiReview}>取消 AI 复核</Button> : null}
        </View>

        {activeSummary ? (
          <View className='card result-card'>
            <Text className='eyebrow'>风险总览</Text>
            <Text className='section-title'>审查结果</Text>
            <View className={`summary-card ${activeSummary.tone}`}>
              <View>
                <Text className='risk-score'>{activeSummary.score}</Text>
                <Text className='risk-label'>风险评分</Text>
              </View>
              <View className='summary-copy'>
                <Text className='risk-level'>{activeSummary.label}</Text>
                <Text className='risk-description'>{adoptedItems.length ? '已采纳的建议已移入下方修订成果区，当前仅统计待处理风险。' : activeSummary.advice}</Text>
              </View>
            </View>
            <View className='stats-row'>
              <View className='stat-item'><Text>{pendingFindings.length}</Text><Text>待处理</Text></View>
              <View className='stat-item high'><Text>{activeSummary.highCount}</Text><Text>高风险</Text></View>
              <View className='stat-item medium'><Text>{activeSummary.mediumCount}</Text><Text>中风险</Text></View>
              <View className='stat-item'><Text>{lowCount}</Text><Text>低风险</Text></View>
            </View>
            {activeSummary.coverage ? (
              <View className='audit-coverage'>
                <View className='audit-coverage-head'>
                  <Text className='finding-label'>条款维度完整度</Text>
                  <Text className='audit-coverage-value'>{activeSummary.coverage.percent}%</Text>
                </View>
                <View className='dimension-bar'><View className='dimension-fill low' style={{ width: `${activeSummary.coverage.percent}%` }} /></View>
                <Text className='caption'>已核对 {activeSummary.coverage.label}。覆盖率不等于合同安全结论。</Text>
              </View>
            ) : null}
            {(activeSummary.missingCount || activeSummary.consistencyCount) ? (
              <View className='audit-alerts'>
                <View className='audit-alert-head'>
                  <Text className='finding-label'>还需要人工确认</Text>
                  <Text className='caption'>{activeSummary.missingCount || 0} 项缺失 · {activeSummary.consistencyCount || 0} 项矛盾</Text>
                </View>
                {[...(activeSummary.missingFindings || []), ...(activeSummary.consistencyFindings || [])].slice(0, 4).map((item) => (
                  <View className='audit-alert-item' key={item.id}>
                    <Text className='audit-alert-title'>{item.title}</Text>
                    <Text className='caption'>{item.explanation}</Text>
                  </View>
                ))}
                {[...(activeSummary.missingFindings || []), ...(activeSummary.consistencyFindings || [])].length > 4 ? <Text className='caption'>其余项目已写入导出报告。</Text> : null}
              </View>
            ) : null}
            {activeDimensions.length ? (
              <View className='dimension-list'>
                {activeDimensions.map((item) => (
                  <View className='dimension-item' key={item.key}>
                    <View className='dimension-head'>
                      <Text>{item.label}</Text>
                      <Text className={`dimension-score ${item.tone}`}>{item.score}</Text>
                    </View>
                    <View className='dimension-bar'><View className={`dimension-fill ${item.tone}`} style={{ width: `${Math.min(100, item.score)}%` }} /></View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {pendingFindings.length ? (
          <View className='card findings-card'>
            <View className='card-header'>
              <View>
                <Text className='eyebrow'>逐条建议</Text>
                <Text className='section-title'>修改与沟通方案</Text>
              </View>
              <Button className='btn-secondary btn-adopt-all' disabled={!pendingAdoptableCount} onClick={this.handleAdoptAll}>全部采纳</Button>
            </View>
            {groupedFindings.map((group) => (
              <View className='finding-group' key={group.title}>
                <View className='finding-group-head'>
                  <Text>{group.title}</Text>
                  <Text>{group.items.length} 条</Text>
                </View>
                {group.items.map(({ finding, index }) => {
                  const expanded = expandedIndex === index
                  const adopted = adoptedItems.some((item) => item.id === finding.id)
                  return (
                    <View key={finding.id || index} className={`finding-card risk-${finding.level}`}>
                  <Button className='finding-header' aria-expanded={expanded} onClick={() => this.setState({ expandedIndex: expanded ? -1 : index })}>
                    <View>
                      <Text className='finding-number'>{String(index + 1).padStart(2, '0')}</Text>
                      <Text className='finding-title'>{finding.title}</Text>
                    </View>
                    <View className='finding-meta'>
                      <Text className='finding-source'>{finding.source === 'ai' ? 'AI 补充' : '本地规则'}</Text>
                      <Text className={`status-badge status-badge-${finding.level === 'high' ? 'error' : finding.level === 'medium' ? 'warning' : 'done'}`}>{levelText(finding.level)}</Text>
                      <Text className='chevron'>{expanded ? '⌃' : '⌄'}</Text>
                    </View>
                  </Button>
                  {expanded ? (
                    <View className='finding-details'>
                      <View className='finding-content'>
                        <Text className='finding-label'>为什么有风险</Text>
                        <Text className='body-text'>{finding.explain || finding.description}</Text>
                      </View>
                      {finding.evidence ? (
                        <View className='finding-content'>
                          <Text className='finding-label'>合同原文</Text>
                          <Text className='body-text evidence-text'>{finding.evidence}</Text>
                          {finding.evidenceLocation ? <Text className='caption evidence-location'>{`${finding.evidenceLocation.clause ? `${finding.evidenceLocation.clause} · ` : ''}第${finding.evidenceLocation.line}行 · 置信度 ${Math.round((finding.confidence || 0) * 100)}%`}</Text> : null}
                        </View>
                      ) : null}
                      {finding.suggestion ? (
                        <View className='finding-content'>
                          <Text className='finding-label'>修改建议</Text>
                          <Text className='body-text suggestion-text'>{finding.suggestion}</Text>
                        </View>
                      ) : null}
                      {finding.roleTip ? (
                        <View className='finding-content'>
                          <Text className='finding-label'>我方关注点</Text>
                          <Text className='body-text'>{finding.roleTip}</Text>
                        </View>
                      ) : null}
                      {finding.replacement ? (
                        <View className='finding-content'>
                          <Text className='finding-label'>建议条款</Text>
                          <Text className='body-text replacement-text'>{finding.replacement}</Text>
                        </View>
                      ) : null}
                      {finding.negotiation ? (
                        <View className='finding-content'>
                          <Text className='finding-label'>沟通话术</Text>
                          <Text className='body-text'>{finding.negotiation}</Text>
                        </View>
                      ) : null}
                      <View className='finding-actions'>
                        {finding.replacement ? <Button className='btn-primary' disabled={adopted} onClick={() => this.handleAdopt(finding)}>{adopted ? '已采纳' : '采纳并改写'}</Button> : null}
                        {finding.negotiation ? <Button className='btn-secondary' onClick={() => this.copyText(finding.negotiation, '话术已复制')}>复制话术</Button> : null}
                        <Button className='btn-ghost feedback-button' onClick={() => this.handleFindingFeedback(finding, 'accurate')}>识别准确</Button>
                        <Button className='btn-ghost feedback-button' onClick={() => this.handleFindingFeedback(finding, 'review')}>需要复核</Button>
                      </View>
                    </View>
                  ) : null}
                    </View>
                  )
                })}
              </View>
            ))}
          </View>
        ) : null}

        {adoptedItems.length ? (
          <View className='card revised-card'>
            <Text className='eyebrow'>修订成果</Text>
            <Text className='section-title'>修订版合同草案</Text>
            <Text className='body-text revised-note'>已采纳 {adoptedItems.length} 条修改建议，建议发给房东或中介确认。</Text>
            <View className='adopted-list'>
              {adoptedItems.map((item) => <Text key={item.id} className='adopted-item'>✓ {item.title}</Text>)}
            </View>
            <Textarea className='contract-input revised-draft' aria-label='修订版合同草案' value={revisedDraft} maxlength={-1} disabled />
            <View className='revised-actions'>
              <Button className='btn-secondary' disabled={isExportingRevised} onClick={this.handleExportRevised}>{isExportingRevised ? '正在生成…' : '导出修订合同'}</Button>
              <Button className='btn-primary' onClick={this.handleWriteBack}>写回编辑区</Button>
            </View>
          </View>
        ) : null}

        {activeSummary && !pendingFindings.length ? (
          <View className='card empty-result'>
            <Text className='empty-title'>{adoptedItems.length ? '待处理风险已全部采纳' : '未发现明显风险条款'}</Text>
            <Text className='body-text'>{adoptedItems.length ? '已采纳项已移入修订成果区；写回编辑区后可再次审查确认。' : '仍建议人工复核押金、维修、解除和费用条款。'}</Text>
          </View>
        ) : null}

        {history.length ? (
          <View className='card history-card'>
            <Button className='card-header history-head' aria-expanded={showHistory} onClick={() => this.setState({ showHistory: !showHistory })}>
              <View>
                <Text className='eyebrow'>审查记录</Text>
                <Text className='section-title'>最近 {history.length} 次审查</Text>
              </View>
              <Text className='btn-ghost history-toggle'>{showHistory ? '收起 ⌃' : '展开 ⌄'}</Text>
            </Button>
            {showHistory ? (
              <View>
                {history.map((entry, index) => (
                  <View className='history-item' key={entry.id || `${entry.time}-${index}`}>
                    <View className='history-info'>
                      <Text className='caption history-time'>{entry.time}</Text>
                      <Text className='body-text history-meta'>{entry.count} 个风险点 · {entry.score} 分</Text>
                      {!entry.snapshot ? <Text className='status-badge status-badge-warning history-legacy'>无快照</Text> : null}
                    </View>
                    <View className='history-actions'>
                      <Button className='btn-primary' disabled={!entry.snapshot} onClick={() => this.restoreHistory(entry)}>恢复</Button>
                      <Button className='btn-danger' onClick={() => this.deleteHistoryItem(entry.id)}>删除</Button>
                    </View>
                  </View>
                ))}
                <Button className='btn-danger btn-clear-history' onClick={this.clearHistory}>清空记录</Button>
              </View>
            ) : null}
          </View>
        ) : null}

        <Text className='legal-note'>免责声明：风险提示仅供租房风险自查参考，不构成法律意见或维权结果承诺。</Text>
      </ScrollView>
    )
  }
}
