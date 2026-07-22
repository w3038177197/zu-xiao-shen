import { Component } from 'react'
import { View, Text, Textarea, Button, Image, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
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

export default class CheckinInspection extends Component {
  state = {
    inspectionState: createDefaultCheckinState(),
    currentRoom: 0,
    isSaving: false,
  }

  componentDidMount() {
    const inspectionState = loadCheckinInspectionState()
    this.setState({ inspectionState })
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
    photos.splice(photoIndex, 1)
    this.updateRecord(roomKey, itemKey, { photos })
  }

  handleReset = () => {
    Taro.showModal({
      title: '确认重置',
      content: '将清空所有填写的内容，是否继续？',
      success: (res) => {
        if (res.confirm) {
          this.setState({ inspectionState: createDefaultCheckinState(), currentRoom: 0 })
        }
      },
    })
  }

  handleExport = () => {
    const { inspectionState } = this.state
    const stats = getCheckinStats(inspectionState)
    const defects = getCheckinDefectRows(inspectionState)

    let report = `入住验房记录\n\n`
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
        report += `\n`
      })
      report += `\n`
    })

    if (defects.length) {
      report += `瑕疵清单：\n`
      defects.forEach((d) => {
        report += `  ${d.room}-${d.item}：${d.defect}（${d.note}；照片${d.photoCount}张）\n`
      })
    }

    Taro.setClipboardData({
      data: report,
      success: () => Taro.showToast({ title: '已复制到剪贴板', icon: 'success' }),
    })
  }

  render() {
    const { inspectionState, currentRoom, isSaving } = this.state
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
                          <Image src={photo} className='photo-image' mode='aspectFill' />
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
          <Button className='btn-export' onClick={this.handleExport}>
            复制报告
          </Button>
          <Button className='btn-reset' onClick={this.handleReset}>
            重置
          </Button>
        </View>
      </ScrollView>
    )
  }
}
