import Taro from '@tarojs/taro'
import { STORAGE_KEYS } from '../constants/appConfig.js'
import { CHECKIN_MAX_PHOTOS_PER_ITEM, checkinItems, checkinRooms, getCheckinItems } from '../constants/checkinConfig.js'

const LEGACY_STORAGE_KEY = 'checkin_inspection_data'

// Keep the old names readable so an existing miniapp install does not lose its records.
const legacyRoomKeys = {
  living: ['livingRoom', 'bedroom', 'balcony'],
  kitchen: ['kitchen'],
  bathroom: ['bathroom'],
  meter: ['livingRoom', 'bedroom', 'kitchen', 'bathroom', 'balcony'],
}
const legacyItemKeys = {
  wall: ['walls', 'floor', 'ceiling'],
  doorWindow: ['doors'],
  appliance: ['furniture', 'appliances'],
  waterElectric: ['plumbing', 'other'],
}

export const ROOMS = checkinRooms
export const INSPECTION_ITEMS = checkinItems

export function createEmptyCheckinRecord() {
  return { status: 'unchecked', defect: '', note: '', photos: [] }
}

function normalizePhoto(photo) {
  if (typeof photo === 'string') return photo
  if (!photo || typeof photo !== 'object') return ''
  return typeof photo.url === 'string' && photo.url ? photo.url : typeof photo.storageId === 'string' ? photo.storageId : ''
}

export function normalizeCheckinRecord(record) {
  const safeRecord = record && typeof record === 'object' ? record : {}
  const photos = Array.isArray(safeRecord.photos)
    ? safeRecord.photos.map(normalizePhoto).filter(Boolean).slice(0, CHECKIN_MAX_PHOTOS_PER_ITEM)
    : []

  return {
    status: ['good', 'defect', 'unchecked'].includes(safeRecord.status) ? safeRecord.status : 'unchecked',
    defect: typeof safeRecord.defect === 'string' ? safeRecord.defect : '',
    note: typeof safeRecord.note === 'string' ? safeRecord.note : '',
    photos,
  }
}

function readLegacyRecord(savedState, roomKey, itemKey) {
  const records = (legacyRoomKeys[roomKey] || []).flatMap((oldRoom) =>
    (legacyItemKeys[itemKey] || []).map((oldItem) => savedState?.[oldRoom]?.[oldItem]),
  ).filter(Boolean)
  if (!records.length) return null

  return records.reduce((merged, record) => {
    const normalized = normalizeCheckinRecord(record)
    return {
      status: normalized.status !== 'unchecked' ? normalized.status : merged.status,
      defect: merged.defect || normalized.defect,
      note: merged.note || normalized.note,
      photos: [...merged.photos, ...normalized.photos].slice(0, CHECKIN_MAX_PHOTOS_PER_ITEM),
    }
  }, createEmptyCheckinRecord())
}

export function createDefaultCheckinState() {
  return Object.fromEntries(
    checkinRooms.map((room) => [
      room.key,
      Object.fromEntries(getCheckinItems(room.key).map((item) => [item.key, createEmptyCheckinRecord()])),
    ]),
  )
}

export function normalizeCheckinState(savedState) {
  const state = createDefaultCheckinState()
  if (!savedState || typeof savedState !== 'object') return state

  checkinRooms.forEach((room) => {
    getCheckinItems(room.key).forEach((item) => {
      const current = savedState?.[room.key]?.[item.key]
      state[room.key][item.key] = current ? normalizeCheckinRecord(current) : normalizeCheckinRecord(readLegacyRecord(savedState, room.key, item.key))
    })
  })
  return state
}

export function getCheckinStats(checkinData) {
  const records = checkinRooms.flatMap((room) => getCheckinItems(room.key).map((item) => checkinData?.[room.key]?.[item.key]))
  const checked = records.filter((record) => record?.status && record.status !== 'unchecked').length
  const defects = records.filter((record) => record?.status === 'defect').length
  const photos = records.reduce((total, record) => total + (Array.isArray(record?.photos) ? record.photos.length : 0), 0)
  const total = records.length

  return { checked, defects, photos, total, percent: total ? Math.round((checked / total) * 100) : 0 }
}

export function hasCheckinContent(checkinData) {
  return checkinRooms.some((room) => getCheckinItems(room.key).some((item) => {
    const record = checkinData?.[room.key]?.[item.key]
    return Boolean(
      (record?.status && record.status !== 'unchecked')
      || record?.defect?.trim()
      || record?.note?.trim()
      || (Array.isArray(record?.photos) && record.photos.length),
    )
  }))
}

export function getCheckinDefectRows(checkinData) {
  return checkinRooms.flatMap((room) => getCheckinItems(room.key)
    .filter((item) => checkinData?.[room.key]?.[item.key]?.status === 'defect')
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
    }))
}

function parseStoredValue(value) {
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) } catch { return null }
}

export function loadCheckinInspectionState() {
  try {
    const current = parseStoredValue(Taro.getStorageSync(STORAGE_KEYS.checkinInspection))
    const legacy = current || parseStoredValue(Taro.getStorageSync(LEGACY_STORAGE_KEY))
    return legacy ? normalizeCheckinState(legacy) : createDefaultCheckinState()
  } catch {
    return createDefaultCheckinState()
  }
}

export function saveCheckinInspectionState(state) {
  try {
    Taro.setStorageSync(STORAGE_KEYS.checkinInspection, JSON.stringify(normalizeCheckinState(state)))
    return true
  } catch {
    return false
  }
}

export function serializeCheckinInspectionState(state) {
  return normalizeCheckinState(state)
}

export function getCheckinContextSummary(checkinData) {
  const state = checkinData || createDefaultCheckinState()
  const stats = getCheckinStats(state)
  const defectRows = getCheckinDefectRows(state)
  const unclassifiedContent = !stats.checked && hasCheckinContent(state)
  return [
    `完成度：${stats.percent}%（${stats.checked}/${stats.total}）`,
    `疑似瑕疵：${stats.defects} 处`,
    `已上传验房照片：${stats.photos} 张`,
    `瑕疵摘要：${defectRows.length ? defectRows.slice(0, 6).map((row) => `${row.room}-${row.item}：${row.defect}（${row.note}；照片${row.photoCount}张）`).join('；') : unclassifiedContent ? '存在尚未标记检查状态的照片或备注，请人工确认' : '暂无明显瑕疵'}`,
  ].join('\n')
}
