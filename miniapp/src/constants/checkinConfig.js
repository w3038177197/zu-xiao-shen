export const DEFAULT_CHECKIN_ROOM_TYPE = 'studio'

export const checkinRoomTypes = [
  { value: 'studio', label: '整租一居室', desc: '适合毕业生、独居租客' },
  { value: 'shared', label: '合租房间', desc: '重点确认公共区和个人房间边界' },
  { value: 'family', label: '整租两居/三居', desc: '适合家庭或多人长期居住' },
  { value: 'apartment', label: '公寓房源', desc: '重点留存物业、门禁和设施记录' },
]

export const checkinRooms = [
  { key: 'living', label: '客厅/卧室' },
  { key: 'bedroom', label: '次卧/书房' },
  { key: 'kitchen', label: '厨房' },
  { key: 'bathroom', label: '卫生间' },
  { key: 'meter', label: '水电燃气' },
  { key: 'building', label: '门禁/公区' },
]

const roomKeysByType = {
  studio: ['living', 'kitchen', 'bathroom', 'meter'],
  shared: ['living', 'kitchen', 'bathroom', 'meter'],
  family: ['living', 'bedroom', 'kitchen', 'bathroom', 'meter'],
  apartment: ['living', 'bathroom', 'meter', 'building'],
}

const roomLabelOverrides = {
  shared: {
    living: '个人房间',
    kitchen: '公共厨房',
    bathroom: '公共卫浴',
    meter: '水电/费用分摊',
  },
  family: {
    living: '客厅/餐厅',
    bedroom: '卧室/儿童房',
  },
  apartment: {
    living: '居住空间',
    meter: '水电/网络',
  },
}

export function getCheckinRooms(roomType) {
  const keys = roomKeysByType[roomType] || roomKeysByType[DEFAULT_CHECKIN_ROOM_TYPE]
  const labels = roomLabelOverrides[roomType] || {}
  return keys
    .map((key) => checkinRooms.find((room) => room.key === key))
    .filter(Boolean)
    .map((room) => ({ ...room, label: labels[room.key] || room.label }))
}

export const checkinItemsByRoom = {
  living: [
    { key: 'wall', label: '墙面/地板', desc: '裂缝、霉斑、划痕、起皮、渗水' },
    { key: 'doorWindow', label: '门窗/门锁', desc: '开合、钥匙、门禁、窗锁、纱窗' },
    { key: 'appliance', label: '家具/收纳', desc: '床、衣柜、桌椅、沙发及现有破损' },
    { key: 'waterElectric', label: '照明/插座', desc: '灯具、开关、插座、空调及通电情况' },
  ],
  bedroom: [
    { key: 'wall', label: '卧室墙地面', desc: '裂缝、霉斑、划痕、起皮、渗水' },
    { key: 'doorWindow', label: '卧室门窗/门锁', desc: '房门钥匙、窗锁、纱窗、隔音和开合' },
    { key: 'appliance', label: '卧室家具/收纳', desc: '床、衣柜、书桌、床垫及现有破损' },
    { key: 'waterElectric', label: '照明/空调/插座', desc: '灯具、开关、插座、空调及通电情况' },
  ],
  kitchen: [
    { key: 'wall', label: '墙顶/地面', desc: '渗水、油污、裂缝、瓷砖空鼓和破损' },
    { key: 'doorWindow', label: '橱柜/台面', desc: '柜门、合页、台面、水槽和密封边' },
    { key: 'appliance', label: '厨房电器', desc: '冰箱、油烟机、灶具及通电点火情况' },
    { key: 'waterElectric', label: '给排水/燃气', desc: '水压、漏水、排水、燃气阀和软管' },
  ],
  bathroom: [
    { key: 'wall', label: '墙地砖/防水', desc: '渗水、霉斑、空鼓、破损和地面积水' },
    { key: 'doorWindow', label: '门窗/通风', desc: '门锁、玻璃、窗户、排风和异味' },
    { key: 'appliance', label: '洁具/热水器', desc: '马桶、洗手盆、花洒、热水器和镜柜' },
    { key: 'waterElectric', label: '排水/用电', desc: '地漏、下水速度、防溅插座和漏电保护' },
  ],
  meter: [
    { key: 'wall', label: '水表', desc: '起始读数、表号、铅封、总阀和是否漏水' },
    { key: 'doorWindow', label: '电表', desc: '起始读数、表号、峰谷读数和配电箱' },
    { key: 'appliance', label: '燃气表', desc: '起始读数、表号、阀门、报警器和通风' },
    { key: 'waterElectric', label: '阀门/线路', desc: '水电燃气总阀、线路标识及安全状态' },
  ],
  building: [
    { key: 'wall', label: '门禁/梯控', desc: '门禁卡、人脸权限、梯控、单元门和访客进入方式' },
    { key: 'doorWindow', label: '公共走廊/电梯', desc: '走廊照明、电梯运行、消防通道和公共卫生' },
    { key: 'appliance', label: '物业/网络/消防', desc: '物业联系方式、宽带、烟感喷淋和应急设施' },
    { key: 'waterElectric', label: '公共设施/收费', desc: '洗衣房、快递柜、公共水电和额外收费规则' },
  ],
}

