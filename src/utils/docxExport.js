export async function copyTextToClipboard(text) {
  if (!text) return false

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return true
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  const success = document.execCommand('copy')
  document.body.removeChild(textarea)
  return success
}

export async function buildContractDocxBlob(contractDraft) {
  const {
    AlignmentType,
    Document,
    Packer,
    Paragraph,
    TextRun,
    convertInchesToTwip,
  } = await import('docx')

  const lines = String(contractDraft ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
    .split('\n')

  const createTextRun = (text, options = {}) =>
    new TextRun({
      text,
      font: 'SimSun',
      size: options.size || 24,
      bold: options.bold || false,
    })

  const children = lines
    .map((line, index) => {
      const trimmed = line.trim()
      if (!trimmed) {
        return new Paragraph({
          children: [createTextRun('')],
          spacing: { after: 120 },
        })
      }

      if (index === 0) {
        return new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 320 },
          children: [createTextRun(trimmed, { bold: true, size: 36 })],
        })
      }

      if (/^[一二三四五六七八九十]+、/.test(trimmed)) {
        return new Paragraph({
          spacing: { before: 220, after: 100 },
          children: [createTextRun(trimmed, { bold: true, size: 25 })],
        })
      }

      const isSignatureLine = /^(甲方|乙方|日期|签字|联系电话|身份证号|经甲、乙双方)/.test(trimmed)

      return new Paragraph({
        alignment: isSignatureLine ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
        indent: isSignatureLine ? undefined : { firstLine: 480 },
        spacing: { after: 160, line: 444 },
        children: [createTextRun(trimmed)],
      })
    })

  const document = new Document({
    title: '租小审-优化合同',
    creator: '租小审',
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.86),
              right: convertInchesToTwip(0.71),
              bottom: convertInchesToTwip(0.79),
              left: convertInchesToTwip(0.71),
            },
          },
        },
        children,
      },
    ],
  })

  return Packer.toBlob(document)
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function buildTextReportDocxBlob(reportText, title = '租小审报告') {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    TextRun,
    convertInchesToTwip,
  } = await import('docx')
  const lines = String(reportText || title)
    .replace(/\r\n/g, '\n')
    .trim()
    .split('\n')

  const createRun = (text, options = {}) =>
    new TextRun({
      text,
      font: 'SimSun',
      size: options.size || 23,
      bold: options.bold || false,
      color: options.color || '171713',
    })

  const children = lines.map((line, index) => {
    const trimmed = line.trim()

    if (!trimmed) {
      return new Paragraph({
        children: [createRun('')],
        spacing: { after: 80 },
      })
    }

    if (index === 0) {
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        heading: HeadingLevel.TITLE,
        spacing: { after: 260 },
        border: {
          bottom: {
            color: '08D36C',
            size: 8,
            space: 12,
            style: BorderStyle.SINGLE,
          },
        },
        children: [createRun(trimmed, { bold: true, size: 34 })],
      })
    }

    if (/^[一二三四五六七八九十]+、/.test(trimmed)) {
      return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
        children: [createRun(trimmed, { bold: true, size: 27 })],
      })
    }

    if (/^\d+\./.test(trimmed)) {
      return new Paragraph({
        spacing: { before: 120, after: 80, line: 390 },
        children: [createRun(trimmed, { bold: true, size: 24 })],
      })
    }

    const isMetaLine = /^(生成时间|房屋类型|验房完成度|疑似瑕疵|已上传照片|合同类型|用户身份|审查深度|综合风险值|高风险|中风险|低风险|原文摘要)/.test(trimmed)

    return new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: isMetaLine ? 90 : 140, line: 420 },
      indent: isMetaLine ? undefined : { firstLine: 420 },
      children: [createRun(trimmed, { bold: isMetaLine })],
    })
  })

  const document = new Document({
    title,
    creator: '租小审',
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.78),
              right: convertInchesToTwip(0.72),
              bottom: convertInchesToTwip(0.78),
              left: convertInchesToTwip(0.72),
            },
          },
        },
        children,
      },
    ],
  })

  return Packer.toBlob(document)
}
