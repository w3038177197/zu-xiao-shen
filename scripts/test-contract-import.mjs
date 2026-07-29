import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Document, Packer, Paragraph } from 'docx'
import {
  CONTRACT_DOCUMENT_MAX_BYTES,
  extractPdfText,
  parseContractDocument,
} from '../server/contract-document-parser.mjs'
import { detectImageSignature, recognizeImageOffline } from '../server/ai-proxy.mjs'

const checks = []
const check = (name, fn) => checks.push([name, fn])

check('TXT/MD：UTF-8 正文规范化且不落盘', async () => {
  const result = await parseContractDocument({
    buffer: Buffer.from('\uFEFF第一条\r\n第二条'),
    fileName: '合同.txt',
  })
  assert.equal(result.text, '第一条\n第二条')
  assert.equal(result.extension, 'txt')
  assert.equal(result.pageCount, null)
})

check('DOCX：真实提取合同正文', async () => {
  const document = new Document({ sections: [{ children: [new Paragraph('房屋租赁合同'), new Paragraph('押金应于退租后返还。')] }] })
  const result = await parseContractDocument({ buffer: await Packer.toBuffer(document), fileName: '合同.docx' })
  assert.match(result.text, /房屋租赁合同/)
  assert.match(result.text, /押金应于退租后返还/)
  assert.equal(result.extension, 'docx')
})

check('PDF：真实样本逐页提取正文', async () => {
  const buffer = await readFile(new URL('../public/dataset/rental-contracts/qhd-2025-rental-contract.pdf', import.meta.url))
  const result = await parseContractDocument({ buffer, fileName: '示范合同.pdf' })
  assert.equal(result.extension, 'pdf')
  assert.ok(result.pageCount > 1)
  assert.ok(result.charCount > 1_000)
  assert.match(result.text, /房屋租赁合同/)
})

check('安全限制：拒绝伪造 PDF、未知格式和超大文件', async () => {
  await assert.rejects(
    parseContractDocument({ buffer: Buffer.from('not pdf'), fileName: '伪造.pdf' }),
    (error) => error.code === 'invalid-pdf' && error.status === 422,
  )
  await assert.rejects(
    parseContractDocument({ buffer: Buffer.from('hello'), fileName: '合同.exe' }),
    (error) => error.code === 'unsupported-file' && error.status === 415,
  )
  await assert.rejects(
    parseContractDocument({ buffer: Buffer.alloc(CONTRACT_DOCUMENT_MAX_BYTES + 1), fileName: '超大.txt' }),
    (error) => error.code === 'file-too-large' && error.status === 413,
  )
})

check('接口与页面：会话鉴权、内存上传、逐次确认和取消入口均存在', async () => {
  const serverSource = await readFile(new URL('../server/ai-proxy.mjs', import.meta.url), 'utf8')
  const pageSource = await readFile(new URL('../miniapp/src/pages/contract/index.jsx', import.meta.url), 'utf8')
  assert.match(serverSource, /\/api\/miniapp\/contract\/parse/)
  assert.match(serverSource, /\/api\/miniapp\/ocr\/image/)
  assert.match(serverSource, /app\.post\('\/api\/miniapp\/ocr\/image', authenticateMiniappSession/)
  assert.match(serverSource, /authenticateMiniappSession/)
  assert.match(serverSource, /multer\.memoryStorage\(\)/)
  assert.match(serverSource, /Cache-Control', 'no-store'/)
  assert.match(serverSource, /maxConcurrentContractParses/)
  assert.match(pageSource, /上传至租小审服务端/)
  assert.match(pageSource, /原始文件仅在内存中处理，不写入磁盘、不持久化保存/)
  assert.match(pageSource, /取消解析/)
  assert.match(pageSource, /拍照识别/)
  assert.match(pageSource, /相册识别/)
  const importSource = await readFile(new URL('../miniapp/src/utils/contractTextImport.js', import.meta.url), 'utf8')
  assert.match(importSource, /path: '\/api\/miniapp\/ocr\/image'/)
})

check('图片签名：完整容器标记通过，伪造、截断和长度不符时拒绝', () => {
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20), Buffer.from([0xff, 0xd9])])
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
  const webp = Buffer.alloc(30)
  webp.write('RIFF', 0, 'ascii')
  webp.writeUInt32LE(22, 4)
  webp.write('WEBPVP8X', 8, 'ascii')
  webp.writeUInt32LE(10, 16)
  assert.equal(detectImageSignature(jpeg), 'jpeg')
  assert.equal(detectImageSignature(png), 'png')
  assert.equal(detectImageSignature(webp), 'webp')
  assert.equal(detectImageSignature(Buffer.from('这是文本不是图片', 'utf8')), null)
  assert.equal(detectImageSignature(Buffer.alloc(0)), null)
  assert.equal(detectImageSignature(jpeg.subarray(0, -2)), null)
  assert.equal(detectImageSignature(png.subarray(0, -12)), null)
  const wrongWebpLength = Buffer.from(webp)
  wrongWebpLength.writeUInt32LE(999, 4)
  assert.equal(detectImageSignature(wrongWebpLength), null)
})

