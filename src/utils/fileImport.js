import {
  CHECKIN_PHOTO_MAX_EDGE,
  CHECKIN_PHOTO_QUALITY,
  CONTRACT_IMAGE_MIME_PATTERN,
  CONTRACT_IMPORT_MAX_BYTES,
  CONTRACT_PDF_EXTENSIONS,
  CONTRACT_TEXT_EXTENSIONS,
  CONTRACT_WORD_EXTENSIONS,
} from '../constants/checkinConfig.js'

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function loadImageFromDataUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('照片读取失败'))
    image.src = url
  })
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('照片压缩失败'))
      }
    }, type, quality)
  })
}

export async function compressCheckinPhoto(file) {
  const dataUrl = await readFileAsDataUrl(file)
  const image = await loadImageFromDataUrl(dataUrl)
  const scale = Math.min(1, CHECKIN_PHOTO_MAX_EDGE / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height))

  if (scale >= 1 && file.size <= 900 * 1024) {
    return dataUrl
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale))
  canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale))
  const context = canvas.getContext('2d')

  if (!context) {
    return dataUrl
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const blob = await canvasToBlob(canvas, 'image/jpeg', CHECKIN_PHOTO_QUALITY)
  return readFileAsDataUrl(blob)
}

function getFileExtension(fileName) {
  return String(fileName || '').split('.').pop()?.toLowerCase() || ''
}

function isSupportedContractFile(file) {
  if (!file) return false

  const extension = getFileExtension(file.name)
  return (
    CONTRACT_TEXT_EXTENSIONS.includes(extension)
    || CONTRACT_WORD_EXTENSIONS.includes(extension)
    || CONTRACT_PDF_EXTENSIONS.includes(extension)
    || CONTRACT_IMAGE_MIME_PATTERN.test(file.type)
  )
}

function isUsableOcrText(text, confidence) {
  const normalized = String(text || '').trim()
  const readableChars = normalized.match(/[\p{Script=Han}A-Za-z]/gu) || []
  const digitOnly = normalized && /^[\d\s.,:;/-]+$/.test(normalized)

  return normalized.length >= 12 && readableChars.length >= 6 && !digitOnly && Number(confidence || 0) >= 35
}

async function extractPdfText(file) {
  const [{ default: pdfWorkerUrl }, pdfjsLib] = await Promise.all([
    import('pdfjs-dist/build/pdf.worker.mjs?url'),
    import('pdfjs-dist'),
  ])

  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const pages = await Promise.all(
    Array.from({ length: pdf.numPages }, async (_, index) => {
      const page = await pdf.getPage(index + 1)
      const content = await page.getTextContent()
      return content.items.map((item) => item.str).join(' ')
    }),
  )

  return pages.join('\n\n').trim()
}

async function extractDocxText(file) {
  const mammoth = await import('mammoth/mammoth.browser')
  const buffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })

  return String(result.value || '').trim()
}

async function extractImageTextWithOcr(file) {
  const formData = new FormData()
  formData.append('image', file)

  const response = await fetch('/api/ocr/image', {
    method: 'POST',
    body: formData,
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data?.message || '图片 OCR 识别失败，请确认后端代理已启动')
  }

  const text = String(data.text || '').trim()
  const confidence = Number(data.confidence || 0)

  if (!isUsableOcrText(text, confidence)) {
    throw new Error(`图片 OCR 结果过弱，置信度 ${confidence || 0}%，请换更清晰的照片或改用文本粘贴`)
  }

  return {
    text,
    confidence,
    mode: data.mode || 'offline-tesseract',
  }
}

export async function extractContractTextFromFile(file) {
  if (!file) {
    throw new Error('请选择要导入的合同文件')
  }
  if (file.size > CONTRACT_IMPORT_MAX_BYTES) {
    throw new Error('文件超过 8MB，请压缩后再上传')
  }
  if (!isSupportedContractFile(file)) {
    throw new Error('当前支持 TXT、MD、DOCX、PDF 和图片格式')
  }

  const extension = getFileExtension(file.name)

  if (CONTRACT_TEXT_EXTENSIONS.includes(extension)) {
    return {
      text: (await file.text()).trim(),
      type: '文本文件',
      source: 'TXT / MD',
    }
  }

  if (CONTRACT_WORD_EXTENSIONS.includes(extension)) {
    return {
      text: await extractDocxText(file),
      type: 'Word 合同',
      source: 'Word',
    }
  }

  if (CONTRACT_PDF_EXTENSIONS.includes(extension)) {
    return {
      text: await extractPdfText(file),
      type: 'PDF 合同',
      source: 'PDF',
    }
  }

  if (CONTRACT_IMAGE_MIME_PATTERN.test(file.type)) {
    const result = await extractImageTextWithOcr(file)

    return {
      text: result.text,
      type: `图片 OCR 合同（置信度 ${result.confidence || 0}%）`,
      source: '图片 OCR',
      confidence: result.confidence || 0,
      mode: result.mode,
    }
  }

  throw new Error('当前支持 TXT、MD、DOCX、PDF 和图片格式')
}
