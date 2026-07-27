import { useMemo, useState } from 'react'
import { Button, Input, Picker, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { calculateDepositReturn } from '../../../../src/utils/money.js'
import './index.css'

const modules = [
  { id: 'subsidy', number: '01', phase: '找补贴', title: '补贴匹配', desc: '按城市和个人情况筛选官方补贴线索。', action: '去匹配' },
  { id: 'review', number: '02', phase: '签约前', title: '租房审查', desc: '标出押金、涨租、维修和违约责任风险。', action: '审合同' },
  { id: 'checkin', number: '03', phase: '入住时', title: '入住验房', desc: '按房间拍照记录，固定房屋初始状态。', action: '去验房' },
  { id: 'evidence', number: '04', phase: '退租时', title: '退租证据包', desc: '整理证据清单、费用争议和沟通话术。', action: '整理证据' },
]

const routeSteps = [
  ['签约前', '先审合同', '重点确认押金、维修、入户、涨租和违约责任。'],
  ['入住时', '拍照留痕', '当天记录房屋状态，并把瑕疵书面发给房东确认。'],
  ['居住中', '保存凭证', '租金、水电、维修和沟通记录按时间持续归档。'],
  ['退租时', '整理证据', '把交接、费用、照片和聊天记录汇总后再协商。'],
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

  return {
    estimatedReturn: result.estimatedReturn,
    deduction: result.totalDeduction,
    warning: result.warning,
  }
}

export default function Index() {
  const [deposit, setDeposit] = useState(defaultDeposit)
  const result = useMemo(() => calculateDeposit(deposit), [deposit])

  Taro.useShareAppMessage(() => ({
    title: '租小审：租房全流程风险审查与证据助手',
    path: '/pages/index/index',
  }))

  const openModule = (id) => {
    const path = id === 'review' ? '/pages/contract/index' : `/pages/${id}/index`
    if (id === 'subsidy') Taro.navigateTo({ url: path })
    else Taro.switchTab({ url: path })
  }

  const updateDeposit = (key, value) => {
    setDeposit((current) => ({ ...current, [key]: value }))
  }

  return (
    <ScrollView className='home' scrollY enhanced showScrollbar={false}>
      <View className='home-header'>
        <View className='brand-mark'>盾</View>
        <View className='brand-copy'>
          <Text className='brand-name'>租小审</Text>
          <Text className='brand-subtitle'>租房全流程风控助手</Text>
        </View>
        <View className='local-status' onClick={() => openModule('ai')}>
          <View className='status-dot' />
          <Text>本地模式</Text>
        </View>
      </View>

      <View className='stage-nav' aria-label='按租房阶段选择功能'>
        {modules.map((item) => (
          <View className='stage-nav-item' key={item.id} onClick={() => openModule(item.id)}>
            <Text>{item.phase}</Text>
            <Text>{item.title}</Text>
          </View>
        ))}
      </View>

      <View className='hero section'>
        <Text className='eyebrow'>租房使用总览</Text>
        <Text className='hero-title'>每一步，先看懂再行动</Text>
        <Text className='hero-copy'>从签约前审合同，到入住留痕和退租协商，把风险、证据和下一步放在一起。</Text>
        <View className='hero-actions'>
          <Button className='primary-action' onClick={() => openModule('review')}>立即审查合同</Button>
          <Button className='secondary-action' onClick={() => openModule('ai')}>问租小审 AI</Button>
        </View>
        <View className='privacy-note'>
          <Text>隐私保护已开启</Text>
          <Text>默认使用本地规则，合同正文和照片不会因为打开首页而上传。</Text>
        </View>
      </View>

      <View className='section module-section'>
        <Text className='eyebrow'>现在要处理什么</Text>
        <Text className='section-title'>按当前租房阶段进入</Text>
        <View className='module-list'>
          {modules.map((item) => (
            <View className='module-item' key={item.id} onClick={() => openModule(item.id)}>
              <Text className='module-number'>{item.number}</Text>
              <View className='module-body'>
                <Text className='module-phase'>{item.phase}</Text>
                <Text className='module-title'>{item.title}</Text>
                <Text className='module-desc'>{item.desc}</Text>
              </View>
              <Text className='module-action'>{item.action} ›</Text>
            </View>
          ))}
        </View>
      </View>

      <View className='section route-section'>
        <Text className='eyebrow'>完整租房路线</Text>
        <Text className='section-title'>四个阶段，材料不要断</Text>
        <View className='route-list'>
          {routeSteps.map(([phase, title, desc], index) => (
            <View className='route-item' key={phase}>
              <Text className='route-index'>{String(index + 1).padStart(2, '0')}</Text>
              <View>
                <Text className='route-phase'>{phase}</Text>
                <Text className='route-title'>{title}</Text>
                <Text className='route-desc'>{desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View className='section deposit-section'>
        <Text className='eyebrow'>退租押金试算</Text>
        <View className='deposit-summary'>
          <View>
            <Text className='deposit-result-label'>预计应退</Text>
            <Text className='deposit-result'>¥ {result.estimatedReturn.toLocaleString()}</Text>
          </View>
          <View className='deduction-box'>
            <Text>预计扣款</Text>
            <Text>¥ {result.deduction.toLocaleString()}</Text>
          </View>
        </View>
        <Text className='deposit-warning'>{result.warning}</Text>
        <View className='deposit-grid'>
          {[
            ['depositAmount', '押金金额'],
            ['unpaidFees', '未结清费用'],
            ['repairCost', '维修扣款'],
            ['cleaningCost', '保洁扣款'],
          ].map(([key, label]) => (
            <View className='field' key={key}>
              <Text>{label}</Text>
              <Input type='digit' value={deposit[key]} onInput={(event) => updateDeposit(key, event.detail.value)} />
            </View>
          ))}
          <View className='field'>
            <Text>是否有票据</Text>
            <Picker range={['无票据或未提供', '有有效票据']} value={deposit.hasVoucher === 'yes' ? 1 : 0} onChange={(event) => updateDeposit('hasVoucher', Number(event.detail.value) ? 'yes' : 'no')}>
              <View className='picker'>{deposit.hasVoucher === 'yes' ? '有有效票据' : '无票据或未提供'}<Text>⌄</Text></View>
            </Picker>
          </View>
          <View className='field'>
            <Text>是否正常损耗</Text>
            <Picker range={['是，仅正常使用损耗', '否，疑似人为损坏']} value={deposit.normalWear === 'yes' ? 0 : 1} onChange={(event) => updateDeposit('normalWear', Number(event.detail.value) ? 'no' : 'yes')}>
              <View className='picker'>{deposit.normalWear === 'yes' ? '是，仅正常损耗' : '否，疑似人为损坏'}<Text>⌄</Text></View>
            </Picker>
          </View>
        </View>
      </View>

      <View className='ai-callout' onClick={() => openModule('ai')}>
        <View>
          <Text className='eyebrow'>还有疑问</Text>
          <Text className='ai-callout-title'>把条款或扣款明细发给租小审 AI</Text>
          <Text className='ai-callout-copy'>按“风险、证据、行动、话术”继续拆解。</Text>
        </View>
        <Text className='ai-callout-action'>去提问 ›</Text>
      </View>

      <Text className='footer-note'>风险提示仅供租房自查参考，不构成法律意见。</Text>
    </ScrollView>
  )
}
