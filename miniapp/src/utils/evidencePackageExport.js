import Taro from '@tarojs/taro'
import { getMiniappErrorMessage } from './privacyAuth.js'

const ILLEGAL_FILE_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g
const MAX_ARCHIVE_BYTES = 35 * 1024 * 1024
const ZIP_UTF8_FLAG = 0x0800
const ZIP_STORE_METHOD = 0

function utf8Bytes(value) {
  const bytes = []
  for (const symbol of String(value || '')) {
    const code = symbol.codePointAt(0)
    if (code <= 0x7f) bytes.push(code)
    else if (code <= 0x7ff) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    else if (code <= 0xffff) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
  }
  return Uint8Array.from(bytes)
}

function binaryStringBytes(value) {
  const output = new Uint8Array(value.length)
  for (let index = 0; index < value.length; index += 1) output[index] = value.charCodeAt(index) & 0xff
  return output
}

function toBytes(value) {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  return utf8Bytes(value)
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const output = new Uint8Array(total)
  let offset = 0
  parts.forEach((part) => {
    output.set(part, offset)
    offset += part.length
  })
  return output
}

function uint16(value) {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff)
}

function uint32(value) {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff)
}

let crcTable = null
function getCrcTable() {
  if (crcTable) return crcTable
  crcTable = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1)
    crcTable[index] = value >>> 0
  }
  return crcTable
}

export function crc32(value) {
  const bytes = toBytes(value)
  const table = getCrcTable()
  let crc = 0xffffffff
  for (let index = 0; index < bytes.length; index += 1) crc = table[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

// SHA-256 纯 JS 实现（小程序环境无 Node crypto，Taro 可能无 SubtleCrypto）
// 仅用于本机证据完整性校验；不是电子签名或公证存证。
const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]

function rotr(value, bits) {
  return ((value >>> bits) | (value << (32 - bits))) >>> 0
}

export function sha256(data) {
  const bytes = toBytes(data)
  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]
  const l = bytes.length
  const bitLen = l * 8
  // 填充：0x80 + 0x00... + 8 字节大端长度
  const padLen = ((l + 9 + 63) >> 6) << 6
  const padded = new Uint8Array(padLen)
  padded.set(bytes)
  padded[l] = 0x80
  // 64 位大端长度（仅低 32 位有效，文件不会超过 512MB）
  padded[padLen - 4] = (bitLen >>> 24) & 0xff
  padded[padLen - 3] = (bitLen >>> 16) & 0xff
  padded[padLen - 2] = (bitLen >>> 8) & 0xff
  padded[padLen - 1] = bitLen & 0xff

  for (let offset = 0; offset < padLen; offset += 64) {
    const W = new Array(64)
    for (let i = 0; i < 16; i += 1) {
      W[i] = ((padded[offset + i * 4] << 24) | (padded[offset + i * 4 + 1] << 16) | (padded[offset + i * 4 + 2] << 8) | padded[offset + i * 4 + 3]) >>> 0
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3)
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10)
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, h] = H
    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (h + S1 + ch + SHA256_K[i] + W[i]) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) >>> 0
      h = g; g = f; f = e; e = (d + t1) >>> 0
      d = c; c = b; b = a; a = (t1 + t2) >>> 0
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0
  }
  return H.map((v) => v.toString(16).padStart(8, '0')).join('')
}

function toDosDateTime(dateValue) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue || Date.now())
  const year = Math.max(1980, date.getFullYear())
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
  }
}

export function sanitizePackageFileName(value, fallback = '未命名文件') {
  const cleaned = String(value || '').replace(ILLEGAL_FILE_CHARS, '_').replace(/^\.+/, '').trim()
  return (cleaned || fallback).slice(0, 100)
}

