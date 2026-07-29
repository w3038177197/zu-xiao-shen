const MAX_TEXT_CHARS = 120_000
const MAX_PDF_PAGES = 80
export const CONTRACT_DOCUMENT_MAX_BYTES = 8 * 1024 * 1024
export const CONTRACT_DOCUMENT_EXTENSIONS = ['txt', 'md', 'docx', 'pdf']

function parserError(message, status = 400, code = 'invalid-document') {
  const error = new Error(message)
  error.status = status
  error.code = code
  return error
}

function extensionOf(fileName) {
  const value = String(fileName || '').trim().toLowerCase()
  const dot = value.lastIndexOf('.')
  return dot >= 0 ? value.slice(dot + 1) : ''
}

function normalizeText(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t ]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
}

function assertDocumentBuffer(buffer, fileName) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw parserError('文件为空或上传不完整', 400, 'empty-file')
  if (buffer.length > CONTRACT_DOCUMENT_MAX_BYTES) throw parserError('文件超过 8MB，请压缩后重试', 413, 'file-too-large')
  const extension = extensionOf(fileName)
  if (!CONTRACT_DOCUMENT_EXTENSIONS.includes(extension)) {
    throw parserError('仅支持 TXT、MD、DOCX 和 PDF 文件', 415, 'unsupported-file')
  }
  if (extension === 'pdf' && buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw parserError('PDF 文件格式无效或已经损坏', 422, 'invalid-pdf')
  }
  if (extension === 'docx' && !(buffer[0] === 0x50 && buffer[1] === 0x4b)) {
    throw parserError('DOCX 文件格式无效或已经损坏', 422, 'invalid-docx')
  }
  return extension
}

async function extractDocxText(buffer) {
  const imported = await import('mammoth')
  const mammoth = imported.default || imported
  const result = await mammoth.extractRawText({ buffer })
  return { text: result.value, pageCount: null }
}

export async function extractPdfText(buffer, { getDocument } = {}) {
  const pdfjs = getDocument ? null : await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loadingTask = (getDocument || pdfjs.getDocument)({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: true,
  })
  try {
    const pdf = await loadingTask.promise
    if (pdf.numPages > MAX_PDF_PAGES) {
      throw parserError(`PDF 超过 ${MAX_PDF_PAGES} 页，请拆分后导入`, 413, 'too-many-pages')
    }

    const pages = []
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      try {
        const content = await page.getTextContent()
        const text = content.items
          .map((item) => String(item?.str || '').trim())
          .filter(Boolean)
          .join(' ')
        if (text) pages.push(text)
      } finally {
        page.cleanup()
      }
    }
    return { text: pages.join('\n\n'), pageCount: pdf.numPages }
  } finally {
    await loadingTask.destroy()
  }
}

export async function parseContractDocument({ buffer, fileName }) {
  const safeFileName = String(fileName || '合同文件').trim().slice(0, 160) || '合同文件'
  const extension = assertDocumentBuffer(buffer, safeFileName)
  let extracted

  try {
    if (extension === 'docx') extracted = await extractDocxText(buffer)
    else if (extension === 'pdf') extracted = await extractPdfText(buffer)
    else extracted = { text: buffer.toString('utf8'), pageCount: null }
  } catch (error) {
    if (error?.status) throw error
    throw parserError('文档解析失败，请确认文件未加密或损坏', 422, 'parse-failed')
  }

  const text = normalizeText(extracted.text)
  if (!text || text.includes('\u0000')) throw parserError('没有读取到可审查的合同正文', 422, 'empty-text')
  if (text.length > MAX_TEXT_CHARS) throw parserError('合同正文超过 12 万字，请拆分后导入', 413, 'text-too-large')

  return {
    text,
    fileName: safeFileName,
    extension,
    pageCount: extracted.pageCount,
    charCount: text.length,
  }
}
