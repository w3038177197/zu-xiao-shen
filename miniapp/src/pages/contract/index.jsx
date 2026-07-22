import { Component } from 'react'
import { View, Text, Textarea, Button, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { analyzeContract, getRiskSummary } from '../../features/contractReview'
import { cleanContractTextForReview } from '../../features/contractReview'
import './index.css'

export default class ContractReview extends Component {
  state = {
    contractText: '',
    findings: [],
    summary: null,
    isAnalyzing: false
  }

  componentDidMount() {}

  handleInputChange = (e) => {
    this.setState({
      contractText: e.detail.value
    })
  }

  handleAnalyze = () => {
    const { contractText } = this.state
    
    if (!contractText.trim()) {
      Taro.showToast({
        title: '请输入合同内容',
        icon: 'none'
      })
      return
    }

    this.setState({ isAnalyzing: true })

    try {
      const cleanedText = cleanContractTextForReview(contractText)
      const findings = analyzeContract(cleanedText)
      const summary = getRiskSummary(findings)

      this.setState({
        findings,
        summary,
        isAnalyzing: false
      })

      Taro.showToast({
        title: '审查完成',
        icon: 'success'
      })
    } catch (error) {
      console.error('审查失败:', error)
      this.setState({ isAnalyzing: false })
      Taro.showToast({
        title: '审查失败，请重试',
        icon: 'none'
      })
    }
  }

  handleReset = () => {
    this.setState({
      contractText: '',
      findings: [],
      summary: null
    })
  }

  render() {
    const { contractText, findings, summary, isAnalyzing } = this.state

    return (
      <ScrollView scrollY className='contract-page'>
        <View className='section'>
          <Text className='section-title'>合同内容</Text>
          <Textarea
            className='contract-input'
            placeholder='请粘贴或输入租房合同内容...'
            value={contractText}
            onInput={this.handleInputChange}
            maxlength={-1}
            autoHeight
          />
        </View>

        <View className='action-buttons'>
          <Button
            className='btn-analyze'
            onClick={this.handleAnalyze}
            disabled={isAnalyzing || !contractText.trim()}
          >
            {isAnalyzing ? '审查中...' : '开始审查'}
          </Button>
          {(findings.length > 0 || contractText) && (
            <Button className='btn-reset' onClick={this.handleReset}>
              重置
            </Button>
          )}
        </View>

        {summary && (
          <View className='result-section'>
            <Text className='section-title'>审查结果</Text>
            
            <View className='summary-card'>
              <View className='summary-header'>
                <Text className='risk-score'>{summary.score}</Text>
                <Text className='risk-label'>风险评分</Text>
              </View>
              <Text className='risk-level'>{summary.level}</Text>
              <Text className='risk-description'>{summary.description}</Text>
            </View>

            <View className='stats-row'>
              <View className='stat-item'>
                <Text className='stat-value'>{findings.length}</Text>
                <Text className='stat-label'>风险点</Text>
              </View>
              <View className='stat-item'>
                <Text className='stat-value'>{summary.highCount}</Text>
                <Text className='stat-label'>高风险</Text>
              </View>
              <View className='stat-item'>
                <Text className='stat-value'>{summary.mediumCount}</Text>
                <Text className='stat-label'>中风险</Text>
              </View>
              <View className='stat-item'>
                <Text className='stat-value'>{summary.lowCount}</Text>
                <Text className='stat-label'>低风险</Text>
              </View>
            </View>
          </View>
        )}

        {findings.length > 0 && (
          <View className='findings-section'>
            <Text className='section-title'>风险详情</Text>
            {findings.map((finding, index) => (
              <View key={index} className={`finding-card finding-${finding.level}`}>
                <View className='finding-header'>
                  <Text className='finding-title'>{finding.title}</Text>
                  <Text className={`finding-badge badge-${finding.level}`}>
                    {finding.level === 'high' ? '高风险' : finding.level === 'medium' ? '中风险' : '低风险'}
                  </Text>
                </View>
                
                <View className='finding-content'>
                  <Text className='finding-label'>问题描述</Text>
                  <Text className='finding-text'>{finding.description}</Text>
                </View>

                {finding.evidence && (
                  <View className='finding-content'>
                    <Text className='finding-label'>合同原文</Text>
                    <Text className='finding-text evidence'>{finding.evidence}</Text>
                  </View>
                )}

                {finding.suggestion && (
                  <View className='finding-content'>
                    <Text className='finding-label'>修改建议</Text>
                    <Text className='finding-text suggestion'>{finding.suggestion}</Text>
                  </View>
                )}

                {finding.replacement && (
                  <View className='finding-content'>
                    <Text className='finding-label'>建议条款</Text>
                    <Text className='finding-text replacement'>{finding.replacement}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {summary && findings.length === 0 && (
          <View className='empty-result'>
            <Text className='empty-text'>未发现明显风险条款</Text>
            <Text className='empty-hint'>建议仍由人工复核关键条款</Text>
          </View>
        )}
      </ScrollView>
    )
  }
}
