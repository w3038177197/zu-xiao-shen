import { Component } from 'react'
import { View, Text, Textarea, Button, Image, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { checkinRoomTypes } from '../../../../src/constants/checkinConfig.js'
import {
  ROOMS,
  INSPECTION_ITEMS,
  createDefaultCheckinState,
  getCheckinStats,
  getCheckinDefectRows,
  saveCheckinInspectionState,
  loadCheckinInspectionState,
} from '../../features/checkinInspection'
import './index.css'

const ROOM_TYPE_KEY = 'zu-xiao-shen-checkin-room-type'

export default class CheckinInspection extends Component {
  state = {
    inspectionState: createDefaultCheckinState(),
    currentRoom: 0,
    isSaving: false,
    roomType: 'studio',
    report: '',
  }

  componentDidMount() {
    const inspectionState = loadCheckinInspectionState()
    const roomType = Taro.getStorageSync(ROOM_TYPE_KEY) || 'studio'
    this.setState({ inspectionState, roomType })
  }

  onShareAppMessage() {
    return { title: '租小审：入住先留证，退租少扯皮', path: '/pages/checkin/index' }
  }

  setRoomType = (roomType) => {
    this.setState({ roomType })
    Taro.setStorageSync(ROOM_TYPE_KEY, roomType)
  }

  saveData = () => {
    this.setState({ isSaving: true })
    try {
      saveCheckinInspectionState(this.state.inspectionState)
      Taro.showToast({ title: '保存成功', icon: 'success' })
    } catch (error) {
      console.error('保存失败:', error)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      this.setState({ isSaving: false })
    }
  }

  updateRecord = (roomKey, itemKey, patch) => {
    this.setState((prev) => {
      const next = { ...prev.inspectionState }
      next[roomKey] = { ...next[roomKey] }
      next[roomKey][itemKey] = { ...next[roomKey][itemKey], ...patch }
      return { inspectionState: next }
    })
  }

  handleStatusChange = (roomKey, itemKey, status) => {
    this.updateRecord(roomKey, itemKey, { status })
  }

  handleNotesChange = (roomKey, itemKey, note) => {
    this.updateRecord(roomKey, itemKey, { note })
  }

  handleDefectChange = (roomKey, itemKey, defect) => {
    this.updateRecord(roomKey, itemKey, { defect })
  }

  handleTakePhoto = async (roomKey, itemKey) => {
    try {
      const res = await Taro.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['camera'],
      })
      
      // 持久化照片文件
      const savedPaths = await Promise.all(
        res.tempFilePaths.map(async (tempPath) => {
          try {
            const saveRes = await Taro.saveFile({ tempFilePath: tempPath })
            return saveRes.savedFilePath
          } catch (err) {
            console.error('保存文件失败:', err)
            return tempPath // 降级使用临时路径
          }
        })
      )
      
      this.updateRecord(roomKey, itemKey, {
        photos: [...(this.state.inspectionState[roomKey][itemKey].photos || []), ...savedPaths],
      })
    } catch (error) {
      console.error('拍照失败:', error)
    }
  }

  handleChoosePhoto = async (roomKey, itemKey) => {
    try {
      const res = await Taro.chooseImage({
        count: 9,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      })
      
      // 持久化照片文件
      const savedPaths = await Promise.all(
        res.tempFilePaths.map(async (tempPath) => {
          try {
            const saveRes = await Taro.saveFile({ tempFilePath: tempPath })
            return saveRes.savedFilePath
          } catch (err) {
            console.error('保存文件失败:', err)
            return tempPath // 降级使用临时路径
          }
        })
      )
      
      this.updateRecord(roomKey, itemKey, {
        photos: [...(this.state.inspectionState[roomKey][itemKey].photos || []), ...savedPaths],
      })
    } catch (error) {
      console.error('选择图片失败:', error)
    }
  }

  handleDeletePhoto = (roomKey, itemKey, photoIndex) => {
    const photos = [...(this.state.inspectionState[roomKey][itemKey].photos || [])]
    const [removed] = photos.splice(photoIndex, 1)
    if (removed?.startsWith('wxfile://')) Taro.removeSavedFile({ filePath: removed }).catch(() => {})
    this.updateRecord(roomKey, itemKey, { photos })
  }

  cleanupSavedPhotos = () => {
    Object.values(this.state.inspectionState).forEach((room) => {
      Object.values(room).forEach((record) => {
        record.photos?.filter((photo) => photo.startsWith('wxfile://')).forEach((filePath) => {
          Taro.removeSavedFile({ filePath }).catch(() => {})
        })
      })
    })
  }

  handleReset = () => {
    Taro.showModal({
      title: '确认重置',
      content: '将清空所有填写的内容，是否继续？',
      success: (res) => {
        if (res.confirm) {
          this.cleanupSavedPhotos()
          this.setState({ inspectionState: createDefaultCheckinState(), currentRoom: 0, report: '' })
          saveCheckinInspectionState(createDefaultCheckinState())
        }
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
      INSPECTION_ITEMS.forEach((item) => {
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

  handleExport = () => {
    Taro.setClipboardData({
      data: this.state.report || this.buildReport(),
      success: () => Taro.showToast({ title: '报告已复制', icon: 'success' }),
    })
  }

  handleCopyScript = () => {
    Taro.setClipboardData({ data: this.getLandlordScript(), success: () => Taro.showToast({ title: '话术已复制', icon: 'success' }) })
  }

  handlePreviewPhoto = (photos, index) => {
    Taro.previewImage({ current: photos[index], urls: photos }).catch(() => {})
  }

  render() {
    const { inspectionState, currentRoom, isSaving, roomType, report } = this.state
    const room = ROOMS[currentRoom]
    const stats = getCheckinStats(inspectionState)

    return (
      <ScrollView scrollY className='checkin-page'>
        <View className='checkin-hero'>
          <Text className='eyebrow'>入住验房</Text>
          <Text className='page-title'>入住先留证，退租少扯皮</Text>
          <Text className='page-copy'>按房间逐项记录设施状态、瑕疵描述和现场照片，形成可追溯的入住基线。</Text>
        </View>
        <View className='section'>
          <Text className='section-kicker'>选择房屋类型</Text>
          <View className='room-type-grid'>
            {checkinRoomTypes.map((item) => (
              <View key={item.value} className={`room-type-item ${roomType === item.value ? 'active' : ''}`} onClick={() => this.setRoomType(item.value)}>
                <Text className='room-type-label'>{item.label}</Text>
                <Text className='room-type-desc'>{item.desc}</Text>
              </View>
            ))}
          </View>

          <Text className='section-kicker'>本次验房进度</Text>
          <View className='checkin-stats'>
            <View><Text>{stats.percent}%</Text><Text>完成度</Text></View>
            <View><Text>{stats.checked}/{stats.total}</Text><Text>已检查</Text></View>
            <View><Text>{stats.defects}</Text><Text>瑕疵</Text></View>
            <View><Text>{stats.photos}</Text><Text>照片</Text></View>
          </View>

          <View className='room-tabs'>
            {ROOMS.map((r, index) => (
              <View
                key={r.key}
                className={`room-tab ${currentRoom === index ? 'active' : ''}`}
                onClick={() => this.setState({ currentRoom: index })}
              >
                {r.label}
              </View>
            ))}
          </View>

          <View className='inspection-list'>
            {INSPECTION_ITEMS.map((item) => {
              const record = inspectionState[room.key]?.[item.key] || { status: 'unchecked', defect: '', note: '', photos: [] }
              return (
                <View key={item.key} className='inspection-item'>
                  <Text className='item-name'>{item.label}</Text>

                  <View className='status-buttons'>
                    <View
                      className={`status-btn ${record.status === 'good' ? 'active good' : ''}`}
                      onClick={() => this.handleStatusChange(room.key, item.key, 'good')}
                    >
                      良好
                    </View>
                    <View
                      className={`status-btn ${record.status === 'defect' ? 'active poor' : ''}`}
                      onClick={() => this.handleStatusChange(room.key, item.key, 'defect')}
                    >
                      瑕疵
                    </View>
                  </View>

                  {record.status === 'defect' && (
                    <Textarea
                      className='item-notes'
                      placeholder='描述瑕疵情况'
                      value={record.defect}
                      onInput={(e) => this.handleDefectChange(room.key, item.key, e.detail.value)}
                      maxlength={200}
                    />
                  )}

                  <Textarea
                    className='item-notes'
                    placeholder='备注说明（可选）'
                    value={record.note}
                    onInput={(e) => this.handleNotesChange(room.key, item.key, e.detail.value)}
                    maxlength={200}
                  />

                  <View className='photo-section'>
                    <Text className='photo-label'>照片记录</Text>
                    <View className='photo-list'>
                      {(record.photos || []).map((photo, photoIndex) => (
                        <View key={photoIndex} className='photo-item'>
                          <Image src={photo} className='photo-image' mode='aspectFill' onClick={() => this.handlePreviewPhoto(record.photos, photoIndex)} />
                          <View
                            className='photo-delete'
                            onClick={() => this.handleDeletePhoto(room.key, item.key, photoIndex)}
                          >
                            ×
                          </View>
                        </View>
                      ))}
                      <View className='photo-actions'>
                        <View className='photo-btn' onClick={() => this.handleTakePhoto(room.key, item.key)}>
                          拍照
                        </View>
                        <View className='photo-btn' onClick={() => this.handleChoosePhoto(room.key, item.key)}>
                          相册
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        </View>

        <View className='action-buttons'>
          <Button className='btn-save' onClick={this.saveData} disabled={isSaving}>
            {isSaving ? '保存中...' : '保存'}
          </Button>
          <Button className='btn-export' onClick={this.handleGenerateReport}>
            生成报告
          </Button>
          <Button className='btn-reset' onClick={this.handleReset}>
            重置
          </Button>
        </View>

        {report ? <View className='section report-section'>
          <Text className='section-kicker'>验房报告</Text>
          <Textarea className='report-text' value={report} maxlength={-1} disabled />
          <View className='report-actions'>
            <Button className='btn-save' onClick={this.handleExport}>复制完整报告</Button>
            <Button className='btn-export' onClick={this.handleCopyScript}>复制房东话术</Button>
          </View>
        </View> : null}
      </ScrollView>
    )
  }
}
