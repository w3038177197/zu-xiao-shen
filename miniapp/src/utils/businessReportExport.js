import Taro from '@tarojs/taro'
import { checkinRoomTypes, checkinRooms, getCheckinItems } from '../constants/checkinConfig.js'
import { getCheckinDefectRows, getCheckinStats, normalizeCheckinState } from '../features/checkinInspection.js'
import { evidenceActions, evidenceGroupMeta, normalizeEvidencePackState } from '../features/evidencePack.js'
import { redactRemoteContext } from '../features/remoteAi.js'
import { getLocalDataSnapshot } from './localDataManager.js'
import { createZipArchive } from './evidencePackageExport.js'

export const BUSINESS_REPORT_MODULES = ['contract', 'checkin', 'evidence']

const MODULE_LABELS = {
  contract: '合同分析',
  checkin: '入住验房',
  evidence: '证据包汇总',
}
const MAX_REPORT_BYTES = 35 * 1024 * 1024
const BODY_WIDTH = 9360
const TABLE_INDENT = 120
const STATUS_LABELS = { good: '良好', defect: '存在瑕疵', unchecked: '未检查' }

export function formatReportDateTime(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value || '待确认')
  const pad = (part) => String(part).padStart(2, '0')
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function reportText(value) {
  return redactRemoteContext(String(value ?? ''))
}

function privateField(value, label) {
  return String(value || '').trim() ? `[已隐藏${label}]` : '待填写'
}

function xml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
}

function parseStored(value, fallback) {
  if (value == null || value === '') return fallback
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) } catch { return value }
}

function paragraph(value, style = 'BodyText', options = {}) {
  const lines = reportText(value).replace(/\r/g, '').split('\n')
  const runs = lines.map((line, index) => `${index ? '<w:br/>' : ''}<w:t xml:space="preserve">${xml(line || ' ')}</w:t>`).join('')
  const keep = options.keepNext ? '<w:keepNext/>' : ''
  const pageBreak = options.pageBreakBefore ? '<w:pageBreakBefore/>' : ''
  const shade = options.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${options.fill}"/>` : ''
  const border = options.borderColor ? `<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="${options.borderColor}"/></w:pBdr>` : ''
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/>${keep}${pageBreak}${shade}${border}</w:pPr><w:r>${runs}</w:r></w:p>`
}

function labelValueTable(rows) {
  const widths = [1701, 7659]
  const rowXml = rows.map(([label, value], rowIndex) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${[
    { text: label, width: widths[0], fill: rowIndex % 2 ? 'F7F9FB' : 'E8EEF5', bold: true },
    { text: value, width: widths[1], fill: rowIndex % 2 ? 'F7F9FB' : 'FFFFFF', bold: false },
  ].map((cell) => `<w:tc><w:tcPr><w:tcW w:w="${cell.width}" w:type="dxa"/><w:shd w:val="clear" w:fill="${cell.fill}"/><w:tcMar><w:top w:w="80" w:type="dxa"/><w:start w:w="120" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:end w:w="120" w:type="dxa"/></w:tcMar><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:after="0" w:line="280" w:lineRule="auto"/></w:pPr><w:r><w:rPr>${cell.bold ? '<w:b/>' : ''}</w:rPr><w:t xml:space="preserve">${xml(reportText(cell.text || '待补充'))}</w:t></w:r></w:p></w:tc>`).join('')}</w:tr>`).join('')
  return `<w:tbl><w:tblPr><w:tblW w:w="${BODY_WIDTH}" w:type="dxa"/><w:tblInd w:w="${TABLE_INDENT}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D7DEE8"/><w:left w:val="single" w:sz="4" w:color="D7DEE8"/><w:bottom w:val="single" w:sz="4" w:color="D7DEE8"/><w:right w:val="single" w:sz="4" w:color="D7DEE8"/><w:insideH w:val="single" w:sz="4" w:color="D7DEE8"/><w:insideV w:val="single" w:sz="4" w:color="D7DEE8"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="${widths[0]}"/><w:gridCol w:w="${widths[1]}"/></w:tblGrid>${rowXml}</w:tbl>`
}

