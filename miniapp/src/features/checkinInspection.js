// 小程序版本 - 适配 Taro 存储 API
import Taro from '@tarojs/taro'

const STORAGE_KEY = 'checkin_inspection_data'

// 房间配置
export const ROOMS = [
  { key: 'livingRoom', label: '客厅' },
  { key: 'bedroom', label: '卧室' },
  { key: 'kitchen', label: '厨房' },
  { key: 'bathroom', label: '卫生间' },
  { key: 'balcony', label: '阳台' },
]

// 验房项目配置
export const INSPECTION_ITEMS = [
  { key: 'walls', label: '墙面' },
  { key: 'floor', label: '地面' },
  { key: 'ceiling', label: '天花板' },
  { key: 'doors', label: '门窗' },
  { key: 'furniture', label: '家具' },
  { key: 'appliances', label: '家电' },
  { key: 'plumbing', label: '水电' },
  { key: 'other', label: '其他' },
]

export function createEmptyCheckinRecord() {
  return { status: 'unchecked', defect: '', note: '', photos: [] }
}

export function normalizeCheckinRecord(record) {
  const safeRecord = record && typeof record === 'object' ? record : {}
  const photos = Array.isArray(safeRecord.photos)
    ? safeRecord.photos
        .filter((photo) => photo && typeof photo === 'string')
        .slice(0, 9)
    : []

  return {
    status: ['good', 'defect', 'unchecked'].includes(safeRecord.status) ? safeRecord.status : 'unchecked',
    defect: typeof safeRecord.defect === 'string' ? safeRecord.defect : '',
    note: typeof safeRecord.note === 'string' ? safeRecord.note : '',
    photos,
  }
}

export function createDefaultCheckinState() {
  const state = {}
  ROOMS.forEach((room) => {
    state[room.key] = {}
    INSPECTION_ITEMS.forEach((item) => {
      state[room.key][item.key] = createEmptyCheckinRecord()
    })
  })
  return state
}

export function normalizeCheckinState(savedState) {
  const state = createDefaultCheckinState()
  if (!savedState || typeof savedState !== 'object') return state

  ROOMS.forEach((room) => {
    INSPECTION_ITEMS.forEach((item) => {
      state[room.key][item.key] = normalizeCheckinRecord(savedState?.[room.key]?.[item.key])
    })
  })
  return state
}

export function getCheckinStats(checkinData) {
  const records = []
  ROOMS.forEach((room) => {
    INSPECTION_ITEMS.forEach((item) => {
      records.push(checkinData[room.key]?.[item.key])
    })
  })

  const checked = records.filter((record) => record?.status && record.status !== 'unchecked').length
  const defects = records.filter((record) => record?.status === 'defect').length
  const photos = records.reduce((total, record) => total + (Array.isArray(record?.photos) ? record.photos.length : 0), 0)
  const total = records.length

  return {
    checked,
    defects,
    photos,
    total,
    percent: total ? Math.round((checked / total) * 100) : 0,
  }
}

export function getCheckinDefectRows(checkinData) {
  const defects = []
  ROOMS.forEach((room) => {
    INSPECTION_ITEMS.forEach((item) => {
      const record = checkinData[room.key]?.[item.key]
      if (record?.status === 'defect') {
        const photoCount = Array.isArray(record.photos) ? record.photos.length : 0
        defects.push({
          room: room.label,
          item: item.label,
          defect: record.defect || '疑似瑕疵',
          note: record.note || (photoCount ? '照片已作为留证' : '待补充说明'),
          photoCount,
        })
      }
    })
  })
  return defects
}

export function loadCheckinInspectionState() {
  try {
    const saved = Taro.getStorageSync(STORAGE_KEY)
    return saved ? normalizeCheckinState(JSON.parse(saved)) : createDefaultCheckinState()
  } catch {
    return createDefaultCheckinState()
  }
}

export function saveCheckinInspectionState(state) {
  try {
    Taro.setStorageSync(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export function serializeCheckinInspectionState(state) {
  const normalized = normalizeCheckinState(state)
  return normalized
}

export function getCheckinContextSummary(checkinData) {
  const state = checkinData || createDefaultCheckinState()
  const stats = getCheckinStats(state)
  const defectRows = getCheckinDefectRows(state)

  return [
    `完成度：${stats.percent}%（${stats.checked}/${stats.total}）`,
    `疑似瑕疵：${stats.defects} 处`,
    `已上传验房照片：${stats.photos} 张`,
    `瑕疵摘要：${defectRows.length ? defectRows.slice(0, 6).map((row) => `${row.room}-${row.item}：${row.defect}（${row.note}；照片${row.photoCount}张）`).join('；') : '暂无明显瑕疵'}`,
  ].join('\n')
}