function uniqueArchivePath(path, usedPaths) {
  const normalized = String(path).replace(/\\/g, '/').replace(/\.{2,}/g, '.').replace(/^\/+/, '')
  if (!usedPaths.has(normalized)) {
    usedPaths.add(normalized)
    return normalized
  }
  const dot = normalized.lastIndexOf('.')
  const base = dot > normalized.lastIndexOf('/') ? normalized.slice(0, dot) : normalized
  const extension = dot > normalized.lastIndexOf('/') ? normalized.slice(dot) : ''
  let index = 2
  while (usedPaths.has(`${base} (${index})${extension}`)) index += 1
  const unique = `${base} (${index})${extension}`
  usedPaths.add(unique)
  return unique
}

export function createZipArchive(entries, date = new Date()) {
  const localParts = []
  const centralParts = []
  let offset = 0
  const stamp = toDosDateTime(date)

  entries.forEach((entry) => {
    const name = utf8Bytes(entry.name)
    const data = toBytes(entry.data)
    const checksum = crc32(data)
    const localHeader = concatBytes([
      uint32(0x04034b50), uint16(20), uint16(ZIP_UTF8_FLAG), uint16(ZIP_STORE_METHOD),
      uint16(stamp.time), uint16(stamp.date), uint32(checksum), uint32(data.length), uint32(data.length),
      uint16(name.length), uint16(0), name,
    ])
    localParts.push(localHeader, data)
    centralParts.push(concatBytes([
      uint32(0x02014b50), uint16(20), uint16(20), uint16(ZIP_UTF8_FLAG), uint16(ZIP_STORE_METHOD),
      uint16(stamp.time), uint16(stamp.date), uint32(checksum), uint32(data.length), uint32(data.length),
      uint16(name.length), uint16(0), uint16(0), uint16(0), uint16(0), uint32(0), uint32(offset), name,
    ]))
    offset += localHeader.length + data.length
  })

  const central = concatBytes(centralParts)
  const end = concatBytes([
    uint32(0x06054b50), uint16(0), uint16(0), uint16(entries.length), uint16(entries.length),
    uint32(central.length), uint32(offset), uint16(0),
  ])
  return concatBytes([...localParts, central, end])
}

function utf16BeHex(value) {
  let output = ''
  for (const symbol of String(value || '')) {
    const code = symbol.codePointAt(0)
    const safe = code <= 0xffff ? code : 0x003f
    output += safe.toString(16).padStart(4, '0').toUpperCase()
  }
  return output
}

function visualWidth(symbol) {
  return symbol.codePointAt(0) > 0xff ? 2 : 1
}

function wrapPdfText(value, maxWidth = 78) {
  const lines = []
  String(value || '').replace(/\r/g, '').split('\n').forEach((paragraph) => {
    if (!paragraph) {
      lines.push('')
      return
    }
    let current = ''
    let width = 0
    for (const symbol of paragraph.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')) {
      const nextWidth = visualWidth(symbol)
      if (current && width + nextWidth > maxWidth) {
        lines.push(current)
        current = symbol
        width = nextWidth
      } else {
        current += symbol
        width += nextWidth
      }
    }
    lines.push(current)
  })
  return lines
}

