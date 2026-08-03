import { Component } from 'react'
import { View, Text, Textarea, Button, Image, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { STORAGE_KEYS } from '../../constants/appConfig'
import {
  CHECKIN_MAX_PHOTOS_PER_ITEM,
  CHECKIN_MAX_PHOTO_BYTES,
  CHECKIN_PHOTO_MAX_EDGE,
  CHECKIN_PHOTO_QUALITY,
  checkinRoomTypes,
  getCheckinItems,
} from '../../constants/checkinConfig'
import {
  ROOMS,
  createDefaultCheckinState,
  getCheckinStats,
  getCheckinDefectRows,
  saveCheckinInspectionState,
  loadCheckinInspectionState,
} from '../../features/checkinInspection'
import { createDebouncedSaver } from '../../utils/debounceSave'
import { copyText } from '../../utils/copyText'
import { isUserCancellation, showCapabilityFailure } from '../../utils/privacyAuth'
import { removePersistedFile } from '../../utils/evidenceAttachments'
import { getEvidenceReferencedCheckinPhotoPaths } from '../../features/evidenceImport'
import {
  createCheckinStateWithoutPhotos,
  deleteCheckinPhoto,
  persistAddedCheckinPhotos,
  replaceCheckinStateAndRemovePhotos,
} from '../../utils/checkinPhotoTransactions'
import './index.css'

export default class CheckinInspection extends Component {
  autoSaver = createDebouncedSaver((state) => saveCheckinInspectionState(state))

  state = {
    inspectionState: createDefaultCheckinState(),
    currentRoom: 0,
    isSaving: false,
    roomType: 'studio',
    report: '',
    expandedItemKey: null,
    operationNotice: '',
    lastPhotoSource: '',
  }

  componentDidMount() {
    const inspectionState = loadCheckinInspectionState()
    const roomType = Taro.getStorageSync(STORAGE_KEYS.checkinRoomType) || 'studio'
    this.setState({ inspectionState, roomType })
  }

  componentDidHide() {
    this.autoSaver.flush()
  }

  componentWillUnmount() {
    if (globalThis.__ZU_XIAO_SHEN_CLEARING__) this.autoSaver.cancel()
    else this.autoSaver.flush()
  }

  onShareAppMessage() {
    return { title: '租小审：入住先留证，退租少扯皮', path: '/pages/checkin/index' }
  }

  setRoomType = (roomType) => {
    this.setState({ roomType, report: '' })
    Taro.setStorageSync(STORAGE_KEYS.checkinRoomType, roomType)
  }

  saveData = () => {
    this.setState({ isSaving: true })
    this.autoSaver.cancel()
    const saved = saveCheckinInspectionState(this.state.inspectionState)
    Taro.showToast({ title: saved ? '保存成功' : '保存失败，请清理空间后重试', icon: saved ? 'success' : 'none' })
    this.setState({ isSaving: false })
  }

  updateRecord = (roomKey, itemKey, patch) => {
    this.setState((prev) => {
      const next = { ...prev.inspectionState }
      next[roomKey] = { ...next[roomKey] }
      next[roomKey][itemKey] = { ...next[roomKey][itemKey], ...patch }
      return { inspectionState: next, report: '' }
    }, this.scheduleSave)
  }

  scheduleSave = () => {
    this.autoSaver.schedule(this.state.inspectionState)
  }

  handleStatusChange = (roomKey, itemKey, status) => {
    this.updateRecord(roomKey, itemKey, { status })
    this.setState({ expandedItemKey: status === 'defect' ? `${roomKey}-${itemKey}` : null })
  }

  handleNotesChange = (roomKey, itemKey, note) => {
    this.updateRecord(roomKey, itemKey, { note })
  }

  handleDefectChange = (roomKey, itemKey, defect) => {
    this.updateRecord(roomKey, itemKey, { defect })
  }

  savePhotoFile = async (tempPath) => {
    try {
      let sourcePath = tempPath
      const fileInfo = await Taro.getFileInfo({ filePath: tempPath }).catch(() => null)
      if (fileInfo?.size > CHECKIN_MAX_PHOTO_BYTES) {
        const compressed = await Taro.compressImage({
          src: tempPath,
          quality: Math.round(CHECKIN_PHOTO_QUALITY * 100),
          compressedWidth: CHECKIN_PHOTO_MAX_EDGE,
          compressedHeight: CHECKIN_PHOTO_MAX_EDGE,
        }).catch(() => null)
        if (compressed?.tempFilePath) sourcePath = compressed.tempFilePath
      }

      const finalInfo = await Taro.getFileInfo({ filePath: sourcePath }).catch(() => null)
      if (finalInfo?.size > CHECKIN_MAX_PHOTO_BYTES) return null
      const saveRes = await Taro.saveFile({ tempFilePath: sourcePath })
      const savedInfo = await Taro.getFileInfo({ filePath: saveRes.savedFilePath }).catch(() => null)
      if (savedInfo?.size > CHECKIN_MAX_PHOTO_BYTES) {
        Taro.removeSavedFile({ filePath: saveRes.savedFilePath }).catch(() => {})
        return null
      }
      return saveRes.savedFilePath
    } catch (err) {
      console.error('保存文件失败:', err)
      return null
    }
  }

  getRemainingPhotoCount = (roomKey, itemKey) => {
    const photos = this.state.inspectionState[roomKey]?.[itemKey]?.photos || []
    return Math.max(0, CHECKIN_MAX_PHOTOS_PER_ITEM - photos.length)
  }

  showPhotoFailure = (error, sourceType) => {
    if (isUserCancellation(error)) return
    showCapabilityFailure(error, sourceType, sourceType === 'camera' ? '拍照没有完成' : '相册选图没有完成')
  }

  retryLastPhoto = () => {
    const { lastPhotoSource, lastPhotoRoomKey, lastPhotoItemKey } = this.state
    this.setState({ operationNotice: '', lastPhotoSource: '', lastPhotoRoomKey: '', lastPhotoItemKey: '' })
    if (!lastPhotoSource || this.state.isSaving) return
    if (lastPhotoSource === 'camera') this.handleTakePhoto(lastPhotoRoomKey, lastPhotoItemKey)
    else if (lastPhotoSource === 'album') this.handleChoosePhoto(lastPhotoRoomKey, lastPhotoItemKey)
  }

  createSafePhotoRemover = () => {
    const evidencePaths = getEvidenceReferencedCheckinPhotoPaths()
    return async (filePath) => {
      if (evidencePaths.has(filePath)) return { ok: true, reason: 'evidence-reference' }
      return removePersistedFile(filePath)
    }
  }

  handleTakePhoto = async (roomKey, itemKey) => {
    if (!this.getRemainingPhotoCount(roomKey, itemKey)) {
      Taro.showToast({ title: `每项最多 ${CHECKIN_MAX_PHOTOS_PER_ITEM} 张照片`, icon: 'none' })
      return
    }
    try {
      const res = await Taro.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['camera'],
      })
      const savedPaths = (await Promise.all(res.tempFilePaths.map(this.savePhotoFile))).filter(Boolean)
      if (savedPaths.length === 0) {
        this.setState({ operationNotice: '照片未保存：本地空间不足或文件异常。请到首页清理无用文件后重试。', lastPhotoSource: 'camera', lastPhotoRoomKey: roomKey, lastPhotoItemKey: itemKey })
        Taro.showToast({ title: '本地存储已满或异常，照片未持久保存', icon: 'none', duration: 3000 })
        return
      }

      this.autoSaver.cancel()
      const result = await persistAddedCheckinPhotos({
        state: this.state.inspectionState,
        roomKey,
        itemKey,
        savedPaths,
        saveState: saveCheckinInspectionState,
        removeFile: removePersistedFile,
      })
      if (!result.ok) {
        this.setState({ operationNotice: '照片记录保存失败，照片未加入验房记录。请清理本地空间后重试。', lastPhotoSource: 'camera', lastPhotoRoomKey: roomKey, lastPhotoItemKey: itemKey })
        Taro.showToast({ title: result.cleanupFailed ? '记录保存失败，请到首页清理无用文件' : '记录保存失败，照片未添加', icon: 'none', duration: 3000 })
        return
      }
      this.setState({ inspectionState: result.state, report: '', operationNotice: '', lastPhotoSource: '', lastPhotoRoomKey: '', lastPhotoItemKey: '' })
    } catch (error) {
      if (!isUserCancellation(error)) this.setState({ operationNotice: '拍照失败：请检查相机权限后重新拍摄。', lastPhotoSource: 'camera', lastPhotoRoomKey: roomKey, lastPhotoItemKey: itemKey })
      this.showPhotoFailure(error, 'camera')
    }
  }

  handleChoosePhoto = async (roomKey, itemKey) => {
    const remaining = this.getRemainingPhotoCount(roomKey, itemKey)
    if (!remaining) {
      Taro.showToast({ title: `每项最多 ${CHECKIN_MAX_PHOTOS_PER_ITEM} 张照片`, icon: 'none' })
      return
    }
    try {
      const res = await Taro.chooseImage({
        count: remaining,
        sizeType: ['compressed'],
        sourceType: ['album'],
      })
      const savedPaths = (await Promise.all(res.tempFilePaths.map(this.savePhotoFile))).filter(Boolean)
      if (savedPaths.length === 0) {
        this.setState({ operationNotice: '照片未保存：本地空间不足或文件异常。请到首页清理无用文件后重试。', lastPhotoSource: 'album', lastPhotoRoomKey: roomKey, lastPhotoItemKey: itemKey })
        Taro.showToast({ title: '本地存储已满或异常，照片未持久保存', icon: 'none', duration: 3000 })
        return
      }
      if (savedPaths.length < res.tempFilePaths.length) {
        Taro.showToast({ title: '部分照片未持久保存', icon: 'none', duration: 3000 })
      }

      this.autoSaver.cancel()
      const result = await persistAddedCheckinPhotos({
        state: this.state.inspectionState,
        roomKey,
        itemKey,
        savedPaths,
        saveState: saveCheckinInspectionState,
        removeFile: removePersistedFile,
      })
      if (!result.ok) {
        this.setState({ operationNotice: '照片记录保存失败，照片未加入验房记录。请清理本地空间后重试。', lastPhotoSource: 'album', lastPhotoRoomKey: roomKey, lastPhotoItemKey: itemKey })
        Taro.showToast({ title: result.cleanupFailed ? '记录保存失败，请到首页清理无用文件' : '记录保存失败，照片未添加', icon: 'none', duration: 3000 })
        return
      }
      this.setState({ inspectionState: result.state, report: '', operationNotice: '', lastPhotoSource: '', lastPhotoRoomKey: '', lastPhotoItemKey: '' })
    } catch (error) {
      if (!isUserCancellation(error)) this.setState({ operationNotice: '相册读取失败：请检查照片权限后重新选择。', lastPhotoSource: 'album', lastPhotoRoomKey: roomKey, lastPhotoItemKey: itemKey })
      this.showPhotoFailure(error, 'album')
    }
  }

  handleDeletePhoto = (roomKey, itemKey, photoIndex) => {
    Taro.showModal({
      title: '删除这张照片？',
      content: '删除后无法恢复，其他验房记录不会受影响。',
      success: async ({ confirm }) => {
        if (!confirm) return
        this.autoSaver.cancel()
        const result = await deleteCheckinPhoto({
          state: this.state.inspectionState,
          roomKey,
          itemKey,
          photoIndex,
          saveState: saveCheckinInspectionState,
          removeFile: this.createSafePhotoRemover(),
        })
        if (result.ok) {
          this.setState({ inspectionState: result.state, report: '' })
          Taro.showToast({
            title: result.retainedFile ? '已从验房移除，证据包照片已保留' : '照片已删除',
            icon: result.retainedFile ? 'none' : 'success',
            duration: result.retainedFile ? 3000 : 1500,
          })
          return
        }
        if (result.reason === 'storage-failed') {
          Taro.showToast({ title: '照片记录删除失败，请清理空间后重试', icon: 'none' })
        } else if (result.reason === 'rollback-failed') {
          this.setState({ inspectionState: result.state, report: '' })
          Taro.showToast({ title: '记录已删除，文件清理失败，可到首页清理', icon: 'none', duration: 3000 })
        } else {
          Taro.showToast({ title: '文件删除失败，请重试', icon: 'none' })
        }
      },
    })
  }

  handleCleanupPhotos = () => {
    Taro.showModal({
      title: '清理照片',
      content: '将删除已保存的验房照片，文字记录会保留。是否继续？',
      success: async (res) => {
        if (!res.confirm) return
        this.autoSaver.cancel()
        const previousState = this.state.inspectionState
        const nextState = createCheckinStateWithoutPhotos(previousState)
        const result = await replaceCheckinStateAndRemovePhotos({
          previousState,
          nextState,
          saveState: saveCheckinInspectionState,
          removeFile: this.createSafePhotoRemover(),
        })
        if (!result.ok) {
          Taro.showToast({ title: '照片记录保存失败，未清理任何文件', icon: 'none' })
          return
        }
        this.setState({ inspectionState: result.state, report: '' })
        const title = result.cleanupFailed
          ? '记录已清理，部分本地文件清理失败'
          : result.retainedFiles
            ? `照片记录已清理，证据包引用保留 ${result.retainedFiles} 张`
            : '照片已清理'
        Taro.showToast({ title, icon: result.cleanupFailed || result.retainedFiles ? 'none' : 'success', duration: 3000 })
      },
    })
  }

  handleReset = () => {
    Taro.showModal({
      title: '确认重置',
      content: '将清空所有填写的内容，是否继续？',
      success: async (res) => {
        if (!res.confirm) return
        this.autoSaver.cancel()
        const previousState = this.state.inspectionState
        const nextState = createDefaultCheckinState()
        const result = await replaceCheckinStateAndRemovePhotos({
          previousState,
          nextState,
          saveState: saveCheckinInspectionState,
          removeFile: this.createSafePhotoRemover(),
        })
        if (!result.ok) {
          Taro.showToast({ title: '重置保存失败，原记录和照片均已保留', icon: 'none' })
          return
        }
        this.setState({ inspectionState: result.state, currentRoom: 0, report: '' })
        const title = result.cleanupFailed
          ? '记录已重置，部分本地文件清理失败'
          : result.retainedFiles
            ? `记录已重置，证据包引用保留 ${result.retainedFiles} 张`
            : '已重置并保存'
        Taro.showToast({ title, icon: result.cleanupFailed || result.retainedFiles ? 'none' : 'success', duration: 3000 })
      },
    })
  }

  getLandlordScript = () => {
    const defects = getCheckinDefectRows(this.state.inspectionState)
    const roomType = checkinRoomTypes.find((item) => item.value === this.state.roomType)?.label || '租住房屋'
    return defects.length
      ? `您好，我今天入住${roomType}时已按房间拍摄并整理验房记录。记录中标注了${defects.slice(0, 3).map((row) => row.defect).join('、')}等入住前已存在情况。麻烦确认这些问题为入住时现状，后续退租时不作为我的责任扣除押金。`
      : `您好，我今天入住${roomType}时已按房间拍摄入住验房照片，当前未发现明显瑕疵。我会保留全屋照片和水电燃气表读数，作为退租时双方核对的基准。麻烦确认收到，谢谢。`
  }

  buildReport = () => {
    const { inspectionState, roomType } = this.state
    const stats = getCheckinStats(inspectionState)
    const defects = getCheckinDefectRows(inspectionState)
    const roomTypeLabel = checkinRoomTypes.find((item) => item.value === roomType)?.label || '租住房屋'

    let report = `租小审入住验房报告\n`
    report += `生成时间：${new Date().toLocaleString('zh-CN', { hour12: false })}\n`
    report += `房屋类型：${roomTypeLabel}\n`
    report += `完成度：${stats.percent}%（${stats.checked}/${stats.total}）\n`
    report += `疑似瑕疵：${stats.defects} 处\n`
    report += `验房照片：${stats.photos} 张\n\n`

    ROOMS.forEach((room) => {
      report += `【${room.label}】\n`
      getCheckinItems(room.key).forEach((item) => {
        const record = inspectionState[room.key]?.[item.key]
        if (!record || record.status === 'unchecked') return
        const statusText = record.status === 'good' ? '良好' : '瑕疵'
        report += `  ${item.label}：${statusText}`
        if (record.defect) report += ` - ${record.defect}`
        if (record.note) report += `（${record.note}）`
        if (record.photos?.length) report += `［照片${record.photos.length}张］`
        report += `\n`
      })
      report += `\n`
    })

    report += `瑕疵清单：\n`
    report += defects.length
      ? defects.map((item) => `  ${item.room}-${item.item}：${item.defect}（${item.note}；照片${item.photoCount}张）`).join('\n')
      : '  本次验房未记录明显瑕疵。'
    report += `\n\n发给房东/中介的确认话术：\n${this.getLandlordScript()}\n\n`
    report += '免责声明：本报告仅供租房自查和双方协商参考，不构成法律意见。'
    return report
  }

  handleGenerateReport = () => {
    this.setState({ report: this.buildReport() })
    Taro.showToast({ title: '验房报告已生成', icon: 'success' })
  }

  handleCopyScript = () => {
    copyText(this.getLandlordScript(), '话术已复制')
  }

  handlePreviewPhoto = (photos, index) => {
    Taro.previewImage({ current: photos[index], urls: photos }).catch(() => {})
  }

  render() {
    const { inspectionState, currentRoom, isSaving, roomType, report, expandedItemKey, operationNotice, lastPhotoSource } = this.state
    const safeRoomIndex = ROOMS[currentRoom] ? currentRoom : 0
    const room = ROOMS[safeRoomIndex]
    const inspectionItems = getCheckinItems(room.key)
    const stats = getCheckinStats(inspectionState)

    return (
      <ScrollView scrollY enableFlex scrollWithAnimation scrollIntoView={report ? 'checkin-report' : ''} className='page checkin-page'>
        <View className='card hero-card'>
          <Text className='eyebrow'>入住验房</Text>
          <Text className='page-title'>入住先留证，退租少扯皮</Text>
          <Text className='body-text'>按房间逐项记录设施状态、瑕疵描述和现场照片，形成可追溯的入住基线。照片仅保存在本机。</Text>
        </View>

        {operationNotice ? (
          <View className='operation-notice' aria-live='polite'>
            <Text>{operationNotice}</Text>
            <View className='operation-notice-actions'>
              {lastPhotoSource ? <Button aria-label='重试上次拍照或选图' disabled={isSaving} onClick={this.retryLastPhoto}>重试</Button> : null}
              <Button aria-label='关闭错误提示' onClick={() => this.setState({ operationNotice: '' })}>关闭</Button>
            </View>
          </View>
        ) : null}

        <View className='card'>
          <Text className='section-title'>选择房屋类型</Text>
          <View className='room-type-grid'>
            {checkinRoomTypes.map((item) => (
              <Button key={item.value} className={`room-type-item ${roomType === item.value ? 'active' : ''}`} onClick={() => this.setRoomType(item.value)}>
                <Text className='room-type-label'>{item.label}</Text>
                <Text className='room-type-desc'>{item.desc}</Text>
              </Button>
            ))}
          </View>

          <View className='card-header section-kicker-row'>
            <Text className='section-title'>本次验房进度</Text>
            <Button className='btn-ghost reset-link' onClick={this.handleReset}>重置记录</Button>
          </View>
          <View className='checkin-stats'>
            <View><Text>{stats.percent}%</Text><Text>完成度</Text></View>
            <View><Text>{stats.checked}/{stats.total}</Text><Text>已检查</Text></View>
            <View><Text>{stats.defects}</Text><Text>瑕疵</Text></View>
            <View><Text>{stats.photos}</Text><Text>照片</Text></View>
          </View>
          {stats.photos > 0 ? (
            <View className='storage-tools'>
              <Text className={`storage-hint ${stats.photos > 50 ? 'warning' : ''}`}>
                已保存 {stats.photos} 张验房照片，建议交接完成后清理本地空间
              </Text>
              <Button className='btn-secondary btn-clear-photos' onClick={this.handleCleanupPhotos}>
                只清照片
              </Button>
            </View>
          ) : null}

          <View className='room-tabs'>
            {ROOMS.map((r, index) => (
              <Button
                key={r.key}
                className={`room-tab ${safeRoomIndex === index ? 'active' : ''}`}
                onClick={() => this.setState({ currentRoom: index, expandedItemKey: null })}
              >
                {r.label}
              </Button>
            ))}
          </View>

          <View className='inspection-list'>
            {inspectionItems.map((item) => {
              const record = inspectionState[room.key]?.[item.key] || { status: 'unchecked', defect: '', note: '', photos: [] }
              const itemKey = `${room.key}-${item.key}`
              const expanded = expandedItemKey === itemKey
              return (
                <View key={item.key} className={`inspection-item ${expanded ? '' : 'collapsed'}`}>
                  <View className='inspection-head'>
                    <View>
                      <Text className='card-title item-name'>{item.label}</Text>
                      <Text className='caption item-desc'>{item.desc}</Text>
                    </View>
                    {!expanded ? <Button className='btn-secondary item-expand' onClick={() => this.setState({ expandedItemKey: itemKey })}>{record.status === 'unchecked' ? '开始记录' : '补充记录'}</Button> : null}
                  </View>

                  {!expanded ? (
                    <Text className={`item-summary ${record.status}`}>{record.status === 'unchecked' ? '未检查' : `${record.status === 'good' ? '良好' : '瑕疵'} · ${(record.photos || []).length} 张照片${record.note ? ' · 已备注' : ''}`}</Text>
                  ) : (
                    <>
                      <View className='status-buttons'>
                        <Button
                          className={`status-btn ${record.status === 'good' ? 'active good' : ''}`}
                          onClick={() => this.handleStatusChange(room.key, item.key, 'good')}
                        >
                          良好
                        </Button>
                        <Button
                          className={`status-btn ${record.status === 'defect' ? 'active poor' : ''}`}
                          onClick={() => this.handleStatusChange(room.key, item.key, 'defect')}
                        >
                          瑕疵
                        </Button>
                      </View>

                      {record.status === 'defect' && (
                        <Textarea
                          className='item-notes'
                          aria-label={`${room.label}${item.label}瑕疵描述`}
                          name={`${room.key}-${item.key}-defect`}
                          adjustPosition
                          cursorSpacing={20}
                          placeholder='描述瑕疵情况…'
                          value={record.defect}
                          onInput={(e) => this.handleDefectChange(room.key, item.key, e.detail.value)}
                          maxlength={200}
                        />
                      )}

                      {record.status !== 'unchecked' ? (
                        <>
                          <Textarea
                            className='item-notes'
                            aria-label={`${room.label}${item.label}备注`}
                            name={`${room.key}-${item.key}-note`}
                            adjustPosition
                            cursorSpacing={20}
                            placeholder='备注说明（可选）…'
                            value={record.note}
                            onInput={(e) => this.handleNotesChange(room.key, item.key, e.detail.value)}
                            maxlength={200}
                          />

                          <View className='photo-section'>
                            <Text className='photo-label'>照片记录（{(record.photos || []).length}/{CHECKIN_MAX_PHOTOS_PER_ITEM}）</Text>
                            <View className='photo-list'>
                              {(record.photos || []).map((photo, photoIndex) => (
                                <View key={photoIndex} className='photo-item'>
                                  <Button className='photo-preview' aria-label={`预览第 ${photoIndex + 1} 张照片`} onClick={() => this.handlePreviewPhoto(record.photos, photoIndex)}>
                                    <Image src={photo} className='photo-image' mode='aspectFill' lazyLoad />
                                  </Button>
                                  <Button
                                    className='photo-delete'
                                    aria-label={`删除第 ${photoIndex + 1} 张照片`}
                                    onClick={() => this.handleDeletePhoto(room.key, item.key, photoIndex)}
                                  >
                                    ×
                                  </Button>
                                </View>
                              ))}
                              {(record.photos || []).length < CHECKIN_MAX_PHOTOS_PER_ITEM ? (
                                <View className='photo-actions'>
                                  <Button className='btn-secondary photo-btn' onClick={() => this.handleTakePhoto(room.key, item.key)}>拍照</Button>
                                  <Button className='btn-secondary photo-btn' onClick={() => this.handleChoosePhoto(room.key, item.key)}>相册</Button>
                                </View>
                              ) : <Text className='photo-limit-hint'>已达到单项照片上限</Text>}
                            </View>
                          </View>
                        </>
                      ) : <Text className='unchecked-hint'>先选择“良好”或“瑕疵”，再补充备注和照片</Text>}
                      {record.status !== 'unchecked' ? <Button className='btn-secondary item-collapse' onClick={() => this.setState({ expandedItemKey: null })}>完成并收起</Button> : null}
                    </>
                  )}
                </View>
              )
            })}
          </View>
        </View>

        <View className='sticky-actions'>
          <Button className='btn-secondary' onClick={this.saveData} disabled={isSaving}>
            {isSaving ? '保存中…' : '保存'}
          </Button>
          <Button className='btn-primary' onClick={this.handleGenerateReport}>
            生成报告
          </Button>
        </View>

        {report ? (
          <View id='checkin-report' className='card report-section'>
            <Text className='section-title'>验房报告</Text>
            <Textarea className='report-text' aria-label='验房报告' value={report} maxlength={-1} disabled />
            <View className='report-actions'>
              <Button className='btn-secondary' onClick={this.handleCopyScript}>复制房东话术</Button>
            </View>
          </View>
        ) : null}
      </ScrollView>
    )
  }
}