check('OCR worker：成功、识别失败和超时都会真实执行 terminate', async () => {
  const run = async (recognize, timeoutMs = 50) => {
    let terminated = 0
    const worker = {
      recognize,
      terminate: async () => { terminated += 1 },
    }
    const promise = recognizeImageOffline(Buffer.from('image'), {
      createWorkerImpl: async () => worker,
      prepareLangPath: async () => 'mock-lang-path',
      timeoutMs,
    })
    return { promise, terminated: () => terminated }
  }

  const success = await run(async () => ({ data: { text: '合同文字', confidence: 91 } }))
  assert.deepEqual(await success.promise, { text: '合同文字', confidence: 91 })
  assert.equal(success.terminated(), 1)

  const failure = await run(async () => { throw new Error('recognize failed') })
  await assert.rejects(failure.promise, /recognize failed/)
  assert.equal(failure.terminated(), 1)

  const timeout = await run(() => new Promise(() => {}), 5)
  await assert.rejects(timeout.promise, /timed out/)
  assert.equal(timeout.terminated(), 1)
})

check('PDF loadingTask：初始解析失败、超页和逐页失败都会真实执行 destroy', async () => {
  const makeTask = (promise) => {
    let destroyed = 0
    return {
      task: { promise, destroy: async () => { destroyed += 1 } },
      destroyed: () => destroyed,
    }
  }

  const initialFailure = makeTask(Promise.reject(new Error('load failed')))
  await assert.rejects(extractPdfText(Buffer.alloc(1), { getDocument: () => initialFailure.task }), /load failed/)
  assert.equal(initialFailure.destroyed(), 1)

  const tooManyPages = makeTask(Promise.resolve({ numPages: 81 }))
  await assert.rejects(
    extractPdfText(Buffer.alloc(1), { getDocument: () => tooManyPages.task }),
    (error) => error.code === 'too-many-pages' && error.status === 413,
  )
  assert.equal(tooManyPages.destroyed(), 1)

  let pageCleaned = 0
  const pageFailure = makeTask(Promise.resolve({
    numPages: 1,
    getPage: async () => ({
      getTextContent: async () => { throw new Error('page failed') },
      cleanup: () => { pageCleaned += 1 },
    }),
  }))
  await assert.rejects(extractPdfText(Buffer.alloc(1), { getDocument: () => pageFailure.task }), /page failed/)
  assert.equal(pageCleaned, 1)
  assert.equal(pageFailure.destroyed(), 1)

  await assert.rejects(
    parseContractDocument({ buffer: Buffer.from('%PDF-1.4\nbroken'), fileName: '损坏.pdf' }),
    (error) => error.code === 'parse-failed' || error.code === 'invalid-pdf',
  )
})

let passed = 0
for (const [name, fn] of checks) {
  await fn()
  passed += 1
  console.log(`PASS ${name}`)
}
console.log(`Contract import check passed: ${passed}/${checks.length}`)
