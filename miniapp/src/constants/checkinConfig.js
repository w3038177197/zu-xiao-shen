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

export const checkinItems = [
  {
    key: 'wall',
    label: '墙面/地板',
    desc: '裂缝、霉斑、划痕、起皮、渗水',
  },
  {
    key: 'doorWindow',
    label: '门窗/门锁',
    desc: '开合、钥匙、门禁、窗锁、纱窗',
  },
  {
    key: 'appliance',
    label: '家具家电',
    desc: '冰箱、洗衣机、空调、热水器、床柜',
  },
  {
    key: 'waterElectric',
    label: '水电燃气',
    desc: '表读数、漏水、跳闸、燃气灶、插座',
  },
]

export const CHECKIN_MAX_PHOTOS_PER_ITEM = 6
export const CHECKIN_MAX_PHOTO_BYTES = 6 * 1024 * 1024
export const CHECKIN_PHOTO_MAX_EDGE = 1280
export const CHECKIN_PHOTO_QUALITY = 0.78
export const CONTRACT_IMPORT_MAX_BYTES = 8 * 1024 * 1024