export function createEvidencePdf(reportText) {
  const allLines = wrapPdfText(reportText)
  const linesPerPage = 41
  const pages = []
  for (let index = 0; index < allLines.length; index += linesPerPage) pages.push(allLines.slice(index, index + linesPerPage))
  if (!pages.length) pages.push(['租小审 退租证据包摘要'])

  const objects = [null]
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[3] = '<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /Identity-H /DescendantFonts [4 0 R] /ToUnicode 6 0 R >>'
  objects[4] = '<< /Type /Font /Subtype /CIDFontType2 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor 5 0 R /CIDToGIDMap /Identity /DW 1000 >>'
  objects[5] = '<< /Type /FontDescriptor /FontName /STSong-Light /Flags 6 /FontBBox [-250 -250 1000 1000] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 880 /StemV 80 >>'
  const unicodeMap = [
    '/CIDInit /ProcSet findresource begin',
    '12 dict begin',
    'begincmap',
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
    '/CMapName /Adobe-Identity-UCS def',
    '/CMapType 2 def',
    '1 begincodespacerange',
    '<0000> <FFFF>',
    'endcodespacerange',
    '1 beginbfrange',
    '<0000> <FFFF> <0000>',
    'endbfrange',
    'endcmap',
    'CMapName currentdict /CMap defineresource pop',
    'end',
    'end',
  ].join('\n')
  objects[6] = `<< /Length ${unicodeMap.length} >>\nstream\n${unicodeMap}\nendstream`

  const pageRefs = []
  pages.forEach((lines, pageIndex) => {
    const pageObject = 7 + pageIndex * 2
    const contentObject = pageObject + 1
    pageRefs.push(`${pageObject} 0 R`)
    const commands = ['BT', '/F1 11 Tf']
    lines.forEach((line, lineIndex) => {
      commands.push(`1 0 0 1 48 ${790 - lineIndex * 18} Tm <${utf16BeHex(line)}> Tj`)
    })
    commands.push(`1 0 0 1 270 35 Tm <${utf16BeHex(`第 ${pageIndex + 1}/${pages.length} 页`)}> Tj`, 'ET')
    const stream = `${commands.join('\n')}\n`
    objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObject} 0 R >>`
    objects[contentObject] = `<< /Length ${stream.length} >>\nstream\n${stream}endstream`
  })
  objects[2] = `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pages.length} >>`

  let document = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'
  const offsets = [0]
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = document.length
    document += `${index} 0 obj\n${objects[index]}\nendobj\n`
  }
  const xrefOffset = document.length
  document += `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let index = 1; index < objects.length; index += 1) document += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
  document += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return binaryStringBytes(document)
}

function readFileBytes(fs, filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile({ filePath, success: (result) => resolve(toBytes(result.data)), fail: reject })
  })
}

function writeBinaryFile(fs, filePath, bytes) {
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  return new Promise((resolve, reject) => {
    fs.writeFile({ filePath, data, success: resolve, fail: reject })
  })
}

function shareFile(filePath, fileName) {
  return new Promise((resolve, reject) => {
    Taro.shareFileMessage({ filePath, fileName, success: resolve, fail: reject })
  })
}

export async function writeAndShare(fileName, bytes) {
  const prepared = await writePackageFile(fileName, bytes)
  if (!prepared.ok) return prepared
  const { filePath } = prepared
  try {
    await shareFile(filePath, fileName)
    return prepared
  } catch (error) {
    const message = getMiniappErrorMessage(error)
    if (/cancel/i.test(message)) return { ...prepared, ok: false, reason: 'share-cancelled' }
    Taro.showModal({
      title: '文件已生成，分享未完成',
      content: '导出文件已保留在小程序本地，但微信没有打开分享面板。请检查微信版本和网络后重试。',
      showCancel: false,
    })
    return { ...prepared, ok: false, reason: 'share-failed', error }
  }
}

export async function writePackageFile(fileName, bytes) {
  const filePath = `${Taro.env.USER_DATA_PATH}/${fileName}`
  const fs = Taro.getFileSystemManager()
  try {
    await writeBinaryFile(fs, filePath, bytes)
  } catch (error) {
    Taro.showToast({ title: /space|quota|disk full/i.test(getMiniappErrorMessage(error)) ? '存储空间不足，请清理后重试' : '导出文件写入失败', icon: 'none' })
    return { ok: false, reason: 'write-failed', error }
  }
  return { ok: true, filePath, fileName }
}

export async function exportEvidencePdf(reportText) {
  if (!String(reportText || '').trim()) return { ok: false, reason: 'empty-content' }
  return writeAndShare('租小审-退租证据包摘要.pdf', createEvidencePdf(reportText))
}

