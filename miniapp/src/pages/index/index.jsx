import { useMemo, useState } from 'react'
import { Button, Input, Picker, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { calculateDepositReturn } from '../../shared/money.js'
import { loadWorkflowContext } from '../../features/workflowContext'
import {
  cleanupUnreferencedSavedFiles,
  clearLocalData,
  formatLocalBytes,
  formatLocalDataExport,
  getLocalDataUsage,
  getLocalStorageInfo,
} from '../../utils/localDataManager'
import { copyText } from '../../utils/copyText'
import { exportTextToFile } from '../../utils/textFileExport'
import './index.css'

const quickModules = [
  { id: 'checkin', phase: '入住时', title: '入住验房', description: '按房间拍照，留下入住基线' },
  { id: 'evidence', phase: '退租时', title: '退租证据包', description: '整理照片、费用和沟通记录' },
]

const defaultDeposit = {
  depositAmount: '',
  unpaidFees: '',
  repairCost: '',
  cleaningCost: '',
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
  const [showDataDetails, setShowDataDetails] = useState(false)
  const [storageInfo, setStorageInfo] = useState(getLocalStorageInfo)
  const [dataUsage, setDataUsage] = useState(null)
  const [workflow, setWorkflow] = useState(loadWorkflowContext)
  const result = useMemo(() => calculateDeposit(deposit), [deposit])
  const hasDepositAmount = Number(deposit.depositAmount) > 0
  const storageUsageLabel = storageInfo
    ? `${formatLocalBytes(storageInfo.currentSize * 1024)} / ${formatLocalBytes(storageInfo.limit * 1024)}`
    : '本地存储'

  Taro.useShareAppMessage(() => ({ title: '租小审：租房全流程风险审查与证据助手', path: '/pages/index/index' }))

  const refreshLocalState = async () => {
    setWorkflow(loadWorkflowContext())
    setStorageInfo(getLocalStorageInfo())
    setDataUsage(await getLocalDataUsage())
  }

  Taro.useDidShow(() => {
    refreshLocalState()
  })

  const openModule = (id) => {
    const path = id === 'review' ? '/pages/contract/index' : '/pages/' + id + '/index'
    if (id === 'ai') Taro.navigateTo({ url: path })
    else Taro.switchTab({ url: path })
  }

  const updateDeposit = (key, value) => {
    setDeposit((current) => ({ ...current, [key]: value }))
  }

  const handleExportLocalData = () => {
    copyText(formatLocalDataExport(), '本地数据已复制')
  }

  const handleExportTxt = () => {
    exportTextToFile('租小审本地数据.txt', formatLocalDataExport())
  }

  const handleClearLocalData = () => {
    Taro.showModal({
      title: '清除本机数据',
      content: '将清除合同草稿、审查记录、AI 对话、验房记录、证据包和补贴资料，并删除本机持久保存的照片与附件。此操作不可恢复。',
      success: async ({ confirm }) => {
        if (!confirm) return
        const result = await clearLocalData()
        await refreshLocalState()
        Taro.showToast({ title: result.ok ? '本地数据已清除' : '部分数据清除失败', icon: result.ok ? 'success' : 'none' })
      },
    })
  }

  const handleCleanupUnusedFiles = () => {
    if (!dataUsage?.unreferencedCount) {
      Taro.showToast({ title: '暂无无用文件', icon: 'none' })
      return
    }
    Taro.showModal({
      title: '清理无用文件',
      content: `发现 ${dataUsage.unreferencedCount} 个未被业务记录引用的文件，占用 ${formatLocalBytes(dataUsage.unreferencedBytes)}。清理不会删除当前验房和证据包正在使用的文件。`,
      success: async ({ confirm }) => {
        if (!confirm) return
        const cleanup = await cleanupUnreferencedSavedFiles()
        await refreshLocalState()
        Taro.showToast({
          title: cleanup.ok ? `已清理 ${cleanup.removedFiles} 个文件` : '部分文件清理失败，请重试',
          icon: cleanup.ok ? 'success' : 'none',
        })
      },
    })
  }

  const reviewModule = workflow.modules.review

  return (
    <ScrollView className='home-page' scrollY enhanced showScrollbar={false}>
      <View className='home-shell'>
        <View className='home-hero'>
          <View className='hero-meta'>
            <View className='hero-brand'><View className='brand-mark'>审</View><Text>租房风险助手</Text></View>
            <View className='local-status'><View className='status-dot' /><Text>资料本地保存</Text></View>
          </View>
          <Text className='hero-title'>先把风险看懂，再决定怎么租</Text>
          <Text className='hero-copy'>先审合同，再拍照留痕。每一步都告诉你接下来该做什么。</Text>
          <Button className='hero-cta' onClick={() => openModule('review')}>
            {workflow.review.isCurrent ? `查看合同审查 · ${workflow.review.summary?.score ?? 0} 分` : reviewModule.hasData ? '继续审查当前合同' : '开始审查合同'}
          </Button>
        </View>

        <Button className='ai-entry' onClick={() => openModule('ai')}>
          <View className='ai-entry-mark'>AI</View>
          <View className='ai-entry-copy'>
            <Text className='ai-entry-title'>问租房 AI</Text>
            <Text className='ai-entry-description'>合同、押金、验房和退租问题直接问</Text>
          </View>
          <Text className='quick-arrow' aria-hidden>›</Text>
        </Button>

        <View className='home-section'>
          <View className='section-heading'>
            <Text className='section-title'>你现在要做什么？</Text>
          </View>
          <View className='quick-list'>
            {quickModules.map((item) => (
              <Button className='quick-card' key={item.id} onClick={() => openModule(item.id)}>
                <View className='quick-card-copy'>
                  <View className='quick-meta-row'>
                    <Text className='quick-phase'>{item.phase}</Text>
                    <Text className={`quick-status ${workflow.modules[item.id]?.hasData ? 'active' : ''}`}>{workflow.modules[item.id]?.status || '未开始'}</Text>
                  </View>
                  <Text className='quick-title'>{item.title}</Text>
                  <Text className='quick-description'>{workflow.modules[item.id]?.hasData ? workflow.modules[item.id].detail : item.description}</Text>
                </View>
                <Text className='quick-arrow' aria-hidden>›</Text>
              </Button>
            ))}
          </View>
        </View>

        <View className='home-section deposit-card'>
          <Button className='deposit-entry' aria-expanded={showDepositDetails} onClick={() => setShowDepositDetails((current) => !current)}>
            <View className='deposit-entry-copy'>
              <Text className='section-kicker'>押金估算</Text>
              <Text className='deposit-entry-title'>退租前先算一下</Text>
            </View>
            <View className='deposit-entry-result'>
              <Text>{hasDepositAmount ? '预计应退' : '押金估算'}</Text>
              <Text>{hasDepositAmount ? `¥ ${result.estimatedReturn.toLocaleString()}` : '填写金额后计算'}</Text>
            </View>
            <Text className='deposit-entry-action'>{showDepositDetails ? '收起' : '展开'}</Text>
          </Button>
          {showDepositDetails ? (
            <View className='deposit-details'>
              <View className='deposit-summary'>
                <View className='deposit-main'><Text className='deposit-caption'>预计应退</Text><Text className='deposit-result'>¥ {result.estimatedReturn.toLocaleString()}</Text></View>
                <View className='deduction-box'><Text>预计扣款</Text><Text>¥ {result.deduction.toLocaleString()}</Text></View>
              </View>
              <Text className='deposit-warning'>{result.warning}</Text>
              <View className='deposit-grid'>
                {[
                  ['depositAmount', '押金金额'],
                  ['unpaidFees', '未结清费用'],
                  ['repairCost', '维修扣款'],
                  ['cleaningCost', '保洁扣款'],
                ].map(([key, label]) => (
                  <View className='field' key={key}><Text>{label}</Text><Input aria-label={label} name={key} type='digit' value={deposit[key]} onInput={(event) => updateDeposit(key, event.detail.value)} /></View>
                ))}
                <View className='field'><Text>是否有票据</Text><Picker aria-label='是否有票据' range={['无票据或未提供', '有有效票据']} value={deposit.hasVoucher === 'yes' ? 1 : 0} onChange={(event) => updateDeposit('hasVoucher', Number(event.detail.value) ? 'yes' : 'no')}><View className='picker'>{deposit.hasVoucher === 'yes' ? '有有效票据' : '无票据或未提供'}<Text>⌄</Text></View></Picker></View>
                <View className='field'><Text>是否正常损耗</Text><Picker aria-label='是否正常损耗' range={['是，仅正常使用损耗', '否，疑似人为损坏']} value={deposit.normalWear === 'yes' ? 0 : 1} onChange={(event) => updateDeposit('normalWear', Number(event.detail.value) ? 'no' : 'yes')}><View className='picker'>{deposit.normalWear === 'yes' ? '是，仅正常损耗' : '否，疑似人为损坏'}<Text>⌄</Text></View></Picker></View>
              </View>
            </View>
          ) : null}
        </View>

        <View className='home-section data-section'>
          <Button className='data-entry' aria-expanded={showDataDetails} onClick={() => setShowDataDetails((current) => !current)}>
            <View className='data-entry-copy'>
              <Text className='section-kicker'>隐私与数据</Text>
              <Text className='data-entry-title'>管理本机数据</Text>
            </View>
            <Text className='deposit-label'>{storageUsageLabel}</Text>
            <Text className='deposit-entry-action'>{showDataDetails ? '收起' : '展开'}</Text>
          </Button>
          {showDataDetails ? (
            <View className='data-details'>
              <Text className='data-copy'>合同草稿、审查记录、AI 对话、验房记录、证据包和补贴资料仅保存在本机。建议先导出备份，再清除数据。</Text>
              <View className='data-usage-row'>
                <View><Text>记录占用</Text><Text>{storageInfo ? formatLocalBytes(storageInfo.currentSize * 1024) : '读取失败'}</Text></View>
                <View><Text>持久文件</Text><Text>{dataUsage?.fileListAvailable ? `${dataUsage.savedFileCount} 个 · ${formatLocalBytes(dataUsage.savedFileBytes)}` : '读取失败'}</Text></View>
              </View>
              {dataUsage?.unreferencedCount ? <Text className='cleanup-hint'>发现 {dataUsage.unreferencedCount} 个未引用文件，可安全清理 {formatLocalBytes(dataUsage.unreferencedBytes)}</Text> : null}
              <View className='data-actions'>
                <Button className='data-button' onClick={handleExportTxt}>导出数据 TXT</Button>
                <Button className='data-button' onClick={handleExportLocalData}>复制数据</Button>
                <Button className='data-button' disabled={!dataUsage?.unreferencedCount} onClick={handleCleanupUnusedFiles}>清理无用文件</Button>
                <Button className='data-button danger' onClick={handleClearLocalData}>清除全部数据</Button>
              </View>
            </View>
          ) : null}
        </View>

        <Text className='footer-note'>风险提示仅供租房自查参考，不构成法律意见。</Text>
      </View>
    </ScrollView>
  )
}
