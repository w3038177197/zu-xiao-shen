import { Component } from 'react'
import { Button, Input, Picker, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.css'

const modules = [
  { id: 'subsidy', number: '01', title: '补贴匹配', desc: '按城市和个人情况筛官方补贴线索，先判断有没有资格。', icon: '￥' },
  { id: 'review', number: '02', title: '租房审查', desc: '标出押金、涨租、维修、违约金等关键风险。', icon: '▤' },
  { id: 'checkin', number: '03', title: '入住验房', desc: '记录房屋初始状态，避免旧问题变成租客责任。', icon: '◇' },
  { id: 'evidence', number: '04', title: '退租证据包', desc: '整理证据包和话术，让押金争议有材料可讲。', icon: '□' },
]

const ideas = [
  '合同拍照识别：手机拍合同，自动提取条款并进入审查。',
  '城市政策更新：补贴入口和申请条件定期维护，减少过期信息。',
  '押金争议导出：把验房、票据、聊天记录整理成 PDF 或 Word。',
  '租金行情参考：用周边租金帮助判断续租涨价是否合理。',
]

const defaultDeposit = { depositAmount: '3800', unpaidFees: '0', repairCost: '0', cleaningCost: '400', hasVoucher: 'no', normalWear: 'yes' }

function calculateDeposit(values) {
  const deposit = Math.max(0, Number(values.depositAmount) || 0)
  const deduction = (Number(values.unpaidFees) || 0) + (Number(values.repairCost) || 0) + (Number(values.cleaningCost) || 0)
  const estimatedReturn = Math.max(0, deposit - deduction)
  return { deduction, estimatedReturn, warning: deduction > deposit ? '当前填写的预计扣款已超过押金，请核对凭证和责任归属。' : '正常损耗不应直接作为押金扣款依据，要求对方提供明细和凭证。' }
}

export default class Index extends Component {
  state = { deposit: defaultDeposit }

  openModule = (id) => {
    const path = id === 'review' ? '/pages/contract/index' : `/pages/${id}/index`
    Taro.navigateTo({ url: path })
  }

  updateDeposit = (key, value) => this.setState((current) => ({ deposit: { ...current.deposit, [key]: value } }))

  render() {
    const { deposit } = this.state
    const result = calculateDeposit(deposit)

    return (
      <ScrollView className='home' scrollY>
        <View className='home-header'>
          <View className='brand-mark'>盾</View>
          <View><Text className='brand-name'>租小审</Text><Text className='brand-subtitle'>租房全流程风控助手</Text></View>
        </View>

        <View className='hero section'>
          <Text className='eyebrow'>PROJECT HOME</Text>
          <Text className='hero-title'>租小审项目首页</Text>
          <Text className='hero-copy'>用首页先讲清楚项目定位、四个核心模块、演示路径和后续开发方向。</Text>
          <View className='status-pill'><View className='status-dot' /><Text>系统 AI 助手 · 本地规则兜底</Text></View>
          <View className='hero-note'><Text>移动端查看模式</Text><Text>租房合同风险审查、验房和证据包都能在手机端完成。</Text></View>
        </View>

        <View className='section intro-card'>
          <Text className='eyebrow'>PROJECT HOME</Text>
          <Text className='section-title'>租小审：租房全流程风控助手</Text>
          <Text className='section-copy'>给普通租客的签约、入住、退租和补贴申请助手，把复杂风险翻译成能直接行动的下一步。</Text>
          <View className='tag-row'><Text>社会服务</Text><Text>租客权益</Text><Text>AI 风险</Text></View>
          <View className='brief-box'><Text className='eyebrow'>项目一句话</Text><Text className='brief-title'>先看懂合同，再决定怎么签。</Text><Text className='brief-copy'>不是替用户打官司，而是在损失发生前提醒：哪条有问题、为什么有问题、下一步怎么谈。</Text></View>
          <View className='brief-grid'><View><Text>服务对象</Text><Text>毕业生、第一次租房人群</Text></View><View><Text>核心价值</Text><Text>看懂条款、保留证据、少丢押金</Text></View></View>
        </View>

        <View className='section'>
          <Text className='eyebrow'>MODULE ENTRANCES</Text>
          <Text className='section-title'>从首页直接进入四个核心模块</Text>
          <View className='module-list'>
            {modules.map((item) => <View className='module-item' key={item.id} onClick={() => this.openModule(item.id)}><View className='module-number'>{item.number}</View><View className='module-body'><Text className='module-title'>{item.title}</Text><Text className='module-desc'>{item.desc}</Text></View><Text className='module-icon'>{item.icon}</Text></View>)}
          </View>
        </View>

        <View className='section'>
          <Text className='eyebrow'>NEXT STAGE</Text>
          <Text className='section-title'>继续开发的想法，先围绕押租押金做深</Text>
          <View className='deposit-card'>
            <Text className='deposit-label'>退租押金计算器</Text>
            <Text className='deposit-result'>预计应退押金：¥ {result.estimatedReturn.toLocaleString()}</Text>
            <Text className='deposit-warning'>{result.warning}</Text>
            <View className='deposit-grid'>
              {[["depositAmount", '押金金额'], ["unpaidFees", '未结清费用'], ["repairCost", '维修扣款'], ["cleaningCost", '保洁扣款']].map(([key, label]) => <View className='field' key={key}><Text>{label}</Text><Input type='number' value={deposit[key]} onInput={(e) => this.updateDeposit(key, e.detail.value)} /></View>)}
              <View className='field'><Text>是否有票据</Text><Picker range={['无票据或未提供', '有有效票据']} value={deposit.hasVoucher === 'yes' ? 1 : 0} onChange={(e) => this.updateDeposit('hasVoucher', Number(e.detail.value) ? 'yes' : 'no')}><View className='picker'>{deposit.hasVoucher === 'yes' ? '有有效票据' : '无票据或未提供'}⌄</View></Picker></View>
              <View className='field'><Text>是否正常损耗</Text><Picker range={['是，仅正常使用损耗', '否，疑似人为损坏']} value={deposit.normalWear === 'yes' ? 0 : 1} onChange={(e) => this.updateDeposit('normalWear', Number(e.detail.value) ? 'no' : 'yes')}><View className='picker'>{deposit.normalWear === 'yes' ? '是，仅正常使用损耗' : '否，疑似人为损坏'}⌄</View></Picker></View>
            </View>
          </View>
          <View className='idea-list'>{ideas.map((idea, index) => <View className='idea-item' key={idea}><Text>{String(index + 1).padStart(2, '0')}</Text><Text>{idea}</Text></View>)}</View>
        </View>

        <Button className='footer-cta' onClick={() => this.openModule('review')}>立即体验租房审查 →</Button>
        <Text className='footer-note'>租房更安心，维权有依据</Text>
      </ScrollView>
    )
  }
}
