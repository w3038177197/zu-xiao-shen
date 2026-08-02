export const checkinRoomTypes = [
  { value: 'studio', label: '整租一居室', desc: '适合毕业生、独居租客' },
  { value: 'shared', label: '合租房间', desc: '重点确认公共区和个人房间边界' },
  { value: 'family', label: '整租两居/三居', desc: '适合家庭或多人长期居住' },
  { value: 'apartment', label: '公寓房源', desc: '重点留存物业、门禁和设施记录' },
]

export const checkinRooms = [
  { key: 'living', label: '客厅/卧室' },
  { key: 'kitchen', label: '厨房' },
  { key: 'bathroom', label: '卫生间' },
  { key: 'meter', label: '水电燃气' },
]

export const checkinItemsByRoom = {
  living: [
    { key: 'wall', label: '墙面/地板', desc: '裂缝、霉斑、划痕、起皮、渗水' },
    { key: 'doorWindow', label: '门窗/门锁', desc: '开合、钥匙、门禁、窗锁、纱窗' },
    { key: 'appliance', label: '家具/收纳', desc: '床、衣柜、桌椅、沙发及现有破损' },
    { key: 'waterElectric', label: '照明/插座', desc: '灯具、开关、插座、空调及通电情况' },
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
}

export function getCheckinItems(roomKey) {
  return checkinItemsByRoom[roomKey] || checkinItemsByRoom.living
}

// 兼容旧引用；持久化 key 保持不变，已有记录和照片无需迁移。
export const checkinItems = checkinItemsByRoom.living

export const CHECKIN_MAX_PHOTOS_PER_ITEM = 6
export const CHECKIN_MAX_PHOTO_BYTES = 6 * 1024 * 1024
export const CHECKIN_PHOTO_MAX_EDGE = 1280
export const CHECKIN_PHOTO_QUALITY = 0.78
export const CONTRACT_IMPORT_MAX_BYTES = 8 * 1024 * 1024
