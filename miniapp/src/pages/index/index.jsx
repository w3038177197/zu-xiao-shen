import { useMemo, useState } from 'react'
import { Button, Checkbox, CheckboxGroup, Input, Label, Picker, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { calculateDepositReturn } from '../../shared/money.js'
import { loadWorkflowContext } from '../../features/workflowContext'
import {
  cleanupUnreferencedSavedFiles,
  clearLocalData,
  formatLocalBytes,
  getLocalDataUsage,
  getLocalStorageInfo,
  buildLocalBackupArchive,
  parseBackupPackageSummary,
  parseBackupSummary,
  restoreBackupArchive,
  restoreLocalData,
} from '../../utils/localDataManager'
import {
  ensureDefaultHouse,
  loadHouses,
  getActiveHouseId,
  createHouse,
  renameHouse,
  deleteHouse,
  switchHouse,
  clearCurrentHouseData,
} from '../../features/houseProfile'
import { buildBusinessReportBundle, buildBusinessReportDocx, BUSINESS_REPORT_MODULES } from '../../utils/businessReportExport'
import { writeAndShare, writePackageFile } from '../../utils/evidencePackageExport'
import './index.css'

const workflowSteps = [
  { id: 'review', number: '1', phase: '签约前', title: '审合同', description: '把押金、涨租、维修等条款过一遍' },
  { id: 'checkin', number: '2', phase: '入住时', title: '入住留证', description: '按房间拍照，留下入住基线' },
  { id: 'evidence', number: '3', phase: '退租时', title: '退租证据', description: '整理照片、费用和沟通记录' },
]

const reportOptions = [
  { id: 'contract', title: '合同分析报告', description: '风险评分、原文证据、修改建议与合同正文' },
  { id: 'checkin', title: '入住验房报告', description: '空间检查、瑕疵分析、备注与验房照片' },
  { id: 'evidence', title: '证据包汇总', description: '基础信息、附件清单、待补材料与沟通说明' },
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
  const [showAdvancedData, setShowAdvancedData] = useState(false)
  const [selectedReports, setSelectedReports] = useState([...BUSINESS_REPORT_MODULES])
  const [storageInfo, setStorageInfo] = useState(getLocalStorageInfo)
  const [dataUsage, setDataUsage] = useState(null)
  const [workflow, setWorkflow] = useState(loadWorkflowContext)
  // 备份/恢复稳定提示（不只依赖 Toast）
  const [backupMessage, setBackupMessage] = useState(null)
  const [preparedExports, setPreparedExports] = useState({ report: null, allReports: null, backup: null })
  // 多房源档案状态
  const [houses, setHouses] = useState(() => {
    ensureDefaultHouse()
    return loadHouses()
  })
  const [activeHouseId, setActiveHouseIdState] = useState(getActiveHouseId)
  const [showHouseManager, setShowHouseManager] = useState(false)
  const [houseRenameId, setHouseRenameId] = useState(null)
  const [houseRenameValue, setHouseRenameValue] = useState('')
  const activeHouse = houses.find((item) => item.id === activeHouseId) || houses[0] || null
  const result = useMemo(() => calculateDeposit(deposit), [deposit])
  const hasDepositAmount = Number(deposit.depositAmount) > 0
  const storageUsageLabel = storageInfo
    ? `${formatLocalBytes(storageInfo.currentSize * 1024)} / ${formatLocalBytes(storageInfo.limit * 1024)}`
    : '本地存储'
  const currentStep = useMemo(() => getCurrentStep(workflow), [workflow])

  Taro.useShareAppMessage(() => ({ title: '租小审：租房全流程风险审查与证据助手', path: '/pages/index/index' }))

  const refreshLocalState = async () => {
    ensureDefaultHouse()
    setHouses(loadHouses())
    setActiveHouseIdState(getActiveHouseId())
    setWorkflow(loadWorkflowContext())
    setStorageInfo(getLocalStorageInfo())
    setDataUsage(await getLocalDataUsage())
  }

  Taro.useDidShow(() => {
    setPreparedExports({ report: null, allReports: null, backup: null })
    refreshLocalState()
  })

  const refreshHouses = () => {
    setHouses(loadHouses())
    setActiveHouseIdState(getActiveHouseId())
  }

  const handleCreateHouse = () => {
    Taro.showModal({
      title: '新建房源档案',
      editable: true,
      placeholderText: '例如：朝阳区A套、张先生房',
      success: ({ confirm, content }) => {
        if (!confirm) return
        const house = createHouse(content)
        refreshHouses()
        refreshLocalState()
        Taro.showToast({ title: `已创建并切换到「${house.name}」`, icon: 'none' })
      },
    })
  }

  const handleSwitchHouse = (houseId) => {
    if (houseId === activeHouseId) {
      setShowHouseManager(false)
      return
    }
    Taro.showModal({
      title: '切换房源档案',
      content: '切换前请确认当前页面的编辑已保存。切换后页面将刷新显示新房源的数据。',
      confirmText: '确认切换',
      cancelText: '取消',
      success: ({ confirm }) => {
        if (!confirm) return
        const result = switchHouse(houseId)
        if (!result.ok) {
          Taro.showToast({ title: '切换失败，请重试', icon: 'none' })
          return
        }
        refreshHouses()
        refreshLocalState()
        setShowHouseManager(false)
        Taro.showToast({ title: `已切换到「${result.house.name}」`, icon: 'none' })
      },
    })
  }

  const handleStartRenameHouse = (houseId, currentName) => {
    setHouseRenameId(houseId)
    setHouseRenameValue(currentName)
  }

  const handleConfirmRenameHouse = () => {
    if (!houseRenameId) return
    const result = renameHouse(houseRenameId, houseRenameValue)
    if (!result.ok) {
      Taro.showToast({ title: '重命名失败', icon: 'none' })
      return
    }
    setHouseRenameId(null)
    setHouseRenameValue('')
    refreshHouses()
    Taro.showToast({ title: '已重命名', icon: 'success' })
  }

  const handleCancelRenameHouse = () => {
    setHouseRenameId(null)
    setHouseRenameValue('')
  }

  const handleDeleteHouse = (houseId, houseName) => {
    Taro.showModal({
      title: '删除房源档案',
      content: `「${houseName}」的合同、验房、证据包、补贴和 AI 对话记录将被删除，照片文件会保留以便其他房源引用。删除后无法恢复，确认删除？`,
      confirmText: '确认删除',
      confirmColor: '#c9372d',
      cancelText: '取消',
      success: ({ confirm }) => {
        if (!confirm) return
        const result = deleteHouse(houseId)
        if (!result.ok) {
          Taro.showToast({ title: '删除失败', icon: 'none' })
          return
        }
        refreshHouses()
        refreshLocalState()
        Taro.showToast({ title: '已删除', icon: 'success' })
      },
    })
  }

  const handleClearCurrentHouse = () => {
    Taro.showModal({
      title: '清除当前房源数据',
      content: `将清除「${activeHouse?.name || '当前房源'}」的合同、验房、证据包、补贴和 AI 对话。其他房源不受影响。清除后无法恢复，确认清除？`,
      confirmText: '确认清除',
      confirmColor: '#c9372d',
      cancelText: '取消',
      success: ({ confirm }) => {
        if (!confirm) return
        const result = clearCurrentHouseData()
        if (!result.ok) {
          Taro.showToast({ title: '清除失败', icon: 'none' })
          return
        }
        refreshLocalState()
        Taro.showToast({ title: '当前房源已清空', icon: 'success' })
      },
    })
  }

  const openModule = (id) => {
    const path = id === 'review' ? '/pages/contract/index' : '/pages/' + id + '/index'
    if (id === 'ai') Taro.navigateTo({ url: path })
    else Taro.switchTab({ url: path })
  }

  const updateDeposit = (key, value) => {
    setDeposit((current) => ({ ...current, [key]: value }))
  }

  const handleReportSelection = (values) => {
    setSelectedReports(values)
    setPreparedExports((current) => ({ ...current, report: null }))
    setBackupMessage(null)
  }

  const handleExportReport = async (modules = selectedReports) => {
    if (!modules.length) {
      setBackupMessage({ type: 'warning', text: '请至少勾选一项报告内容。' })
      return
    }
    setBackupMessage(null)
    try {
      const report = await buildBusinessReportDocx({ selectedModules: modules })
      const result = await writePackageFile(report.fileName, report.bytes)
      if (!result.ok) {
        setBackupMessage({ type: 'error', text: 'Word 报告生成失败，请重试。' })
        return
      }
      const skipped = report.skippedPhotos ? `，${report.skippedPhotos} 张照片未能读取` : ''
      setPreparedExports((current) => ({
        ...current,
        report: {
          ...result,
          selectedModules: report.selectedModules,
          includedPhotos: report.includedPhotos,
          skippedPhotos: report.skippedPhotos,
        },
      }))
      setBackupMessage({
        type: skipped ? 'warning' : 'success',
        text: `Word 报告已生成，包含 ${report.selectedModules.length} 个模块、${report.includedPhotos} 张验房照片${skipped}。请点击“分享已生成 Word”。`,
      })
    } catch (error) {
      setBackupMessage({ type: 'error', text: `Word 报告生成失败：${error?.message || '未知错误'}` })
    }
  }

  const handleExportAllReports = async () => {
    setBackupMessage(null)
    try {
      const bundle = await buildBusinessReportBundle()
      const result = await writePackageFile(bundle.fileName, bundle.bytes)
      if (!result.ok) {
        setBackupMessage({ type: 'error', text: '全部 Word 报告生成失败，请重试。' })
        return
      }
      setPreparedExports((current) => ({ ...current, allReports: { ...result, reportCount: bundle.reports.length } }))
      const skipped = bundle.skippedPhotos ? `，${bundle.skippedPhotos} 张照片未能读取` : ''
      setBackupMessage({ type: skipped ? 'warning' : 'success', text: `已生成 ${bundle.reports.length} 份独立 Word 报告并装入 ZIP${skipped}。请点击“分享全部报告 ZIP”。` })
    } catch (error) {
      setBackupMessage({ type: 'error', text: `全部 Word 报告生成失败：${error?.message || '未知错误'}` })
    }
  }

  // 导出可用 Word 打开的整包备份，包含本机可读取的照片和附件
  const handleExportBackup = async () => {
    setBackupMessage(null)
    try {
      const archive = await buildLocalBackupArchive({ format: 'docx' })
      const result = await writePackageFile('租小审-恢复用备份.docx', archive.bytes)
      if (result.ok) {
        const skipped = archive.skipped?.length ? `，${archive.skipped.length} 个文件读取失败` : ''
        setPreparedExports((current) => ({ ...current, backup: { ...result, includedCount: archive.included.length, skippedCount: archive.skipped?.length || 0 } }))
        setBackupMessage({ type: skipped ? 'warning' : 'success', text: `恢复用备份已生成，包含 ${archive.included.length} 个照片/附件${skipped}。请点击“分享恢复用备份”。` })
      } else {
        setBackupMessage({ type: 'error', text: '备份导出失败，请重试。' })
      }
    } catch (error) {
      setBackupMessage({ type: 'error', text: `备份导出失败：${error?.message || '未知错误'}` })
    }
  }

  const handleSharePrepared = (type) => {
    const prepared = preparedExports[type]
    if (!prepared) return
    try {
      Taro.shareFileMessage({
        filePath: prepared.filePath,
        fileName: prepared.fileName,
        success: () => {
          setPreparedExports((current) => ({ ...current, [type]: null }))
          setBackupMessage({ type: 'success', text: type === 'report'
            ? 'Word 报告已打开微信分享。'
            : type === 'allReports'
              ? `全部报告 ZIP 已打开分享，内含 ${prepared.reportCount} 份 Word。`
              : `恢复用备份已打开分享，包含 ${prepared.includedCount} 个照片/附件。` })
        },
        fail: (error) => {
          const cancelled = /cancel/i.test(error?.errMsg || error?.message || '')
          setBackupMessage({ type: cancelled ? 'warning' : 'error', text: cancelled
            ? '已取消分享，文件仍在，可再次点击分享。'
            : '微信未能打开分享面板，请更新微信后重试。' })
        },
      })
    } catch {
      setBackupMessage({ type: 'error', text: '微信未能打开分享面板，请更新微信后重试。' })
    }
  }

  // 选择并导入 Word/ZIP 整包；兼容旧版 JSON 备份
  const handleImportBackup = () => {
    setBackupMessage(null)
    Taro.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['docx', 'zip', 'json'],
      success: async ({ tempFiles }) => {
        const file = tempFiles?.[0]
        if (!file) {
          setBackupMessage({ type: 'error', text: '未选择备份文件' })
          return
        }
        try {
          // 读取文件内容；ZIP 使用二进制，旧 JSON 使用 UTF-8
          const fs = Taro.getFileSystemManager?.()
          let isZip = /\.(zip|docx)$/i.test(file.name || file.path || '')
          const content = await new Promise((resolve, reject) => {
            if (fs?.readFile) fs.readFile({ filePath: file.path, ...(isZip ? {} : { encoding: 'utf8' }), success: (r) => resolve(r.data), fail: reject })
            else reject(new Error('当前环境不支持读取文件'))
          })
          const binaryHeader = content instanceof ArrayBuffer
            ? new Uint8Array(content)
            : ArrayBuffer.isView(content) ? new Uint8Array(content.buffer, content.byteOffset, content.byteLength) : null
          isZip = isZip || Boolean(binaryHeader && binaryHeader[0] === 0x50 && binaryHeader[1] === 0x4b)

          // 先解析摘要，展示给用户确认
          const summary = isZip ? parseBackupPackageSummary(content) : parseBackupSummary(typeof content === 'string' ? content : String(content))
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
          const fileText = isZip ? `\n文件：${summary.fileCount || 0} 个，缺失 ${summary.skippedFileCount || 0} 个` : '\n旧版 JSON 不包含照片和附件文件'

          Taro.showModal({
            title: '确认恢复备份',
            content: `${versionText}${timeText}包含数据：${itemsText}${fileText}\n\n恢复将写回当前本机资料。是否继续？`,
            success: async ({ confirm }) => {
              if (!confirm) return
              const result = isZip
                ? await restoreBackupArchive(content)
                : await restoreLocalData(typeof content === 'string' ? content : String(content))
              await refreshLocalState()
              if (result.ok) {
                if (result.missingFiles?.length) {
                  setBackupMessage({
                    type: 'warning',
                    text: `记录已恢复，${result.missingFiles.length} 个照片/附件未能恢复，需要重新添加`,
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

  const handleClearLocalData = async () => {
    let choice
    try {
      choice = await Taro.showActionSheet({
        alertText: '清除前是否保存当前工作状态？',
        itemList: ['先导出完整备份，再清除', '不备份，直接彻底清除'],
      })
    } catch {
      return
    }

    if (choice.tapIndex === 0) {
      setBackupMessage({ type: 'warning', text: '正在生成恢复用备份，请稍候。' })
      try {
        const archive = await buildLocalBackupArchive({ format: 'docx' })
        if (archive.skipped?.length) {
          const warning = await Taro.showModal({
            title: '备份中有文件缺失',
            content: `${archive.skipped.length} 个照片或附件无法读取。继续后这些文件不能从备份恢复，是否仍要保存其余数据？`,
            confirmText: '继续备份',
            cancelText: '停止清除',
          })
          if (!warning.confirm) {
            setBackupMessage({ type: 'warning', text: '已停止清除，请补齐缺失文件后重试。' })
            return
          }
        }
        const shared = await writeAndShare('租小审-恢复用备份.docx', archive.bytes)
        if (!shared.ok) {
          setBackupMessage({ type: 'error', text: '备份尚未成功分享，数据不会被清除。' })
          return
        }
        setBackupMessage({ type: 'success', text: `当前工作状态已分享保存，包含 ${archive.included.length} 个照片/附件。` })
      } catch (error) {
        setBackupMessage({ type: 'error', text: `备份失败，数据不会被清除：${error?.message || '未知错误'}` })
        return
      }
    }

    const confirmation = await Taro.showModal({
      title: choice.tapIndex === 0 ? '备份已保存，确认清除？' : '确认彻底清除？',
      content: '将删除合同原文与审查记录、AI 对话、验房记录和照片、证据包与附件、补贴资料、登录会话以及小程序生成的本地文件。清除后需通过恢复用备份才能找回。',
      confirmText: '彻底清除',
      confirmColor: '#c9372d',
      cancelText: '取消',
    })
    if (!confirmation.confirm) return

    globalThis.__ZU_XIAO_SHEN_CLEARING__ = true
    const result = await clearLocalData()
    setPreparedExports({ report: null, allReports: null, backup: null })
    setBackupMessage({
      type: result.ok ? 'success' : 'warning',
      text: result.ok ? '全部本机使用痕迹已清除。' : '记录已清除，但部分本地文件删除失败，请再次清除。',
    })
    await refreshLocalState()
    try {
      await Taro.reLaunch({ url: '/pages/index/index' })
    } finally {
      setTimeout(() => { globalThis.__ZU_XIAO_SHEN_CLEARING__ = false }, 0)
    }
    Taro.showToast({ title: result.ok ? '已彻底清除' : '部分文件未删除', icon: result.ok ? 'success' : 'none' })
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
          <Text>本机保存 · 脱敏 AI</Text>
        </View>
      </View>

      <View className='home-house card'>
        <View className='home-house-head'>
          <View className='home-house-info'>
            <Text className='eyebrow'>当前房源</Text>
            <Text className='home-house-name'>{activeHouse?.name || '默认房源'}</Text>
          </View>
          <Button
            className='btn-secondary house-switch-btn'
            aria-expanded={showHouseManager}
            onClick={() => setShowHouseManager((current) => !current)}
          >
            {showHouseManager ? '收起' : '管理'}
          </Button>
        </View>
        {showHouseManager ? (
          <View className='home-house-manager'>
            <View className='home-house-list'>
              {houses.map((house) => (
                <View
                  key={house.id}
                  className={`house-row ${house.id === activeHouseId ? 'house-row-active' : ''}`}
                >
                  {houseRenameId === house.id ? (
                    <View className='house-rename'>
                      <Input
                        className='house-rename-input'
                        value={houseRenameValue}
                        focus
                        onInput={(event) => setHouseRenameValue(event.detail.value)}
                      />
                      <Button className='btn-secondary house-rename-btn' onClick={handleConfirmRenameHouse}>保存</Button>
                      <Button className='btn-secondary house-rename-btn' onClick={handleCancelRenameHouse}>取消</Button>
                    </View>
                  ) : (
                    <Button className='house-row-main' onClick={() => handleSwitchHouse(house.id)}>
                      <Text className='house-row-name'>{house.name}</Text>
                      {house.id === activeHouseId ? <Text className='house-row-badge'>当前</Text> : null}
                    </Button>
                  )}
                  {houseRenameId === house.id ? null : (
                    <View className='house-row-actions'>
                      <Button className='btn-link house-action-btn' onClick={() => handleStartRenameHouse(house.id, house.name)}>重命名</Button>
                      <Button className='btn-link house-action-btn house-action-danger' onClick={() => handleDeleteHouse(house.id, house.name)}>删除</Button>
                    </View>
                  )}
                </View>
              ))}
            </View>
            <Button className='btn-primary house-create-btn' onClick={handleCreateHouse}>新建房源档案</Button>
          </View>
        ) : null}
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
            <Text className='card-title'>报告导出中心</Text>
            <Text className='caption'>按需组合并导出精排 Word</Text>
          </View>
          <Text className='data-toggle'>{showDataDetails ? '收起' : '展开'}</Text>
        </Button>
        {showDataDetails ? (
          <View className='data-details'>
            <Text className='body-text'>勾选导出会生成一份组合 Word；“一键导出全部”会生成 ZIP，内含合同分析、入住验房和证据包汇总三份独立 Word。</Text>
            <CheckboxGroup className='report-options' value={selectedReports} onChange={(event) => handleReportSelection(event.detail.value)}>
              {reportOptions.map((option) => {
                const module = workflow.modules[option.id === 'contract' ? 'review' : option.id]
                return (
                  <Label className={`report-option ${selectedReports.includes(option.id) ? 'report-option-selected' : ''}`} key={option.id}>
                    <Checkbox className='report-checkbox' value={option.id} checked={selectedReports.includes(option.id)} color='#1a6b50' />
                    <View className='report-option-body'>
                      <View className='report-option-head'>
                        <Text className='report-option-title'>{option.title}</Text>
                        <Text className={`status-badge ${module?.hasData ? 'status-badge-done' : 'status-badge-pending'}`}>{module?.hasData ? module.status : '暂无数据'}</Text>
                      </View>
                      <Text className='caption'>{option.description}</Text>
                    </View>
                  </Label>
                )
              })}
            </CheckboxGroup>
            <View className='report-actions'>
              <Button className='btn-primary report-button' disabled={!selectedReports.length} onClick={preparedExports.report ? () => handleSharePrepared('report') : () => handleExportReport()}>{preparedExports.report ? '分享已生成 Word' : `导出所选 Word（${selectedReports.length}）`}</Button>
              <Button className='btn-secondary report-button' onClick={preparedExports.allReports ? () => handleSharePrepared('allReports') : handleExportAllReports}>{preparedExports.allReports ? '分享全部报告 ZIP' : '一键导出全部'}</Button>
            </View>
            {backupMessage ? (
              <Text className={`backup-message backup-message-${backupMessage.type}`}>{backupMessage.text}</Text>
            ) : null}
            <Button className='advanced-data-entry' aria-expanded={showAdvancedData} onClick={() => setShowAdvancedData((current) => !current)}>
              <View>
                <Text className='advanced-data-title'>高级数据管理</Text>
                <Text className='caption'>恢复备份、存储清理与清除数据 · {storageUsageLabel}</Text>
              </View>
              <Text className='data-toggle'>{showAdvancedData ? '收起' : '展开'}</Text>
            </Button>
            {showAdvancedData ? (
              <View className='advanced-data-details'>
                <Text className='body-text'>恢复用备份用于换机或误删恢复，不是阅读报告。它会保留本机可读取的业务数据、照片和附件。</Text>
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
                  <Button className='btn-secondary data-button' onClick={preparedExports.backup ? () => handleSharePrepared('backup') : handleExportBackup}>{preparedExports.backup ? '分享恢复用备份' : '生成恢复用备份'}</Button>
                  <Button className='btn-secondary data-button' onClick={handleImportBackup}>导入恢复用备份</Button>
                  <Button className='btn-secondary data-button' disabled={!dataUsage?.unreferencedCount} onClick={handleCleanupUnusedFiles}>清理无用文件</Button>
                  <Button className='btn-danger data-button' onClick={handleClearCurrentHouse}>清除当前房源</Button>
                  <Button className='btn-danger data-button' onClick={handleClearLocalData}>清除全部数据</Button>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <Text className='legal-note'>风险提示仅供租房自查参考，不构成法律意见。</Text>
    </ScrollView>
  )
}
