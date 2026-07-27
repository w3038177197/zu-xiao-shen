import { Component } from 'react'
import { Button, Picker, ScrollView, Text, Textarea, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { demoContracts } from '../../../../src/data/demoContracts.js'
import { contractTypeOptions, partyRoleOptions, reviewDepthOptions } from '../../../../src/constants/reviewOptions.js'
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
    expandedIndex: 0,
    showHistory: false,
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

  onShareAppMessage() {
    return { title: '租小审：签合同前，先把押金和涨租条款过一遍', path: '/pages/contract/index' }
  }

  updateContract = (contractText, extra = {}) => {
    this.setState({ contractText, findings: [], summary: null, dimensions: [], adoptedItems: [], revisedDraft: '', activeProfile: null, ...extra })
    Taro.setStorageSync(STORAGE_KEY, contractText)
  }

  updateProfile = (key, value) => {
    this.setState((previous) => {
      const profile = { ...previous.profile, [key]: value }
      Taro.setStorageSync(PROFILE_KEY, profile)
      return { profile }
    })
  }

  pushHistory = (summary, findingsCount) => {
    const entry = { time: new Date().toLocaleString('zh-CN', { hour12: false }), score: summary.score, label: summary.label, count: findingsCount }
    this.setState((previous) => {
      const history = [entry, ...previous.history].slice(0, 8)
      Taro.setStorageSync(HISTORY_KEY, history)
      return { history }
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
      this.setState({
        findings,
        summary,
        dimensions: getDimensionScores(findings).filter((item) => item.score > 0),
        adoptedItems: [],
        revisedDraft: '',
        activeProfile,
        isAnalyzing: false,
        expandedIndex: 0,
      })
      this.pushHistory(summary, findings.length)
      Taro.showToast({ title: `发现 ${findings.length} 个风险点`, icon: findings.length ? 'none' : 'success' })
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

  chooseFile = () => {
    Taro.chooseMessageFile({ count: 1, type: 'file', extension: ['txt', 'md'] })
      .then(({ tempFiles }) => {
        const file = tempFiles?.[0]
        if (!file) return
        Taro.getFileSystemManager().readFile({
          filePath: file.path,
          encoding: 'utf8',
          success: ({ data }) => {
            this.updateContract(String(data || ''))
            Taro.showToast({ title: '合同已导入', icon: 'success' })
          },
          fail: () => Taro.showToast({ title: '读取失败，请直接粘贴正文', icon: 'none' }),
        })
      })
      .catch(() => {})
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
    if (!data) return
    Taro.setClipboardData({ data, success: () => Taro.showToast({ title, icon: 'success' }) })
  }

  copyReport = () => {
    const { summary, findings, adoptedItems, contractText, activeProfile, profile } = this.state
    if (!summary) return
    this.copyText(createReportText({ summary, findings, revisionItems: adoptedItems, contractText, reviewProfile: activeProfile || profile }), '报告已复制')
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

  renderProfilePicker = (label, options, key) => {
    const index = Math.max(0, options.findIndex((item) => item.value === this.state.profile[key]))
    return (
      <View className='profile-field' key={key}>
        <Text>{label}</Text>
        <Picker range={options.map((item) => item.label)} value={index} onChange={(event) => this.updateProfile(key, options[Number(event.detail.value)].value)}>
          <View className='picker-value'>{options[index]?.label}<Text>⌄</Text></View>
        </Picker>
      </View>
    )
  }

  render() {
    const { contractText, findings, summary, dimensions, adoptedItems, revisedDraft, profile, history, isAnalyzing, expandedIndex, showHistory } = this.state
    const lowCount = Math.max(0, findings.length - (summary?.highCount || 0) - (summary?.mediumCount || 0))

    return (
      <ScrollView scrollY className='contract-page'>
        <View className='review-hero'>
          <Text className='eyebrow'>合同审查</Text>
          <Text className='page-title'>先看懂合同，再决定怎么签</Text>
          <Text className='page-copy'>标出押金、涨租、维修、入户和违约责任，把风险翻译成可直接沟通的修改建议。</Text>
          <View className='privacy-row'><View className='toggle active'><View /></View><Text>仅本地分析，合同不会上传</Text></View>
        </View>

        <View className='section input-section'>
          <View className='section-head'><View><Text className='eyebrow'>审查材料</Text><Text className='section-title'>合同正文</Text></View><Text className='char-count'>{contractText.length.toLocaleString()} 字</Text></View>
          <Textarea className='contract-input' placeholder='请粘贴租房合同内容，或从微信聊天中导入 TXT/MD 文件…' value={contractText} onInput={(event) => this.updateContract(event.detail.value)} maxlength={-1} />
          <View className='secondary-actions'>
            <Button onClick={this.chooseFile}>从微信导入</Button>
            <Picker range={demoContracts.map((item) => item.title)} onChange={(event) => this.loadDemo(Number(event.detail.value))}>
              <Button className='demo-picker-button'>载入演示合同</Button>
            </Picker>
          </View>
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
            <Button className='btn-report' onClick={this.copyReport}>复制审查报告</Button>
          </View>
        ) : null}

        {findings.length ? (
          <View className='findings-section'>
            <View className='section-head'><View><Text className='eyebrow'>逐条建议</Text><Text className='section-title'>修改与沟通方案</Text></View><Button className='btn-adopt-all' onClick={this.handleAdoptAll}>全部采纳</Button></View>
            {findings.map((finding, index) => {
              const expanded = expandedIndex === index
              return <View key={finding.id || index} className={`finding-card finding-${finding.level}`}>
                <View className='finding-header' onClick={() => this.setState({ expandedIndex: expanded ? -1 : index })}><View><Text className='finding-number'>{String(index + 1).padStart(2, '0')}</Text><Text className='finding-title'>{finding.title}</Text></View><Text className={`finding-badge badge-${finding.level}`}>{levelText(finding.level)}</Text></View>
                {expanded ? <View className='finding-details'>
                  <View className='finding-content'><Text className='finding-label'>为什么有风险</Text><Text className='finding-text'>{finding.explain || finding.description}</Text></View>
                  {finding.evidence ? <View className='finding-content'><Text className='finding-label'>合同原文</Text><Text className='finding-text evidence'>{finding.evidence}</Text></View> : null}
                  {finding.suggestion ? <View className='finding-content'><Text className='finding-label'>修改建议</Text><Text className='finding-text suggestion'>{finding.suggestion}</Text></View> : null}
                  {finding.replacement ? <View className='finding-content'><Text className='finding-label'>建议条款</Text><Text className='finding-text replacement'>{finding.replacement}</Text></View> : null}
                  {finding.negotiation ? <View className='finding-content'><Text className='finding-label'>沟通话术</Text><Text className='finding-text'>{finding.negotiation}</Text></View> : null}
                  <View className='finding-actions'>
                    {finding.replacement ? <Button className='btn-adopt' onClick={() => this.handleAdopt(finding)}>采纳并改写</Button> : null}
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
          <Textarea className='revised-draft' value={revisedDraft} maxlength={-1} disabled />
          <View className='revised-actions'><Button className='btn-adopt' onClick={() => this.copyText(revisedDraft, '修订稿已复制')}>复制修订稿</Button><Button className='btn-write-back' onClick={this.handleWriteBack}>写回复查</Button></View>
        </View> : null}

        {summary && !findings.length ? <View className='empty-result'><Text>未发现明显风险条款</Text><Text>仍建议人工复核押金、维修、解除和费用条款。</Text></View> : null}

        {history.length ? <View className='history-section'>
          <View className='section-head' onClick={() => this.setState({ showHistory: !showHistory })}><View><Text className='eyebrow'>审查记录</Text><Text className='section-title'>最近 {history.length} 次审查</Text></View><Text className='history-toggle'>{showHistory ? '收起 ⌃' : '展开 ⌄'}</Text></View>
          {showHistory ? <View>{history.map((entry, index) => <View className='history-item' key={`${entry.time}-${index}`}><Text className='history-time'>{entry.time}</Text><Text>{entry.count} 个风险点</Text><Text className='history-score'>{entry.score} 分</Text></View>)}<Button className='btn-clear-history' onClick={this.clearHistory}>清空记录</Button></View> : null}
        </View> : null}

        <Text className='legal-note'>免责声明：风险提示仅供租房风险自查参考，不构成法律意见或维权结果承诺。</Text>
      </ScrollView>
    )
  }
}
