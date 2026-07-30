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
  backupLocalData,
  parseBackupSummary,
  restoreLocalData,
} from '../../utils/localDataManager'
import { copyText } from '../../utils/copyText'
import { exportTextToFile } from '../../utils/textFileExport'
import './index.css'

const workflowSteps = [
  { id: 'review', number: '1', phase: '签约前', title: '审合同', description: '把押金、涨租、维修等条款过一遍' },
  { id: 'checkin', number: '2', phase: '入住时', title: '入住留证', description: '按房间拍照，留下入住基线' },
  { id: 'evidence', number: '3', phase: '退租时', title: '退租证据', description: '整理照片、费用和沟通记录' },
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

function getCurrentStep(workflow) {
  const review = workflow.review
  const reviewModule = workflow.modules.review
  const checkin = workflow.modules.checkin
  const evidence = workflow.modules.evidence

  if (!reviewModule.hasData) {
    return { id: 'review', title: '开始审查合同', desc: '先把合同风险看懂，再决定怎么租', action: '开始审查合同' }
  }
  if (!review.isCurrent) {
    return { id: 'review', title: '继续审查合同', desc: reviewModule.detail, action: '继续审查' }
  }
  if (!checkin.hasData || checkin.status !== '已完成') {
    return { id: 'checkin', title: checkin.hasData ? '继续入住验房' : '入住拍照留证', desc: checkin.detail, action: checkin.hasData ? '继续验房' : '开始验房' }
  }
  if (!evidence.hasData) {
    return { id: 'evidence', title: '整理退租证据', desc: evidence.detail, action: '整理证据' }
  }
  return { id: 'evidence', title: '继续整理退租证据', desc: evidence.detail, action: '继续整理' }
}

export default function Index() {
  const [deposit, setDeposit] = useState(defaultDeposit)
  const [showDepositDetails, setShowDepositDetails] = useState(false)
  const [showDataDetails, setShowDataDetails] = useState(false)
  const [storageInfo, setStorageInfo] = useState(getLocalStorageInfo)
  const [dataUsage, setDataUsage] = useState(null)
  const [workflow, setWorkflow] = useState(loadWorkflowContext)
  // 备份/恢复稳定提示（不只依赖 Toast）
  const [backupMessage, setBackupMessage] = useState(null)
  const result = useMemo(() => calculateDeposit(deposit), [deposit])
  const hasDepositAmount = Number(deposit.depositAmount) > 0
  const storageUsageLabel = storageInfo
    ? `${formatLocalBytes(storageInfo.currentSize * 1024)} / ${formatLocalBytes(storageInfo.limit * 1024)}`
    : '本地存储'
  const currentStep = useMemo(() => getCurrentStep(workflow), [workflow])

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

  // 导出整包备份 JSON
  const handleExportBackup = async () => {
    setBackupMessage(null)
    try {
      const json = backupLocalData()
      const result = await exportTextToFile('租小审备份.json', json, { extension: '.json' })
      if (result.ok) {
        setBackupMessage({ type: 'success', text: '备份已导出为 JSON 文件。照片和附件文件不包含在内，只包含引用信息。' })
      } else if (result.reason === 'share-cancelled') {
        setBackupMessage({ type: 'warning', text: '备份文件已生成，但没有完成分享。需要保存时请重新导出。' })
      } else {
        setBackupMessage({ type: 'error', text: '备份导出失败，请重试。' })
      }
    } catch (error) {
      setBackupMessage({ type: 'error', text: `备份导出失败：${error?.message || '未知错误'}` })
    }
  }

  // 选择并导入备份文件
  const handleImportBackup = () => {
    setBackupMessage(null)
    Taro.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: async ({ tempFiles }) => {
        const file = tempFiles?.[0]
        if (!file) {
          setBackupMessage({ type: 'error', text: '未选择备份文件' })
          return
        }
        try {
          // 读取文件内容
          const fs = Taro.getFileSystemManager?.()
          const content = await new Promise((resolve, reject) => {
            if (fs?.readFile) fs.readFile({ filePath: file.path, encoding: 'utf8', success: (r) => resolve(r.data), fail: reject })
            else reject(new Error('当前环境不支持读取文件'))
          })

          // 先解析摘要，展示给用户确认
          const summary = parseBackupSummary(content)
          if (!summary.ok) {
            setBackupMessage({ type: 'error', text: summary.error || '备份文件无效' })
            return
          }

          // 展示摘要并请求用户确认
          const itemsText = summary.summary
            .filter((i) => i.count > 0)
            .map((i) => `${i.label}：${i.count} 条`)
            .join('，') || '空备份'
          const timeText = summary.exportedAt ? `备份时间：${summary.exportedAt}\n` : ''
          const versionText = `版本：v${summary.version}\n`

          Taro.showModal({
            title: '确认恢复备份',
            content: `${versionText}${timeText}包含数据：${itemsText}\n\n恢复将覆盖当前本机资料，照片和附件文件不会被恢复。是否继续？`,
            success: async ({ confirm }) => {
              if (!confirm) return
              const result = await restoreLocalData(content)
              await refreshLocalState()
              if (result.ok) {
                if (result.missingFiles?.length) {
                  setBackupMessage({
                    type: 'warning',
                    text: `记录已恢复，部分本地文件需要重新添加（${result.missingFiles.length} 个文件不在本机）`,
                  })
                } else {
                  setBackupMessage({ type: 'success', text: '备份已恢复，所有记录已写回本机' })
                }
              } else {
                setBackupMessage({ type: 'error', text: result.error || '恢复失败' })
              }
            },
          })
        } catch (error) {
          setBackupMessage({ type: 'error', text: `读取备份文件失败：${error?.message || '未知错误'}` })
        }
      },
      fail: () => {
        // 用户取消选择，不显示错误
      },
    })
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

  const getStepStatusClass = (step) => {
    const module = workflow.modules[step.id]
    if (!module?.hasData) return 'status-badge-pending'
    if (step.id === 'review' && workflow.review.isCurrent) return 'status-badge-done'
    if (step.id === 'checkin' && module.status === '已完成') return 'status-badge-done'
    if (step.id === 'evidence' && module.status === '已整理') return 'status-badge-done'
    return 'status-badge-warning'
  }

  const getStepStatusText = (step) => {
    const module = workflow.modules[step.id]
    if (!module?.hasData) return '未开始'
    return module.status
  }

  const getStepDetail = (step) => {
    const module = workflow.modules[step.id]
    if (module?.hasData && module.detail) return module.detail
    return step.description
  }

  return (
    <ScrollView className='home-page' scrollY enhanced showScrollbar={false}>
      <View className='home-header'>
        <View className='home-brand'>
          <Text className='home-brand-name'>租小审</Text>
          <Text className='home-brand-tag'>租房风险助手</Text>
        </View>
        <View className='home-status-badge'>
          <View className='status-dot' />
          <Text>资料本地保存</Text>
        </View>
      </View>

      <View className='home-current card'>
        <Text className='eyebrow'>当前步骤</Text>
        <Text className='current-title'>{currentStep.title}</Text>
        <Text className='body-text current-desc'>{currentStep.desc}</Text>
        <Button className='btn-primary current-action' onClick={() => openModule(currentStep.id)}>
          {currentStep.action}
        </Button>
      </View>

      <View className='home-steps card'>
        <Text className='section-title'>租房三步走</Text>
        <View className='steps-list'>
          {workflowSteps.map((step) => (
            <Button className='step-row' key={step.id} onClick={() => openModule(step.id)}>
              <View className='step-number'>
                <Text>{step.number}</Text>
              </View>
              <View className='step-body'>
                <View className='step-head'>
                  <View>
                    <Text className='step-phase'>{step.phase}</Text>
                    <Text className='step-name'>{step.title}</Text>
                  </View>
                  <Text className={`status-badge ${getStepStatusClass(step)}`}>{getStepStatusText(step)}</Text>
                </View>
                <Text className='step-detail'>{getStepDetail(step)}</Text>
              </View>
              <Text className='step-arrow' aria-hidden>›</Text>
            </Button>
          ))}
        </View>
      </View>

      <Button className='ai-entry card' onClick={() => openModule('ai')}>
        <View className='ai-icon'>AI</View>
        <View className='ai-body'>
          <Text className='card-title'>问租房 AI</Text>
          <Text className='body-text'>合同、押金、验房和退租问题直接问</Text>
        </View>
        <Text className='step-arrow' aria-hidden>›</Text>
      </Button>

      <View className='home-tools card'>
        <Text className='section-title'>更多工具</Text>
        <Button className='tool-row' onClick={() => openModule('subsidy')}>
          <View className='tool-icon'>
            <Text>补</Text>
          </View>
          <View className='tool-body'>
            <Text className='tool-name'>住房补贴匹配</Text>
            <Text className='body-text'>按城市和个人情况匹配政策线索</Text>
          </View>
          <Text className='step-arrow' aria-hidden>›</Text>
        </Button>
        <Button className='tool-row deposit-tool-row' aria-expanded={showDepositDetails} onClick={() => setShowDepositDetails((current) => !current)}>
          <View className='tool-icon deposit-icon'>
            <Text>押</Text>
          </View>
          <View className='tool-body'>
            <Text className='tool-name'>押金估算</Text>
            <Text className='body-text'>{hasDepositAmount ? `预计应退 ¥ ${result.estimatedReturn.toLocaleString()}` : '填写金额后计算应退押金'}</Text>
          </View>
          <Text className='step-arrow' aria-hidden>{showDepositDetails ? '⌃' : '⌄'}</Text>
        </Button>
        {showDepositDetails ? (
          <View className='deposit-details'>
            <View className='deposit-summary'>
              <View className='deposit-summary-item'>
                <Text className='caption'>预计应退</Text>
                <Text className='deposit-result'>¥ {result.estimatedReturn.toLocaleString()}</Text>
              </View>
              <View className='deposit-summary-item'>
                <Text className='caption'>预计扣款</Text>
                <Text className='deposit-deduction'>¥ {result.deduction.toLocaleString()}</Text>
              </View>
            </View>
            {result.warning ? <Text className='deposit-warning'>{result.warning}</Text> : null}
            <View className='deposit-grid'>
              {[
                ['depositAmount', '押金金额'],
                ['unpaidFees', '未结清费用'],
                ['repairCost', '维修扣款'],
                ['cleaningCost', '保洁扣款'],
              ].map(([key, label]) => (
                <View className='deposit-field' key={key}>
                  <Text className='field-label'>{label}</Text>
                  <Input aria-label={label} name={key} type='digit' value={deposit[key]} placeholder='0' onInput={(event) => updateDeposit(key, event.detail.value)} />
                </View>
              ))}
              <View className='deposit-field'>
                <Text className='field-label'>是否有票据</Text>
                <Picker aria-label='是否有票据' range={['无票据或未提供', '有有效票据']} value={deposit.hasVoucher === 'yes' ? 1 : 0} onChange={(event) => updateDeposit('hasVoucher', Number(event.detail.value) ? 'yes' : 'no')}>
                  <View className='picker-field'>{deposit.hasVoucher === 'yes' ? '有有效票据' : '无票据或未提供'}<Text>⌄</Text></View>
                </Picker>
              </View>
              <View className='deposit-field'>
                <Text className='field-label'>是否正常损耗</Text>
                <Picker aria-label='是否正常损耗' range={['是，仅正常使用损耗', '否，疑似人为损坏']} value={deposit.normalWear === 'yes' ? 0 : 1} onChange={(event) => updateDeposit('normalWear', Number(event.detail.value) ? 'no' : 'yes')}>
                  <View className='picker-field'>{deposit.normalWear === 'yes' ? '是，仅正常损耗' : '否，疑似人为损坏'}<Text>⌄</Text></View>
                </Picker>
              </View>
            </View>
          </View>
        ) : null}
      </View>

      <View className='home-data card'>
        <Button className='data-entry' aria-expanded={showDataDetails} onClick={() => setShowDataDetails((current) => !current)}>
          <View className='data-entry-body'>
            <Text className='card-title'>隐私与数据</Text>
            <Text className='caption'>管理本机数据 · {storageUsageLabel}</Text>
          </View>
          <Text className='data-toggle'>{showDataDetails ? '收起' : '展开'}</Text>
        </Button>
        {showDataDetails ? (
          <View className='data-details'>
            <Text className='body-text'>合同草稿、审查记录、AI 对话、验房记录、证据包和补贴资料仅保存在本机。建议先导出备份，再清除数据。</Text>
            <View className='data-usage-row'>
              <View className='data-usage-item'>
                <Text className='caption'>记录占用</Text>
                <Text className='data-usage-value'>{storageInfo ? formatLocalBytes(storageInfo.currentSize * 1024) : '读取失败'}</Text>
              </View>
              <View className='data-usage-item'>
                <Text className='caption'>持久文件</Text>
                <Text className='data-usage-value'>{dataUsage?.fileListAvailable ? `${dataUsage.savedFileCount} 个 · ${formatLocalBytes(dataUsage.savedFileBytes)}` : '读取失败'}</Text>
              </View>
            </View>
            {dataUsage?.unreferencedCount ? <Text className='cleanup-hint'>发现 {dataUsage.unreferencedCount} 个未引用文件，可安全清理 {formatLocalBytes(dataUsage.unreferencedBytes)}</Text> : null}
            <View className='data-actions'>
              <Button className='btn-secondary data-button' onClick={handleExportBackup}>导出备份</Button>
              <Button className='btn-secondary data-button' onClick={handleImportBackup}>导入备份</Button>
              <Button className='btn-secondary data-button' onClick={handleExportTxt}>导出数据 TXT</Button>
              <Button className='btn-secondary data-button' onClick={handleExportLocalData}>复制数据</Button>
              <Button className='btn-secondary data-button' disabled={!dataUsage?.unreferencedCount} onClick={handleCleanupUnusedFiles}>清理无用文件</Button>
              <Button className='btn-danger data-button' onClick={handleClearLocalData}>清除全部数据</Button>
            </View>
            {backupMessage ? (
              <Text className={`backup-message backup-message-${backupMessage.type}`}>{backupMessage.text}</Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <Text className='legal-note'>风险提示仅供租房自查参考，不构成法律意见。</Text>
    </ScrollView>
  )
}
