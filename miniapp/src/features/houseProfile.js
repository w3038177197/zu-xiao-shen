import Taro from '@tarojs/taro'
import { STORAGE_KEYS } from '../constants/appConfig.js'

// 多房源档案 MVP：
// - 扁平 storage key（contractDraft 等）始终代表"当前活跃房源"的数据
// - houses 列表保存所有房源元信息
// - houseData:{id} 保存非当前房源的完整业务数据快照
// - 切换房源 = 当前扁平数据 → 旧房源快照；新房源快照 → 扁平 key
// - 子页面零侵入，仍读扁平 key

// 与 localDataManager.DATA_KEYS 保持一致（业务数据 key 名）
const HOUSE_DATA_KEYS = [
  'contractDraft',
  'reviewHistory',
  'reviewProfile',
  'aiChat',
  'checkinInspection',
  'evidencePack',
  'subsidyMatcher',
  'checkinRoomType',
]

function houseDataKey(houseId) {
  return `${STORAGE_KEYS.houseDataPrefix}${houseId}`
}

function readJson(key, fallback) {
  try {
    const raw = Taro.getStorageSync(key)
    return raw === '' || raw === null || raw === undefined ? fallback : raw
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  try {
    Taro.setStorageSync(key, value)
    return true
  } catch (error) {
    console.warn('[houseProfile] storage 写入失败', { key, error: String(error?.message || error).slice(0, 100) })
    return false
  }
}

function removeKey(key) {
  try {
    Taro.removeStorageSync(key)
  } catch {
    // 忽略：key 不存在或已删除
  }
}

function generateHouseId() {
  return `house-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function nowIso() {
  return new Date().toISOString()
}

export function loadHouses() {
  const list = readJson(STORAGE_KEYS.houses, [])
  if (!Array.isArray(list)) return []
  return list.filter((item) => item && typeof item.id === 'string')
}

export function saveHouses(list) {
  writeJson(STORAGE_KEYS.houses, list)
}

export function getActiveHouseId() {
  return String(readJson(STORAGE_KEYS.activeHouse, '') || '')
}

export function setActiveHouseId(houseId) {
  writeJson(STORAGE_KEYS.activeHouse, houseId)
}

export function getActiveHouse() {
  const id = getActiveHouseId()
  if (!id) return null
  return loadHouses().find((item) => item.id === id) || null
}

// 读取当前扁平 key 的全部业务数据，组装为快照对象
export function captureCurrentDataSnapshot() {
  const snapshot = {}
  for (const keyName of HOUSE_DATA_KEYS) {
    try {
      snapshot[keyName] = Taro.getStorageSync(STORAGE_KEYS[keyName])
    } catch {
      snapshot[keyName] = null
    }
  }
  return snapshot
}

// 把快照对象写回扁平 key（覆盖当前数据）。返回写入失败的 key 数量。
export function restoreDataSnapshot(snapshot) {
  let failed = 0
  for (const keyName of HOUSE_DATA_KEYS) {
    const storageKey = STORAGE_KEYS[keyName]
    const value = snapshot?.[keyName]
    try {
      if (value === null || value === undefined || value === '') {
        Taro.removeStorageSync(storageKey)
      } else {
        Taro.setStorageSync(storageKey, value)
      }
    } catch {
      failed += 1
    }
  }
  return failed
}

// 读取某个房源的快照（非当前房源）
function loadHouseSnapshot(houseId) {
  return readJson(houseDataKey(houseId), null)
}

// 保存某个房源的快照
function saveHouseSnapshot(houseId, snapshot) {
  writeJson(houseDataKey(houseId), snapshot)
}

function removeHouseSnapshot(houseId) {
  removeKey(houseDataKey(houseId))
}

// 首次进入迁移：如果没有 houses 列表，把当前扁平数据归属到"默认房源"
// 不移动数据，只创建元信息。返回当前活跃房源。
export function ensureDefaultHouse() {
  const existing = loadHouses()
  if (existing.length > 0) {
    const activeId = getActiveHouseId()
    if (activeId && existing.some((item) => item.id === activeId)) {
      return existing.find((item) => item.id === activeId)
    }
    // 有列表但无有效 active，切到第一个
    const first = existing[0]
    setActiveHouseId(first.id)
    return first
  }
  // 首次迁移：创建默认房源，当前扁平数据自然归属于它（不写快照，避免冗余复制）
  const now = nowIso()
  const defaultHouse = {
    id: generateHouseId(),
    name: '默认房源',
    createdAt: now,
    updatedAt: now,
  }
  saveHouses([defaultHouse])
  setActiveHouseId(defaultHouse.id)
  return defaultHouse
}

// 创建新房源并切换为当前
export function createHouse(name) {
  const trimmed = String(name || '').trim()
  const houseName = trimmed || `房源 ${loadHouses().length + 1}`
  const now = nowIso()
  const house = {
    id: generateHouseId(),
    name: houseName,
    createdAt: now,
    updatedAt: now,
  }
  const list = loadHouses()
  // 先保存当前数据到旧房源快照
  const activeId = getActiveHouseId()
  if (activeId) {
    saveHouseSnapshot(activeId, captureCurrentDataSnapshot())
    const oldIndex = list.findIndex((item) => item.id === activeId)
    if (oldIndex >= 0) {
      list[oldIndex] = { ...list[oldIndex], updatedAt: now }
    }
  }
  // 新房源：空快照
  saveHouseSnapshot(house.id, {})
  list.push(house)
  saveHouses(list)
  // 清空扁平 key（新房源无数据）
  restoreDataSnapshot({})
  setActiveHouseId(house.id)
  markHouseSwitched()
  return house
}

// 重命名房源
export function renameHouse(houseId, newName) {
  const trimmed = String(newName || '').trim()
  if (!trimmed) {
    return { ok: false, reason: 'empty-name' }
  }
  const list = loadHouses()
  const index = list.findIndex((item) => item.id === houseId)
  if (index < 0) {
    return { ok: false, reason: 'not-found' }
  }
  list[index] = { ...list[index], name: trimmed, updatedAt: nowIso() }
  saveHouses(list)
  return { ok: true, house: list[index] }
}

// 切换当前房源。切换前先把当前扁平数据快照到旧房源，再加载新房源快照。
// 失败时回滚：恢复旧扁平数据，恢复旧 activeId。
// 成功后标记切换时间戳，各业务页面 componentDidShow 时检查并重载。
export function switchHouse(targetId) {
  const list = loadHouses()
  const target = list.find((item) => item.id === targetId)
  if (!target) {
    return { ok: false, reason: 'not-found' }
  }
  const currentId = getActiveHouseId()
  if (targetId === currentId) {
    return { ok: true, house: target, skipped: true }
  }
  // 1. 快照当前数据到旧房源（如果有旧房源）
  const previousSnapshot = captureCurrentDataSnapshot()
  if (currentId) {
    saveHouseSnapshot(currentId, previousSnapshot)
    const oldIndex = list.findIndex((item) => item.id === currentId)
    if (oldIndex >= 0) {
      list[oldIndex] = { ...list[oldIndex], updatedAt: nowIso() }
      saveHouses(list)
    }
  }
  // 2. 加载新房源快照到扁平 key，检查是否有写入失败
  const targetSnapshot = loadHouseSnapshot(targetId)
  const restoreFailed = restoreDataSnapshot(targetSnapshot || {})
  if (restoreFailed > 0) {
    // 部分恢复失败：回滚到旧扁平数据，避免新旧房源数据混合
    restoreDataSnapshot(previousSnapshot)
    return { ok: false, reason: 'restore-failed', failedCount: restoreFailed }
  }
  setActiveHouseId(targetId)
  markHouseSwitched()
  return { ok: true, house: target }
}

// 删除房源。如果是当前房源，切换到列表中第一个其他房源。
// 不删除物理照片文件（可能被其他房源引用）。
export function deleteHouse(houseId) {
  const list = loadHouses()
  const index = list.findIndex((item) => item.id === houseId)
  if (index < 0) {
    return { ok: false, reason: 'not-found' }
  }
  const remaining = list.filter((item) => item.id !== houseId)
  removeHouseSnapshot(houseId)

  const currentId = getActiveHouseId()
  let switchedTo = null
  if (houseId === currentId) {
    if (remaining.length === 0) {
      // 删完最后一个：创建新默认房源，清空当前扁平数据
      const now = nowIso()
      const newDefault = {
        id: generateHouseId(),
        name: '默认房源',
        createdAt: now,
        updatedAt: now,
      }
      saveHouses([newDefault])
      setActiveHouseId(newDefault.id)
      restoreDataSnapshot({})
      switchedTo = newDefault
      markHouseSwitched()
    } else {
      // 切换到剩余的第一个
      const next = remaining[0]
      saveHouses(remaining)
      const nextSnapshot = loadHouseSnapshot(next.id)
      restoreDataSnapshot(nextSnapshot || {})
      setActiveHouseId(next.id)
      switchedTo = next
      markHouseSwitched()
    }
  } else {
    saveHouses(remaining)
  }
  return { ok: true, switchedTo }
}

// 清除当前房源的全部业务数据（保留房源元信息和其他房源）。
// 物理照片文件不删（可能被其他房源引用）。
export function clearCurrentHouseData() {
  const activeId = getActiveHouseId()
  if (!activeId) {
    return { ok: false, reason: 'no-active' }
  }
  // 清空扁平 key
  restoreDataSnapshot({})
  // 同步清空当前房源的快照（如果有）
  removeHouseSnapshot(activeId)
  // 更新 updatedAt
  const list = loadHouses()
  const index = list.findIndex((item) => item.id === activeId)
  if (index >= 0) {
    list[index] = { ...list[index], updatedAt: nowIso() }
    saveHouses(list)
  }
  return { ok: true, houseId: activeId }
}

// 收集所有房源快照中的业务数据（用于扫描照片引用等跨房源聚合）
// 返回 [{ houseId, snapshot }, ...]
export function collectAllHouseSnapshots() {
  const houses = loadHouses()
  const result = []
  const activeId = getActiveHouseId()
  // 当前活跃房源的数据在扁平 key 里
  if (activeId) {
    result.push({ houseId: activeId, snapshot: captureCurrentDataSnapshot() })
  }
  // 其他房源的数据在快照里
  for (const house of houses) {
    if (house.id === activeId) continue
    const snapshot = loadHouseSnapshot(house.id)
    if (snapshot) {
      result.push({ houseId: house.id, snapshot })
    }
  }
  return result
}

// 清除所有房源相关 storage（供 clearLocalData 调用）
export function removeAllHouseStorage() {
  const houses = loadHouses()
  for (const house of houses) {
    removeHouseSnapshot(house.id)
  }
  removeKey(STORAGE_KEYS.houses)
  removeKey(STORAGE_KEYS.activeHouse)
}

// 房源切换时间戳：各业务页面在 componentDidShow 时检查此标志，
// 如果比上次加载新，则 cancel draftSaver 并重新从 storage 加载，避免串档。
export function markHouseSwitched() {
  globalThis.__ZU_XIAO_SHEN_HOUSE_SWITCHED_AT__ = Date.now()
}

export function hasHouseSwitchedSince(timestamp) {
  const switchedAt = globalThis.__ZU_XIAO_SHEN_HOUSE_SWITCHED_AT__
  return typeof switchedAt === 'number' && typeof timestamp === 'number' && switchedAt > timestamp
}

// 删除非当前房源的孤立的 houseData 快照 key（防止 houses 列表与快照不一致）
// 供清理流程调用。返回被清理的 houseId 列表。
export function pruneOrphanHouseSnapshots() {
  const houses = loadHouses()
  const validIds = new Set(houses.map((item) => item.id))
  const removed = []
  try {
    const allKeys = Taro.getStorageInfoSync()?.keys || []
    for (const key of allKeys) {
      if (typeof key === 'string' && key.startsWith(STORAGE_KEYS.houseDataPrefix)) {
        const houseId = key.slice(STORAGE_KEYS.houseDataPrefix.length)
        if (!validIds.has(houseId)) {
          removeKey(key)
          removed.push(houseId)
        }
      }
    }
  } catch {
    // 忽略
  }
  return removed
}
