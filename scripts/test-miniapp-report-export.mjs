import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'
import mammoth from 'mammoth'

Object.assign(globalThis, {
  ENABLE_INNER_HTML: false,
  ENABLE_ADJACENT_HTML: false,
  ENABLE_CLONE_NODE: false,
  ENABLE_CONTAINS: false,
  ENABLE_SIZE_APIS: false,
  ENABLE_TEMPLATE_CONTENT: false,
  ENABLE_MUTATION_OBSERVER: false,
})

const { buildBusinessReportBundle, buildBusinessReportDocx, formatReportDateTime } = await import('../miniapp/src/utils/businessReportExport.js')

const now = new Date(2026, 7, 2, 20, 40)
const samplePhoto = path.resolve('miniapp/src/assets/brand/zu-xiao-shen-avatar-144.png')
const contractText = '甲方（出租方）姓名：张三\n身份证号：520103198706141129\n联系电话：13678552244\n房屋地址：贵阳市测试路1号\n押金不予退还。'
const finding = { title: '押金没收范围过宽', level: 'high', levelText: '高风险', evidence: '押金不予退还', explain: '可能加重承租人责任', suggestion: '按实际损失结算' }
const evidencePhoto = {
  id: 'evidence-photo-1',
  fileName: '交接照片.png',
  fileType: 'image',
  source: 'album',
  localPath: samplePhoto,
  createdAt: '2026-08-02T12:30:00+08:00',
}
const data = {
  contractDraft: contractText,
  reviewHistory: [{ time: 'Sun Aug 02 2026 20:35:41 GMT+0800 (CST)', snapshot: { contractText, findings: [finding], summary: { score: 30, label: '高风险' }, activeProfile: { contractType: 'lease', partyRole: 'partyB', reviewDepth: 'strict' } } }],
  checkinInspection: { kitchen: { wall: { status: 'defect', defect: '墙面疑似污渍', note: '交接时复核', photos: [samplePhoto] } } },
  checkinRoomType: 'studio',
  evidencePack: {
    formData: { address: '贵阳市测试路1号', landlordName: '张三', landlordPhone: '13678552244' },
    evidence: {},
    attachments: { photos: [evidencePhoto] },
    actions: [],
    communicationText: '发送前先补：押金付款凭证。',
  },
}
const miniappFs = {
  readFile({ filePath, success, fail }) {
    fs.readFile(filePath, (error, bytes) => error ? fail(error) : success({ data: bytes }))
  },
}

assert.equal(formatReportDateTime(now), '2026年8月2日 20:40')

const contractReport = await buildBusinessReportDocx({ selectedModules: ['contract'], data, fs: miniappFs, now })
const { value: contractReportText } = await mammoth.extractRawText({ buffer: Buffer.from(contractReport.bytes) })
assert.match(contractReportText, /关键结论/)
assert.match(contractReportText, /2026年8月2日 20:35/)
assert.match(contractReportText, /\[已隐藏身份证号\]/)
assert.doesNotMatch(contractReportText, /520103198706141129|13678552244|Sun Aug/)

const evidenceReport = await buildBusinessReportDocx({ selectedModules: ['evidence'], data, fs: miniappFs, now })
const evidenceZip = await JSZip.loadAsync(Buffer.from(evidenceReport.bytes))
const evidenceDocumentXml = await evidenceZip.file('word/document.xml').async('string')
assert.match(evidenceDocumentXml, /<w:pgSz w:w="11906" w:h="16838"\/>/)
assert.doesNotMatch(evidenceDocumentXml, /<w:pageBreakBefore\/>[\s\S]{0,240}证据包汇总/)
assert.match(evidenceDocumentXml, /cx="1371600" cy="1371600"/)
assert.ok(Object.keys(evidenceZip.files).some((name) => name.startsWith('word/media/')), '证据 Word 应嵌入图片')
assert.equal(evidenceReport.includedPhotos, 1)

const emptyEvidenceReport = await buildBusinessReportDocx({ selectedModules: ['evidence'], data: { evidencePack: {} }, fs: miniappFs, now })
const { value: emptyEvidenceText } = await mammoth.extractRawText({ buffer: Buffer.from(emptyEvidenceReport.bytes) })
assert.match(emptyEvidenceText, /暂无证据资料/)
assert.doesNotMatch(emptyEvidenceText, /用户未勾选材料/)

const bundle = await buildBusinessReportBundle({ data, fs: miniappFs, now })
const bundleZip = await JSZip.loadAsync(Buffer.from(bundle.bytes))
assert.equal(bundle.reports.length, 3)
assert.match(bundle.fileName, /全部Word报告.*\.zip$/)
assert.ok(Object.keys(bundleZip.files).some((name) => /合同分析报告.*\.docx$/.test(name)))
assert.ok(Object.keys(bundleZip.files).some((name) => /入住验房报告.*\.docx$/.test(name)))
assert.ok(Object.keys(bundleZip.files).some((name) => /证据包汇总报告.*\.docx$/.test(name)))

if (process.env.REPORT_OUTPUT_DIR) {
  fs.mkdirSync(process.env.REPORT_OUTPUT_DIR, { recursive: true })
  bundle.reports.forEach((report) => fs.writeFileSync(path.join(process.env.REPORT_OUTPUT_DIR, report.fileName), report.bytes))
}

console.log('Miniapp report export check passed: A4 DOCX + evidence image + 3-report ZIP')