function matrixTable(headers, rows, widths) {
  const renderRow = (cells, header = false) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cells.map((value, index) => `<w:tc><w:tcPr><w:tcW w:w="${widths[index]}" w:type="dxa"/><w:shd w:val="clear" w:fill="${header ? 'E8EEF5' : 'FFFFFF'}"/><w:tcMar><w:top w:w="80" w:type="dxa"/><w:start w:w="120" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:end w:w="120" w:type="dxa"/></w:tcMar><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:after="0" w:line="280" w:lineRule="auto"/></w:pPr><w:r><w:rPr>${header ? '<w:b/><w:color w:val="1F4D78"/>' : ''}</w:rPr><w:t xml:space="preserve">${xml(reportText(value || '—'))}</w:t></w:r></w:p></w:tc>`).join('')}</w:tr>`
  return `<w:tbl><w:tblPr><w:tblW w:w="${BODY_WIDTH}" w:type="dxa"/><w:tblInd w:w="${TABLE_INDENT}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D7DEE8"/><w:left w:val="single" w:sz="4" w:color="D7DEE8"/><w:bottom w:val="single" w:sz="4" w:color="D7DEE8"/><w:right w:val="single" w:sz="4" w:color="D7DEE8"/><w:insideH w:val="single" w:sz="4" w:color="D7DEE8"/><w:insideV w:val="single" w:sz="4" w:color="D7DEE8"/></w:tblBorders></w:tblPr><w:tblGrid>${widths.map((width) => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>${renderRow(headers, true)}${rows.map((row) => renderRow(row)).join('')}</w:tbl>`
}

function bullet(value) {
  return `<w:p><w:pPr><w:pStyle w:val="BodyText"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t xml:space="preserve">${xml(reportText(value))}</w:t></w:r></w:p>`
}

function getImageInfo(bytes) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes.length >= 24) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    return { ext: 'png', width: view.getUint32(16), height: view.getUint32(20) }
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue }
      const marker = bytes[offset + 1]
      const length = (bytes[offset + 2] << 8) + bytes[offset + 3]
      if (length < 2) break
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { ext: 'jpg', height: (bytes[offset + 5] << 8) + bytes[offset + 6], width: (bytes[offset + 7] << 8) + bytes[offset + 8] }
      }
      offset += 2 + length
    }
    return { ext: 'jpg', width: 4, height: 3 }
  }
  return null
}

function fitImage(width, height) {
  const maxCx = 5029200
  const maxCy = 4846320
  const nativeCx = Math.max(1, width) * 9525
  const nativeCy = Math.max(1, height) * 9525
  const ratio = Math.min(1, maxCx / nativeCx, maxCy / nativeCy)
  return { cx: Math.round(nativeCx * ratio), cy: Math.round(nativeCy * ratio) }
}

function readFileBytes(fs, filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile({
      filePath,
      success: ({ data }) => {
        if (data instanceof Uint8Array) resolve(data)
        else if (data instanceof ArrayBuffer) resolve(new Uint8Array(data))
        else if (ArrayBuffer.isView(data)) resolve(new Uint8Array(data.buffer, data.byteOffset, data.byteLength))
        else reject(new Error('照片格式无法读取'))
      },
      fail: reject,
    })
  })
}

function imageParagraph(relId, name, id, dimensions) {
  return `<w:p><w:pPr><w:pStyle w:val="Photo"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${dimensions.cx}" cy="${dimensions.cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${id}" name="${xml(name)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="${xml(name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${dimensions.cx}" cy="${dimensions.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
}

function stylesXml() {
  const font = '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="微软雅黑"/>'
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr>${font}<w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="1F2933"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr><w:rPr>${font}<w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Subtitle"/><w:qFormat/><w:pPr><w:spacing w:before="0" w:after="80"/><w:keepNext/></w:pPr><w:rPr>${font}<w:b/><w:color w:val="0B2545"/><w:sz w:val="48"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="BodyText"/><w:qFormat/><w:pPr><w:spacing w:before="0" w:after="240" w:line="280" w:lineRule="auto"/></w:pPr><w:rPr>${font}<w:color w:val="526271"/><w:sz w:val="23"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="BodyText"/><w:qFormat/><w:pPr><w:spacing w:before="280" w:after="160"/><w:keepNext/><w:outlineLvl w:val="0"/></w:pPr><w:rPr>${font}<w:b/><w:color w:val="2E74B5"/><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="BodyText"/><w:qFormat/><w:pPr><w:spacing w:before="220" w:after="120"/><w:keepNext/><w:outlineLvl w:val="1"/></w:pPr><w:rPr>${font}<w:b/><w:color w:val="2E74B5"/><w:sz w:val="26"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="BodyText"/><w:qFormat/><w:pPr><w:spacing w:before="160" w:after="80"/><w:keepNext/><w:outlineLvl w:val="2"/></w:pPr><w:rPr>${font}<w:b/><w:color w:val="1F4D78"/><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="BodyText"><w:name w:val="Body Text"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr><w:rPr>${font}<w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="Caption"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="40" w:after="100" w:line="260" w:lineRule="auto"/></w:pPr><w:rPr>${font}<w:color w:val="66737F"/><w:sz w:val="18"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Photo"><w:name w:val="Photo"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:before="80" w:after="40"/></w:pPr></w:style></w:styles>`
}

function numberingXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="●"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="540"/></w:tabs><w:ind w:left="540" w:hanging="270"/><w:spacing w:after="80" w:line="300" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="微软雅黑"/><w:sz w:val="16"/><w:color w:val="2E74B5"/></w:rPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`
}

function headerXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:spacing w:after="0"/><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="微软雅黑"/><w:color w:val="7B8794"/><w:sz w:val="18"/></w:rPr><w:t>租小审 · 租赁全流程档案</w:t></w:r></w:p></w:hdr>'
}

function footerXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="微软雅黑"/><w:color w:val="7B8794"/><w:sz w:val="18"/></w:rPr><w:t>第 </w:t></w:r><w:fldSimple w:instr=" PAGE "><w:r><w:rPr><w:color w:val="7B8794"/><w:sz w:val="18"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple><w:r><w:rPr><w:color w:val="7B8794"/><w:sz w:val="18"/></w:rPr><w:t> 页 / 共 </w:t></w:r><w:fldSimple w:instr=" NUMPAGES "><w:r><w:rPr><w:color w:val="7B8794"/><w:sz w:val="18"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple><w:r><w:rPr><w:color w:val="7B8794"/><w:sz w:val="18"/></w:rPr><w:t> 页</w:t></w:r></w:p></w:ftr>'
}

function addContractSection(body, data, options = {}) {
  const history = Array.isArray(data.reviewHistory) ? data.reviewHistory : []
  const currentDraft = typeof data.contractDraft === 'string' ? data.contractDraft : ''
  const entry = history.find((item) => item?.snapshot?.contractText === currentDraft)
    || history.find((item) => item?.snapshot)
    || history[0]
    || null
  const snapshot = entry?.snapshot || {}
  const findings = Array.isArray(snapshot.findings) ? snapshot.findings : []
  const summary = snapshot.summary || (entry ? { score: entry.score, label: entry.label } : null)
  const draft = typeof snapshot.contractText === 'string' ? snapshot.contractText : currentDraft
  const profile = snapshot.activeProfile || snapshot.profile || data.reviewProfile || {}

  body.push(paragraph('合同分析报告', 'Heading1', { pageBreakBefore: options.pageBreakBefore }))
  body.push(summary
    ? paragraph(`${summary.label || '已完成审查'} · 风险评分 ${summary.score ?? '—'}/100 · 共发现 ${findings.length || entry?.count || 0} 项风险`, 'BodyText', { fill: 'EEF5F1', borderColor: '2F765E' })
    : paragraph('尚未找到完整审查结果。以下仅保留当前合同正文，建议先完成一次综合审查。', 'BodyText', { fill: 'FFF8E1', borderColor: 'C18A00' }))
  body.push(labelValueTable([
    ['最近审查', entry?.time ? formatReportDateTime(entry.time) : '暂无审查时间'],
    ['合同类型', profile.contractType === 'lease' ? '房屋租赁合同' : profile.contractType || '待确认'],
    ['审查身份', profile.partyRole === 'partyB' ? '承租方（乙方）' : profile.partyRole === 'partyA' ? '出租方（甲方）' : profile.partyRole || '待确认'],
    ['审查强度', ({ quick: '快速', business: '标准', strict: '严格' })[profile.reviewDepth] || profile.reviewDepth || '待确认'],
    ['覆盖情况', summary?.coverage?.label || '未生成'],
  ]))

  body.push(paragraph('核心风险', 'Heading2'))
  if (!findings.length) body.push(paragraph(summary ? '本次审查未记录明确风险项，仍建议核对身份、权属、金额、日期和交接附件。' : '暂无可展示的风险明细。'))
  findings.forEach((finding, index) => {
    const source = finding.source === 'ai' ? 'AI 全文复核' : '本地规则'
    body.push(paragraph(`${String(index + 1).padStart(2, '0')}  ${finding.title || '未命名风险'} · ${finding.levelText || finding.level || '待判断'}`, 'Heading3'))
    body.push(labelValueTable([
      ['发现来源', source],
      ['原文证据', finding.evidence || finding.hits?.join('、') || '未保存原文片段'],
      ['风险说明', finding.explain || '待人工复核'],
      ['修改建议', finding.suggestion || '建议双方书面协商并明确责任边界'],
    ]))
  })

  const audits = [...(summary?.missingFindings || []), ...(summary?.consistencyFindings || [])]
  if (audits.length) {
    body.push(paragraph('待补齐与待核对', 'Heading2'))
    audits.forEach((item) => body.push(bullet(`${item.title || '待核对事项'}：${item.explanation || ''}${item.suggestion ? ` 建议：${item.suggestion}` : ''}`)))
  }

  if (Array.isArray(snapshot.adoptedItems) && snapshot.adoptedItems.length) {
    body.push(paragraph('已采纳修改', 'Heading2'))
    snapshot.adoptedItems.forEach((item) => body.push(labelValueTable([
      ['修改项目', item.title || '条款修改'],
      ['原风险', item.evidence || '未保存'],
      ['建议文本', item.replacement || '未保存'],
    ])))
  }

  body.push(paragraph('合同正文存档', 'Heading2'))
  body.push(paragraph(draft || '暂无合同正文。', 'BodyText'))
}

async function addCheckinSection(body, data, media, relationships, fs, reportState, options = {}) {
  const state = normalizeCheckinState(data.checkinInspection)
  const stats = getCheckinStats(state)
  const defects = getCheckinDefectRows(state)
  const roomType = checkinRoomTypes.find((item) => item.value === data.checkinRoomType)?.label || '租住房屋'
  body.push(paragraph('入住验房报告', 'Heading1', { pageBreakBefore: options.pageBreakBefore }))
  body.push(paragraph(defects.length
    ? `本次完成 ${stats.percent}% 的检查，记录 ${defects.length} 处疑似瑕疵。建议尽快把带时间的照片和文字说明发给房东或中介确认。`
    : stats.checked ? `本次完成 ${stats.percent}% 的检查，暂未标记明显瑕疵。请继续保留全屋照片和水电燃气起始读数。` : '尚未完成验房检查，请先记录房屋现状。',
  'BodyText', { fill: defects.length ? 'FFF3F1' : 'EEF5F1', borderColor: defects.length ? 'A33A2B' : '2F765E' }))
  body.push(labelValueTable([
    ['房屋类型', roomType],
    ['检查完成度', `${stats.percent}%（${stats.checked}/${stats.total}）`],
    ['疑似瑕疵', `${stats.defects} 处`],
    ['验房照片', `${stats.photos} 张`],
  ]))

  body.push(paragraph('瑕疵分析', 'Heading2'))
  if (!defects.length) body.push(paragraph(stats.checked ? '已检查项目中暂无明显瑕疵记录。' : '暂无已检查项目。'))
  else body.push(matrixTable(['空间', '检查项', '瑕疵与说明', '照片'], defects.map((item) => [item.room, item.item, `${item.defect}${item.note ? `；${item.note}` : ''}`, `${item.photoCount} 张`]), [1500, 1800, 4560, 1500]))

  body.push(paragraph('逐项记录与照片', 'Heading2'))
  body.push(paragraph('照片按用户在验房页选择的检查项归档，租小审未识别照片内容是否与检查项一致；发送前请逐张核对。', 'BodyText', { fill: 'FFF8E1', borderColor: 'C18A00' }))
  for (const room of checkinRooms) {
    const records = getCheckinItems(room.key).map((item) => ({ item, record: state[room.key]?.[item.key] })).filter(({ record }) => record && (record.status !== 'unchecked' || record.defect || record.note || record.photos?.length))
    if (!records.length) continue
    body.push(paragraph(room.label, 'Heading3'))
    for (const { item, record } of records) {
      body.push(labelValueTable([
        ['检查项', item.label],
        ['检查结果', STATUS_LABELS[record.status] || '未检查'],
        ['瑕疵描述', record.defect || '无'],
        ['补充说明', record.note || '无'],
      ]))
      for (let index = 0; index < (record.photos || []).length; index += 1) {
        const filePath = record.photos[index]
        try {
          const bytes = await readFileBytes(fs, filePath)
          const info = getImageInfo(bytes)
          if (!info) throw new Error('仅支持 JPEG 或 PNG 照片')
          if (reportState.mediaBytes + bytes.length > MAX_REPORT_BYTES) throw new Error('报告照片合计超过 35MB')
          reportState.mediaBytes += bytes.length
          const imageIndex = media.length + 1
          const mediaName = `checkin-${imageIndex}.${info.ext}`
          const relId = `rIdImage${imageIndex}`
          media.push({ name: `word/media/${mediaName}`, data: bytes })
          relationships.push(`<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/>`)
          body.push(imageParagraph(relId, `${room.label}-${item.label}-${index + 1}`, imageIndex + 20, fitImage(info.width, info.height)))
          body.push(paragraph(`图 ${reportState.includedPhotos + 1}  用户关联：${room.label} · ${item.label} · 第 ${index + 1} 张`, 'Caption'))
          reportState.includedPhotos += 1
        } catch (error) {
          reportState.skippedPhotos += 1
          body.push(paragraph(`照片 ${index + 1} 未能嵌入：${error?.message || '本地文件读取失败'}`, 'Caption'))
        }
      }
    }
  }
}

async function addEvidenceSection(body, data, media, relationships, fs, reportState, options = {}) {
  const state = normalizeEvidencePackState(data.evidencePack)
  const { formData, evidence, attachments, actions, communicationText } = state
  const selected = []
  const missing = []
  let attachmentCount = 0
  Object.entries(evidenceGroupMeta).forEach(([group, meta]) => {
    meta.items.forEach((item, index) => (evidence[group]?.[index] ? selected : missing).push(`${meta.title}：${item}`))
    attachmentCount += attachments[group]?.length || 0
  })

  body.push(paragraph('证据包汇总', 'Heading1', { pageBreakBefore: options.pageBreakBefore }))
  const hasContent = selected.length
    || attachmentCount
    || actions.some(Boolean)
    || communicationText.trim()
    || Object.values(formData).some((value) => String(value || '').trim())
  if (!hasContent) {
    body.push(paragraph('暂无证据资料。请先添加附件、勾选已备材料或填写交接信息后再导出。', 'BodyText', { fill: 'F4F6F9', borderColor: '7B8794' }))
    return
  }
  body.push(paragraph(`用户已勾选 ${selected.length} 项，未勾选 ${missing.length} 项；当前关联 ${attachmentCount} 个附件。勾选状态仅代表用户标记，不代表附件内容已经核验。`, 'BodyText', { fill: missing.length ? 'FFF8E1' : 'EEF5F1', borderColor: missing.length ? 'C18A00' : '2F765E' }))
  body.push(labelValueTable([
    ['房屋地址', privateField(formData.address, '地址')],
    ['押金 / 月租金', `${formData.deposit || '待填写'} 元 / ${formData.monthlyRent || '待填写'} 元`],
    ['房东或中介', `${privateField(formData.landlordName, '姓名')}${formData.landlordPhone ? `（${privateField(formData.landlordPhone, '手机号')}）` : ''}`],
    ['入住 / 退租', `${formData.checkinDate || '待确认'} / ${formData.checkoutDate || '待确认'}`],
    ['交接安排', `${formData.handoverDate || '待确认'} ${formData.handoverTime || ''}`.trim()],
  ]))

  body.push(paragraph('附件清单', 'Heading2'))
  const attachmentRows = []
  const attachmentItems = []
  Object.entries(evidenceGroupMeta).forEach(([group, meta]) => {
    ;(attachments[group] || []).forEach((item, index) => {
      const extension = String(item.fileName || '').match(/\.[^.]+$/)?.[0] || ''
      const generatedName = /^tmp_[a-z0-9]+\./i.test(String(item.fileName || ''))
        ? `${meta.title}-${index + 1}${extension}`
        : item.fileName || '未命名附件'
      const category = item.sourceModule === 'contract' || item.sourceModule === 'review'
        ? '合同文件'
        : /备份/i.test(generatedName) ? '备份文件' : meta.title
      const source = item.source === 'module' ? `模块引用 · ${item.sourceModule || '未知来源'}` : item.source === 'album' ? '相册' : '微信文件'
      const createdAt = item.createdAt ? formatReportDateTime(item.createdAt) : '待确认'
      attachmentRows.push([
        category,
        generatedName,
        source,
        createdAt,
      ])
      attachmentItems.push({ item, category, generatedName, source, createdAt })
    })
  })
  body.push(attachmentRows.length ? matrixTable(['分类', '文件名', '来源', '日期'], attachmentRows, [1500, 3360, 1800, 2700]) : paragraph('暂未关联附件。'))

  const imageItems = attachmentItems.filter(({ item }) => item.fileType === 'image' && item.localPath)
  if (imageItems.length) body.push(paragraph('证据图片', 'Heading2'))
  for (const { item, category, generatedName, source, createdAt } of imageItems) {
    try {
      const bytes = await readFileBytes(fs, item.localPath)
      const info = getImageInfo(bytes)
      if (!info) throw new Error('仅支持 JPEG 或 PNG 图片')
      if (reportState.mediaBytes + bytes.length > MAX_REPORT_BYTES) throw new Error('报告图片合计超过 35MB')
      reportState.mediaBytes += bytes.length
      const imageIndex = media.length + 1
      const mediaName = `evidence-${imageIndex}.${info.ext}`
      const relId = `rIdImage${imageIndex}`
      media.push({ name: `word/media/${mediaName}`, data: bytes })
      relationships.push(`<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/>`)
      body.push(imageParagraph(relId, generatedName, imageIndex + 20, fitImage(info.width, info.height)))
      body.push(paragraph(`图 ${reportState.includedPhotos + 1}  ${category} · ${generatedName} · ${source} · ${createdAt}`, 'Caption'))
      reportState.includedPhotos += 1
    } catch (error) {
      reportState.skippedPhotos += 1
      body.push(paragraph(`${generatedName} 未能嵌入：${error?.message || '本地文件读取失败'}`, 'Caption'))
    }
  }

  body.push(paragraph('用户标记已备材料', 'Heading2'))
  if (selected.length) selected.forEach((item) => body.push(bullet(item)))
  else body.push(paragraph('暂无已勾选证据。'))
  body.push(paragraph('用户未勾选材料', 'Heading2'))
  if (missing.length) missing.forEach((item) => body.push(bullet(item)))
  else body.push(paragraph('证据清单已全部勾选，但仍需核对对应原始附件是否真实、清晰、完整。'))

  body.push(paragraph('用户标记的行动进度', 'Heading2'))
  body.push(matrixTable(['状态', '行动', '说明'], evidenceActions.map((item, index) => [actions[index] ? '已完成' : '待完成', item.title, item.desc]), [1500, 3000, 4860]))
  body.push(paragraph('用户保存的沟通草稿', 'Heading2'))
  body.push(paragraph(communicationText ? `${communicationText}\n\n发送前请按当前附件和清单状态重新核对，草稿可能早于后续资料更新。` : '尚未生成沟通说明。', 'BodyText', { fill: 'F4F6F9', borderColor: '7B8794' }))
  if (formData.notes) {
    body.push(paragraph('补充备注', 'Heading2'))
    body.push(paragraph(formData.notes))
  }
}

function getReportFileName(modules, now) {
  const label = modules.length === BUSINESS_REPORT_MODULES.length ? '租赁全流程报告' : modules.map((item) => MODULE_LABELS[item]).join('-') + '报告'
  const pad = (value) => String(value).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `租小审-${label}-${stamp}.docx`
}

function addExecutiveSummary(body, modules, data) {
  body.push(paragraph('关键结论', 'Heading1'))
  if (modules.includes('contract')) {
    const history = Array.isArray(data.reviewHistory) ? data.reviewHistory : []
    const currentDraft = typeof data.contractDraft === 'string' ? data.contractDraft : ''
    const entry = history.find((item) => item?.snapshot?.contractText === currentDraft) || history.find((item) => item?.snapshot)
    const findings = Array.isArray(entry?.snapshot?.findings) ? entry.snapshot.findings : []
    const highRisks = findings.filter((item) => item.level === 'high').slice(0, 3)
    body.push(bullet(`合同审查：共 ${findings.length} 项风险，高风险 ${findings.filter((item) => item.level === 'high').length} 项。${highRisks.length ? `优先处理：${highRisks.map((item) => item.title).join('、')}。` : '当前没有已记录的高风险项。'}`))
  }
  if (modules.includes('checkin')) {
    const stats = getCheckinStats(normalizeCheckinState(data.checkinInspection))
    body.push(bullet(`入住验房：已检查 ${stats.checked}/${stats.total} 项，记录 ${stats.defects} 处瑕疵、${stats.photos} 张照片；照片内容仍需人工核对。`))
  }
  if (modules.includes('evidence')) {
    const state = normalizeEvidencePackState(data.evidencePack)
    const checks = Object.entries(evidenceGroupMeta).flatMap(([group, meta]) => meta.items.map((_, index) => Boolean(state.evidence[group]?.[index])))
    const attachmentCount = Object.values(state.attachments).reduce((total, items) => total + (items?.length || 0), 0)
    body.push(bullet(`证据包：用户勾选 ${checks.filter(Boolean).length}/${checks.length} 项，关联 ${attachmentCount} 个附件；勾选状态不等于附件已核验。`))
  }
}

export async function buildBusinessReportDocx({ selectedModules, data, fs = Taro.getFileSystemManager?.(), now = new Date() } = {}) {
  const modules = [...new Set(selectedModules || [])].filter((item) => BUSINESS_REPORT_MODULES.includes(item))
  if (!modules.length) throw new Error('请至少选择一项报告内容')
  if (!fs?.readFile && modules.includes('checkin')) throw new Error('当前环境不支持读取验房照片')
  const source = data || Object.fromEntries(getLocalDataSnapshot().map(({ key, value }) => [key, value]))
  const normalized = Object.fromEntries(Object.entries(source).map(([key, value]) => [key, parseStored(value, null)]))
  const body = []
  const media = []
  const relationships = [
    '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    '<Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>',
    '<Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>',
    '<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>',
  ]
  const reportState = { includedPhotos: 0, skippedPhotos: 0, mediaBytes: 0 }

  const reportTitle = modules.length === BUSINESS_REPORT_MODULES.length ? '租赁全流程档案' : `${MODULE_LABELS[modules[0]]}报告`
  body.push(paragraph(reportTitle, 'Title'))
  body.push(paragraph(modules.length === BUSINESS_REPORT_MODULES.length ? '合同风险、入住现状与退租证据的统一 Word 报告' : '租小审本机资料导出报告', 'Subtitle'))
  body.push(labelValueTable([
    ['生成时间', formatReportDateTime(now)],
    ['包含内容', modules.map((item) => MODULE_LABELS[item]).join('、')],
    ['数据来源', '租小审本机记录'],
    ['文件用途', '自查、交接核对与沟通留存'],
  ]))
  body.push(paragraph('报告说明', 'Heading1'))
  body.push(paragraph('本报告只整理用户在本机保存的合同审查、验房和证据资料，常见格式的姓名、电话、身份证号和详细地址已默认隐藏；照片和自由填写内容仍需发送前核对。本报告不构成律师出具的法律意见，发生争议时请保留可核验的原始文件。', 'BodyText', { fill: 'F4F6F9', borderColor: '7B8794' }))
  addExecutiveSummary(body, modules, normalized)

  const sectionOptions = { pageBreakBefore: modules.length > 1 }
  if (modules.includes('contract')) addContractSection(body, normalized, sectionOptions)
  if (modules.includes('checkin')) await addCheckinSection(body, normalized, media, relationships, fs, reportState, sectionOptions)
  if (modules.includes('evidence')) await addEvidenceSection(body, normalized, media, relationships, fs, reportState, sectionOptions)
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body.join('')}<w:sectPr><w:headerReference w:type="default" r:id="rIdHeader"/><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`
  const created = now.toISOString()
  const entries = [
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdOfficeDocument" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rIdCore" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rIdApp" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>' },
    { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>租小审租赁全流程档案</dc:title><dc:creator>租小审</dc:creator><cp:lastModifiedBy>租小审</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified></cp:coreProperties>` },
    { name: 'docProps/app.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>租小审</Application><AppVersion>1.1</AppVersion></Properties>' },
    { name: 'word/document.xml', data: documentXml },
    { name: 'word/styles.xml', data: stylesXml() },
    { name: 'word/numbering.xml', data: numberingXml() },
    { name: 'word/header1.xml', data: headerXml() },
    { name: 'word/footer1.xml', data: footerXml() },
    { name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.join('')}</Relationships>` },
    ...media,
  ]
  return {
    bytes: createZipArchive(entries, now),
    fileName: getReportFileName(modules, now),
    selectedModules: modules,
    includedPhotos: reportState.includedPhotos,
    skippedPhotos: reportState.skippedPhotos,
  }
}

export async function buildBusinessReportBundle({ data, fs = Taro.getFileSystemManager?.(), now = new Date() } = {}) {
  const source = data || Object.fromEntries(getLocalDataSnapshot().map(({ key, value }) => [key, value]))
  const reports = []
  for (const moduleId of BUSINESS_REPORT_MODULES) {
    reports.push(await buildBusinessReportDocx({ selectedModules: [moduleId], data: source, fs, now }))
  }
  const pad = (value) => String(value).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  return {
    bytes: createZipArchive(reports.map((report, index) => ({ name: `${index + 1}-${report.fileName}`, data: report.bytes })), now),
    fileName: `租小审-全部Word报告-${stamp}.zip`,
    reports,
    includedPhotos: reports.reduce((total, report) => total + report.includedPhotos, 0),
    skippedPhotos: reports.reduce((total, report) => total + report.skippedPhotos, 0),
  }
}
