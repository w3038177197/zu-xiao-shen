import { useMemo, useState } from 'react'
import { Button, Input, Picker, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { calculateDepositReturn } from '../../../../src/utils/money.js'
import './index.css'

const quickModules = [
  { id: 'review', step: '01', phase: '签约前', title: '合同审查', description: '先看押金、涨租、维修和违约责任', action: '开始审查', tone: 'risk' },
  { id: 'checkin', step: '02', phase: '入住时', title: '入住验房', description: '按房间拍照，留下可追溯的入住基线', action: '去验房', tone: 'green' },
  { id: 'evidence', step: '03', phase: '退租时', title: '证据包', description: '整理照片、费用和沟通记录', action: '整理证据', tone: 'blue' },
  { id: 'subsidy', step: '04', phase: '补贴匹配', title: '查补贴', description: '按城市和身份筛选公开政策', action: '去匹配', tone: 'amber' },
]

const routeSteps = [
  ['签约前', '先审合同', '押金、维修、入户和涨租条款先看懂'],
  ['入住时', '拍照留痕', '当天记录房屋状态并让对方确认'],
  ['居住中', '保存凭证', '租金、水电、维修和沟通记录按时间保存'],
  ['退租时', '整理证据', '交接、费用、照片和聊天记录集中归档'],
]

const defaultDeposit = {
  depositAmount: '3800',
  unpaidFees: '0',
  repairCost: '0',
  cleaningCost: '400',
  hasVoucher: 'no',
  normalWear: 'yes',
}

function calculateDeposit(values) {
  const result = calculateDepositReturn(values)
  return { estimatedReturn: result.estimatedReturn, deduction: result.totalDeduction, warning: result.warning }
}

export default function Index() {
  const [deposit, setDeposit] = useState(defaultDeposit)
  const [showDepositDetails, setShowDepositDetails] = useState(false)
  const result = useMemo(() => calculateDeposit(deposit), [deposit])

  Taro.useShareAppMessage(() => ({ title: '租小审：租房全流程风险审查与证据助手', path: '/pages/index/index' }))

  const openModule = (id) => {
    const path = id === 'review' ? '/pages/contract/index' : '/pages/' + id + '/index'
    if (id === 'subsidy') Taro.navigateTo({ url: path })
    else Taro.switchTab({ url: path })
  }

  const updateDeposit = (key, value) => {
    setDeposit((current) => ({ ...current, [key]: value }))
  }

  return (
    <ScrollView className='home-page' scrollY enhanced showScrollbar={false}>
      <View className='home-shell'>
        <View className='home-header'>
          <View className='brand-mark'>审</View>
          <View className='brand-copy'>
            <Text className='brand-name'>租小审</Text>
            <Text className='brand-subtitle'>租房风险助手</Text>
          </View>
          <View className='local-status' onClick={() => openModule('ai')}>
            <View className='status-dot' />
            <Text>本地模式</Text>
          </View>
        </View>

        <View className='home-hero'>
          <View className='hero-kicker'><View className='kicker-dot' /><Text>从签约到退租，证据都留在手上</Text></View>
          <Text className='hero-title'>先把风险看懂，再决定怎么租</Text>
          <Text className='hero-copy'>合同先审一遍，入住拍照留痕，退租时把证据整理好。每一步都给你下一步可以执行的动作。</Text>
          <Button className='hero-cta' onClick={() => openModule('review')}>开始审查合同</Button>
          <Text className='hero-note'>本地分析模式已开启，合同正文和照片不会因为打开首页而上传。</Text>
        </View>

        <View className='home-section'>
          <View className='section-heading'>
            <Text className='section-kicker'>现在要处理什么</Text>
            <Text className='section-title'>四个关键节点</Text>
          </View>
          <View className='quick-grid'>
            {quickModules.map((item) => (
              <View className={'quick-card ' + item.tone} key={item.id} onClick={() => openModule(item.id)}>
                <View className='quick-card-top'><Text className='quick-step'>{item.step}</Text><Text className='quick-phase'>{item.phase}</Text></View>
                <Text className='quick-title'>{item.title}</Text>
                <Text className='quick-description'>{item.description}</Text>
                <Text className='quick-action'>{item.action} <Text className='arrow'>›</Text></Text>
              </View>
            ))}
          </View>
        </View>

        <View className='home-section flow-section'>
          <View className='section-heading inline-heading'>
            <View><Text className='section-kicker'>租房流程</Text><Text className='section-title'>每一步都有凭证</Text></View>
            <Text className='section-side-note'>左右滑动</Text>
          </View>
          <ScrollView className='flow-scroll' scrollX showScrollbar={false}>
            <View className='flow-row'>
              {routeSteps.map(([phase, title, desc], index) => (
                <View className='flow-card' key={phase}>
                  <Text className='flow-index'>0{index + 1}</Text>
                  <Text className='flow-phase'>{phase}</Text>
                  <Text className='flow-title'>{title}</Text>
                  <Text className='flow-description'>{desc}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        <View className='home-section deposit-card'>
          <View className='section-heading inline-heading'>
            <View><Text className='section-kicker'>退租前快速估算</Text><Text className='section-title'>押金大概能退多少</Text></View>
            <Text className='deposit-label'>仅供自查</Text>
          </View>
          <View className='deposit-summary'>
            <View className='deposit-main'><Text className='deposit-caption'>预计应退</Text><Text className='deposit-result'>¥ {result.estimatedReturn.toLocaleString()}</Text></View>
            <View className='deduction-box'><Text>预计扣款</Text><Text>¥ {result.deduction.toLocaleString()}</Text></View>
          </View>
          <Text className='deposit-warning'>{result.warning}</Text>
          <Button className='deposit-toggle' onClick={() => setShowDepositDetails((current) => !current)}>{showDepositDetails ? '收起调整项' : '调整扣款项'}</Button>
          {showDepositDetails ? (
            <View className='deposit-grid'>
              {[
                ['depositAmount', '押金金额'],
                ['unpaidFees', '未结清费用'],
                ['repairCost', '维修扣款'],
                ['cleaningCost', '保洁扣款'],
              ].map(([key, label]) => (
                <View className='field' key={key}><Text>{label}</Text><Input type='digit' value={deposit[key]} onInput={(event) => updateDeposit(key, event.detail.value)} /></View>
              ))}
              <View className='field'><Text>是否有票据</Text><Picker range={['无票据或未提供', '有有效票据']} value={deposit.hasVoucher === 'yes' ? 1 : 0} onChange={(event) => updateDeposit('hasVoucher', Number(event.detail.value) ? 'yes' : 'no')}><View className='picker'>{deposit.hasVoucher === 'yes' ? '有有效票据' : '无票据或未提供'}<Text>⌄</Text></View></Picker></View>
              <View className='field'><Text>是否正常损耗</Text><Picker range={['是，仅正常使用损耗', '否，疑似人为损坏']} value={deposit.normalWear === 'yes' ? 0 : 1} onChange={(event) => updateDeposit('normalWear', Number(event.detail.value) ? 'no' : 'yes')}><View className='picker'>{deposit.normalWear === 'yes' ? '是，仅正常损耗' : '否，疑似人为损坏'}<Text>⌄</Text></View></Picker></View>
            </View>
          ) : null}
        </View>

        <View className='ai-callout' onClick={() => openModule('ai')}>
          <View className='ai-callout-copy'>
            <Text className='section-kicker'>还有问题</Text>
            <Text className='ai-callout-title'>把条款或扣款明细交给本地 AI</Text>
            <Text className='ai-callout-description'>结合当前合同，帮你拆解风险、证据和下一步。</Text>
          </View>
          <Text className='ai-callout-action'>去提问 ›</Text>
        </View>
        <Text className='footer-note'>风险提示仅供租房自查参考，不构成法律意见。</Text>
      </View>
    </ScrollView>
  )
}
