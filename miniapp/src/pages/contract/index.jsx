import { Component } from 'react'
import { Button, Picker, ScrollView, Text, Textarea, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { demoContracts } from '../../shared/demoContracts.js'
import { contractTypeOptions, partyRoleOptions, reviewDepthOptions } from '../../shared/reviewOptions.js'
import {
  analyzeContract,
  cleanContractTextForReview,
  createReportText,
  createRevisedContractDraft,
  getDimensionScores,
  getRiskSummary,
  mergeRevisionItems,
  resolveReviewProfile,
} from '../../features/contractReview'
import { createReviewHistoryEntry, saveReviewHistory } from '../../features/reviewHistory'
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
import { exportTextToFile } from '../../utils/textFileExport'
import { openAiTask } from '../../utils/aiTaskHandoff'
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
    isImporting: false,
    importProgress: null,
    expandedIndex: 0,
    showHistory: false,
    operationNotice: '',
    lastImportSource: '',
  }

  componentDidMount() {
    const savedProfile = loadStored(PROFILE_KEY, DEFAULT_PROFILE)
    const savedHistory = loadStored(HISTORY_KEY, [])
    this.setState({
      contractText: loadStored(STORAGE_KEY, ''),
      history: Array.isArray(savedHistory) ? savedHistory.slice(0, 8) : [],
      profile: { ...DEFAULT_PROFILE, ...(typeof savedProfile === 'object' ? savedProfile : {}) },
    })
  }

  componentDidHide() {
    this.draftSaver.flush()
  }

  componentWillUnmount() {
    this.activeImportTask?.cancel?.()
    this.draftSaver.flush()
  }

  onShareAppMessage() {
    return { title: '租小审：签合同前，先把押金和涨租条款过一遍', path: '/pages/contract/index' }
  }

  updateContract = (contractText, extra = {}) => {
    this.setState({ contractText, findings: [], summary: null, dimensions: [], adoptedItems: [], revisedDraft: '', activeProfile: null, ...extra })
    this.draftSaver.schedule(contractText)
  }

  updateProfile = (key, value) => {
    this.setState((previous) => {
      const profile = { ...previous.profile, [key]: value }
      Taro.setStorageSync(PROFILE_KEY, profile)
      return { profile }
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
      expandedIndex: 0,
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

  handleAnalyze = () => {
    const contractText = this.state.contractText.trim()
    if (!contractText) {
      Taro.showToast({ title: '请先粘贴或导入合同', icon: 'none' })
      return
    }

    this.setState({ isAnalyzing: true })
    try {
      const cleanText = cleanContractTextForReview(contractText)
      const activeProfile = resolveReviewProfile(this.state.profile, cleanText)
      const findings = analyzeContract(cleanText, activeProfile)
      const summary = getRiskSummary(findings)
      const dimensions = getDimensionScores(findings).filter((item) => item.score > 0)
      const adoptedItems = []
      const revisedDraft = ''
      this.setState({
        findings,
        summary,
        dimensions,
        adoptedItems,
        revisedDraft,
        activeProfile,
        isAnalyzing: false,
        expandedIndex: 0,
      })
      // 直接传本次计算出的完整结果，不依赖 this.state（setState 异步，this.state 此时仍是旧值）
      const historyStatus = this.pushHistory({
        contractText,
        findings,
        summary,
        dimensions,
        adoptedItems,
        revisedDraft,
        activeProfile,
        profile: { ...this.state.profile },
      })
      const title = historyStatus === 'failed'
        ? '审查完成，但历史未保存'
        : historyStatus === 'summary'
          ? '审查完成，仅保存历史摘要'
          : `发现 ${findings.length} 个风险点`
      Taro.showToast({ title, icon: findings.length || historyStatus !== 'saved' ? 'none' : 'success' })
    } catch (error) {
      console.error('审查失败:', error)
      this.setState({ isAnalyzing: false })
      Taro.showToast({ title: '审查失败，请重试', icon: 'none' })
    }
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
      this.updateContract(text, { findings: [], summary: null, dimensions: [], adoptedItems: [], revisedDraft: '', operationNotice: '' })
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

  confirmRemoteParse = async (fileName, source) => {
    const isImage = source === 'camera' || source === 'album'
    try {
      const result = await Taro.showModal({
        title: isImage ? '上传识别合同？' : '上传解析合同？',
        content: `“${String(fileName || '合同文件').slice(0, 36)}”将上传至租小审服务端，仅用于${isImage ? '文字识别' : '提取正文'}，原始文件仅在内存中处理，不写入磁盘、不持久化保存，请求处理结束后释放相关内存。解析完成后仍在本机审查。`,
        confirmText: '上传解析',
        cancelText: '暂不上传',
      })
      return Boolean(result.confirm)
    } catch {
      return false
    }
  }

  runRemoteImport = async (file, source) => {
    if (!await this.confirmRemoteParse(file.name, source)) return
    this.setState({ importProgress: { fileName: file.name, progress: 0 } })
    const options = {
      onProgress: (progress) => this.setState({ importProgress: { fileName: file.name, progress } }),
    }
    const task = source === 'camera' || source === 'album'
      ? startRemoteImageImport(file, options)
      : startRemoteDocumentImport(file, options)
    this.activeImportTask = task
    const result = await task.promise
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
        await this.runRemoteImport(file, 'wechat')
      }
    } catch (error) {
      this.showImportFailure(error, 'wechat')
    } finally {
      this.activeImportTask = null
      this.setState({ isImporting: false, importProgress: null })
    }
  }

  importContractImage = async (source) => {
    if (this.state.isImporting) return
    this.setState({ isImporting: true })
    try {
      const file = await chooseContractImage(source)
      await this.runRemoteImport(file, source)
    } catch (error) {
      this.showImportFailure(error, source)
    } finally {
      this.activeImportTask = null
      this.setState({ isImporting: false, importProgress: null })
    }
  }

  cancelImport = () => {
    this.activeImportTask?.cancel?.()
  }

  retryLastImport = () => {
    const source = this.state.lastImportSource
    this.setState({ operationNotice: '', lastImportSource: '' })
    if (!source || this.state.isImporting) return
    if (source === 'camera' || source === 'album') this.importContractImage(source)
    else if (source === 'wechat') this.chooseWechatFile()
    else if (source === 'phone') this.importFromPhone()
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

  copyText = (data, title = '已复制') => {
    copyToClipboard(data, title)
  }

  copyReport = () => {
    const { summary, findings, adoptedItems, contractText, activeProfile, profile } = this.state
    if (!summary) return
    this.copyText(createReportText({ summary, findings, revisionItems: adoptedItems, contractText, reviewProfile: activeProfile || profile }), '报告已复制')
  }

  exportReportTxt = () => {
    const { summary, findings, adoptedItems, contractText, activeProfile, profile } = this.state
    if (!summary) return
    exportTextToFile('合同审查报告.txt', createReportText({ summary, findings, revisionItems: adoptedItems, contractText, reviewProfile: activeProfile || profile }))
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
        if (confirm) this.updateContract('', { expandedIndex: 0 })
      },
    })
  }

  handleAiReview = () => {
    this.draftSaver.flush()
    openAiTask('review')
  }

  renderProfilePicker = (label, options, key) => {
    const index = Math.max(0, options.findIndex((item) => item.value === this.state.profile[key]))
    return (
      <View className='profile-field' key={key}>
        <Text>{label}</Text>
        <Picker aria-label={label} range={options.map((item) => item.label)} value={index} onChange={(event) => this.updateProfile(key, options[Number(event.detail.value)].value)}>
          <View className='picker-value'>{options[index]?.label}<Text>⌄</Text></View>
        </Picker>
      </View>
    )
  }

  render() {
    const { contractText, findings, summary, dimensions, adoptedItems, revisedDraft, profile, history, isAnalyzing, isImporting, importProgress, expandedIndex, showHistory, operationNotice, lastImportSource } = this.state
    const lowCount = Math.max(0, findings.length - (summary?.highCount || 0) - (summary?.mediumCount || 0))

    return (
      <ScrollView scrollY enableFlex className='contract-page'>
        <View className='review-hero'>
          <Text className='eyebrow'>合同审查</Text>
          <Text className='page-title'>先看懂合同，再决定怎么签</Text>
          <Text className='page-copy'>标出押金、涨租、维修、入户和违约责任，把风险翻译成可直接沟通的修改建议。</Text>
          <View className='privacy-row'><View className='privacy-indicator'>✓</View><Text>审查在本机完成；PDF、DOCX 与图片仅在你确认后上传提取文字</Text></View>
        </View>

        <View className='section input-section'>
          <View className='section-head'><View><Text className='eyebrow'>审查材料</Text><Text className='section-title'>合同正文</Text></View><Text className='char-count'>{contractText.length.toLocaleString()} 字</Text></View>
          <Textarea className='contract-input' aria-label='合同正文' name='contractText' adjustPosition cursorSpacing={20} placeholder='粘贴正文，或导入 TXT、MD、DOCX、PDF 与合同照片…' value={contractText} onInput={(event) => this.updateContract(event.detail.value)} maxlength={-1} />
          {operationNotice ? <View className='operation-notice' aria-live='polite'><Text>{operationNotice}</Text><View className='operation-notice-actions'>{lastImportSource ? <Button aria-label='重试上次导入' disabled={isImporting} onClick={this.retryLastImport}>重试</Button> : null}<Button aria-label='关闭错误提示' onClick={() => this.setState({ operationNotice: '' })}>关闭</Button></View></View> : null}
          <View className='secondary-actions'>
            <Button disabled={isImporting} onClick={this.importFromPhone}>手机粘贴</Button>
            <Button disabled={isImporting} onClick={this.chooseWechatFile}>微信文件</Button>
            <Button disabled={isImporting} onClick={() => this.importContractImage('camera')}>拍照识别</Button>
            <Button disabled={isImporting} onClick={() => this.importContractImage('album')}>相册识别</Button>
            <Picker className='demo-picker' aria-label='选择演示合同' range={demoContracts.map((item) => item.title)} onChange={(event) => this.loadDemo(Number(event.detail.value))}>
              <Button className='demo-picker-button'>载入演示合同</Button>
            </Picker>
          </View>
          {importProgress ? <View className='import-progress'>
            <View className='import-progress-head'><Text>{importProgress.fileName}</Text><Text>{importProgress.progress || '连接中'}{importProgress.progress ? '%' : ''}</Text></View>
            <View className='import-progress-track'><View className='import-progress-fill' style={{ width: `${importProgress.progress || 8}%` }} /></View>
            <Button className='import-cancel' onClick={this.cancelImport}>取消解析</Button>
          </View> : null}
          <Text className='import-help'>TXT/MD 在本机读取；微信里的 DOCX/PDF 可确认后上传解析。手机文件可在 WPS/文件 App 复制正文，或把文件发送到微信后选择。合同照片可直接拍摄或从相册选择。</Text>
          <View className='profile-grid'>
            {this.renderProfilePicker('合同类型', contractTypeOptions, 'contractType')}
            {this.renderProfilePicker('审查角色', partyRoleOptions, 'partyRole')}
            {this.renderProfilePicker('审查深度', reviewDepthOptions, 'reviewDepth')}
          </View>
        </View>

        <View className='action-buttons'>
          <Button className='btn-analyze' onClick={this.handleAnalyze} disabled={isAnalyzing || !contractText.trim()}>{isAnalyzing ? '审查中…' : '开始本地审查'}</Button>
          {(findings.length > 0 || contractText) ? <Button className='btn-reset' onClick={this.handleReset}>重置</Button> : null}
        </View>

        {summary ? (
          <View className='result-section'>
            <Text className='eyebrow'>风险总览</Text><Text className='section-title'>审查结果</Text>
            <View className={`summary-card ${summary.tone}`}><View><Text className='risk-score'>{summary.score}</Text><Text className='risk-label'>风险评分</Text></View><View className='summary-copy'><Text className='risk-level'>{summary.label}</Text><Text className='risk-description'>{summary.advice}</Text></View></View>
            <View className='stats-row'><View className='stat-item'><Text>{findings.length}</Text><Text>风险点</Text></View><View className='stat-item high'><Text>{summary.highCount}</Text><Text>高风险</Text></View><View className='stat-item medium'><Text>{summary.mediumCount}</Text><Text>中风险</Text></View><View className='stat-item'><Text>{lowCount}</Text><Text>低风险</Text></View></View>
            {dimensions.length ? <View className='dimension-list'>{dimensions.map((item) => <View className='dimension-item' key={item.key}><View className='dimension-head'><Text>{item.label}</Text><Text className={`dimension-score ${item.tone}`}>{item.score}</Text></View><View className='dimension-bar'><View className={`dimension-fill ${item.tone}`} style={{ width: `${Math.min(100, item.score)}%` }} /></View></View>)}</View> : null}
            <View className='report-export-row'>
              <Button className='btn-report' onClick={this.exportReportTxt}>导出审查报告 TXT</Button>
              <Button className='btn-report' onClick={this.copyReport}>复制审查报告</Button>
            </View>
            <Button className='ai-task-btn' onClick={this.handleAiReview}>让 AI 解读审查结果</Button>
          </View>
        ) : null}

        {findings.length ? (
          <View className='findings-section'>
            <View className='section-head'><View><Text className='eyebrow'>逐条建议</Text><Text className='section-title'>修改与沟通方案</Text></View><Button className='btn-adopt-all' onClick={this.handleAdoptAll}>全部采纳</Button></View>
            {findings.map((finding, index) => {
              const expanded = expandedIndex === index
              const adopted = adoptedItems.some((item) => item.id === finding.id)
              return <View key={finding.id || index} className={`finding-card finding-${finding.level}`}>
                <Button className='finding-header' aria-expanded={expanded} onClick={() => this.setState({ expandedIndex: expanded ? -1 : index })}><View><Text className='finding-number'>{String(index + 1).padStart(2, '0')}</Text><Text className='finding-title'>{finding.title}</Text></View><View className='finding-meta'><Text className={`finding-badge badge-${finding.level}`}>{levelText(finding.level)}</Text><Text className='finding-chevron'>{expanded ? '⌃' : '⌄'}</Text></View></Button>
                {expanded ? <View className='finding-details'>
                  <View className='finding-content'><Text className='finding-label'>为什么有风险</Text><Text className='finding-text'>{finding.explain || finding.description}</Text></View>
                  {finding.evidence ? <View className='finding-content'><Text className='finding-label'>合同原文</Text><Text className='finding-text evidence'>{finding.evidence}</Text></View> : null}
                  {finding.suggestion ? <View className='finding-content'><Text className='finding-label'>修改建议</Text><Text className='finding-text suggestion'>{finding.suggestion}</Text></View> : null}
                  {finding.replacement ? <View className='finding-content'><Text className='finding-label'>建议条款</Text><Text className='finding-text replacement'>{finding.replacement}</Text></View> : null}
                  {finding.negotiation ? <View className='finding-content'><Text className='finding-label'>沟通话术</Text><Text className='finding-text'>{finding.negotiation}</Text></View> : null}
                  <View className='finding-actions'>
                    {finding.replacement ? <Button className='btn-adopt' disabled={adopted} onClick={() => this.handleAdopt(finding)}>{adopted ? '已采纳' : '采纳并改写'}</Button> : null}
                    {finding.negotiation ? <Button className='btn-copy-talk' onClick={() => this.copyText(finding.negotiation, '话术已复制')}>复制话术</Button> : null}
                  </View>
                </View> : null}
              </View>
            })}
          </View>
        ) : null}

        {adoptedItems.length ? <View className='revised-section'>
          <Text className='eyebrow'>修订成果</Text><Text className='section-title'>修订版合同草案</Text>
          <Text className='revised-note'>已采纳 {adoptedItems.length} 条修改建议，建议发给房东或中介确认。</Text>
          <View className='adopted-list'>{adoptedItems.map((item) => <Text key={item.id}>✓ {item.title}</Text>)}</View>
          <Textarea className='revised-draft' aria-label='修订版合同草案' value={revisedDraft} maxlength={-1} disabled />
          <View className='revised-actions'><Button className='btn-adopt' onClick={() => this.copyText(revisedDraft, '修订稿已复制')}>复制修订稿</Button><Button className='btn-write-back' onClick={this.handleWriteBack}>写回编辑区</Button></View>
        </View> : null}

        {summary && !findings.length ? <View className='empty-result'><Text>未发现明显风险条款</Text><Text>仍建议人工复核押金、维修、解除和费用条款。</Text></View> : null}

        {history.length ? <View className='history-section'>
          <Button className='section-head history-head' aria-expanded={showHistory} onClick={() => this.setState({ showHistory: !showHistory })}><View><Text className='eyebrow'>审查记录</Text><Text className='section-title'>最近 {history.length} 次审查</Text></View><Text className='history-toggle'>{showHistory ? '收起 ⌃' : '展开 ⌄'}</Text></Button>
          {showHistory ? <View>{history.map((entry, index) => (
            <View className='history-item' key={entry.id || `${entry.time}-${index}`}>
              <View className='history-info'>
                <Text className='history-time'>{entry.time}</Text>
                <Text className='history-meta'>{entry.count} 个风险点 · {entry.score} 分</Text>
                {!entry.snapshot ? <Text className='history-legacy'>无快照</Text> : null}
              </View>
              <View className='history-actions'>
                <Button className='btn-restore' disabled={!entry.snapshot} onClick={() => this.restoreHistory(entry)}>恢复</Button>
                <Button className='btn-delete-history' onClick={() => this.deleteHistoryItem(entry.id)}>删除</Button>
              </View>
            </View>
          ))}<Button className='btn-clear-history' onClick={this.clearHistory}>清空记录</Button></View> : null}
        </View> : null}

        <Text className='legal-note'>免责声明：风险提示仅供租房风险自查参考，不构成法律意见或维权结果承诺。</Text>
      </ScrollView>
    )
  }
}
