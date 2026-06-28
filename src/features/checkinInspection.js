import { STORAGE_KEYS } from '../constants/appConfig.js'
import { CHECKIN_MAX_PHOTOS_PER_ITEM, checkinItems, checkinRooms } from '../constants/checkinConfig.js'

function createEmptyCheckinRecord() {
  return { status: 'unchecked', defect: '', note: '', photos: [] }
}

export function normalizeCheckinRecord(record) {
  const safeRecord = record && typeof record === 'object' ? record : {}
  const photos = Array.isArray(safeRecord.photos)
    ? safeRecord.photos
        .filter((photo) => photo && typeof photo.url === 'string')
        .slice(0, CHECKIN_MAX_PHOTOS_PER_ITEM)
        .map((photo) => ({
          id: photo.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: photo.name || '验房照片',
          url: photo.url,
          createdAt: photo.createdAt || '',
        }))
    : []

  return {
    status: ['good', 'defect', 'unchecked'].includes(safeRecord.status) ? safeRecord.status : 'unchecked',
    defect: typeof safeRecord.defect === 'string' ? safeRecord.defect : '',
    note: typeof safeRecord.note === 'string' ? safeRecord.note : '',
    photos,
  }
}

export function createDefaultCheckinState() {
  return Object.fromEntries(
    checkinRooms.map((room) => [
      room.key,
      Object.fromEntries(
        checkinItems.map((item) => [
          item.key,
          createEmptyCheckinRecord(),
        ]),
      ),
    ]),
  )
}

export function normalizeCheckinState(savedState) {
  return Object.fromEntries(
    checkinRooms.map((room) => [
      room.key,
      Object.fromEntries(
        checkinItems.map((item) => [
          item.key,
          normalizeCheckinRecord(savedState?.[room.key]?.[item.key]),
        ]),
      ),
    ]),
  )
}

export function getCheckinStats(checkinData) {
  const records = checkinRooms.flatMap((room) => checkinItems.map((item) => checkinData[room.key]?.[item.key]))
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
  return checkinRooms.flatMap((room) =>
    checkinItems
      .filter((item) => checkinData[room.key]?.[item.key]?.status === 'defect')
      .map((item) => {
        const record = checkinData[room.key][item.key]
        const photoCount = Array.isArray(record.photos) ? record.photos.length : 0
        return {
          room: room.label,
          item: item.label,
          defect: record.defect || '疑似瑕疵',
          note: record.note || (photoCount ? '照片已作为留证' : '待补充说明'),
          photoCount,
        }
      }),
  )
}

export function loadCheckinInspectionState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.checkinInspection)
    return saved ? normalizeCheckinState(JSON.parse(saved)) : createDefaultCheckinState()
  } catch {
    return createDefaultCheckinState()
  }
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
