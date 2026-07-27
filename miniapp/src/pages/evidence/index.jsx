import { Component } from 'react'
import { View, Text, Input, Textarea, Button, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import {
  evidenceGroupMeta,
  evidenceActions,
  evidenceToolTabs,
  createDefaultEvidencePackState,
  loadEvidencePackState,
  saveEvidencePackState,
  buildEvidenceCommunication,
  createEvidencePackageText,
} from '../../features/evidencePack'
import './index.css'

const GROUPS = Object.entries(evidenceGroupMeta)

export default class EvidencePack extends Component {
  state = {
    packState: createDefaultEvidencePackState(),
    currentTab: 'deposit',
    currentGroup: 0,
    isSaving: false,
  }

  componentDidMount() {
    const packState = loadEvidencePackState()
    this.setState({ packState })
  }

  onShareAppMessage() {
    return { title: '租小审：退租前把证据整理成包', path: '/pages/evidence/index' }
  }

  saveData = () => {
    this.setState({ isSaving: true })
    try {
      saveEvidencePackState(this.state.packState)
      Taro.showToast({ title: '保存成功', icon: 'success' })
    } catch (error) {
      console.error('保存失败:', error)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      this.setState({ isSaving: false })
    }
  }

  handleFormChange = (field, value) => {
    this.setState((prev) => ({
      packState: {
        ...prev.packState,
        formData: { ...prev.packState.formData, [field]: value },
      },
    }))
  }

  handleEvidenceToggle = (group, index) => {
    this.setState((prev) => {
      const evidence = { ...prev.packState.evidence }
      evidence[group] = [...evidence[group]]
      evidence[group][index] = !evidence[group][index]
      return { packState: { ...prev.packState, evidence } }
    })
  }

  handleActionToggle = (index) => {
    this.setState((prev) => {
      const actions = [...prev.packState.actions]
      actions[index] = !actions[index]
      return { packState: { ...prev.packState, actions } }
    })
  }

  handleGenerateCommunication = () => {
    const { currentTab, packState } = this.state
    const text = buildEvidenceCommunication(currentTab, packState.formData)
    this.setState((prev) => ({
      packState: { ...prev.packState, communicationText: text },
    }))
    Taro.showToast({ title: '已生成沟通说明', icon: 'success' })
  }

  handleReset = () => {
    Taro.showModal({
      title: '确认重置',
      content: '将清空所有填写的内容，是否继续？',
      success: (res) => {
        if (res.confirm) {
          this.setState({ packState: createDefaultEvidencePackState(), currentGroup: 0 })
        }
      },
    })
  }

  handleExport = () => {
    const report = createEvidencePackageText(this.state.packState)
    Taro.setClipboardData({
      data: report,
      success: () => Taro.showToast({ title: '已复制到剪贴板', icon: 'success' }),
    })
  }

  getProgress = () => {
    const { evidence } = this.state.packState
    let total = 0
    let collected = 0
    Object.values(evidence).forEach((checks) => {
      checks.forEach((v) => {
        total++
        if (v) collected++
      })
    })
    return { total, collected, percentage: total > 0 ? Math.round((collected / total) * 100) : 0 }
  }

  render() {
    const { packState, currentTab, currentGroup, isSaving } = this.state
    const { formData, evidence, actions, communicationText } = packState
    const progress = this.getProgress()
    const [activeGroupKey, activeGroupMeta] = GROUPS[currentGroup] || GROUPS[0]

    return (
      <ScrollView scrollY className='evidence-page'>
        <View className='evidence-hero'>
          <Text className='eyebrow'>退租证据包</Text>
          <Text className='page-title'>退租证据整理成包</Text>
          <Text className='page-copy'>把合同、押金凭证、交接照片、费用票据和沟通记录串成一条证据链。</Text>
        </View>
        <View className='progress-section'>
          <Text className='progress-title'>证据收集进度</Text>
          <View className='progress-bar'>
            <View className='progress-fill' style={{ width: `${progress.percentage}%` }} />
          </View>
          <Text className='progress-text'>
            {progress.collected} / {progress.total} 项 ({progress.percentage}%)
          </Text>
        </View>

        <View className='section'>
          <Text className='section-title'>基本信息</Text>

          <View className='form-item'>
            <Text className='form-label'>房屋地址</Text>
            <Input className='form-input' placeholder='请输入房屋地址' value={formData.address} onInput={(e) => this.handleFormChange('address', e.detail.value)} />
          </View>
          <View className='form-item'>
            <Text className='form-label'>押金金额（元）</Text>
            <Input className='form-input' type='number' placeholder='请输入押金金额' value={formData.deposit} onInput={(e) => this.handleFormChange('deposit', e.detail.value)} />
          </View>
          <View className='form-item'>
            <Text className='form-label'>月租金（元）</Text>
            <Input className='form-input' type='number' placeholder='请输入月租金' value={formData.monthlyRent} onInput={(e) => this.handleFormChange('monthlyRent', e.detail.value)} />
          </View>
          <View className='form-item'>
            <Text className='form-label'>房东/中介</Text>
            <Input className='form-input' placeholder='请输入房东或中介姓名' value={formData.landlordName} onInput={(e) => this.handleFormChange('landlordName', e.detail.value)} />
          </View>
          <View className='form-item'>
            <Text className='form-label'>联系电话</Text>
            <Input className='form-input' placeholder='请输入联系电话' value={formData.landlordPhone} onInput={(e) => this.handleFormChange('landlordPhone', e.detail.value)} />
          </View>
          <View className='form-item'>
            <Text className='form-label'>入住日期</Text>
            <Input className='form-input' placeholder='如 2025-06-01' value={formData.checkinDate} onInput={(e) => this.handleFormChange('checkinDate', e.detail.value)} />
          </View>
          <View className='form-item'>
            <Text className='form-label'>退租日期</Text>
            <Input className='form-input' placeholder='如 2026-06-01' value={formData.checkoutDate} onInput={(e) => this.handleFormChange('checkoutDate', e.detail.value)} />
          </View>
          <View className='form-item'>
            <Text className='form-label'>交接日期</Text>
            <Input className='form-input' placeholder='如 2026-06-05' value={formData.handoverDate} onInput={(e) => this.handleFormChange('handoverDate', e.detail.value)} />
          </View>
          <View className='form-item'>
            <Text className='form-label'>交接时间</Text>
            <Input className='form-input' placeholder='如 10:00' value={formData.handoverTime} onInput={(e) => this.handleFormChange('handoverTime', e.detail.value)} />
          </View>
        </View>

        <View className='section'>
          <Text className='section-title'>证据清单</Text>
          <View className='category-tabs'>
            {GROUPS.map(([key, meta], index) => (
              <View
                key={key}
                className={`category-tab ${currentGroup === index ? 'active' : ''}`}
                onClick={() => this.setState({ currentGroup: index })}
              >
                {meta.title}
              </View>
            ))}
          </View>

          <View className='evidence-list'>
            {activeGroupMeta.items.map((item, itemIndex) => (
              <View key={itemIndex} className='evidence-item'>
                <View className='item-header' onClick={() => this.handleEvidenceToggle(activeGroupKey, itemIndex)}>
                  <View className={`checkbox ${evidence[activeGroupKey][itemIndex] ? 'checked' : ''}`}>
                    {evidence[activeGroupKey][itemIndex] && <Text>✓</Text>}
                  </View>
                  <Text className='item-name'>{item}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View className='section'>
          <Text className='section-title'>下一步行动</Text>
          {evidenceActions.map((action, index) => (
            <View key={index} className='action-item' onClick={() => this.handleActionToggle(index)}>
              <View className={`checkbox ${actions[index] ? 'checked' : ''}`}>
                {actions[index] && <Text>✓</Text>}
              </View>
              <View className='action-text'>
                <Text className='item-name'>{action.title}</Text>
                <Text className='item-desc'>{action.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View className='section'>
          <Text className='section-title'>沟通说明</Text>
          <View className='tab-row'>
            {evidenceToolTabs.map((tab) => (
              <View
                key={tab.value}
                className={`tab-btn ${currentTab === tab.value ? 'active' : ''}`}
                onClick={() => this.setState({ currentTab: tab.value })}
              >
                {tab.label}
              </View>
            ))}
          </View>
          <Button className='btn-generate' onClick={this.handleGenerateCommunication}>
            生成沟通说明
          </Button>
          {communicationText ? (
            <Textarea className='communication-text' value={communicationText} maxlength={2000} onInput={(e) => this.setState((prev) => ({ packState: { ...prev.packState, communicationText: e.detail.value } }))} />
          ) : null}
        </View>

        <View className='action-buttons'>
          <Button className='btn-save' onClick={this.saveData} disabled={isSaving}>
            {isSaving ? '保存中...' : '保存'}
          </Button>
          <Button className='btn-export' onClick={this.handleExport}>
            复制报告摘要
          </Button>
          <Button className='btn-reset' onClick={this.handleReset}>
            重置
          </Button>
        </View>
      </ScrollView>
    )
  }
}