const itemOverridesByType = {
  shared: {
    living: {
      doorWindow: { label: '房门/门锁', desc: '个人房门钥匙、门锁、窗锁和室友进入边界' },
      appliance: { label: '个人家具/收纳', desc: '床、衣柜、桌椅、独立收纳及现有破损' },
    },
    kitchen: {
      wall: { desc: '公共厨房油污、墙地面破损和责任边界' },
      appliance: { desc: '共用冰箱、油烟机、灶具、使用规则和已有破损' },
    },
    bathroom: {
      wall: { desc: '公共卫浴渗水、霉斑、地面积水和清洁责任' },
      appliance: { desc: '共用马桶、花洒、热水器、镜柜和已有破损' },
    },
    meter: {
      wall: { label: '水费分摊', desc: '分表、起始读数、缴费截图和室友分摊口径' },
      doorWindow: { label: '电费分摊', desc: '电表读数、峰谷电价和公共用电分摊' },
      appliance: { label: '燃气/热水', desc: '燃气读数、热水器费用和安全阀门' },
      waterElectric: { label: '公共费用凭证', desc: '物业、网络、保洁等公共费用是否有凭证' },
    },
  },
  apartment: {
    living: {
      doorWindow: { label: '门窗/智能门锁', desc: '密码锁、门禁卡、窗锁、纱窗和权限移交' },
      appliance: { label: '家具/家电/软装', desc: '床、衣柜、冰箱、洗衣机、空调和软装破损' },
      waterElectric: { label: '照明/插座/网络', desc: '灯具、插座、空调、宽带和弱电接口' },
    },
    meter: {
      wall: { label: '水费读数', desc: '水表或后台计费截图、起始金额和账单规则' },
      doorWindow: { label: '电费读数', desc: '电表、预付费余额、峰谷电价和充值方式' },
      appliance: { label: '网络/物业费', desc: '宽带、物业服务、管理费和额外收费' },
    },
  },
}

export function getCheckinItems(roomKey, roomType) {
  const base = checkinItemsByRoom[roomKey] || checkinItemsByRoom.living
  const overrides = itemOverridesByType[roomType]?.[roomKey] || {}
  return base.map((item) => ({ ...item, ...(overrides[item.key] || {}) }))
}

// 兼容旧引用；持久化 key 保持不变，已有记录和照片无需迁移。
export const checkinItems = checkinItemsByRoom.living

export const CHECKIN_MAX_PHOTOS_PER_ITEM = 6
export const CHECKIN_MAX_PHOTO_BYTES = 6 * 1024 * 1024
export const CHECKIN_PHOTO_MAX_EDGE = 1280
export const CHECKIN_PHOTO_QUALITY = 0.78
export const CONTRACT_IMPORT_MAX_BYTES = 8 * 1024 * 1024
