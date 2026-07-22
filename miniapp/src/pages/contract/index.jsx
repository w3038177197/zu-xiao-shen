import { Component } from 'react'
import { Button, ScrollView, Text, Textarea, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { sampleContract } from '../../../../src/data/demoContracts.js'
import { analyzeContract, cleanContractTextForReview, getRiskSummary } from '../../features/contractReview'
import './index.css'

const STORAGE_KEY = 'zu-xiao-shen-contract-draft'

export default class ContractReview extends Component {
  state = {
    contractText: '',
    findings: [],
    summary: null,
    isAnalyzing: false,
    expandedIndex: 0,
    localOnly: true,
  }

  componentDidMount() {
    const contractText = Taro.getStorageSync(STORAGE_KEY) || ''
    this.setState({ contractText })
  }

  updateContract = (contractText) => {
    this.setState({ contractText, findings: [], summary: null })
    Taro.setStorageSync(STORAGE_KEY, contractText)
  }

  handleAnalyze = () => {
    const contractText = this.state.contractText.trim()
    if (!contractText) {
      Taro.showToast({ title: '请先粘贴或导入合同', icon: 'none' })
      return
    }

    this.setState({ isAnalyzing: true })
    try {
      const findings = analyzeContract(cleanContractTextForReview(contractText))
      this.setState({ findings, summary: getRiskSummary(findings), isAnalyzing: false, expandedIndex: 0 })
      Taro.showToast({ title: `发现 ${findings.length} 个风险点`, icon: 'success' })
    } catch (error) {
      console.error('审查失败:', error)
      this.setState({ isAnalyzing: false })
      Taro.showToast({ title: '审查失败，请重试', icon: 'none' })
    }
  }

  loadDemo = () => {
    this.updateContract(sampleContract)
    Taro.showToast({ title: '已载入演示合同', icon: 'success' })
  }

  chooseFile = () => {
    Taro.chooseMessageFile({ count: 1, type: 'file', extension: ['txt'] })
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

  handleReset = () => {
    this.updateContract('')
    this.setState({ expandedIndex: 0 })
  }

  render() {
    const { contractText, findings, summary, isAnalyzing, expandedIndex, localOnly } = this.state
    const lowCount = Math.max(0, findings.length - (summary?.highCount || 0) - (summary?.mediumCount || 0))

    return (
      <ScrollView scrollY className='contract-page'>
        <View className='review-hero'>
          <Text className='eyebrow'>CONTRACT REVIEW</Text>
          <Text className='page-title'>先看懂合同，再决定怎么签</Text>
          <Text className='page-copy'>标出押金、涨租、维修、入户和违约责任，把风险翻译成可直接沟通的修改建议。</Text>
          <View className='privacy-row' onClick={() => this.setState({ localOnly: !localOnly })}><View className={localOnly ? 'toggle active' : 'toggle'}><View /></View><Text>{localOnly ? '仅本地分析，合同不会上传' : '远端 AI 可用（当前仍以本地规则审查）'}</Text></View>
        </View>

        <View className='section input-section'>
          <View className='section-head'><View><Text className='eyebrow'>CONTRACT INPUT</Text><Text className='section-title'>合同正文</Text></View><Text className='char-count'>{contractText.length.toLocaleString()} 字</Text></View>
          <Textarea className='contract-input' placeholder='请粘贴租房合同内容，或从微信聊天中导入 TXT 文件…' value={contractText} onInput={(event) => this.updateContract(event.detail.value)} maxlength={-1} />
          <View className='secondary-actions'><Button onClick={this.chooseFile}>从微信导入 TXT</Button><Button onClick={this.loadDemo}>载入高风险演示合同</Button></View>
        </View>

        <View className='action-buttons'>
          <Button className='btn-analyze' onClick={this.handleAnalyze} disabled={isAnalyzing || !contractText.trim()}>{isAnalyzing ? '审查中…' : '开始本地审查'}</Button>
          {(findings.length > 0 || contractText) && <Button className='btn-reset' onClick={this.handleReset}>重置</Button>}
        </View>

        {summary && (
          <View className='result-section'>
            <Text className='eyebrow'>RISK OVERVIEW</Text><Text className='section-title'>审查结果</Text>
            <View className={`summary-card ${summary.tone}`}><View><Text className='risk-score'>{summary.score}</Text><Text className='risk-label'>风险评分</Text></View><View className='summary-copy'><Text className='risk-level'>{summary.label}</Text><Text className='risk-description'>{summary.advice}</Text></View></View>
            <View className='stats-row'><View className='stat-item'><Text>{findings.length}</Text><Text>风险点</Text></View><View className='stat-item high'><Text>{summary.highCount}</Text><Text>高风险</Text></View><View className='stat-item medium'><Text>{summary.mediumCount}</Text><Text>中风险</Text></View><View className='stat-item'><Text>{lowCount}</Text><Text>低风险</Text></View></View>
          </View>
        )}

        {findings.length > 0 && (
          <View className='findings-section'>
            <Text className='eyebrow'>RISK DETAILS</Text><Text className='section-title'>逐条修改建议</Text>
            {findings.map((finding, index) => {
              const expanded = expandedIndex === index
              return (
                <View key={finding.id || index} className={`finding-card finding-${finding.level}`}>
                  <View className='finding-header' onClick={() => this.setState({ expandedIndex: expanded ? -1 : index })}><View><Text className='finding-number'>{String(index + 1).padStart(2, '0')}</Text><Text className='finding-title'>{finding.title}</Text></View><Text className={`finding-badge badge-${finding.level}`}>{finding.level === 'high' ? '高风险' : finding.level === 'medium' ? '中风险' : '低风险'}</Text></View>
                  {expanded && <View className='finding-details'>
                    <View className='finding-content'><Text className='finding-label'>为什么有风险</Text><Text className='finding-text'>{finding.explain || finding.description}</Text></View>
                    {finding.evidence && <View className='finding-content'><Text className='finding-label'>合同原文</Text><Text className='finding-text evidence'>{finding.evidence}</Text></View>}
                    {finding.suggestion && <View className='finding-content'><Text className='finding-label'>修改建议</Text><Text className='finding-text suggestion'>{finding.suggestion}</Text></View>}
                    {finding.replacement && <View className='finding-content'><Text className='finding-label'>建议条款</Text><Text className='finding-text replacement'>{finding.replacement}</Text></View>}
                    {finding.negotiation && <View className='finding-content'><Text className='finding-label'>沟通话术</Text><Text className='finding-text'>{finding.negotiation}</Text></View>}
                  </View>}
                </View>
              )
            })}
          </View>
        )}

        {summary && findings.length === 0 && <View className='empty-result'><Text>未发现明显风险条款</Text><Text>仍建议人工复核押金、维修、解除和费用条款。</Text></View>}
        <Text className='legal-note'>免责声明：风险提示仅供租房风险自查参考，不构成法律意见或维权结果承诺。</Text>
      </ScrollView>
    )
  }
}
