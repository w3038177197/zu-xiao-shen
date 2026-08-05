import { Component } from 'react'
import { View, Text, Input, Textarea, Button, Picker, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import {
  evidenceGroupMeta,
  evidenceActions,
  evidenceToolTabs,
  createDefaultEvidencePackState,
  loadEvidencePackState,
  saveEvidencePackState,
  buildEvidenceCommunication,
  addAttachment,
  removeAttachment,
  getGroupAttachments,
  getAttachmentStats,
  importModuleReferences,
} from '../../features/evidencePack'
import {
  buildCheckinPhotoRefs,
  buildCheckinReportRef,
  buildContractTextRef,
  buildReviewReportRefs,
} from '../../features/evidenceImport'
import { createDebouncedSaver } from '../../utils/debounceSave'
import { copyText } from '../../utils/copyText'
import { deleteEvidenceAttachmentTransaction } from '../../utils/evidenceAttachmentTransactions'
import { getCapabilityFailure, showCapabilityFailure } from '../../utils/privacyAuth'
import { formatMessageBlocks, loadAllModuleContext } from '../../features/aiAssistant'
import { AI_TASK_PRESETS, buildRemoteAiPayload } from '../../features/remoteAi'
import { REMOTE_AI_CONFIG } from '../../constants/appConfig'
import { confirmRemoteConsent, getRemoteAiError, startRemoteAiRequest } from '../../utils/remoteAiRequest'
import {
  persistAttachment,
  removePersistedFile,
  pickImagesFromAlbum,
  pickFilesFromChat,
  previewImageAttachment,
  openFileAttachment,
  formatSize,
} from '../../utils/evidenceAttachments'
import { hasHouseSwitchedSince } from '../../features/houseProfile'
import './index.css'

const GROUPS = Object.entries(evidenceGroupMeta)
const today = new Date()
const TODAY = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const STEPS = [
  { key: 'basic', label: '1 基本资料' },
  { key: 'attachments', label: '2 证据附件' },
  { key: 'output', label: '3 说明与导出' },
]

export default class EvidencePack extends Component {
  autoSaver = createDebouncedSaver((state) => saveEvidencePackState(state))
  pendingAiRequest = null
  aiRunId = 0

  state = {
    packState: createDefaultEvidencePackState(),
    currentTab: 'deposit',
    currentGroup: 0,
    showExtraInfo: false,
    isSaving: false,
    isAttaching: false,
    isImporting: false,
    textPreview: null,
    activeStep: 'basic',
    operationNotice: '',
    isAiAnalyzing: false,
    aiCommunication: null,
    aiError: null,
  }

  componentDidMount() {
    const packState = loadEvidencePackState()
    this.setState({ packState })
    this.loadedAt = Date.now()
  }

  componentDidShow() {
    if (!hasHouseSwitchedSince(this.loadedAt || 0)) return
    this.autoSaver.cancel()
    this.aiRunId += 1
    this.pendingAiRequest?.cancel()
    const packState = loadEvidencePackState()
    this.setState({
      packState,
      textPreview: null,
      aiCommunication: null,
      aiError: null,
      isAiAnalyzing: false,
    })
    this.loadedAt = Date.now()
  }

  componentDidHide() {
    this.autoSaver.flush()
  }

  componentWillUnmount() {
    this.aiRunId += 1
    this.pendingAiRequest?.cancel()
    if (globalThis.__ZU_XIAO_SHEN_CLEARING__) this.autoSaver.cancel()
    else this.autoSaver.flush()
  }

  onShareAppMessage() {
    return { title: '租小审：退租前把证据整理成包', path: '/pages/evidence/index' }
  }

  saveData = () => {
    this.setState({ isSaving: true })
    this.autoSaver.cancel()
    const saved = saveEvidencePackState(this.state.packState)
    Taro.showToast({ title: saved ? '保存成功' : '保存失败，请清理空间后重试', icon: saved ? 'success' : 'none' })
    this.setState({ isSaving: false })
  }

  scheduleSave = () => {
    this.autoSaver.schedule(this.state.packState)
  }

  handleFormChange = (field, value) => {
    this.setState((prev) => ({
      packState: {
        ...prev.packState,
        formData: { ...prev.packState.formData, [field]: value },
      },
    }), this.scheduleSave)
  }

  handleEvidenceToggle = (group, index) => {
    this.setState((prev) => {
      const evidence = { ...prev.packState.evidence }
      evidence[group] = [...evidence[group]]
      evidence[group][index] = !evidence[group][index]
      return { packState: { ...prev.packState, evidence } }
    }, this.scheduleSave)
  }

  handleActionToggle = (index) => {
    this.setState((prev) => {
      const actions = [...prev.packState.actions]
      actions[index] = !actions[index]
      return { packState: { ...prev.packState, actions } }
    }, this.scheduleSave)
  }

  handleGenerateCommunication = () => {
    const { currentTab, packState } = this.state
    const text = buildEvidenceCommunication(currentTab, packState.formData)
    this.setState((prev) => ({
      packState: { ...prev.packState, communicationText: text },
      aiCommunication: null,
      aiError: null,
    }), this.scheduleSave)
    Taro.showToast({ title: '已生成沟通说明', icon: 'success' })
  }

  handleCommunicationChange = (value) => {
    this.setState((prev) => ({
      packState: { ...prev.packState, communicationText: value },
    }), this.scheduleSave)
  }

  applyAiCommunication = () => {
    const text = String(this.state.aiCommunication?.reply || '').trim().slice(0, 2000)
    if (!text) return
    this.setState((prev) => ({
      packState: { ...prev.packState, communicationText: text },
    }), this.scheduleSave)
    Taro.showToast({ title: '已采用 AI 版本', icon: 'success' })
  }

  handleAiEvidenceCheck = async (force = false) => {
    if (this.state.isAiAnalyzing) return
    const localDraft = String(this.state.packState.communicationText || '').trim()
      || buildEvidenceCommunication(this.state.currentTab, this.state.packState.formData)
    const nextPackState = { ...this.state.packState, communicationText: localDraft }
    this.autoSaver.cancel()
    if (!saveEvidencePackState(nextPackState)) {
      this.setState({ operationNotice: '资料保存失败，请清理本地空间后重试。' })
      return
    }

    const prompt = AI_TASK_PRESETS.evidence.prompt
    const context = loadAllModuleContext()
    const runId = ++this.aiRunId
    const showLocalDraft = (meta) => {
      if (runId !== this.aiRunId) return
      this.setState({ aiCommunication: { reply: localDraft, meta, citations: [] } })
    }

    this.setState({ packState: nextPackState, isAiAnalyzing: true, aiCommunication: null, aiError: null })
    if (!REMOTE_AI_CONFIG.enabled) {
      showLocalDraft('本地草稿')
      this.setState({ isAiAnalyzing: false })
      return
    }

    try {
      if (!await confirmRemoteConsent()) {
        showLocalDraft('本地草稿')
        return
      }
      if (runId !== this.aiRunId) return
      const payload = buildRemoteAiPayload({ prompt, context, selectedModules: ['evidence'] })
      const request = startRemoteAiRequest(payload, { force })
      this.pendingAiRequest = request
      const result = await request.promise
      if (runId !== this.aiRunId) return
      this.setState({ aiCommunication: { reply: result.reply, meta: 'AI生成 · 联网', citations: result.citations } })
    } catch (error) {
      const detail = getRemoteAiError(error)
      if (detail.cancelled || runId !== this.aiRunId) return
      showLocalDraft('本地草稿')
      this.setState({
        aiError: {
          message: detail.code === 'quota' ? '今日联网额度已用完，已保留本地草稿' : `${detail.message}，已保留本地草稿`,
          retryable: detail.retryable,
        },
      })
    } finally {
      if (runId === this.aiRunId) {
        this.pendingAiRequest = null
        this.setState({ isAiAnalyzing: false })
      }
    }
  }

  showImportFailure = (error) => {
    const message = error?.message || '导入失败，请重试'
    this.setState({ operationNotice: message })
    Taro.showToast({ title: message, icon: 'none' })
  }

  handleAddFromAlbum = async (group) => {
    if (this.state.isAttaching) return
    this.setState({ isAttaching: true })
    try {
      const files = await pickImagesFromAlbum(9)
      const attachments = await Promise.all(files.map(({ tempFilePath, fileName, size }) => (
        persistAttachment(tempFilePath, 'album', fileName, size)
      )))
      await this.commitAttachments(group, attachments)
    } catch (error) {
      const detail = getCapabilityFailure(error, 'album')
      if (!detail.cancelled) {
        this.setState({ operationNotice: detail.reason === 'api-failed' && error?.message ? `${error.message}。请检查相册权限或重新选择。` : '相册图片添加失败，请检查照片权限后重试。' })
        if (detail.reason === 'api-failed' && error?.message) {
          Taro.showToast({ title: error.message, icon: 'none' })
        } else {
          await showCapabilityFailure(error, 'album', '相册图片添加失败')
        }
      }
    } finally {
      this.setState({ isAttaching: false })
    }
  }

  handleAddFromChat = async (group) => {
    if (this.state.isAttaching) return
    this.setState({ isAttaching: true })
    try {
      const files = await pickFilesFromChat(9)
      const attachments = await Promise.all(files.map(({ tempFilePath, fileName, size }) => (
        persistAttachment(tempFilePath, 'chat', fileName, size)
      )))
      await this.commitAttachments(group, attachments)
    } catch (error) {
      const detail = getCapabilityFailure(error, 'chatFile')
      if (!detail.cancelled) {
        this.setState({ operationNotice: detail.reason === 'api-failed' && error?.message ? `${error.message}。请重新选择微信文件或最近文件。` : '文件添加失败：小程序只能从微信聊天、文件传输助手或最近文件中选择，请先把本机文件分享到微信后再选。' })
        if (detail.reason === 'api-failed' && error?.message) {
          Taro.showToast({ title: error.message, icon: 'none' })
        } else {
          await showCapabilityFailure(error, 'chatFile', '微信文件添加失败')
        }
      }
    } finally {
      this.setState({ isAttaching: false })
    }
  }

  // 添加附件后立即同步保存：失败则回滚 state 并清理已持久化的文件
  commitAttachment = async (group, attachment) => {
    await this.commitAttachments(group, [attachment])
  }

  // 批量添加附件只保存一次；Storage 失败时清理本次新增文件
  commitAttachments = async (group, attachments) => {
    const validAttachments = Array.isArray(attachments) ? attachments.filter(Boolean) : []
    if (!validAttachments.length) return
    const prev = this.state.packState
    const next = validAttachments.reduce((state, attachment) => addAttachment(state, group, attachment), prev)
    this.setState({ packState: next })
    this.autoSaver.cancel()
    const saved = saveEvidencePackState(next)
    if (!saved) {
      // 回滚到添加前的 state，并清理刚保存到小程序文件系统的附件
      this.setState({ packState: prev })
      await Promise.all(validAttachments.map((attachment) => removePersistedFile(attachment.localPath)))
      this.setState({ operationNotice: '附件保存失败：本地空间不足。请到首页清理无用文件后重试。' })
      Taro.showToast({ title: '附件保存失败，请清理空间后重试', icon: 'none' })
      return
    }
    this.setState({ operationNotice: '' })
    Taro.showToast({ title: validAttachments.length > 1 ? `已添加 ${validAttachments.length} 个附件` : '附件已添加', icon: 'success' })
  }

  handlePreviewAttachment = (attachment, group) => {
    if (!attachment) return
    if (attachment.fileType === 'image' && attachment.localPath) {
      const groupImages = getGroupAttachments(this.state.packState, group)
        .filter((item) => item.fileType === 'image' && item.localPath)
      previewImageAttachment(attachment, groupImages)
    } else if (attachment.textContent) {
      // 文本类模块引用：内容较长时复制到剪贴板，较短时弹窗展示
      const text = attachment.textContent
      if (text.length > 800) {
        copyText(text, '内容较长，已复制到剪贴板')
      } else {
        this.setState({ textPreview: { title: attachment.fileName, text } })
      }
    } else {
      openFileAttachment(attachment)
    }
  }

  closeTextPreview = () => {
    this.setState({ textPreview: null })
  }

  handleDeleteAttachment = (attachment, group) => {
    Taro.showModal({
      title: '删除附件',
      content: `确定删除「${attachment.fileName}」？删除后无法恢复。`,
      success: async ({ confirm }) => {
        if (!confirm) return
        const prev = this.state.packState
        const next = removeAttachment(prev, group, attachment.id)
        this.autoSaver.cancel()
        const result = await deleteEvidenceAttachmentTransaction({
          previousState: prev,
          nextState: next,
          attachment,
          saveState: saveEvidencePackState,
          removeFile: removePersistedFile,
        })
        if (result.reason === 'storage-failed') {
          this.setState({ operationNotice: '附件记录删除失败：本地空间不足。请清理空间后重试。' })
          Taro.showToast({ title: '附件记录删除失败，请清理空间后重试', icon: 'none' })
          return
        }
        if (result.ok) {
          this.setState({ packState: result.state })
          Taro.showToast({ title: result.reason === 'reference-removed' ? '已删除引用' : '已删除', icon: 'success' })
          return
        }
        if (result.reason === 'rollback-failed') {
          this.setState({ packState: result.state })
          Taro.showToast({ title: '记录已删除，文件未清理，可到首页清理', icon: 'none', duration: 3000 })
        } else {
          this.setState({ operationNotice: '文件删除失败，请保留当前页面并重新操作。' })
          Taro.showToast({ title: '文件删除失败，请重试', icon: 'none' })
        }
      },
    })
  }

  handleReset = () => {
    Taro.showModal({
      title: '确认重置',
      content: '将清空所有填写的内容和已上传附件，是否继续？',
      success: async (res) => {
        if (!res.confirm) return
        // 1. 保存 prevState（用于收集待删除附件）
        const prev = this.state.packState
        // 2. 创建 emptyState
        const emptyState = createDefaultEvidencePackState()
        // 3. 先调用 saveEvidencePackState(emptyState)
        this.autoSaver.cancel()
        const saved = saveEvidencePackState(emptyState)
        // 4. Storage 保存失败：停止操作，不删除任何文件，不更新 UI
        if (!saved) {
          Taro.showToast({ title: '重置失败，请清理空间后重试', icon: 'none' })
          return
        }
        // 5. Storage 保存成功后，再 Promise.all 删除附件文件（模块引用跳过，不删除原模块文件）
        const allAttachments = []
        Object.keys(evidenceGroupMeta).forEach((group) => {
          getGroupAttachments(prev, group).forEach((att) => {
            if (att.source !== 'module') {
              allAttachments.push(att)
            }
          })
        })
        const results = await Promise.all(
          allAttachments.map((att) => removePersistedFile(att.localPath))
        )
        const hasCleanupFailure = results.some((r) => !r.ok)
        // 6. 更新 UI 为 emptyState
        this.setState({ packState: emptyState, currentGroup: 0 })
        // 7. 部分文件清理失败时提示
        if (hasCleanupFailure) {
          Taro.showToast({ title: '记录已重置，部分本地文件清理失败', icon: 'none' })
        } else {
          Taro.showToast({ title: '已重置并保存', icon: 'success' })
        }
      },
    })
  }

  // 模块引用导入：读取其他模块的持久化数据生成引用，按来源和路径去重
  // 不复制或删除原模块的持久化文件，只把引用记录写入证据包
  handleImportCheckinPhotos = async () => {
    if (this.state.isImporting) return
    this.setState({ isImporting: true })
    try {
      const refs = buildCheckinPhotoRefs()
      if (!refs.length) {
        Taro.showToast({ title: '暂无可导入的验房照片', icon: 'none' })
        return
      }
      const group = 'photos'
      const { state: next, added, skipped } = importModuleReferences(this.state.packState, group, refs)
      if (added === 0) {
        Taro.showToast({ title: `${refs.length} 张验房照片均已导入，无新增`, icon: 'none' })
        return
      }
      this.autoSaver.cancel()
      const saved = saveEvidencePackState(next)
      if (!saved) {
        Taro.showToast({ title: '保存失败，请清理空间后重试', icon: 'none' })
        return
      }
      this.setState({ packState: next })
      Taro.showToast({ title: `已导入 ${added} 张验房照片${skipped ? `，${skipped} 张已存在` : ''}`, icon: 'none' })
    } catch (error) {
      this.showImportFailure(error)
    } finally {
      this.setState({ isImporting: false })
    }
  }

  handleImportCheckinReport = async () => {
    if (this.state.isImporting) return
    this.setState({ isImporting: true })
    try {
      const ref = buildCheckinReportRef()
      if (!ref) {
        Taro.showToast({ title: '暂无可导入的验房记录', icon: 'none' })
        return
      }
      const group = 'photos'
      const { state: next, added } = importModuleReferences(this.state.packState, group, [ref])
      if (added === 0) {
        Taro.showToast({ title: '验房报告已导入，如需更新请先删除原引用', icon: 'none' })
        return
      }
      this.autoSaver.cancel()
      const saved = saveEvidencePackState(next)
      if (!saved) {
        Taro.showToast({ title: '保存失败，请清理空间后重试', icon: 'none' })
        return
      }
      this.setState({ packState: next })
      Taro.showToast({ title: '已导入验房报告', icon: 'success' })
    } catch (error) {
      this.showImportFailure(error)
    } finally {
      this.setState({ isImporting: false })
    }
  }

  handleImportContractText = async () => {
    if (this.state.isImporting) return
    this.setState({ isImporting: true })
    try {
      const ref = buildContractTextRef()
      if (!ref) {
        Taro.showToast({ title: '合同正文为空，请先在合同审查页录入', icon: 'none' })
        return
      }
      const group = 'contract'
      const { state: next, added } = importModuleReferences(this.state.packState, group, [ref])
      if (added === 0) {
        Taro.showToast({ title: '合同正文已导入，如需更新请先删除原引用', icon: 'none' })
        return
      }
      this.autoSaver.cancel()
      const saved = saveEvidencePackState(next)
      if (!saved) {
        Taro.showToast({ title: '保存失败，请清理空间后重试', icon: 'none' })
        return
      }
      this.setState({ packState: next })
      Taro.showToast({ title: '已导入合同正文', icon: 'success' })
    } catch (error) {
      this.showImportFailure(error)
    } finally {
      this.setState({ isImporting: false })
    }
  }

  handleImportReviewReport = async () => {
    if (this.state.isImporting) return
    this.setState({ isImporting: true })
    try {
      const refs = buildReviewReportRefs()
      if (!refs.length) {
        Taro.showToast({ title: '暂无可导入的审查报告', icon: 'none' })
        return
      }
      const group = 'contract'
      const { state: next, added, skipped } = importModuleReferences(this.state.packState, group, refs)
      if (added === 0) {
        Taro.showToast({ title: `${refs.length} 份审查报告均已导入，无新增`, icon: 'none' })
        return
      }
      this.autoSaver.cancel()
      const saved = saveEvidencePackState(next)
      if (!saved) {
        Taro.showToast({ title: '保存失败，请清理空间后重试', icon: 'none' })
        return
      }
      this.setState({ packState: next })
      Taro.showToast({ title: `已导入 ${added} 份审查报告${skipped ? `，${skipped} 份已存在` : ''}`, icon: 'none' })
    } catch (error) {
      this.showImportFailure(error)
    } finally {
      this.setState({ isImporting: false })
    }
  }

  // 进度只统计真实附件数量和覆盖组数，不再用百分比进度条避免误导
  getProgress = () => {
    const stats = getAttachmentStats(this.state.packState)
    const totalGroups = GROUPS.length
    const collectedGroups = Object.values(stats.byGroup).filter((count) => count > 0).length
    return {
      totalGroups,
      collectedGroups,
      totalAttachments: stats.total,
    }
  }

  render() {
    const { packState, currentTab, currentGroup, isSaving, isAttaching, isImporting, textPreview, activeStep, operationNotice, isAiAnalyzing, aiCommunication, aiError } = this.state
    const { formData = {}, evidence = {}, actions = [], communicationText = '' } = packState || {}
    const progress = this.getProgress()
    const hasAiContext = progress.totalAttachments > 0
      || actions.some(Boolean)
      || Object.values(evidence).some((items) => Array.isArray(items) && items.some(Boolean))
      || Object.values(formData).some((value) => String(value || '').trim())
      || Boolean(String(communicationText || '').trim())
    const [activeGroupKey, activeGroupMeta] = GROUPS[currentGroup] || GROUPS[0]
    const activeEvidence = Array.isArray(evidence?.[activeGroupKey]) ? evidence[activeGroupKey] : []
    const activeGroupAttachments = getGroupAttachments(packState, activeGroupKey)
    const moduleSourceLabel = (att) => {
      if (att.source !== 'module') return att.source === 'album' ? '相册' : '微信文件'
      const map = { checkin: '验房模块', contract: '合同模块', review: '审查模块' }
      return `引用·${map[att.sourceModule] || att.sourceModule || '其他模块'}`
    }

    return (
      <ScrollView scrollY enableFlex className='evidence-page'>
        <View className='card evidence-hero'>
          <Text className='eyebrow'>退租证据包</Text>
          <Text className='page-title'>退租证据整理成包</Text>
          <Text className='body-text'>把合同、押金凭证、交接照片、费用票据和沟通记录串成一条证据链。</Text>
        </View>
        <View className='card progress-section'>
          <View className='progress-head'><Text className='progress-title'>证据收集进度</Text><Button className='reset-link' onClick={this.handleReset}>重置记录</Button></View>
          <Text className='progress-text'>
            已添加 {progress.totalAttachments} 个真实附件，覆盖 {progress.collectedGroups}/{progress.totalGroups} 类
          </Text>
        </View>
        <View className='step-tabs' aria-label='证据包步骤'>
          {STEPS.map((step) => <Button key={step.key} className={activeStep === step.key ? 'active' : ''} aria-current={activeStep === step.key ? 'step' : undefined} onClick={() => this.setState({ activeStep: step.key })}>{step.label}</Button>)}
        </View>
        {operationNotice ? <View className='operation-notice' aria-live='polite'><Text>{operationNotice}</Text><Button aria-label='关闭错误提示' onClick={() => this.setState({ operationNotice: '' })}>关闭</Button></View> : null}

        {activeStep === 'basic' ? <>
        <View className='card section'>
          <Text className='section-title'>基本信息</Text>

          <View className='form-item'>
            <Text className='form-label'>房屋地址</Text>
            <Input className='form-input' aria-label='房屋地址' name='address' placeholder='请输入房屋地址…' value={formData.address} onInput={(e) => this.handleFormChange('address', e.detail.value)} />
          </View>
          <View className='form-item'>
            <Text className='form-label'>押金金额（元）</Text>
            <Input className='form-input' aria-label='押金金额' name='deposit' type='digit' placeholder='请输入押金金额…' value={formData.deposit} onInput={(e) => this.handleFormChange('deposit', e.detail.value)} />
          </View>
          <View className='form-item'>
            <Text className='form-label'>月租金（元）</Text>
            <Input className='form-input' aria-label='月租金' name='monthlyRent' type='digit' placeholder='请输入月租金…' value={formData.monthlyRent} onInput={(e) => this.handleFormChange('monthlyRent', e.detail.value)} />
          </View>
          <Button className='extra-toggle' aria-expanded={this.state.showExtraInfo} onClick={() => this.setState(({ showExtraInfo }) => ({ showExtraInfo: !showExtraInfo }))}>
            <Text>补充交接信息（选填）</Text><Text>{this.state.showExtraInfo ? '收起 ⌃' : '展开 ⌄'}</Text>
          </Button>
          {this.state.showExtraInfo ? <View className='extra-fields'>
            <View className='form-item'>
              <Text className='form-label'>房东/中介</Text>
              <Input className='form-input' aria-label='房东或中介姓名' name='landlordName' placeholder='请输入房东或中介姓名…' value={formData.landlordName} onInput={(e) => this.handleFormChange('landlordName', e.detail.value)} />
            </View>
            <View className='form-item'>
              <Text className='form-label'>联系电话</Text>
              <Input className='form-input' aria-label='联系电话' name='landlordPhone' type='number' maxlength={11} placeholder='请输入联系电话…' value={formData.landlordPhone} onInput={(e) => this.handleFormChange('landlordPhone', e.detail.value)} />
            </View>
            {[['checkinDate', '入住日期'], ['checkoutDate', '退租日期'], ['handoverDate', '交接日期']].map(([field, label]) => (
              <View className='form-item' key={field}>
                <Text className='form-label'>{label}</Text>
                <Picker aria-label={label} mode='date' value={formData[field] || TODAY} onChange={(e) => this.handleFormChange(field, e.detail.value)}>
                  <View className={`form-input picker-input ${formData[field] ? '' : 'placeholder'}`}>{formData[field] || `请选择${label}`}<Text>⌄</Text></View>
                </Picker>
              </View>
            ))}
            <View className='form-item'>
              <Text className='form-label'>交接时间</Text>
              <Picker aria-label='交接时间' mode='time' value={formData.handoverTime || '09:00'} onChange={(e) => this.handleFormChange('handoverTime', e.detail.value)}>
                <View className={`form-input picker-input ${formData.handoverTime ? '' : 'placeholder'}`}>{formData.handoverTime || '请选择交接时间'}<Text>⌄</Text></View>
              </Picker>
            </View>
          </View> : null}
        </View>
        <View className='step-actions'><Button onClick={() => this.setState({ activeStep: 'attachments' })}>下一步：添加证据</Button></View>
        </> : null}

        {activeStep === 'attachments' ? <>
        <View className='card section'>
          <View className='section-head'>
            <View><Text className='eyebrow'>证据清单</Text><Text className='section-title'>证据与附件</Text></View>
            <Text className='group-attachment-count'>{activeGroupAttachments.length} 个附件</Text>
          </View>
          <View className='category-tabs'>
            {GROUPS.map(([key, meta], index) => {
              const count = getGroupAttachments(packState, key).length
              return (
                <Button
                  key={key}
                  className={`category-tab ${currentGroup === index ? 'active' : ''}`}
                  onClick={() => this.setState({ currentGroup: index })}
                >
                  {meta.title}{count > 0 ? ` (${count})` : ''}
                </Button>
              )
            })}
          </View>

          <View className='evidence-list'>
            {activeGroupMeta.items.map((item, itemIndex) => (
              <View key={itemIndex} className='evidence-item'>
                <Button className='item-header' aria-checked={Boolean(activeEvidence[itemIndex])} onClick={() => this.handleEvidenceToggle(activeGroupKey, itemIndex)}>
                  <View className={`checkbox ${activeEvidence[itemIndex] ? 'checked' : ''}`}>
                    {activeEvidence[itemIndex] && <Text>✓</Text>}
                  </View>
                  <Text className='item-name'>{item}</Text>
                </Button>
              </View>
            ))}
          </View>

          <View className='attachment-area'>
            <View className='attachment-head'>
              <Text className='attachment-title'>{activeGroupMeta.title}的附件</Text>
              <Text className='attachment-hint'>支持图片、PDF、Word、TXT，可从其他模块导入引用</Text>
            </View>
            {activeGroupAttachments.length ? (
              <View className='attachment-list'>
                {activeGroupAttachments.map((attachment) => (
                  <View key={attachment.id} className={`attachment-card ${attachment.source === 'module' ? 'is-module-ref' : ''}`}>
                    <View className='attachment-info'>
                      <Text className='attachment-name'>{attachment.fileType === 'image' ? '🖼' : '📄'} {attachment.fileName}</Text>
                      <Text className='attachment-meta'>{attachment.source === 'module' ? moduleSourceLabel(attachment) : `${formatSize(attachment.size)} · ${moduleSourceLabel(attachment)}`} · {attachment.createdAt.slice(0, 10)}</Text>
                    </View>
                    <View className='attachment-actions'>
                      <Button className='btn-preview' onClick={() => this.handlePreviewAttachment(attachment, activeGroupKey)}>{attachment.textContent ? '查看' : '预览'}</Button>
                      <Button className='btn-delete-attachment' onClick={() => this.handleDeleteAttachment(attachment, activeGroupKey)}>删除</Button>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text className='attachment-empty'>该组暂无附件，点击下方按钮添加或从其他模块导入。</Text>
            )}
            <View className='attachment-add-row'>
              <Button className='btn-add-album' disabled={isAttaching || isImporting} onClick={() => this.handleAddFromAlbum(activeGroupKey)}>{isAttaching ? '处理中…' : '从相册添加图片'}</Button>
              <Button className='btn-add-chat' disabled={isAttaching || isImporting} onClick={() => this.handleAddFromChat(activeGroupKey)}>{isAttaching ? '处理中…' : '选择文件/最近文件'}</Button>
            </View>
            <Text className='file-picker-hint'>手机本地文档需先分享到微信、文件传输助手或最近文件，再从这里选择；一次最多 9 个。</Text>
            {activeGroupKey === 'photos' ? (
              <View className='import-row'>
                <Button className='btn-import' disabled={isImporting} onClick={this.handleImportCheckinPhotos}>{isImporting ? '导入中…' : '导入验房照片'}</Button>
                <Button className='btn-import' disabled={isImporting} onClick={this.handleImportCheckinReport}>{isImporting ? '导入中…' : '导入验房报告'}</Button>
              </View>
            ) : null}
            {activeGroupKey === 'contract' ? (
              <View className='import-row'>
                <Button className='btn-import' disabled={isImporting} onClick={this.handleImportContractText}>{isImporting ? '导入中…' : '导入合同正文'}</Button>
                <Button className='btn-import' disabled={isImporting} onClick={this.handleImportReviewReport}>{isImporting ? '导入中…' : '导入审查报告'}</Button>
              </View>
            ) : null}
          </View>
        </View>
        <View className='step-actions'><Button className='secondary' onClick={() => this.setState({ activeStep: 'basic' })}>上一步</Button><Button onClick={() => this.setState({ activeStep: 'output' })}>下一步：生成说明</Button></View>
        </> : null}

        {activeStep === 'output' ? <>
        <View className='card section'>
          <Text className='section-title'>下一步行动</Text>
          {evidenceActions.map((action, index) => (
            <Button key={index} className='action-item' aria-checked={actions[index]} onClick={() => this.handleActionToggle(index)}>
              <View className={`checkbox ${actions[index] ? 'checked' : ''}`}>
                {actions[index] && <Text>✓</Text>}
              </View>
              <View className='action-text'>
                <Text className='item-name'>{action.title}</Text>
                <Text className='item-desc'>{action.desc}</Text>
              </View>
            </Button>
          ))}
        </View>

        <View className='card section'>
          <Text className='section-title'>沟通说明</Text>
          <View className='tab-row'>
            {evidenceToolTabs.map((tab) => (
              <Button
                key={tab.value}
                className={`tab-btn ${currentTab === tab.value ? 'active' : ''}`}
                onClick={() => this.setState({ currentTab: tab.value, aiCommunication: null, aiError: null })}
              >
                {tab.label}
              </Button>
            ))}
          </View>
          <Button className='btn-generate' onClick={this.handleGenerateCommunication}>
            生成简短沟通说明
          </Button>
          {communicationText ? (
            <Textarea className='communication-text' aria-label='沟通说明' adjustPosition cursorSpacing={20} value={communicationText} maxlength={2000} onInput={(e) => this.handleCommunicationChange(e.detail.value)} />
          ) : null}
            <Button className='ai-task-btn' disabled={!hasAiContext || isAiAnalyzing} onClick={() => this.handleAiEvidenceCheck()}>{isAiAnalyzing ? '正在优化沟通说明…' : hasAiContext ? '让 AI 优化这段话' : '暂无证据资料可优化'}</Button>
            {isAiAnalyzing || aiCommunication ? (
              <View className='evidence-ai-panel' aria-live='polite'>
                <View className='evidence-ai-head'><Text>优化结果</Text><Text>{isAiAnalyzing ? '生成中' : aiCommunication?.meta}</Text></View>
                {isAiAnalyzing ? <Text className='evidence-ai-loading'>正在结合当前证据摘要生成简短话术…</Text> : null}
                {aiCommunication ? <View className='evidence-ai-content'>{formatMessageBlocks(aiCommunication.reply).map((block, index) => <View className='evidence-ai-block' key={`${block.title}-${index}`}>{block.title ? <Text className='evidence-ai-title'>{block.title}</Text> : null}{block.lines.map((line, lineIndex) => <Text className='evidence-ai-line' userSelect key={`${index}-${lineIndex}`}>{line}</Text>)}</View>)}</View> : null}
                {aiCommunication ? <View className='evidence-ai-actions'><Button onClick={this.applyAiCommunication}>采用这版</Button><Button onClick={() => copyText(aiCommunication.reply, 'AI 话术已复制')}>复制</Button></View> : null}
                {aiError ? <View className='evidence-ai-error'><Text>{aiError.message}</Text>{aiError.retryable ? <Button disabled={isAiAnalyzing} onClick={() => this.handleAiEvidenceCheck(true)}>重试联网</Button> : null}</View> : null}
              </View>
            ) : null}
        </View>

        <View className='action-buttons'>
          <Button className='btn-save' onClick={this.saveData} disabled={isSaving}>
            {isSaving ? '保存中…' : '保存'}
          </Button>
        </View>
        </> : null}

        {textPreview ? (
          <View className='text-preview-mask'>
            <View className='text-preview-card'>
              <View className='text-preview-head'>
                <Text className='text-preview-title'>{textPreview.title}</Text>
                <Button className='text-preview-close' onClick={this.closeTextPreview}>关闭</Button>
              </View>
              <ScrollView scrollY className='text-preview-body'>
                <Text className='text-preview-content'>{textPreview.text}</Text>
              </ScrollView>
              <View className='text-preview-actions'>
                <Button className='btn-copy-text' onClick={() => copyText(textPreview.text, '已复制到剪贴板')}>复制全文</Button>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>
    )
  }
}
