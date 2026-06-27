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
    notePlaceholder: '补充备注：如墙面整体正常、地板无起翘、已拍全景照片',
    defectPlaceholder: '补充备注：如南侧墙角发霉、卧室木地板翘起、踢脚线开裂',
    defectAdvice: '建议拍远景定位房间，再拍近景展示裂缝、霉斑、起皮或渗水范围。',
    defectSuggestions: ['写清房间和方位', '近拍裂缝/霉斑', '记录面积或长度'],
    photoHint: '适合上传墙角、地板接缝、渗水点和划痕近景。',
  },
  {
    key: 'doorWindow',
    label: '门窗/门锁',
    desc: '开合、钥匙、门禁、窗锁、纱窗',
    notePlaceholder: '补充备注：如钥匙2把、门禁卡1张、窗户可正常开合',
    defectPlaceholder: '补充备注：如门锁松动、窗户关不严、纱窗破洞、钥匙缺失',
    defectAdvice: '建议拍门锁编号、钥匙数量、窗户闭合缝隙和纱窗破损位置。',
    defectSuggestions: ['拍钥匙/门禁数量', '拍闭合缝隙', '记录无法开合位置'],
    photoHint: '适合上传门锁、钥匙、窗锁、门禁卡和纱窗细节。',
  },
  {
    key: 'appliance',
    label: '家具家电',
    desc: '冰箱、洗衣机、空调、热水器、床柜',
    notePlaceholder: '补充备注：如冰箱制冷正常、洗衣机可运行、柜门开合正常',
    defectPlaceholder: '补充备注：如冰箱异响、洗衣机漏水、空调不制冷、柜门损坏',
    defectAdvice: '建议拍品牌型号、外观损坏处、运行异常画面和已有维修贴纸。',
    defectSuggestions: ['拍品牌型号', '拍破损细节', '记录异常声音/漏水'],
    photoHint: '适合上传家电铭牌、外观破损、运行状态和遥控器配件。',
  },
  {
    key: 'waterElectric',
    label: '水电燃气',
    desc: '表读数、漏水、跳闸、燃气灶、插座',
    notePlaceholder: '补充备注：如水表0000、电表0000、燃气表0000、插座正常',
    defectPlaceholder: '补充备注：如水表读数、电表读数、插座松动、燃气灶打不着火',
    defectAdvice: '建议拍清表读数、阀门状态、漏水点、插座面板和燃气灶火焰状态。',
    defectSuggestions: ['拍清表盘读数', '拍阀门/插座状态', '记录漏水或跳闸时间'],
    photoHint: '适合上传水表、电表、燃气表、阀门、插座和漏水点。',
  },
]

export const CHECKIN_MAX_PHOTOS_PER_ITEM = 6
export const CHECKIN_MAX_PHOTO_BYTES = 6 * 1024 * 1024
export const CHECKIN_PHOTO_MAX_EDGE = 1280
export const CHECKIN_PHOTO_QUALITY = 0.78
export const CONTRACT_IMPORT_MAX_BYTES = 8 * 1024 * 1024
export const CONTRACT_TEXT_EXTENSIONS = ['txt', 'md']
export const CONTRACT_WORD_EXTENSIONS = ['docx']
export const CONTRACT_PDF_EXTENSIONS = ['pdf']
export const CONTRACT_IMAGE_MIME_PATTERN = /^image\//
export const OCR_REVIEW_WARNING_CONFIDENCE = 70
