import { createZipArchive, writeAndShare } from './evidencePackageExport.js'

function xml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
}

function stylesXml() {
  const font = '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="宋体"/><w:lang w:eastAsia="zh-CN"/>'
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr>${font}<w:sz w:val="24"/><w:szCs w:val="24"/><w:color w:val="000000"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:widowControl/><w:spacing w:after="80" w:line="360" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:widowControl/><w:spacing w:after="80" w:line="360" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr><w:rPr>${font}<w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="ContractTitle"><w:name w:val="Contract Title"/><w:basedOn w:val="Normal"/><w:next w:val="ContractField"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="0" w:after="480" w:line="360" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr><w:rPr>${font}<w:b/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="ContractHeading"><w:name w:val="Contract Heading"/><w:basedOn w:val="Normal"/><w:next w:val="ContractBody"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120" w:line="360" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:rPr>${font}<w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="ContractBody"><w:name w:val="Contract Body"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:widowControl/><w:spacing w:after="80" w:line="360" w:lineRule="auto"/><w:ind w:firstLine="480"/><w:jc w:val="both"/></w:pPr><w:rPr>${font}<w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="ContractField"><w:name w:val="Contract Field"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:widowControl/><w:spacing w:after="80" w:line="360" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:rPr>${font}<w:sz w:val="24"/></w:rPr></w:style></w:styles>`
}

function footerXml() {
  const font = '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="宋体"/>'
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr>${font}<w:sz w:val="18"/><w:color w:val="666666"/></w:rPr><w:t>第 </w:t></w:r><w:fldSimple w:instr=" PAGE "><w:r><w:rPr>${font}<w:sz w:val="18"/><w:color w:val="666666"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple><w:r><w:rPr>${font}<w:sz w:val="18"/><w:color w:val="666666"/></w:rPr><w:t> 页 / 共 </w:t></w:r><w:fldSimple w:instr=" NUMPAGES "><w:r><w:rPr>${font}<w:sz w:val="18"/><w:color w:val="666666"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple><w:r><w:rPr>${font}<w:sz w:val="18"/><w:color w:val="666666"/></w:rPr><w:t> 页</w:t></w:r></w:p></w:ftr>`
}

function paragraph(value, style) {
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t xml:space="preserve">${xml(value)}</w:t></w:r></w:p>`
}

function getFileName(now) {
  const pad = (value) => String(value).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `修订版房屋租赁合同-${stamp}.docx`
}

export function buildRevisedContractDocx({ contractText, now = new Date() } = {}) {
  const lines = String(contractText || '').replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean)
  if (!lines.length) throw new Error('修订合同正文为空')
  const headingPattern = /^(第[一二三四五六七八九十百零〇0-9]+条(?:\s|$)|[一二三四五六七八九十百零〇]+[、.]\s*)/
  const fieldPattern = /^(甲方|乙方|出租方|承租方|法定代表人|授权代表|身份证号|联系电话|签订日期|签署日期|日期|甲方签字|乙方签字)[（(:：]/
  const body = lines.map((line, index) => {
    if (index === 0 && /合同/.test(line) && line.length <= 50) return paragraph(line, 'ContractTitle')
    if (headingPattern.test(line)) return paragraph(line, 'ContractHeading')
    return paragraph(line, fieldPattern.test(line) ? 'ContractField' : 'ContractBody')
  })
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body.join('')}<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`
  const created = now.toISOString()
  return {
    bytes: createZipArchive([
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdOfficeDocument" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rIdCore" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rIdApp" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>' },
      { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(lines[0])}</dc:title><dc:creator>租小审</dc:creator><cp:lastModifiedBy>租小审</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified></cp:coreProperties>` },
      { name: 'docProps/app.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>租小审</Application><AppVersion>1.1</AppVersion></Properties>' },
      { name: 'word/document.xml', data: documentXml },
      { name: 'word/styles.xml', data: stylesXml() },
      { name: 'word/footer1.xml', data: footerXml() },
      { name: 'word/_rels/document.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>' },
    ], now),
    fileName: getFileName(now),
  }
}

export function exportRevisedContract(contractText) {
  const document = buildRevisedContractDocx({ contractText })
  return writeAndShare(document.fileName, document.bytes)
}