export async function buildEvidenceArchive({ packState, reportText, groupLabels = {}, fs = Taro.getFileSystemManager() }) {
  const entries = []
  const usedPaths = new Set()
  const included = []
  const skipped = []
  let totalBytes = 0
  const exportedAt = new Date().toISOString()

  const addEntry = (name, data) => {
    const bytes = toBytes(data)
    totalBytes += bytes.length
    if (totalBytes > MAX_ARCHIVE_BYTES) {
      const error = new Error('证据附件合计超过 35MB，请删除部分大文件后重试')
      error.code = 'archive-too-large'
      throw error
    }
    entries.push({ name: uniqueArchivePath(name, usedPaths), data: bytes })
  }

  // 摘要文本也纳入完整性清单
  const summaryBytes = utf8Bytes(reportText || '')
  const summaryPath = uniqueArchivePath('退租证据包摘要.txt', usedPaths)
  totalBytes += summaryBytes.length
  if (totalBytes > MAX_ARCHIVE_BYTES) {
    const error = new Error('证据附件合计超过 35MB，请删除部分大文件后重试')
    error.code = 'archive-too-large'
    throw error
  }
  entries.push({ name: summaryPath, data: summaryBytes })
  included.push({
    fileName: '退租证据包摘要.txt',
    size: summaryBytes.length,
    module: 'summary',
    addedAt: exportedAt,
    exportedAt,
    note: '证据包文字摘要',
    sha256: sha256(summaryBytes),
    status: 'included',
    path: summaryPath,
  })

  for (const [group, attachments] of Object.entries(packState?.attachments || {})) {
    const groupName = sanitizePackageFileName(groupLabels[group] || group, '其他材料')
    for (const attachment of Array.isArray(attachments) ? attachments : []) {
      const fileName = sanitizePackageFileName(attachment?.fileName, '未命名附件')
      try {
        let data
        if (attachment?.textContent) data = utf8Bytes(attachment.textContent)
        else if (attachment?.localPath) data = await readFileBytes(fs, attachment.localPath)
        else throw new Error('附件没有可读取的本地内容')
        const path = uniqueArchivePath(`附件/${groupName}/${fileName}`, usedPaths)
        const bytes = toBytes(data)
        totalBytes += bytes.length
        if (totalBytes > MAX_ARCHIVE_BYTES) {
          const error = new Error('证据附件合计超过 35MB，请删除部分大文件后重试')
          error.code = 'archive-too-large'
          throw error
        }
        entries.push({ name: path, data: bytes })
        included.push({
          fileName,
          size: bytes.length,
          module: group,
          addedAt: attachment?.createdAt || exportedAt,
          exportedAt,
          note: attachment?.source ? `来源：${attachment.source}` : '证据附件',
          sha256: sha256(bytes),
          status: 'included',
          path,
        })
      } catch (error) {
        if (error?.code === 'archive-too-large') throw error
        skipped.push({
          fileName,
          module: group,
          addedAt: attachment?.createdAt || exportedAt,
          exportedAt,
          note: getMiniappErrorMessage(error) || '文件读取失败',
          sha256: '',
          status: 'missing',
          reason: getMiniappErrorMessage(error) || '文件读取失败',
        })
      }
    }
  }

  addEntry('证据包清单.json', JSON.stringify({
    version: 2,
    generatedAt: exportedAt,
    purpose: '完整性证明：记录每个附件的 SHA-256，便于证明文件未被篡改',
    algorithm: 'SHA-256',
    included,
    skipped,
    notice: '本压缩包由租小审在本机生成。请核对本清单中各文件的 SHA-256 与实际接收文件是否一致后再使用。',
  }, null, 2))

  return { bytes: createZipArchive(entries), included, skipped }
}

export async function exportEvidenceZip(options) {
  let archive
  try {
    archive = await buildEvidenceArchive(options)
  } catch (error) {
    Taro.showToast({ title: error?.message || '证据包生成失败', icon: 'none' })
    return { ok: false, reason: error?.code || 'archive-failed', error }
  }
  const shared = await writeAndShare('租小审-退租证据包.zip', archive.bytes)
  return { ...shared, included: archive.included, skipped: archive.skipped }
}
