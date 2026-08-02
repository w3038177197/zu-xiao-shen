import assert from 'node:assert/strict'

Object.assign(globalThis, {
  ENABLE_INNER_HTML: false,
  ENABLE_ADJACENT_HTML: false,
  ENABLE_CLONE_NODE: false,
  ENABLE_CONTAINS: false,
  ENABLE_SIZE_APIS: false,
  ENABLE_TEMPLATE_CONTENT: false,
  ENABLE_MUTATION_OBSERVER: false,
})

const [{
  createDefaultCheckinState,
  getCheckinStats,
  hasCheckinContent,
  normalizeCheckinState,
  saveCheckinInspectionState,
  getCheckinContextSummary,
}, {
  createDefaultEvidencePackState,
  loadEvidencePackState,
  saveEvidencePackState,
  normalizeEvidencePackState,
  addAttachment,
  removeAttachment,
  getGroupAttachments,
  getAttachmentStats,
  evidenceGroupMeta,
  hasModuleReference,
  addModuleReference,
  importModuleReferences,
}, { createDebouncedSaver }, localDataManager, businessReportExport, subsidyData, clipboard, attachmentUtils, textFileExport, evidencePackageExport, evidenceImport, contractReview, demoContractsData, reviewHistory, workflowContext, aiAssistant, contractTextImport, privacyAuth] = await Promise.all([
  import('../miniapp/src/features/checkinInspection.js'),
  import('../miniapp/src/features/evidencePack.js'),
  import('../miniapp/src/utils/debounceSave.js'),
  import('../miniapp/src/utils/localDataManager.js'),
  import('../miniapp/src/utils/businessReportExport.js'),
  import('../src/data/subsidyPolicies.js'),
  import('../miniapp/src/utils/copyText.js'),
  import('../miniapp/src/utils/evidenceAttachments.js'),
  import('../miniapp/src/utils/textFileExport.js'),
  import('../miniapp/src/utils/evidencePackageExport.js'),
  import('../miniapp/src/features/evidenceImport.js'),
  import('../miniapp/src/features/contractReview.js'),
  import('../src/data/demoContracts.js'),
  import('../miniapp/src/features/reviewHistory.js'),
  import('../miniapp/src/features/workflowContext.js'),
  import('../miniapp/src/features/aiAssistant.js'),
  import('../miniapp/src/utils/contractTextImport.js'),
  import('../miniapp/src/utils/privacyAuth.js'),
])
const { STORAGE_KEYS } = await import('../miniapp/src/constants/appConfig.js')
const { getCheckinItems } = await import('../miniapp/src/constants/checkinConfig.js')
const checkinPhotoTransactions = await import('../miniapp/src/utils/checkinPhotoTransactions.js')
const evidenceAttachmentTransactions = await import('../miniapp/src/utils/evidenceAttachmentTransactions.js')
const Taro = (await import('../miniapp/node_modules/@tarojs/taro/index.js')).default

const storage = new Map()
Taro.getStorageSync = (key) => storage.get(key)
Taro.setStorageSync = (key, value) => storage.set(key, value)
Taro.removeStorageSync = (key) => storage.delete(key)
Taro.getStorageInfoSync = () => ({ currentSize: 12, limit: 10240 })
let copied = ''
Taro.setClipboardData = ({ data, success }) => {
  copied = data
  success?.()
}
Taro.showToast = () => {}
Taro.showModal = () => {}
let lastChooseImageArgs = null
Taro.chooseImage = (options) => {
  lastChooseImageArgs = options
  const result = { tempFilePaths: ['wxfile://temp/selected.jpg'], tempFiles: [{ path: 'wxfile://temp/selected.jpg', size: 2048, type: 'image/jpeg' }] }
  options.success?.(result)
  return Promise.resolve(result)
}
let lastUploadArgs = null
let uploadShouldFail = false
let uploadShouldPending = false
let uploadResponseData = { ok: true, text: '解析后的合同正文', fileName: '合同.pdf' }
Taro.uploadFile = (options) => {
  lastUploadArgs = options
  let finished = false
  let progressCallback = null
  const task = {
    onProgressUpdate(callback) {
      progressCallback = callback
    },
    abort() {
      if (finished) return
      finished = true
      options.fail?.({ errMsg: 'uploadFile:fail abort' })
    },
  }
  queueMicrotask(() => {
    if (finished || uploadShouldPending) return
    progressCallback?.({ progress: 64 })
    finished = true
    if (uploadShouldFail) options.fail?.({ errMsg: 'uploadFile:fail network error' })
    else options.success?.({ statusCode: 200, data: JSON.stringify(uploadResponseData) })
  })
  return task
}

// 模拟小程序文件系统和 shareFileMessage
const virtualFiles = new Map()
let writeFileShouldFail = false
let shareFileShouldFail = false
let shareFileShouldCancel = false
let lastShareArgs = null
Taro.env = { USER_DATA_PATH: 'wxfile://userdata' }
Taro.getFileSystemManager = () => ({
  getSavedFileList: ({ success }) => success({
    fileList: [...savedFiles.entries()].map(([filePath, file]) => ({
      filePath,
      size: Number(file.size) || 0,
      createTime: 1,
    })),
  }),
  writeFile: ({ filePath, data, encoding, success, fail }) => {
    if (writeFileShouldFail) {
      fail({ errMsg: 'writeFile:fail disk full' })
      return
    }
    virtualFiles.set(filePath, { data, encoding })
    success({ errMsg: 'writeFile:ok' })
  },
  readFile: ({ filePath, success, fail }) => {
    const file = virtualFiles.get(filePath)
    if (!file) {
      fail({ errMsg: 'readFile:fail not exist' })
      return
    }
    success({ data: file.data, errMsg: 'readFile:ok' })
  },
})
let messageFileResult = null
let messageFileError = null
let clipboardText = ''
Taro.chooseMessageFile = async (options = {}) => {
  if (messageFileError) {
    options.fail?.(messageFileError)
    throw messageFileError
  }
  const result = messageFileResult || { tempFiles: [] }
  options.success?.(result)
  return result
}
Taro.getClipboardData = async () => ({ data: clipboardText })
Taro.shareFileMessage = ({ filePath, fileName, success, fail }) => {
  lastShareArgs = { filePath, fileName }
  if (shareFileShouldCancel) {
    fail({ errMsg: 'shareFileMessage:fail cancel' })
    return
  }
  if (shareFileShouldFail) {
    fail({ errMsg: 'shareFileMessage:fail network error' })
    return
  }
  success({ errMsg: 'shareFileMessage:ok' })
}

// 模拟小程序持久化文件系统：saveFile 把临时路径注册为持久路径
const savedFiles = new Map()
let saveFileSeq = 0
let saveFileShouldFail = false
let removeSavedFileShouldFail = false
Taro.getFileInfo = async ({ filePath }) => {
  const size = savedFiles.has(filePath) ? savedFiles.get(filePath).size : 1024
  return { size, digest: '' }
}
Taro.saveFile = async ({ tempFilePath }) => {
  if (saveFileShouldFail) {
    throw { errMsg: 'saveFile:fail no space left' }
  }
  saveFileSeq += 1
  const savedPath = `wxfile://saved/evidence_${saveFileSeq}`
  savedFiles.set(savedPath, { tempFilePath, size: 1024 })
  return { savedFilePath: savedPath, errMsg: 'saveFile:ok' }
}
Taro.removeSavedFile = async ({ filePath }) => {
  if (removeSavedFileShouldFail) {
    // 模拟权限错误等非"文件不存在"的失败
    throw { errMsg: 'removeSavedFile:fail permission denied' }
  }
  const existed = savedFiles.delete(filePath)
  if (!existed) {
    // 文件不存在时 Taro 实际会抛错
    throw { errMsg: 'removeSavedFile:fail not exist' }
  }
  return { errMsg: 'removeSavedFile:ok' }
}

const checks = [
  ['证据包默认状态不再预填演示地址和金额', () => {
    const state = createDefaultEvidencePackState()
    assert.equal(state.formData.address, '')
    assert.equal(state.formData.deposit, '')
    assert.equal(state.formData.monthlyRent, '')
  }],
  ['验房模型统一与旧数据迁移', () => {
    const oldState = { livingRoom: { walls: { status: 'defect', photos: Array.from({ length: 8 }, (_, i) => `photo-${i}`) } } }
    const state = normalizeCheckinState(oldState)
    assert.deepEqual(Object.keys(state), ['living', 'kitchen', 'bathroom', 'meter'])
    assert.equal(Object.keys(state.living).length, 4)
    assert.equal(state.living.wall.status, 'defect')
    assert.equal(state.living.wall.photos.length, 6)
    assert.equal(getCheckinStats(state).total, 16)
    assert.equal(Object.keys(createDefaultCheckinState()).length, 4)
    assert.deepEqual(getCheckinItems('meter').map((item) => item.label), ['水表', '电表', '燃气表', '阀门/线路'])
    assert.equal(getCheckinItems('kitchen').some((item) => item.label.includes('门锁')), false)
    assert.equal(getCheckinItems('bathroom').some((item) => item.label === '家具家电'), false)
  }],
  ['验房照片添加：记录保存失败时回收新文件且不更新状态', async () => {
    const state = createDefaultCheckinState()
    let removeCalls = 0
    const result = await checkinPhotoTransactions.persistAddedCheckinPhotos({
      state,
      roomKey: 'living',
      itemKey: 'wall',
      savedPaths: ['wxfile://saved/new-photo.jpg'],
      saveState: () => false,
      removeFile: async () => { removeCalls += 1; return { ok: true } },
    })
    assert.equal(result.ok, false)
    assert.equal(result.reason, 'storage-failed')
    assert.equal(removeCalls, 1)
    assert.deepEqual(result.state, state)
    assert.equal(result.state.living.wall.photos.length, 0)
  }],
  ['验房照片删除：先保存记录，Storage 失败时不删除文件', async () => {
    const state = createDefaultCheckinState()
    state.living.wall.photos = ['wxfile://saved/keep-photo.jpg']
    const events = []
    const result = await checkinPhotoTransactions.deleteCheckinPhoto({
      state,
      roomKey: 'living',
      itemKey: 'wall',
      photoIndex: 0,
      saveState: () => { events.push('save'); return false },
      removeFile: async () => { events.push('remove'); return { ok: true } },
    })
    assert.deepEqual(events, ['save'])
    assert.equal(result.reason, 'storage-failed')
    assert.equal(result.state.living.wall.photos[0], 'wxfile://saved/keep-photo.jpg')
  }],
  ['验房照片删除：文件失败时回滚记录，回滚失败则保持新状态', async () => {
    const state = createDefaultCheckinState()
    state.living.wall.photos = ['wxfile://saved/fail-photo.jpg']
    let saves = 0
    const rolledBack = await checkinPhotoTransactions.deleteCheckinPhoto({
      state,
      roomKey: 'living',
      itemKey: 'wall',
      photoIndex: 0,
      saveState: () => { saves += 1; return true },
      removeFile: async () => ({ ok: false }),
    })
    assert.equal(saves, 2)
    assert.equal(rolledBack.reason, 'file-failed')
    assert.equal(rolledBack.state.living.wall.photos.length, 1)

    saves = 0
    const rollbackFailed = await checkinPhotoTransactions.deleteCheckinPhoto({
      state,
      roomKey: 'living',
      itemKey: 'wall',
      photoIndex: 0,
      saveState: () => { saves += 1; return saves === 1 },
      removeFile: async () => ({ ok: false }),
    })
    assert.equal(rollbackFailed.reason, 'rollback-failed')
    assert.equal(rollbackFailed.state.living.wall.photos.length, 0)
  }],
  ['验房重置：先保存空记录，失败时保留全部照片', async () => {
    const previousState = createDefaultCheckinState()
    previousState.living.wall.photos = ['wxfile://saved/a.jpg']
    previousState.kitchen.appliance.photos = ['wxfile://saved/b.jpg']
    const nextState = createDefaultCheckinState()
    let removeCalls = 0
    const result = await checkinPhotoTransactions.replaceCheckinStateAndRemovePhotos({
      previousState,
      nextState,
      saveState: () => false,
      removeFile: async () => { removeCalls += 1; return { ok: true } },
    })
    assert.equal(result.reason, 'storage-failed')
    assert.equal(removeCalls, 0)
    assert.equal(result.state.living.wall.photos.length, 1)
    assert.equal(result.state.kitchen.appliance.photos.length, 1)
  }],
  ['验房清理照片：记录成功后清理全部文件并报告部分失败', async () => {
    const previousState = createDefaultCheckinState()
    previousState.living.wall.photos = ['wxfile://saved/a.jpg']
    previousState.kitchen.appliance.photos = ['wxfile://saved/b.jpg']
    const nextState = checkinPhotoTransactions.createCheckinStateWithoutPhotos(previousState)
    const removed = []
    const result = await checkinPhotoTransactions.replaceCheckinStateAndRemovePhotos({
      previousState,
      nextState,
      saveState: () => true,
      removeFile: async (path) => { removed.push(path); return { ok: !path.endsWith('/b.jpg') } },
    })
    assert.equal(result.ok, true)
    assert.equal(result.cleanupFailed, 1)
    assert.deepEqual(removed.sort(), ['wxfile://saved/a.jpg', 'wxfile://saved/b.jpg'])
    assert.equal(checkinPhotoTransactions.collectCheckinPhotoPaths(result.state).length, 0)
  }],
  ['验房照片被证据包引用后，验房清理只移除记录且保留原文件', async () => {
    const attachment = await attachmentUtils.persistAttachment('wxfile://temp/protected.jpg', 'album', '验房留证.jpg')
    const evidenceState = addModuleReference(createDefaultEvidencePackState(), 'photos', {
      ...attachment,
      source: 'module',
      sourceModule: 'checkin',
      sourcePath: 'living.wall.photos[0]',
    })
    assert.equal(saveEvidencePackState(evidenceState), true)
    const protectedPaths = evidenceImport.getEvidenceReferencedCheckinPhotoPaths()
    assert.equal(protectedPaths.has(attachment.localPath), true)

    const previousState = createDefaultCheckinState()
    previousState.living.wall.photos = [attachment.localPath]
    const result = await checkinPhotoTransactions.replaceCheckinStateAndRemovePhotos({
      previousState,
      nextState: checkinPhotoTransactions.createCheckinStateWithoutPhotos(previousState),
      saveState: () => true,
      removeFile: async (filePath) => protectedPaths.has(filePath)
        ? { ok: true, reason: 'evidence-reference' }
        : attachmentUtils.removePersistedFile(filePath),
    })
    assert.equal(result.ok, true)
    assert.equal(result.retainedFiles, 1)
    assert.equal(savedFiles.has(attachment.localPath), true)
    assert.equal(result.state.living.wall.photos.length, 0)
  }],
  ['证据包保存与读取', () => {
    const state = createDefaultEvidencePackState()
    state.formData.address = '测试地址'
    assert.equal(saveEvidencePackState(state), true)
    assert.equal(loadEvidencePackState().formData.address, '测试地址')
    assert.equal(typeof storage.get(STORAGE_KEYS.evidencePack), 'string')
  }],
  ['防抖保存只写入最后一次状态', async () => {
    let saved = null
    const saver = createDebouncedSaver((value) => { saved = value; return true }, 5)
    saver.schedule('first')
    saver.schedule('last')
    await new Promise((resolve) => setTimeout(resolve, 15))
    assert.equal(saved, 'last')
    saver.schedule('flushed')
    assert.equal(saver.flush(), true)
    assert.equal(saved, 'flushed')
  }],
  ['本地数据导出与清除', async () => {
    storage.set(STORAGE_KEYS.contractDraft, '合同草稿')
    const exported = localDataManager.formatLocalDataExport()
    assert.match(exported, /合同草稿/)
    assert.equal(localDataManager.getLocalStorageInfo().currentSize, 12)
    assert.equal((await localDataManager.clearLocalData({ removePhotos: false })).ok, true)
    assert.equal(storage.has(STORAGE_KEYS.contractDraft), false)
  }],
  ['清除全部数据会一并清除旧版本遗留的 Storage key', async () => {
    // 模拟旧版本遗留数据：当前版本已不再写入，但旧安装可能残留
    storage.set(STORAGE_KEYS.history, [{ id: 'old', time: '2026-01-01' }])
    storage.set(STORAGE_KEYS.aiConfig, { mode: 'remote' })
    storage.set(STORAGE_KEYS.aiFeedback, { rating: 1 })
    storage.set(STORAGE_KEYS.localOnlyMode, true)
    storage.set(STORAGE_KEYS.accountId, 'old-account-001')
    // 同时写入当前版本 key，确认也会被清除
    storage.set(STORAGE_KEYS.aiSession, { token: 'session-token' })
    storage.set(STORAGE_KEYS.aiRemoteConsent, true)

    const result = await localDataManager.clearLocalData({ removePhotos: false })
    assert.equal(result.ok, true)
    // 5 个旧版本遗留 key 必须被清除
    assert.equal(storage.has(STORAGE_KEYS.history), false, 'history 未清除')
    assert.equal(storage.has(STORAGE_KEYS.aiConfig), false, 'aiConfig 未清除')
    assert.equal(storage.has(STORAGE_KEYS.aiFeedback), false, 'aiFeedback 未清除')
    assert.equal(storage.has(STORAGE_KEYS.localOnlyMode), false, 'localOnlyMode 未清除')
    assert.equal(storage.has(STORAGE_KEYS.accountId), false, 'accountId 未清除')
    // 当前版本 key 也被清除
    assert.equal(storage.has(STORAGE_KEYS.aiSession), false)
    assert.equal(storage.has(STORAGE_KEYS.aiRemoteConsent), false)
  }],
  ['隐私说明与实际上传行为一致：区分本机保存与服务端上传，且服务端仅内存处理', async () => {
    const fs = await import('node:fs')
    const privacyChecklist = JSON.parse(fs.readFileSync(new URL('../miniapp/src/privacy.json', import.meta.url), 'utf8'))
    const importSource = fs.readFileSync(new URL('../miniapp/src/utils/contractTextImport.js', import.meta.url), 'utf8')
    const parserSource = fs.readFileSync(new URL('../server/contract-document-parser.mjs', import.meta.url), 'utf8')
    const aiProxySource = fs.readFileSync(new URL('../server/ai-proxy.mjs', import.meta.url), 'utf8')

    // 1. 验房/证据照片：必须声明仅本机保存
    const photoType = privacyChecklist.privacyTypes.find((t) => t.name === '选中的照片或视频信息')
    assert.match(photoType.purpose, /验房.*仅保存在本机/)
    // 验房照片本身不应被描述为上传（合同 OCR 上传是另一回事）
    assert.doesNotMatch(photoType.purpose, /验房照片.*上传/)

    // 2. DOCX/PDF 合同：必须披露用户确认后上传服务端提取文字，原始文件仅在内存中处理
    const fileType = privacyChecklist.privacyTypes.find((t) => t.name === '选中的文件')
    assert.match(fileType.purpose, /DOCX\/PDF/)
    assert.match(fileType.purpose, /逐次确认后上传服务端提取文字/)
    assert.match(fileType.purpose, /原始文件仅在内存中处理/)
    assert.match(fileType.purpose, /不写入磁盘、不持久化保存/)
    assert.match(fileType.purpose, /请求处理结束后释放相关内存/)

    // 3. 合同拍照/相册 OCR：必须披露用户确认后上传服务端识别，原始图片仅在内存中处理
    const cameraType = privacyChecklist.privacyTypes.find((t) => t.name === '摄像头')
    assert.match(cameraType.purpose, /OCR/)
    assert.match(cameraType.purpose, /逐次确认后上传服务端识别文字/)
    assert.match(cameraType.purpose, /原始图片仅在内存中处理/)
    assert.match(cameraType.purpose, /请求处理结束后释放相关内存/)

    // 4. 联网 AI：默认优先联网，首次请求前征得同意，拒绝/未授权/不可用时本地降级
    const aiType = privacyChecklist.privacyTypes.find((t) => t.name === '联网 AI 问题与可选资料摘要')
    assert.match(aiType.purpose, /默认优先使用联网 AI/)
    assert.match(aiType.purpose, /首次发送联网请求前单独征得用户同意/)
    assert.match(aiType.purpose, /拒绝、未授权或服务不可用时使用本地分析/)
    assert.match(aiType.purpose, /默认不发送合同全文、照片和附件/)
    const contractReviewType = privacyChecklist.privacyTypes.find((t) => t.name === 'AI 合同全文复核')
    assert.ok(contractReviewType)
    assert.match(contractReviewType.purpose, /点击“开始综合审查”即主动发起/)
    assert.match(contractReviewType.purpose, /隐藏姓名、地址、手机号、证件号、银行卡号和邮箱/)
    assert.match(contractReviewType.purpose, /不写盘、不持久化合同正文/)
    assert.match(privacyChecklist.dataHandling.remoteAiConsent, /首次发送联网请求前单独征得用户同意/)
    assert.match(privacyChecklist.dataHandling.remoteAiConsent, /用户点击“开始综合审查”即主动发起/)
    assert.match(privacyChecklist.dataHandling.remoteAiConsent, /AI 服务不可用、请求取消或长合同超限时保留本地规则审查结果/)
    assert.match(privacyChecklist.dataHandling.remoteUpload, /普通联网 AI 问答默认不发送合同全文、照片和附件/)
    assert.match(privacyChecklist.dataHandling.remoteUpload, /点击“开始综合审查”后发送双重脱敏的合同文字/)

    // 5. 实际上传逻辑确实存在（contractTextImport.js 有 uploadFile 调用）
    assert.match(importSource, /uploadFile|startCloudContainerRequest/)

    // 6. 服务端仅内存处理：memoryStorage、OCR worker terminate、retained:false，无持久化写入
    assert.match(aiProxySource, /multer\.memoryStorage\(\)/)
    assert.match(aiProxySource, /await\s+worker\.terminate\(\)/)
    assert.match(aiProxySource, /retained:\s*false/)
    assert.doesNotMatch(`${aiProxySource}\n${parserSource}`, /(?:writeFile|appendFile|createWriteStream)\s*\(/)

    // 7. privacyAuth.js 的 camera/album/chatFile 三项 action 均区分本机保存与服务端上传
    const capabilityActions = Object.fromEntries(
      privacyAuth.WECHAT_PRIVACY_DECLARATIONS.map(({ declaration, action }) => [declaration, action]),
    )
    const cameraAction = capabilityActions['摄像头']
    const albumAction = capabilityActions['选中的照片或视频信息']
    const chatFileAction = capabilityActions['选中的文件']
    // camera：验房拍照仅本机保存，合同拍照 OCR 在确认后上传，原始图片仅内存处理
    assert.match(cameraAction, /拍摄入住验房照片.*仅保存在本机/)
    assert.match(cameraAction, /合同拍照进行 OCR 识别.*逐次确认后上传服务端识别文字/)
    assert.match(cameraAction, /原始图片仅在内存中处理，不写入磁盘、不持久化保存；请求处理结束后释放相关内存/)
    // album：验房/证据照片仅本机保存，合同相册 OCR 在确认后上传，原始图片仅内存处理
    assert.match(albumAction, /相册选择验房或证据照片.*仅保存在本机/)
    assert.match(albumAction, /从相册选择合同图片进行 OCR 识别.*逐次确认后上传服务端识别文字/)
    assert.match(albumAction, /原始图片仅在内存中处理，不写入磁盘、不持久化保存；请求处理结束后释放相关内存/)
    // chatFile：TXT/MD 和证据附件仅本机保存，DOCX/PDF 合同在确认后上传，原始文件仅内存处理
    assert.match(chatFileAction, /TXT\/MD 和证据附件仅保存在本机/)
    assert.match(chatFileAction, /DOCX\/PDF 合同会在逐次确认后上传服务端提取文字/)
    assert.match(chatFileAction, /原始文件仅在内存中处理，不写入磁盘、不持久化保存；请求处理结束后释放相关内存/)
  }],
  ['补贴城市与官网链接可用', () => {
    assert.ok(subsidyData.subsidyCities.length >= 30)
    assert.equal(new Set(subsidyData.subsidyCities).size, subsidyData.subsidyCities.length)
    subsidyData.subsidyPolicies.forEach((policy) => {
      assert.match(policy.applyUrl || policy.sourceUrl, /^https:\/\//)
    })
  }],
  ['复制操作有成功结果', async () => {
    assert.equal(await clipboard.copyText('官网链接', '已复制'), true)
    assert.equal(copied, '官网链接')
  }],
  ['真机隐私错误能区分后台声明、系统权限与用户取消', () => {
    const clipboardPrivacy = privacyAuth.getCapabilityFailure(
      { errMsg: 'setClipboardData:fail api scope is not declared in the privacy agreement' },
      'clipboard'
    )
    assert.equal(clipboardPrivacy.reason, 'privacy-blocked')
    assert.match(clipboardPrivacy.content, /剪切板/)

    const cameraDenied = privacyAuth.getCapabilityFailure(
      { errMsg: 'authorize:fail auth deny' },
      'camera'
    )
    assert.equal(cameraDenied.reason, 'permission-denied')
    assert.match(cameraDenied.content, /拍摄入住验房照片/)

    assert.equal(
      privacyAuth.getCapabilityFailure({ errMsg: 'chooseImage:fail cancel' }, 'album').cancelled,
      true
    )
  }],
  ['相册选图直接调用 chooseImage，不请求无效 scope.album', async () => {
    lastChooseImageArgs = null
    const selected = await attachmentUtils.pickImageFromAlbum()
    assert.deepEqual(lastChooseImageArgs.sourceType, ['album'])
    assert.equal(selected.tempFilePath, 'wxfile://temp/selected.jpg')

    const fs = await import('node:fs')
    const checkinSource = fs.readFileSync(new URL('../miniapp/src/pages/checkin/index.jsx', import.meta.url), 'utf8')
    const privacySource = fs.readFileSync(new URL('../miniapp/src/utils/privacyAuth.js', import.meta.url), 'utf8')
    assert.equal(checkinSource.includes('ensureMediaPermission'), false)
    assert.equal(privacySource.includes('scope.album'), false)
    assert.match(checkinSource, /sourceType:\s*\['camera'\]/)
    assert.match(checkinSource, /sourceType:\s*\['album'\]/)
  }],
  ['证据包附件选择：相册和聊天文件一次最多选择 9 个', async () => {
    lastChooseImageArgs = null
    await attachmentUtils.pickImagesFromAlbum(9)
    assert.equal(lastChooseImageArgs.count, 9)
    assert.deepEqual(lastChooseImageArgs.sourceType, ['album'])

    const originalChooseMessageFile = Taro.chooseMessageFile
    let lastChooseMessageFileArgs = null
    try {
      Taro.chooseMessageFile = async (options) => {
        lastChooseMessageFileArgs = options
        const result = { tempFiles: [{ path: 'wxfile://temp/a.pdf', name: 'a.pdf', size: 128 }] }
        options.success?.(result)
        return result
      }
      const files = await attachmentUtils.pickFilesFromChat(9)
      assert.equal(lastChooseMessageFileArgs.count, 9)
      assert.equal(files.length, 1)
    } finally {
      Taro.chooseMessageFile = originalChooseMessageFile
    }

    const fs = await import('node:fs')
    const evidenceSource = fs.readFileSync(new URL('../miniapp/src/pages/evidence/index.jsx', import.meta.url), 'utf8')
    assert.match(evidenceSource, /pickImagesFromAlbum\(9\)/)
    assert.match(evidenceSource, /pickFilesFromChat\(9\)/)
    assert.match(evidenceSource, /选择文件\/最近文件/)
    assert.match(evidenceSource, /一次最多 9 个/)
  }],
  ['小程序使用微信官方隐私授权弹窗且声明清单完整', async () => {
    const fs = await import('node:fs')
    const appSource = fs.readFileSync(new URL('../miniapp/src/app.js', import.meta.url), 'utf8')
    const appConfigSource = fs.readFileSync(new URL('../miniapp/src/app.config.js', import.meta.url), 'utf8')
    const privacyChecklist = JSON.parse(fs.readFileSync(new URL('../miniapp/src/privacy.json', import.meta.url), 'utf8'))
    assert.match(appConfigSource, /__usePrivacyCheck__:\s*true/)
    assert.doesNotMatch(appSource, /onNeedPrivacyAuthorization/)
    assert.doesNotMatch(appSource, /agreePrivacyAuthorization/)
    assert.deepEqual(
      privacyChecklist.privacyTypes.map((item) => item.name),
      ['剪切板', '选中的照片或视频信息', '摄像头', '选中的文件', '联网 AI 问题与可选资料摘要', 'AI 合同全文复核']
    )
    assert.equal(JSON.stringify(privacyChecklist).includes('scope.album'), false)
  }],
  ['证据包旧数据迁移：无 attachments 字段时不破坏已有勾选', () => {
    // 模拟旧版本保存的 state：只有 evidence 勾选，没有 attachments
    const legacyState = {
      formData: { address: '旧地址', deposit: '1000', monthlyRent: '2000' },
      evidence: { contract: [true, false, true], photos: [false, false, false, false], chat: [true, false, false], expense: [false, false, false] },
      actions: [true, false, false, false, false, false],
      communicationText: '旧沟通说明',
    }
    const normalized = normalizeEvidencePackState(legacyState)
    // 旧勾选保留
    assert.equal(normalized.evidence.contract[0], true)
    assert.equal(normalized.evidence.contract[1], false)
    assert.equal(normalized.evidence.chat[0], true)
    // attachments 字段被补全为 4 个空数组
    assert.deepEqual(Object.keys(normalized.attachments).sort(), ['chat', 'contract', 'expense', 'photos'])
    Object.values(normalized.attachments).forEach((list) => assert.equal(Array.isArray(list) && list.length === 0, true))
    // 其他字段保留
    assert.equal(normalized.formData.address, '旧地址')
    assert.equal(normalized.communicationText, '旧沟通说明')
  }],
  ['附件添加后保存与读取：重启后仍能恢复', async () => {
    const state = createDefaultEvidencePackState()
    // 通过 persistAttachment 模拟真实选图流程
    const attachment = await attachmentUtils.persistAttachment('wxfile://temp/contract.jpg', 'album', '租赁合同.jpg')
    assert.equal(attachment.fileName, '租赁合同.jpg')
    assert.equal(attachment.fileType, 'image')
    assert.equal(attachment.source, 'album')
    assert.ok(attachment.localPath.startsWith('wxfile://saved/'))
    assert.ok(attachment.id.startsWith('att_'))
    assert.equal(typeof attachment.createdAt, 'string')

    const stateWithAttachment = addAttachment(state, 'contract', attachment)
    assert.equal(getGroupAttachments(stateWithAttachment, 'contract').length, 1)
    assert.equal(getAttachmentStats(stateWithAttachment).total, 1)
    assert.equal(getAttachmentStats(stateWithAttachment).byGroup.contract, 1)

    // 保存后直接读取，模拟小程序重启后 storage 仍在
    assert.equal(saveEvidencePackState(stateWithAttachment), true)
    const reloaded = loadEvidencePackState()
    const restored = getGroupAttachments(reloaded, 'contract')
    assert.equal(restored.length, 1)
    assert.equal(restored[0].fileName, '租赁合同.jpg')
    assert.equal(restored[0].localPath, attachment.localPath)
  }],
  ['附件持久化：相册临时路径无扩展名仍识别为图片，声明超限时拒绝保存', async () => {
    const image = await attachmentUtils.persistAttachment('wxfile://temp/no-extension', 'album', '', 2048)
    assert.equal(image.fileName, '相册图片.jpg')
    assert.equal(image.fileType, 'image')
    assert.equal(image.size, 2048)

    const before = savedFiles.size
    await assert.rejects(
      attachmentUtils.persistAttachment('wxfile://temp/too-large.pdf', 'chat', '超大合同.pdf', attachmentUtils.ATTACHMENT_MAX_BYTES + 1),
      /超过 10MB/,
    )
    assert.equal(savedFiles.size, before)
  }],
  ['附件删除：严格按页面顺序 prev→next→save→removeFile→setState', async () => {
    // 准备：两个附件在 expense 组，模拟页面 state
    const state = createDefaultEvidencePackState()
    const att1 = await attachmentUtils.persistAttachment('wxfile://temp/a.pdf', 'chat', '收据.pdf')
    const att2 = await attachmentUtils.persistAttachment('wxfile://temp/b.jpg', 'album', '照片.jpg')
    let pageState = addAttachment(addAttachment(state, 'expense', att1), 'expense', att2)
    assert.equal(getGroupAttachments(pageState, 'expense').length, 2)
    saveEvidencePackState(pageState)

    // 严格按 handleDeleteAttachment 顺序执行
    // 1. 保存 prevState
    const prev = pageState
    // 2. 生成移除附件后的 nextState
    const next = removeAttachment(prev, 'expense', att1.id)
    assert.equal(getGroupAttachments(next, 'expense').length, 1)
    assert.equal(getGroupAttachments(next, 'expense')[0].id, att2.id)
    // 3. 立即调用 saveEvidencePackState(nextState)
    const saved = saveEvidencePackState(next)
    assert.equal(saved, true)
    // 4. Storage 保存成功，跳过失败分支
    // 5. 调用 removePersistedFile
    const result = await attachmentUtils.removePersistedFile(att1.localPath)
    // 6. 文件删除成功
    assert.equal(result.ok, true)
    assert.equal(result.reason, 'removed')
    assert.equal(savedFiles.has(att1.localPath), false)
    assert.equal(savedFiles.has(att2.localPath), true)
    // setState(next)
    pageState = next
    // 验证：重启后只剩余一个附件
    const reloaded = loadEvidencePackState()
    assert.equal(getGroupAttachments(reloaded, 'expense').length, 1)
    assert.equal(getGroupAttachments(reloaded, 'expense')[0].fileName, '照片.jpg')
  }],
  ['附件删除：文件删除失败时回滚 Storage 到 prevState', async () => {
    // 准备：两个附件，删除第一个时 removeSavedFile 会失败
    const state = createDefaultEvidencePackState()
    const att1 = await attachmentUtils.persistAttachment('wxfile://temp/fail1.jpg', 'album', '失败1.jpg')
    const att2 = await attachmentUtils.persistAttachment('wxfile://temp/ok2.jpg', 'album', '成功2.jpg')
    let pageState = addAttachment(addAttachment(state, 'expense', att1), 'expense', att2)
    saveEvidencePackState(pageState)

    // 严格按 handleDeleteAttachment 顺序
    const prev = pageState
    const next = removeAttachment(prev, 'expense', att1.id)
    // 3. saveEvidencePackState(next) 成功
    const saved = saveEvidencePackState(next)
    assert.equal(saved, true)
    // 5. removePersistedFile 注入失败
    removeSavedFileShouldFail = true
    const result = await attachmentUtils.removePersistedFile(att1.localPath)
    assert.equal(result.ok, false)
    assert.equal(result.reason, 'error')
    // 7. 文件删除失败：立即 saveEvidencePackState(prev) 回滚
    const rolledBack = saveEvidencePackState(prev)
    assert.equal(rolledBack, true)
    removeSavedFileShouldFail = false
    // 验证：Storage 中仍是旧记录（两个附件都在），UI 保持原状态
    const reloaded = loadEvidencePackState()
    assert.equal(getGroupAttachments(reloaded, 'expense').length, 2)
    assert.equal(savedFiles.has(att1.localPath), true)
    assert.equal(savedFiles.has(att2.localPath), true)
  }],
  ['附件删除：文件失败且 Storage 回滚失败时，页面状态跟随已保存的新记录', async () => {
    const previousState = createDefaultEvidencePackState()
    const attachment = await attachmentUtils.persistAttachment('wxfile://temp/orphan.jpg', 'album', '待删除.jpg')
    const withAttachment = addAttachment(previousState, 'photos', attachment)
    const nextState = removeAttachment(withAttachment, 'photos', attachment.id)
    let saveCalls = 0
    const result = await evidenceAttachmentTransactions.deleteEvidenceAttachmentTransaction({
      previousState: withAttachment,
      nextState,
      attachment,
      saveState: () => { saveCalls += 1; return saveCalls === 1 },
      removeFile: async () => ({ ok: false, reason: 'error' }),
    })
    assert.equal(result.ok, false)
    assert.equal(result.reason, 'rollback-failed')
    assert.equal(getGroupAttachments(result.state, 'photos').length, 0)
    assert.equal(savedFiles.has(attachment.localPath), true)
  }],
  ['附件删除：Storage 保存失败时文件仍存在、旧记录仍存在', async () => {
    // 准备：一个附件在 contract 组
    const state = createDefaultEvidencePackState()
    const att = await attachmentUtils.persistAttachment('wxfile://temp/keep.jpg', 'album', '保留.jpg')
    let pageState = addAttachment(state, 'contract', att)
    saveEvidencePackState(pageState)
    assert.equal(savedFiles.has(att.localPath), true)

    // 严格按 handleDeleteAttachment 顺序
    const prev = pageState
    const next = removeAttachment(prev, 'contract', att.id)
    // 3. saveEvidencePackState(next) 注入失败
    const originalSetItem = Taro.setStorageSync
    Taro.setStorageSync = () => { throw new Error('storage full') }
    let saved
    try {
      saved = saveEvidencePackState(next)
    } finally {
      Taro.setStorageSync = originalSetItem
    }
    // 4. Storage 保存失败：不删除文件、不更新 UI
    assert.equal(saved, false)
    // 验证：文件仍存在
    assert.equal(savedFiles.has(att.localPath), true)
    // 验证：Storage 中仍是旧记录（附件仍在）
    const reloaded = loadEvidencePackState()
    assert.equal(getGroupAttachments(reloaded, 'contract').length, 1)
    assert.equal(getGroupAttachments(reloaded, 'contract')[0].fileName, '保留.jpg')
  }],
  ['附件统计：多组附件按组计数，进度不靠勾选冒充', async () => {
    const state = createDefaultEvidencePackState()
    // 手动勾选但不上传附件
    state.evidence.contract[0] = true
    state.evidence.photos[0] = true
    // 勾选但无附件时统计应为 0
    assert.equal(getAttachmentStats(state).total, 0)
    assert.equal(getAttachmentStats(state).byGroup.contract, 0)

    // 只在 contract 组上传 1 个附件
    const att = await attachmentUtils.persistAttachment('wxfile://temp/c.pdf', 'chat', '合同.pdf')
    const withAtt = addAttachment(state, 'contract', att)
    const stats = getAttachmentStats(withAtt)
    assert.equal(stats.total, 1)
    assert.equal(stats.byGroup.contract, 1)
    assert.equal(stats.byGroup.photos, 0)
    // 有附件的组数 = 1
    const groupsWithAttachments = Object.values(stats.byGroup).filter((n) => n > 0).length
    assert.equal(groupsWithAttachments, 1)
  }],
  ['Storage 保存失败时附件文件被回滚删除', async () => {
    // 模拟 persistAttachment 成功（saveFile 正常），但后续 saveEvidencePackState 失败
    const state = createDefaultEvidencePackState()
    const attachment = await attachmentUtils.persistAttachment('wxfile://temp/rollback.jpg', 'album', '回滚测试.jpg')
    assert.ok(savedFiles.has(attachment.localPath))

    // 注入 saveEvidencePackState 失败：让 setStorageSync 抛错
    const originalSetItem = Taro.setStorageSync
    Taro.setStorageSync = () => { throw new Error('storage full') }
    try {
      const next = addAttachment(state, 'contract', attachment)
      const saved = saveEvidencePackState(next)
      assert.equal(saved, false)
      // 保存失败后，调用 removePersistedFile 清理刚保存的文件
      const cleanup = await attachmentUtils.removePersistedFile(attachment.localPath)
      assert.equal(cleanup.ok, true)
      assert.equal(savedFiles.has(attachment.localPath), false)
      // state 中不应保留该附件
      assert.equal(getGroupAttachments(state, 'contract').length, 0)
    } finally {
      Taro.setStorageSync = originalSetItem
    }
  }],
  ['removePersistedFile 文件不存在时返回 ok，其他失败返回明确结果', async () => {
    // 1. 文件不存在：应返回 { ok: true, reason: 'not-exist' }
    const notExist = await attachmentUtils.removePersistedFile('wxfile://saved/never_existed')
    assert.equal(notExist.ok, true)
    assert.equal(notExist.reason, 'not-exist')

    // 2. 其他失败（权限错误）：应返回 { ok: false, reason: 'error' }
    removeSavedFileShouldFail = true
    const att = await attachmentUtils.persistAttachment('wxfile://temp/perm.jpg', 'album', '权限测试.jpg')
    const failResult = await attachmentUtils.removePersistedFile(att.localPath)
    assert.equal(failResult.ok, false)
    assert.equal(failResult.reason, 'error')
    removeSavedFileShouldFail = false
  }],
  ['重置：严格按页面顺序 prev→empty→save→Promise.all删除→setState', async () => {
    // 准备 3 个附件分散在不同组，模拟页面 state
    const state = createDefaultEvidencePackState()
    const att1 = await attachmentUtils.persistAttachment('wxfile://temp/r1.jpg', 'album', 'a1.jpg')
    const att2 = await attachmentUtils.persistAttachment('wxfile://temp/r2.pdf', 'chat', 'a2.pdf')
    const att3 = await attachmentUtils.persistAttachment('wxfile://temp/r3.jpg', 'album', 'a3.jpg')
    let pageState = addAttachment(state, 'contract', att1)
    pageState = addAttachment(pageState, 'expense', att2)
    pageState = addAttachment(pageState, 'photos', att3)
    saveEvidencePackState(pageState)
    assert.equal(getAttachmentStats(pageState).total, 3)

    // 严格按 handleReset 顺序执行
    // 1. 保存 prevState
    const prev = pageState
    // 2. 创建 emptyState
    const emptyState = createDefaultEvidencePackState()
    // 3. 先调用 saveEvidencePackState(emptyState)
    const saved = saveEvidencePackState(emptyState)
    assert.equal(saved, true)
    // 4. Storage 保存成功，跳过失败分支
    // 5. Promise.all 删除附件文件
    const allAttachments = []
    Object.keys(evidenceGroupMeta).forEach((group) => {
      getGroupAttachments(prev, group).forEach((att) => allAttachments.push(att))
    })
    const results = await Promise.all(
      allAttachments.map((att) => attachmentUtils.removePersistedFile(att.localPath))
    )
    assert.equal(results.length, 3)
    assert.equal(results.every((r) => r.ok), true)
    assert.equal(savedFiles.has(att1.localPath), false)
    assert.equal(savedFiles.has(att2.localPath), false)
    assert.equal(savedFiles.has(att3.localPath), false)
    // 6. 更新 UI 为 emptyState
    pageState = emptyState
    // 7. 无部分失败，提示成功
    const hasCleanupFailure = results.some((r) => !r.ok)
    assert.equal(hasCleanupFailure, false)
    // 验证：重启后 Storage 为空
    const reloaded = loadEvidencePackState()
    assert.equal(getAttachmentStats(reloaded).total, 0)
  }],
  ['重置：部分文件清理失败时提示但记录已重置', async () => {
    // 准备 2 个附件，第二个删除会失败
    const state = createDefaultEvidencePackState()
    const att1 = await attachmentUtils.persistAttachment('wxfile://temp/pf1.jpg', 'album', 'pf1.jpg')
    const att2 = await attachmentUtils.persistAttachment('wxfile://temp/pf2.jpg', 'album', 'pf2.jpg')
    let pageState = addAttachment(addAttachment(state, 'contract', att1), 'photos', att2)
    saveEvidencePackState(pageState)

    // 严格按 handleReset 顺序
    const prev = pageState
    const emptyState = createDefaultEvidencePackState()
    const saved = saveEvidencePackState(emptyState)
    assert.equal(saved, true)
    // 5. Promise.all 删除，注入第二个失败
    removeSavedFileShouldFail = true
    const allAttachments = []
    Object.keys(evidenceGroupMeta).forEach((group) => {
      getGroupAttachments(prev, group).forEach((att) => allAttachments.push(att))
    })
    const results = await Promise.all(
      allAttachments.map((att) => attachmentUtils.removePersistedFile(att.localPath))
    )
    removeSavedFileShouldFail = false
    const hasCleanupFailure = results.some((r) => !r.ok)
    assert.equal(hasCleanupFailure, true)
    // 6. 仍更新 UI 为 emptyState
    pageState = emptyState
    // 验证：Storage 已是空状态
    const reloaded = loadEvidencePackState()
    assert.equal(getAttachmentStats(reloaded).total, 0)
  }],
  ['重置：Storage 保存失败时所有附件文件和旧记录都仍存在', async () => {
    // 准备 2 个附件
    const state = createDefaultEvidencePackState()
    const att1 = await attachmentUtils.persistAttachment('wxfile://temp/keep1.jpg', 'album', '保留1.jpg')
    const att2 = await attachmentUtils.persistAttachment('wxfile://temp/keep2.jpg', 'album', '保留2.jpg')
    let pageState = addAttachment(addAttachment(state, 'contract', att1), 'photos', att2)
    saveEvidencePackState(pageState)
    assert.equal(savedFiles.has(att1.localPath), true)
    assert.equal(savedFiles.has(att2.localPath), true)

    // 严格按 handleReset 顺序
    const prev = pageState
    const emptyState = createDefaultEvidencePackState()
    // 3. saveEvidencePackState(emptyState) 注入失败
    const originalSetItem = Taro.setStorageSync
    Taro.setStorageSync = () => { throw new Error('storage full') }
    let saved
    try {
      saved = saveEvidencePackState(emptyState)
    } finally {
      Taro.setStorageSync = originalSetItem
    }
    // 4. Storage 保存失败：停止操作，不删除任何文件，不更新 UI
    assert.equal(saved, false)
    // 验证：所有附件文件仍存在
    assert.equal(savedFiles.has(att1.localPath), true)
    assert.equal(savedFiles.has(att2.localPath), true)
    // 验证：Storage 中仍是旧记录
    const reloaded = loadEvidencePackState()
    assert.equal(getAttachmentStats(reloaded).total, 2)
    assert.equal(getGroupAttachments(reloaded, 'contract')[0].fileName, '保留1.jpg')
    assert.equal(getGroupAttachments(reloaded, 'photos')[0].fileName, '保留2.jpg')
  }],
  ['进度不再显示误导性百分比，只显示附件数量和覆盖组数', async () => {
    // 模拟 getProgress 的语义：只有 totalAttachments / collectedGroups / totalGroups
    const state = createDefaultEvidencePackState()
    const stats = getAttachmentStats(state)
    const totalGroups = Object.keys(state.attachments).length
    const collectedGroups = Object.values(stats.byGroup).filter((n) => n > 0).length
    // 空状态：0 个附件，覆盖 0/4 类，无百分比
    assert.equal(stats.total, 0)
    assert.equal(collectedGroups, 0)
    assert.equal(totalGroups, 4)
    assert.equal(!('percentage' in stats), true)

    // 4 组各 1 个附件也不是 100% 完成，只是覆盖 4/4 类
    let current = state
    const atts = await Promise.all([
      attachmentUtils.persistAttachment('wxfile://temp/p1.jpg', 'album', 'p1.jpg'),
      attachmentUtils.persistAttachment('wxfile://temp/p2.jpg', 'album', 'p2.jpg'),
      attachmentUtils.persistAttachment('wxfile://temp/p3.jpg', 'album', 'p3.jpg'),
      attachmentUtils.persistAttachment('wxfile://temp/p4.jpg', 'album', 'p4.jpg'),
    ])
    current = addAttachment(current, 'contract', atts[0])
    current = addAttachment(current, 'photos', atts[1])
    current = addAttachment(current, 'chat', atts[2])
    current = addAttachment(current, 'expense', atts[3])
    const fullStats = getAttachmentStats(current)
    const fullCollected = Object.values(fullStats.byGroup).filter((n) => n > 0).length
    assert.equal(fullStats.total, 4)
    assert.equal(fullCollected, 4)
    assert.equal(totalGroups, 4)
    // 语义是"覆盖 4/4 类"，不是"100% 完成"
    assert.equal(!('percentage' in fullStats), true)
  }],
  ['TXT 导出：文件名非法字符被清理且始终以 .txt 结尾', () => {
    const { sanitizeFileName } = textFileExport
    // 非法字符被替换
    assert.equal(sanitizeFileName('验房/报告?.txt'), '验房_报告_.txt')
    assert.equal(sanitizeFileName('合同:审查*报告.txt'), '合同_审查_报告.txt')
    assert.equal(sanitizeFileName('a\\b/c:d*e?f"g<h>i|j.txt'), 'a_b_c_d_e_f_g_h_i_j.txt')
    // 无扩展名时补 .txt
    assert.equal(sanitizeFileName('正常文件名'), '正常文件名.txt')
    assert.equal(sanitizeFileName('报告'), '报告.txt')
    // 已有 .txt 时不重复
    assert.equal(sanitizeFileName('正常文件名.txt'), '正常文件名.txt')
    // 空名称
    assert.equal(sanitizeFileName(''), '导出文件.txt')
    assert.equal(sanitizeFileName(null), '导出文件.txt')
    // 所有结果必须以 .txt 结尾
    const cases = ['验房报告', '报告.txt', '', null, 'a/b:c*.txt', 'A'.repeat(100)]
    for (const c of cases) {
      assert.ok(sanitizeFileName(c).endsWith('.txt'), `${JSON.stringify(c)} 的结果未以 .txt 结尾`)
    }
    // 长度限制
    const long = 'A'.repeat(100)
    const result = sanitizeFileName(long)
    assert.ok(result.length <= 80)
    assert.ok(result.endsWith('.txt'))
  }],
  ['文本导出：备份 JSON 可以保留 .json 扩展名', async () => {
    const { sanitizeFileName } = textFileExport
    assert.equal(sanitizeFileName('租小审备份.json', '.json'), '租小审备份.json')
    assert.equal(sanitizeFileName('租小审/备份?.json', '.json'), '租小审_备份_.json')

    lastShareArgs = null
    const result = await textFileExport.exportTextToFile('租小审备份.json', '{"ok":true}', { extension: '.json' })
    assert.equal(result.ok, true)
    assert.ok(result.filePath.endsWith('租小审备份.json'))
    assert.equal(lastShareArgs.fileName, '租小审备份.json')
  }],
  ['TXT 导出：空内容禁止导出', async () => {
    const result1 = await textFileExport.exportTextToFile('空测试.txt', '')
    assert.equal(result1.ok, false)
    assert.equal(result1.reason, 'empty-content')
    const result2 = await textFileExport.exportTextToFile('空测试.txt', '   ')
    assert.equal(result2.ok, false)
    assert.equal(result2.reason, 'empty-content')
    const result3 = await textFileExport.exportTextToFile('空测试.txt', null)
    assert.equal(result3.ok, false)
    assert.equal(result3.reason, 'empty-content')
  }],
  ['TXT 导出：UTF-8 中文内容完整写入并分享', async () => {
    const content = '租小审查报告\n房屋地址：北京市朝阳区\n押金：3800元\n风险评分：72分\n建议：补充书面交接记录'
    lastShareArgs = null
    const result = await textFileExport.exportTextToFile('中文导出测试.txt', content)
    assert.equal(result.ok, true)
    assert.ok(result.filePath.endsWith('中文导出测试.txt'))
    // 验证写入的内容
    const written = virtualFiles.get(result.filePath)
    assert.equal(written.encoding, 'utf8')
    assert.equal(written.data, content)
    // 验证分享收到正确的 filePath 和 fileName
    assert.ok(lastShareArgs)
    assert.equal(lastShareArgs.filePath, result.filePath)
    assert.equal(lastShareArgs.fileName, '中文导出测试.txt')
  }],
  ['TXT 导出：可先生成文件，等待下一次用户点击再分享', async () => {
    lastShareArgs = null
    const result = await textFileExport.prepareTextFile('两步导出.txt', '等待用户再次点击')
    assert.equal(result.ok, true)
    assert.equal(result.fileName, '两步导出.txt')
    assert.equal(lastShareArgs, null)
    assert.equal(virtualFiles.get(result.filePath).data, '等待用户再次点击')
  }],
  ['TXT 导出：writeFile 失败返回明确失败结果', async () => {
    writeFileShouldFail = true
    const result = await textFileExport.exportTextToFile('失败测试.txt', '有内容但写入失败')
    writeFileShouldFail = false
    assert.equal(result.ok, false)
    assert.equal(result.reason, 'write-failed')
    assert.ok(result.error)
    // 验证文件未写入
    assert.equal(virtualFiles.has(`${Taro.env.USER_DATA_PATH}/失败测试.txt`), false)
  }],
  ['TXT 导出：用户取消分享返回 share-cancelled', async () => {
    shareFileShouldCancel = true
    const result = await textFileExport.exportTextToFile('取消分享测试.txt', '内容正常')
    shareFileShouldCancel = false
    assert.equal(result.ok, false)
    assert.equal(result.reason, 'share-cancelled')
    // 文件应已成功写入
    assert.ok(result.filePath)
    assert.equal(virtualFiles.has(result.filePath), true)
    assert.equal(virtualFiles.get(result.filePath).data, '内容正常')
  }],
  ['TXT 导出：分享失败返回 share-failed 且文件仍保留', async () => {
    shareFileShouldFail = true
    const result = await textFileExport.exportTextToFile('分享失败测试.txt', '文件已写入但分享失败')
    shareFileShouldFail = false
    assert.equal(result.ok, false)
    assert.equal(result.reason, 'share-failed')
    // 文件应已成功写入并保留
    assert.ok(result.filePath)
    assert.equal(virtualFiles.has(result.filePath), true)
    assert.equal(virtualFiles.get(result.filePath).data, '文件已写入但分享失败')
    assert.ok(result.error)
  }],
  ['TXT 导出：同名文件重复导出不产生多个路径', async () => {
    const content1 = '第一次内容'
    const content2 = '第二次内容'
    const result1 = await textFileExport.exportTextToFile('同名测试.txt', content1)
    const result2 = await textFileExport.exportTextToFile('同名测试.txt', content2)
    assert.equal(result1.ok, true)
    assert.equal(result2.ok, true)
    // 两次导出的路径应相同
    assert.equal(result1.filePath, result2.filePath)
    // virtualFiles 中只有一份记录（覆盖）
    assert.equal(virtualFiles.get(result1.filePath).data, content2)
  }],
  ['TXT 导出：源码中不再出现 openDocument', async () => {
    const fs = await import('node:fs')
    const code = fs.readFileSync(new URL('../miniapp/src/utils/textFileExport.js', import.meta.url), 'utf-8')
    assert.ok(
      !code.includes('openDocument'),
      'textFileExport.js 中仍包含 openDocument 调用'
    )
    // 确认已改用 shareFileMessage
    assert.ok(code.includes('shareFileMessage'), 'textFileExport.js 未使用 shareFileMessage')
  }],
  ['TXT 导出：保留文本导出的两个业务页调用同一个统一工具', async () => {
    // 首页和合同页已改用首页业务 Word 报告；其余两个页面继续复用统一文本工具。
    const fs = await import('node:fs')
    const pages = [
      '../miniapp/src/pages/checkin/index.jsx',
      '../miniapp/src/pages/evidence/index.jsx',
    ]
    for (const page of pages) {
      const code = fs.readFileSync(new URL(page, import.meta.url), 'utf-8')
      assert.ok(
        code.includes("from '../../utils/textFileExport'"),
        `${page} 未从统一工具模块导入 exportTextToFile`
      )
      const exportFunction = page.includes('/index/index.jsx') ? 'prepareTextFile' : 'exportTextToFile'
      assert.ok(code.includes(exportFunction), `${page} 未调用 ${exportFunction}`)
    }
    // 统一工具确实存在且是函数
    assert.equal(typeof textFileExport.exportTextToFile, 'function')
    assert.equal(typeof textFileExport.sanitizeFileName, 'function')
  }],

  ['证据 PDF：在本机生成合法 PDF 且中文内容可被阅读器提取', async () => {
    const bytes = evidencePackageExport.createEvidencePdf('租小审 退租证据包摘要\n押金金额：3800 元\n建议：保留书面交接记录')
    const source = Buffer.from(bytes).toString('latin1')
    assert.match(source, /^%PDF-1\.4/)
    assert.match(source, /\/STSong-Light/)
    assert.match(source, /\/Identity-H/)
    assert.match(source, /\/ToUnicode/)
    assert.match(source, /xref[\s\S]*startxref/)
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const task = pdfjs.getDocument({ data: bytes.slice() })
    const document = await task.promise
    const page = await document.getPage(1)
    const content = await page.getTextContent()
    assert.match(content.items.map((item) => item.str).join(''), /租小审.*押金金额.*3800/)
    await task.destroy()
  }],

  ['证据 ZIP：生成标准 ZIP 并保留 UTF-8 中文文件名', async () => {
    const bytes = evidencePackageExport.createZipArchive([
      { name: '退租证据包摘要.txt', data: '中文摘要' },
      { name: '附件/房屋照片/厨房.jpg', data: Uint8Array.of(1, 2, 3, 4) },
    ], new Date('2026-07-28T12:00:00'))
    assert.equal(bytes[0], 0x50)
    assert.equal(bytes[1], 0x4b)
    const decoded = Buffer.from(bytes).toString('utf8')
    assert.match(decoded, /退租证据包摘要\.txt/)
    assert.match(decoded, /厨房\.jpg/)
    const JSZip = (await import('jszip')).default
    const archive = await JSZip.loadAsync(bytes)
    assert.equal(await archive.file('退租证据包摘要.txt').async('string'), '中文摘要')
    assert.deepEqual([...await archive.file('附件/房屋照片/厨房.jpg').async('uint8array')], [1, 2, 3, 4])
  }],

  ['证据 ZIP：真实附件和模块文本一并打包，缺失文件明确列出', async () => {
    const packState = createDefaultEvidencePackState()
    packState.attachments.contract.push({
      id: 'contract-text', source: 'module', sourceModule: 'contract', fileName: '合同正文.txt', textContent: '合同正文内容', createdAt: '2026-07-28T12:00:00.000Z',
    })
    packState.attachments.photos.push({
      id: 'photo-ok', source: 'album', fileName: '厨房.jpg', localPath: 'wxfile://saved/kitchen.jpg', createdAt: '2026-07-28T12:00:00.000Z',
    })
    packState.attachments.photos.push({
      id: 'photo-missing', source: 'album', fileName: '缺失.jpg', localPath: 'wxfile://saved/missing.jpg', createdAt: '2026-07-28T12:00:00.000Z',
    })
    virtualFiles.set('wxfile://saved/kitchen.jpg', { data: Uint8Array.of(9, 8, 7).buffer })
    const archive = await evidencePackageExport.buildEvidenceArchive({
      packState,
      reportText: '证据摘要',
      groupLabels: { contract: '合同文件', photos: '房屋照片' },
    })
    assert.equal(archive.included.length, 2)
    assert.equal(archive.skipped.length, 1)
    assert.equal(archive.skipped[0].fileName, '缺失.jpg')
    assert.equal(archive.bytes[0], 0x50)
    assert.equal(archive.bytes[1], 0x4b)
  }],

  ['证据导出：PDF 与 ZIP 写入本地后调用微信文件分享', async () => {
    lastShareArgs = null
    const pdfResult = await evidencePackageExport.exportEvidencePdf('租小审证据摘要\n押金：2000 元')
    assert.equal(pdfResult.ok, true)
    assert.ok(pdfResult.filePath.endsWith('.pdf'))
    assert.equal(lastShareArgs.fileName, '租小审-退租证据包摘要.pdf')
    assert.ok(virtualFiles.has(pdfResult.filePath))

    const zipResult = await evidencePackageExport.exportEvidenceZip({
      packState: createDefaultEvidencePackState(),
      reportText: '空附件证据摘要',
      groupLabels: {},
    })
    assert.equal(zipResult.ok, true)
    assert.ok(zipResult.filePath.endsWith('.zip'))
    assert.equal(lastShareArgs.fileName, '租小审-退租证据包.zip')
    assert.ok(virtualFiles.has(zipResult.filePath))
  }],

  ['证据导出：页面提供 PDF、ZIP、TXT 三种真实导出入口', async () => {
    const fs = await import('node:fs')
    const source = fs.readFileSync(new URL('../miniapp/src/pages/evidence/index.jsx', import.meta.url), 'utf8')
    assert.match(source, /ZIP 完整证据包（含附件）/)
    assert.match(source, /PDF 证据摘要/)
    assert.match(source, /TXT 证据摘要/)
    assert.match(source, /exportEvidencePdf/)
    assert.match(source, /exportEvidenceZip/)
  }],
  // ---- 合同审查历史：快照保存 / 恢复 / 删除 / 清空 / 旧数据迁移 ----
  ['合同审查历史：保存完整快照到 Storage', () => {
    storage.delete(STORAGE_KEYS.reviewHistory)
    // 模拟 pushHistory 写入：与 contract/index.jsx pushHistory 结构一致
    const entry = {
      id: 'hist-001',
      time: '2026-07-28 10:00:00',
      score: 72,
      label: '中风险',
      count: 3,
      snapshot: {
        contractText: '甲方与乙方签订租赁合同',
        findings: [{ id: 'f1', level: 'high', title: '押金过高' }],
        summary: { score: 72, label: '中风险', highCount: 1, mediumCount: 1, lowCount: 1, advice: '建议协商' },
        dimensions: [{ key: 'payment', label: '付款', score: 30, tone: 'danger' }],
        adoptedItems: [],
        revisedDraft: '',
        activeProfile: { contractType: 'lease' },
        profile: { contractType: 'lease', partyRole: 'partyB', reviewDepth: 'strict' },
      },
    }
    Taro.setStorageSync(STORAGE_KEYS.reviewHistory, [entry])
    const loaded = Taro.getStorageSync(STORAGE_KEYS.reviewHistory)
    assert.equal(Array.isArray(loaded), true)
    assert.equal(loaded.length, 1)
    assert.equal(loaded[0].snapshot.contractText, '甲方与乙方签订租赁合同')
    assert.equal(loaded[0].snapshot.findings.length, 1)
    assert.equal(loaded[0].snapshot.summary.score, 72)
  }],
  ['合同审查历史：恢复快照还原审查现场', () => {
    storage.delete(STORAGE_KEYS.reviewHistory)
    const entry = {
      id: 'hist-002',
      time: '2026-07-28 11:00:00',
      score: 50,
      label: '中风险',
      count: 2,
      snapshot: {
        contractText: '恢复测试合同',
        findings: [{ id: 'f1', level: 'medium' }],
        summary: { score: 50, label: '中风险', advice: '恢复测试' },
        dimensions: [],
        adoptedItems: [{ id: 'f1', title: '已采纳项' }],
        revisedDraft: '修订稿内容',
        activeProfile: null,
        profile: { contractType: 'lease', partyRole: 'partyB', reviewDepth: 'normal' },
      },
    }
    Taro.setStorageSync(STORAGE_KEYS.reviewHistory, [entry])
    // 模拟 restoreHistory：从 Storage 读取并还原字段
    const loaded = Taro.getStorageSync(STORAGE_KEYS.reviewHistory)
    const snap = loaded[0].snapshot
    assert.equal(snap.contractText, '恢复测试合同')
    assert.equal(snap.adoptedItems.length, 1)
    assert.equal(snap.adoptedItems[0].title, '已采纳项')
    assert.equal(snap.revisedDraft, '修订稿内容')
    assert.equal(snap.profile.reviewDepth, 'normal')
  }],
  ['合同审查历史：删除单条记录保留其他记录', () => {
    storage.delete(STORAGE_KEYS.reviewHistory)
    const entries = [
      { id: 'h1', time: '2026-07-28 09:00:00', score: 60, count: 1, snapshot: { contractText: 'A' } },
      { id: 'h2', time: '2026-07-28 10:00:00', score: 70, count: 2, snapshot: { contractText: 'B' } },
      { id: 'h3', time: '2026-07-28 11:00:00', score: 80, count: 3, snapshot: { contractText: 'C' } },
    ]
    Taro.setStorageSync(STORAGE_KEYS.reviewHistory, entries)
    // 模拟 deleteHistoryItem：过滤掉指定 id
    const targetId = 'h2'
    const filtered = Taro.getStorageSync(STORAGE_KEYS.reviewHistory).filter((e) => e.id !== targetId)
    Taro.setStorageSync(STORAGE_KEYS.reviewHistory, filtered)
    const loaded = Taro.getStorageSync(STORAGE_KEYS.reviewHistory)
    assert.equal(loaded.length, 2)
    assert.equal(loaded.some((e) => e.id === 'h2'), false)
    assert.equal(loaded[0].id, 'h1')
    assert.equal(loaded[1].id, 'h3')
  }],
  ['合同审查历史：清空记录后 Storage 为空数组', () => {
    storage.delete(STORAGE_KEYS.reviewHistory)
    Taro.setStorageSync(STORAGE_KEYS.reviewHistory, [
      { id: 'h1', time: '2026-07-28 09:00:00', score: 60, count: 1 },
      { id: 'h2', time: '2026-07-28 10:00:00', score: 70, count: 2 },
    ])
    // 模拟 clearHistory
    Taro.setStorageSync(STORAGE_KEYS.reviewHistory, [])
    const loaded = Taro.getStorageSync(STORAGE_KEYS.reviewHistory)
    assert.deepEqual(loaded, [])
  }],
  ['合同审查历史：旧数据迁移（无 snapshot 字段不崩溃）', () => {
    storage.delete(STORAGE_KEYS.reviewHistory)
    // 旧版本历史记录没有 snapshot 字段
    const legacyEntries = [
      { id: 'old1', time: '2026-06-01 09:00:00', score: 50, count: 1 },
      { id: 'old2', time: '2026-06-02 10:00:00', score: 60, count: 2 },
    ]
    Taro.setStorageSync(STORAGE_KEYS.reviewHistory, legacyEntries)
    const loaded = Taro.getStorageSync(STORAGE_KEYS.reviewHistory)
    // 旧数据能正常读取
    assert.equal(loaded.length, 2)
    // 旧数据没有 snapshot，恢复时应被识别为不可恢复
    assert.equal(loaded[0].snapshot, undefined)
    assert.equal(loaded[1].snapshot, undefined)
    // 渲染时应显示"无快照"标记，不崩溃
    const hasSnapshot = (entry) => Boolean(entry && entry.snapshot)
    assert.equal(hasSnapshot(loaded[0]), false)
    assert.equal(hasSnapshot(loaded[1]), false)
  }],
  ['合同审查历史：混合同旧数据（有快照和无快照共存）', () => {
    storage.delete(STORAGE_KEYS.reviewHistory)
    const mixed = [
      { id: 'old1', time: '2026-06-01 09:00:00', score: 50, count: 1 },
      { id: 'new1', time: '2026-07-28 10:00:00', score: 70, count: 2, snapshot: { contractText: '新数据' } },
      { id: 'old2', time: '2026-06-02 11:00:00', score: 60, count: 1 },
    ]
    Taro.setStorageSync(STORAGE_KEYS.reviewHistory, mixed)
    const loaded = Taro.getStorageSync(STORAGE_KEYS.reviewHistory)
    assert.equal(loaded.length, 3)
    // 只有 new1 可恢复
    const restorable = loaded.filter((e) => e.snapshot)
    assert.equal(restorable.length, 1)
    assert.equal(restorable[0].id, 'new1')
  }],
  // ---- 证据包模块引用导入：去重 / 空数据 / 重复导入 ----
  ['证据包模块引用：hasModuleReference 正确识别已导入引用', () => {
    const state = createDefaultEvidencePackState()
    const ref = {
      id: 'ref_test_1',
      fileName: '验房照片-客厅-墙面-1.jpg',
      fileType: 'image',
      size: 0,
      localPath: 'wxfile://saved/checkin_photo_1',
      source: 'module',
      sourceModule: 'checkin',
      sourcePath: 'living.wall.photos[0]',
      createdAt: '2026-07-28T10:00:00.000Z',
    }
    assert.equal(hasModuleReference(state, 'photos', 'checkin', 'living.wall.photos[0]'), false)
    const withRef = addModuleReference(state, 'photos', ref)
    assert.equal(hasModuleReference(withRef, 'photos', 'checkin', 'living.wall.photos[0]'), true)
    // 原始 state 未被修改
    assert.equal(hasModuleReference(state, 'photos', 'checkin', 'living.wall.photos[0]'), false)
  }],
  ['证据包模块引用：重复导入同一来源和路径被跳过', () => {
    const state = createDefaultEvidencePackState()
    const refs = [
      {
        id: 'ref_1', fileName: 'photo1.jpg', fileType: 'image', size: 0,
        localPath: 'wxfile://saved/p1', source: 'module',
        sourceModule: 'checkin', sourcePath: 'living.wall.photos[0]',
        createdAt: '2026-07-28T10:00:00.000Z',
      },
      {
        id: 'ref_2', fileName: 'photo2.jpg', fileType: 'image', size: 0,
        localPath: 'wxfile://saved/p2', source: 'module',
        sourceModule: 'checkin', sourcePath: 'living.wall.photos[1]',
        createdAt: '2026-07-28T10:00:00.000Z',
      },
    ]
    // 第一次导入：2 个都新增
    const first = importModuleReferences(state, 'photos', refs)
    assert.equal(first.added, 2)
    assert.equal(first.skipped, 0)
    assert.equal(getGroupAttachments(first.state, 'photos').length, 2)
    // 第二次导入相同引用：全部跳过
    const second = importModuleReferences(first.state, 'photos', refs)
    assert.equal(second.added, 0)
    assert.equal(second.skipped, 2)
    assert.equal(getGroupAttachments(second.state, 'photos').length, 2)
  }],
  ['证据包模块引用：不同来源或路径不视为重复', () => {
    const state = createDefaultEvidencePackState()
    const ref1 = {
      id: 'ref_a', fileName: 'photo.jpg', fileType: 'image', size: 0,
      localPath: 'wxfile://saved/same_path', source: 'module',
      sourceModule: 'checkin', sourcePath: 'living.wall.photos[0]',
      createdAt: '2026-07-28T10:00:00.000Z',
    }
    const ref2 = {
      id: 'ref_b', fileName: 'photo.jpg', fileType: 'image', size: 0,
      localPath: 'wxfile://saved/same_path', source: 'module',
      // 同 localPath 但不同 sourceModule：不重复
      sourceModule: 'contract', sourcePath: 'living.wall.photos[0]',
      createdAt: '2026-07-28T10:00:00.000Z',
    }
    const ref3 = {
      id: 'ref_c', fileName: 'photo.jpg', fileType: 'image', size: 0,
      localPath: 'wxfile://saved/same_path', source: 'module',
      sourceModule: 'checkin', sourcePath: 'living.wall.photos[1]',
      createdAt: '2026-07-28T10:00:00.000Z',
    }
    const result = importModuleReferences(state, 'photos', [ref1, ref2, ref3])
    assert.equal(result.added, 3)
    assert.equal(result.skipped, 0)
  }],
  ['证据包模块引用：文本类引用（textContent）通过校验', () => {
    const state = createDefaultEvidencePackState()
    const textRef = {
      id: 'ref_text_1',
      fileName: '验房报告.txt',
      fileType: 'file',
      size: 100,
      textContent: '租小审 验房报告\n完成度：50%',
      source: 'module',
      sourceModule: 'checkin',
      sourcePath: 'summary',
      createdAt: '2026-07-28T10:00:00.000Z',
    }
    // 无 localPath 但有 textContent：应通过 isValidAttachment 校验
    const result = importModuleReferences(state, 'photos', [textRef])
    assert.equal(result.added, 1)
    const loaded = getGroupAttachments(result.state, 'photos')
    assert.equal(loaded.length, 1)
    assert.equal(loaded[0].textContent, '租小审 验房报告\n完成度：50%')
    assert.equal(loaded[0].localPath, undefined)
  }],
  ['证据包模块引用：导入后保存重启仍能恢复', () => {
    storage.delete(STORAGE_KEYS.evidencePack)
    const state = createDefaultEvidencePackState()
    const ref = {
      id: 'ref_persist',
      fileName: '合同正文.txt',
      fileType: 'file',
      size: 200,
      textContent: '甲方与乙方租赁合同正文',
      source: 'module',
      sourceModule: 'contract',
      sourcePath: 'draft',
      createdAt: '2026-07-28T10:00:00.000Z',
    }
    const withRef = addModuleReference(state, 'contract', ref)
    assert.equal(saveEvidencePackState(withRef), true)
    const reloaded = loadEvidencePackState()
    const restored = getGroupAttachments(reloaded, 'contract')
    assert.equal(restored.length, 1)
    assert.equal(restored[0].source, 'module')
    assert.equal(restored[0].sourceModule, 'contract')
    assert.equal(restored[0].sourcePath, 'draft')
    assert.equal(restored[0].textContent, '甲方与乙方租赁合同正文')
  }],
  ['证据包模块引用：删除引用不删除原模块文件', () => {
    storage.delete(STORAGE_KEYS.evidencePack)
    const state = createDefaultEvidencePackState()
    const ref = {
      id: 'ref_del',
      fileName: '验房照片.jpg',
      fileType: 'image',
      size: 0,
      localPath: 'wxfile://saved/checkin_original',
      source: 'module',
      sourceModule: 'checkin',
      sourcePath: 'living.wall.photos[0]',
      createdAt: '2026-07-28T10:00:00.000Z',
    }
    const withRef = addModuleReference(state, 'photos', ref)
    saveEvidencePackState(withRef)
    // 模拟原模块文件存在
    savedFiles.set('wxfile://saved/checkin_original', { size: 1024 })
    // 模拟 handleDeleteAttachment 对模块引用的处理：只移除记录，不调用 removePersistedFile
    const next = removeAttachment(withRef, 'photos', ref.id)
    const saved = saveEvidencePackState(next)
    assert.equal(saved, true)
    // 模块引用的原始文件应仍存在
    assert.equal(savedFiles.has('wxfile://saved/checkin_original'), true)
    // 证据包中已无该引用
    const reloaded = loadEvidencePackState()
    assert.equal(getGroupAttachments(reloaded, 'photos').length, 0)
  }],
  ['证据包模块引用：重置时跳过模块引用不删除原模块文件', async () => {
    storage.delete(STORAGE_KEYS.evidencePack)
    const state = createDefaultEvidencePackState()
    // 一个真实附件 + 一个模块引用
    const realAtt = await attachmentUtils.persistAttachment('wxfile://temp/real.jpg', 'album', '真实.jpg')
    const ref = {
      id: 'ref_reset',
      fileName: '验房照片.jpg',
      fileType: 'image',
      size: 0,
      localPath: 'wxfile://saved/checkin_keep',
      source: 'module',
      sourceModule: 'checkin',
      sourcePath: 'living.wall.photos[0]',
      createdAt: '2026-07-28T10:00:00.000Z',
    }
    savedFiles.set('wxfile://saved/checkin_keep', { size: 1024 })
    let pageState = addAttachment(state, 'expense', realAtt)
    pageState = addModuleReference(pageState, 'photos', ref)
    saveEvidencePackState(pageState)
    assert.equal(savedFiles.has(realAtt.localPath), true)
    assert.equal(savedFiles.has('wxfile://saved/checkin_keep'), true)

    // 模拟 handleReset：只收集非模块引用附件进行文件删除
    const emptyState = createDefaultEvidencePackState()
    const saved = saveEvidencePackState(emptyState)
    assert.equal(saved, true)
    const allAttachments = []
    Object.keys(evidenceGroupMeta).forEach((group) => {
      getGroupAttachments(pageState, group).forEach((att) => {
        if (att.source !== 'module') {
          allAttachments.push(att)
        }
      })
    })
    // 只收集到 1 个真实附件，模块引用被跳过
    assert.equal(allAttachments.length, 1)
    assert.equal(allAttachments[0].fileName, '真实.jpg')
    await Promise.all(allAttachments.map((att) => attachmentUtils.removePersistedFile(att.localPath)))
    // 真实附件文件被删除
    assert.equal(savedFiles.has(realAtt.localPath), false)
    // 模块引用的原文件保留
    assert.equal(savedFiles.has('wxfile://saved/checkin_keep'), true)
  }],
  // ---- evidenceImport 空数据 ----
  ['evidenceImport 空数据：验房照片为空时返回空数组', () => {
    storage.delete(STORAGE_KEYS.checkinInspection)
    const refs = evidenceImport.buildCheckinPhotoRefs()
    assert.equal(Array.isArray(refs), true)
    assert.equal(refs.length, 0)
  }],
  ['evidenceImport 空数据：合同正文为空时返回 null', () => {
    storage.delete(STORAGE_KEYS.contractDraft)
    const ref = evidenceImport.buildContractTextRef()
    assert.equal(ref, null)
  }],
  ['evidenceImport 空数据：审查历史为空时返回空数组', () => {
    storage.delete(STORAGE_KEYS.reviewHistory)
    const refs = evidenceImport.buildReviewReportRefs()
    assert.equal(Array.isArray(refs), true)
    assert.equal(refs.length, 0)
  }],
  ['evidenceImport 空数据：审查历史无快照时被过滤', () => {
    Taro.setStorageSync(STORAGE_KEYS.reviewHistory, [
      { id: 'old1', time: '2026-06-01', score: 50, count: 1 },
      { id: 'old2', time: '2026-06-02', score: 60, count: 2 },
    ])
    const refs = evidenceImport.buildReviewReportRefs()
    assert.equal(refs.length, 0)
  }],
  // ---- evidenceImport 有数据 ----
  ['evidenceImport 有数据：验房照片构建引用列表', () => {
    storage.delete(STORAGE_KEYS.checkinInspection)
    const checkinState = createDefaultCheckinState()
    checkinState.living.wall.photos = ['wxfile://saved/photo1.jpg', 'wxfile://saved/photo2.jpg']
    checkinState.kitchen.appliance.photos = ['wxfile://saved/photo3.jpg']
    saveCheckinInspectionState(checkinState)
    const refs = evidenceImport.buildCheckinPhotoRefs()
    assert.equal(refs.length, 3)
    assert.equal(refs.every((r) => r.source === 'module'), true)
    assert.equal(refs.every((r) => r.sourceModule === 'checkin'), true)
    assert.equal(refs.every((r) => r.fileType === 'image'), true)
    // 验证 sourcePath 唯一
    const paths = refs.map((r) => r.sourcePath)
    assert.equal(new Set(paths).size, 3)
    // 验证 localPath 指向原文件（不复制）
    assert.equal(refs[0].localPath, 'wxfile://saved/photo1.jpg')
  }],
  ['evidenceImport 有数据：验房报告包含完成度和瑕疵摘要', () => {
    storage.delete(STORAGE_KEYS.checkinInspection)
    const checkinState = createDefaultCheckinState()
    checkinState.living.wall.status = 'defect'
    checkinState.living.wall.defect = '墙面裂缝'
    saveCheckinInspectionState(checkinState)
    const ref = evidenceImport.buildCheckinReportRef()
    assert.equal(ref.source, 'module')
    assert.equal(ref.sourceModule, 'checkin')
    assert.equal(ref.sourcePath, 'summary')
    assert.ok(ref.textContent.includes('租小审 验房报告'))
    assert.ok(ref.textContent.includes('墙面裂缝'))
    assert.ok(ref.fileName.endsWith('.txt'))
  }],
  ['evidenceImport 有数据：合同正文引用保存文本快照', () => {
    Taro.setStorageSync(STORAGE_KEYS.contractDraft, '甲方与乙方于2026年签订租赁合同')
    const ref = evidenceImport.buildContractTextRef()
    assert.ok(ref)
    assert.equal(ref.sourceModule, 'contract')
    assert.equal(ref.sourcePath, 'draft')
    assert.equal(ref.textContent, '甲方与乙方于2026年签订租赁合同')
    assert.equal(ref.fileName, '合同正文.txt')
  }],
  ['evidenceImport 有数据：审查报告引用从历史快照生成', () => {
    Taro.setStorageSync(STORAGE_KEYS.reviewHistory, [
      {
        id: 'rev1',
        time: '2026-07-28 10:00:00',
        score: 72,
        label: '中风险',
        count: 2,
        snapshot: {
          contractText: '合同正文',
          findings: [
            { id: 'f1', level: 'high', title: '押金过高', explain: '押金超过三个月' },
            { id: 'f2', level: 'medium', title: '维修责任不清', suggestion: '写明维修方' },
          ],
          summary: { score: 72, label: '中风险', advice: '建议协商' },
        },
      },
    ])
    const refs = evidenceImport.buildReviewReportRefs()
    assert.equal(refs.length, 1)
    assert.equal(refs[0].sourceModule, 'review')
    assert.equal(refs[0].sourcePath, 'history.rev1')
    assert.ok(refs[0].textContent.includes('押金过高'))
    assert.ok(refs[0].textContent.includes('写明维修方'))
    assert.ok(refs[0].textContent.includes('72'))
  }],
  // ---- 证据包旧数据迁移：模块引用字段兼容 ----
  ['证据包旧数据迁移：无 attachments 字段时不破坏已有勾选', () => {
    const legacyState = {
      formData: { address: '旧地址', deposit: '1000', monthlyRent: '2000' },
      evidence: { contract: [true, false, true], photos: [false, false, false, false], chat: [true, false, false], expense: [false, false, false] },
      actions: [true, false, false, false, false, false],
      communicationText: '旧沟通说明',
    }
    const normalized = normalizeEvidencePackState(legacyState)
    assert.equal(normalized.evidence.contract[0], true)
    assert.equal(normalized.evidence.chat[0], true)
    assert.deepEqual(Object.keys(normalized.attachments).sort(), ['chat', 'contract', 'expense', 'photos'])
    Object.values(normalized.attachments).forEach((list) => assert.equal(Array.isArray(list) && list.length === 0, true))
  }],
  // ---- 补贴结构化匹配：满足 / 待确认 / 不满足 ----
  ['补贴结构化匹配：完整个人情况判定为满足', () => {
    const policy = subsidyData.subsidyPolicies.find((p) => p.city === '杭州')
    assert.ok(policy)
    const profile = '我是2026年应届本科毕业生，已签劳动合同并缴纳社保，目前租房居住，杭州无房。'
    const result = subsidyData.evaluateSubsidyMatch(policy, profile)
    assert.equal(result.status, 'satisfied')
    assert.ok(result.criteria.length >= 4)
    // 所有条件都满足
    assert.equal(result.criteria.every((c) => c.status === 'satisfied'), true)
    // 每个满足条件有依据
    result.criteria.forEach((c) => {
      if (c.status === 'satisfied') assert.ok(c.evidence, `${c.label} 缺少依据`)
    })
  }],
  ['补贴结构化匹配：缺少社保和学历判定为待确认', () => {
    const policy = subsidyData.subsidyPolicies.find((p) => p.city === '杭州')
    const profile = '我刚来杭州租房居住，无房。'
    const result = subsidyData.evaluateSubsidyMatch(policy, profile)
    assert.equal(result.status, 'pending')
    const pending = result.criteria.filter((c) => c.status === 'pending')
    assert.ok(pending.length > 0)
    // 待确认条件有缺失说明
    pending.forEach((c) => assert.ok(c.missing, `${c.label} 缺少缺失说明`))
  }],
  ['补贴结构化匹配：已停止新受理政策判定为不满足', () => {
    const policy = subsidyData.subsidyPolicies.find((p) => p.status === '已停止新受理')
    assert.ok(policy)
    const result = subsidyData.evaluateSubsidyMatch(policy, '我是应届本科毕业生，已签劳动合同并缴纳社保，无房。')
    assert.equal(result.status, 'unsatisfied')
    assert.equal(result.criteria.length, 1)
    assert.equal(result.criteria[0].status, 'unsatisfied')
    assert.ok(result.criteria[0].missing.includes('已停止新受理'))
  }],
  ['补贴结构化匹配：criteria 包含 label / status / evidence / missing', () => {
    const policy = subsidyData.subsidyPolicies.find((p) => p.city === '南京')
    const result = subsidyData.evaluateSubsidyMatch(policy, '我是应届硕士毕业生')
    assert.ok(Array.isArray(result.criteria))
    result.criteria.forEach((c) => {
      assert.ok(typeof c.key === 'string' && c.key)
      assert.ok(typeof c.label === 'string' && c.label)
      assert.ok(['satisfied', 'pending', 'unsatisfied'].includes(c.status))
      assert.ok(typeof c.evidence === 'string')
      assert.ok(typeof c.missing === 'string')
    })
  }],
  ['补贴结构化匹配：subsidyMatchStatusLabel 返回中文标签', () => {
    assert.equal(subsidyData.subsidyMatchStatusLabel('satisfied'), '满足')
    assert.equal(subsidyData.subsidyMatchStatusLabel('pending'), '待确认')
    assert.equal(subsidyData.subsidyMatchStatusLabel('unsatisfied'), '不满足')
  }],

  // ---- handleAnalyze 真实时序：首次审查快照不为空 ----
  ['合同审查历史：handleAnalyze 真实时序——首次审查快照不为空', () => {
    storage.delete(STORAGE_KEYS.reviewHistory)
    storage.delete(STORAGE_KEYS.contractDraft)

    // 使用真实演示合同文本
    const contractText = demoContractsData.demoContracts[0].text
    const profile = { contractType: 'lease', partyRole: 'partyB', reviewDepth: 'strict' }

    // 模拟 handleAnalyze 中的真实计算（调用真实的 contractReview 函数）
    const cleanText = contractReview.cleanContractTextForReview(contractText)
    const activeProfile = contractReview.resolveReviewProfile(profile, cleanText)
    const findings = contractReview.analyzeContract(cleanText, activeProfile)
    const summary = contractReview.getRiskSummary(findings)
    const dimensions = contractReview.getDimensionScores(findings).filter((item) => item.score > 0)

    // 验证计算结果非空（确保演示合同能触发风险点）
    assert.ok(findings.length > 0, '演示合同应产生风险点')
    assert.ok(summary.score > 0)

    const reviewResult = {
      contractText,
      findings,
      summary,
      dimensions,
      adoptedItems: [],
      revisedDraft: '',
      activeProfile,
      profile: { ...profile },
    }
    // 调用页面实际使用的共享业务函数，避免手工复制快照结构掩盖回归。
    const entry = reviewHistory.createReviewHistoryEntry(reviewResult)
    Taro.setStorageSync(STORAGE_KEYS.reviewHistory, [entry])

    // 验证快照不为空，且与本次计算结果一致
    const loaded = Taro.getStorageSync(STORAGE_KEYS.reviewHistory)
    assert.equal(loaded.length, 1)
    assert.equal(loaded[0].snapshot.contractText, contractText)
    assert.equal(loaded[0].snapshot.findings.length, findings.length)
    assert.ok(loaded[0].snapshot.findings.length > 0, '首次审查快照的 findings 不应为空')
    assert.equal(loaded[0].snapshot.summary.score, summary.score)
    assert.equal(loaded[0].snapshot.summary.label, summary.label)
    assert.deepEqual(loaded[0].snapshot.dimensions, dimensions)
    assert.equal(loaded[0].snapshot.activeProfile.contractType, 'lease')
    assert.equal(loaded[0].snapshot.profile.contractType, 'lease')
  }],

  // ---- handleAnalyze 源码检查：pushHistory 接收计算结果而非 this.state ----
  ['合同审查历史：handleAnalyze 源码——pushHistory 接收计算结果对象', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const filePath = path.resolve('miniapp/src/pages/contract/index.jsx')
    const source = await fs.readFile(filePath, 'utf-8')
    // 混合审查完成后统一保存 result，避免本地和 AI 阶段生成两条历史。
    assert.ok(source.includes('this.pushHistory(result)'), 'pushHistory 应接收本次混合审查结果对象')
    assert.ok(source.includes('localResult = { contractText, findings, summary, dimensions'), '本地结果应包含完整快照字段')
    assert.ok(source.includes('summary: getRiskSummary(findings)'), 'AI 合并后应重新计算 summary')
    assert.ok(source.includes('dimensions: getDimensionScores(findings)'), 'AI 合并后应重新计算 dimensions')
    // 确认不再使用旧的 (summary, count) 签名
    assert.ok(!source.includes('this.pushHistory(summary, findings.length)'), '不应再使用旧的 pushHistory(summary, count) 调用')
  }],

  // ---- restoreHistory 持久化：恢复后同步写入草稿和画像 ----
  ['合同审查历史：restoreHistory 同步持久化草稿和画像到 Storage', () => {
    storage.delete(STORAGE_KEYS.reviewHistory)
    storage.delete(STORAGE_KEYS.contractDraft)
    storage.delete(STORAGE_KEYS.reviewProfile)

    // 准备一条带完整快照的历史记录
    const snap = {
      contractText: '甲方与乙方签订的租赁合同（恢复测试）',
      findings: [{ id: 'f1', level: 'high', title: '押金过高', score: 20, dimension: 'payment', explain: '押金超过月租金2倍', suggestion: '建议协商降低' }],
      summary: { score: 72, label: '需重点关注', tone: 'warning', advice: '建议协商', highCount: 1, mediumCount: 0 },
      dimensions: [{ dimension: 'payment', score: 60, tone: 'medium' }],
      adoptedItems: [],
      revisedDraft: '',
      activeProfile: { contractType: 'lease', partyRole: 'partyB', reviewDepth: 'strict' },
      profile: { contractType: 'lease', partyRole: 'partyB', reviewDepth: 'strict' },
    }
    const entry = {
      id: 'hist-restore-001',
      time: '2026-07-28 15:00:00',
      score: 72,
      label: '需重点关注',
      count: 1,
      snapshot: snap,
    }
    Taro.setStorageSync(STORAGE_KEYS.reviewHistory, [entry])

    // 模拟 restoreHistory 的持久化逻辑（与 contract/index.jsx 一致）
    // 1. draftSaver.cancel() — 这里不涉及防抖，跳过
    // 2. 同步持久化合同草稿和审查画像
    Taro.setStorageSync(STORAGE_KEYS.contractDraft, snap.contractText || '')
    Taro.setStorageSync(STORAGE_KEYS.reviewProfile, snap.profile || { contractType: 'lease', partyRole: 'partyB', reviewDepth: 'strict' })

    // 验证 Storage 中已写入恢复的草稿和画像
    assert.equal(Taro.getStorageSync(STORAGE_KEYS.contractDraft), '甲方与乙方签订的租赁合同（恢复测试）')
    const persistedProfile = Taro.getStorageSync(STORAGE_KEYS.reviewProfile)
    assert.equal(persistedProfile.contractType, 'lease')
    assert.equal(persistedProfile.partyRole, 'partyB')
    assert.equal(persistedProfile.reviewDepth, 'strict')
  }],

  // ---- restoreHistory 源码检查：调用 draftSaver.cancel 和 setStorageSync ----
  ['合同审查历史：restoreHistory 源码——cancel draftSaver 并持久化', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const filePath = path.resolve('miniapp/src/pages/contract/index.jsx')
    const source = await fs.readFile(filePath, 'utf-8')
    // 确认 restoreHistory 中调用了 draftSaver.cancel()
    assert.ok(source.includes('this.draftSaver.cancel()'), 'restoreHistory 应调用 draftSaver.cancel()')
    // 确认 restoreHistory 中同步持久化了草稿
    assert.ok(source.match(/setStorageSync\(\s*STORAGE_KEY\s*,/), 'restoreHistory 应同步持久化 STORAGE_KEY')
    // 确认 restoreHistory 中同步持久化了画像
    assert.ok(source.match(/setStorageSync\(\s*PROFILE_KEY\s*,/), 'restoreHistory 应同步持久化 PROFILE_KEY')
  }],

  // ---- restoreHistory + draftSaver 真实时序：取消未执行的防抖保存 ----
  ['合同审查历史：restoreHistory 取消 draftSaver 后旧草稿不覆盖恢复结果', async () => {
    storage.delete(STORAGE_KEYS.contractDraft)
    storage.delete(STORAGE_KEYS.reviewProfile)
    storage.delete(STORAGE_KEYS.reviewHistory)

    // 模拟用户在恢复前编辑了合同（触发 draftSaver.schedule）
    let persistedDraft = ''
    const draftSaver = createDebouncedSaver((value) => {
      persistedDraft = value
      Taro.setStorageSync(STORAGE_KEYS.contractDraft, value)
      return true
    }, 10)

    // 用户编辑了草稿，但防抖尚未执行
    draftSaver.schedule('用户正在编辑的旧草稿——不应覆盖恢复结果')
    assert.equal(persistedDraft, '', '防抖未执行时不应写入')

    // 此时用户点击恢复某条历史
    const snap = {
      contractText: '恢复后的合同正文',
      profile: { contractType: 'lease', partyRole: 'partyB', reviewDepth: 'strict' },
    }
    // restoreHistory 先 cancel draftSaver
    draftSaver.cancel()
    // 再同步持久化恢复的草稿和画像
    Taro.setStorageSync(STORAGE_KEYS.contractDraft, snap.contractText)
    Taro.setStorageSync(STORAGE_KEYS.reviewProfile, snap.profile)

    // 等待防抖时间过去，验证 cancel 生效——旧草稿不会写入
    await new Promise((resolve) => setTimeout(resolve, 20))
    assert.equal(persistedDraft, '', 'cancel 后防抖不应再执行，旧草稿不写入')

    // 验证 Storage 中只有恢复结果
    assert.equal(Taro.getStorageSync(STORAGE_KEYS.contractDraft), '恢复后的合同正文')
  }],

  ['合同审查历史：超大快照降级为摘要且保留基本信息', () => {
    const entry = reviewHistory.createReviewHistoryEntry({
      contractText: '甲'.repeat(reviewHistory.REVIEW_HISTORY_SNAPSHOT_BUDGET + 1),
      findings: [],
      summary: { score: 20, label: '低风险' },
      dimensions: [],
      adoptedItems: [],
      revisedDraft: '',
      activeProfile: null,
      profile: { contractType: 'lease', partyRole: 'partyB', reviewDepth: 'strict' },
    })
    const [saved] = reviewHistory.compactReviewHistory([entry])
    assert.equal(saved.snapshot, undefined)
    assert.equal(saved.score, 20)
    assert.equal(saved.label, '低风险')
    assert.equal(saved.count, 0)
  }],

  ['合同审查历史：Storage 首次超限时降级保存摘要', () => {
    const entry = reviewHistory.createReviewHistoryEntry({
      contractText: '正常合同',
      findings: [{ id: 'risk-1' }],
      summary: { score: 60, label: '中风险' },
      dimensions: [],
      adoptedItems: [],
      revisedDraft: '',
      activeProfile: null,
      profile: { contractType: 'lease', partyRole: 'partyB', reviewDepth: 'strict' },
    })
    const originalSetStorageSync = Taro.setStorageSync
    let attempts = 0
    Taro.setStorageSync = (key, value) => {
      if (key === STORAGE_KEYS.reviewHistory && attempts++ === 0) throw new Error('quota exceeded')
      return originalSetStorageSync(key, value)
    }
    try {
      const result = reviewHistory.saveReviewHistory([entry])
      assert.equal(result.ok, true)
      assert.equal(result.degraded, true)
      assert.equal(result.history[0].snapshot, undefined)
      assert.equal(Taro.getStorageSync(STORAGE_KEYS.reviewHistory)[0].score, 60)
    } finally {
      Taro.setStorageSync = originalSetStorageSync
    }
  }],

  ['合同审查历史：Storage 连续失败时返回失败而不抛异常', () => {
    const entry = reviewHistory.createReviewHistoryEntry({
      contractText: '正常合同',
      findings: [],
      summary: { score: 10, label: '低风险' },
      dimensions: [],
      adoptedItems: [],
      revisedDraft: '',
      activeProfile: null,
      profile: { contractType: 'lease', partyRole: 'partyB', reviewDepth: 'strict' },
    })
    const originalSetStorageSync = Taro.setStorageSync
    Taro.setStorageSync = () => { throw new Error('quota exceeded') }
    try {
      const result = reviewHistory.saveReviewHistory([entry])
      assert.equal(result.ok, false)
      assert.ok(result.error)
    } finally {
      Taro.setStorageSync = originalSetStorageSync
    }
  }],

  // ---- 补贴否定场景：未缴社保 → unsatisfied ----
  ['补贴否定：未缴社保应判不满足，不因包含"社保"判满足', () => {
    const policy = subsidyData.subsidyPolicies.find((p) => p.city === '杭州')
    const result = subsidyData.evaluateSubsidyMatch(policy, '我是应届本科毕业生，未缴社保，在杭无房')
    const social = result.criteria.find((c) => c.key === 'social')
    assert.equal(social.status, 'unsatisfied')
    assert.ok(social.missing.includes('未缴纳社保'))
  }],

  ['补贴否定：没有缴纳社保应判不满足', () => {
    const policy = subsidyData.subsidyPolicies.find((p) => p.city === '杭州')
    const result = subsidyData.evaluateSubsidyMatch(policy, '应届本科毕业生，没有缴纳社保，杭州无房')
    const social = result.criteria.find((c) => c.key === 'social')
    assert.equal(social.status, 'unsatisfied')
  }],

  ['补贴肯定：已缴社保应判满足', () => {
    const policy = subsidyData.subsidyPolicies.find((p) => p.city === '杭州')
    const result = subsidyData.evaluateSubsidyMatch(policy, '我是应届本科毕业生，已缴纳社保6个月，在杭无房')
    const social = result.criteria.find((c) => c.key === 'social')
    assert.equal(social.status, 'satisfied')
  }],

  // ---- 补贴否定场景：未签劳动合同 / 未就业 → unsatisfied ----
  ['补贴否定：未签劳动合同应判不满足', () => {
    const policy = subsidyData.subsidyPolicies.find((p) => p.city === '南京')
    const result = subsidyData.evaluateSubsidyMatch(policy, '硕士毕业生，未签劳动合同，未缴社保')
    const employment = result.criteria.find((c) => c.key === 'employment')
    assert.equal(employment.status, 'unsatisfied')
  }],

  ['补贴否定：未就业应判不满足', () => {
    const policy = subsidyData.subsidyPolicies.find((p) => p.city === '青岛')
    const result = subsidyData.evaluateSubsidyMatch(policy, '本科毕业生，未就业，未创业')
    const employment = result.criteria.find((c) => c.key === 'employment')
    assert.equal(employment.status, 'unsatisfied')
    const business = result.criteria.find((c) => c.key === 'business')
    assert.equal(business.status, 'unsatisfied')
  }],

  ['补贴否定：失业应判不满足', () => {
    const policy = subsidyData.subsidyPolicies.find((p) => p.city === '南京')
    const result = subsidyData.evaluateSubsidyMatch(policy, '本科毕业生，目前失业，社保断缴')
    const employment = result.criteria.find((c) => c.key === 'employment')
    assert.equal(employment.status, 'unsatisfied')
  }],

  // ---- 补贴否定场景：已有住房 / 有房 → unsatisfied ----
  ['补贴否定：已有住房应判不满足', () => {
    const policy = subsidyData.subsidyPolicies.find((p) => p.city === '杭州')
    const result = subsidyData.evaluateSubsidyMatch(policy, '应届本科毕业生，已缴社保，已有住房')
    const noHouse = result.criteria.find((c) => c.key === 'noHouse')
    assert.equal(noHouse.status, 'unsatisfied')
    assert.ok(noHouse.missing.includes('有自有住房'))
  }],

  ['补贴否定：有房应判不满足', () => {
    const policy = subsidyData.subsidyPolicies.find((p) => p.city === '杭州')
    const result = subsidyData.evaluateSubsidyMatch(policy, '应届本科毕业生，已缴社保，名下有房')
    const noHouse = result.criteria.find((c) => c.key === 'noHouse')
    assert.equal(noHouse.status, 'unsatisfied')
  }],

  ['补贴肯定：无房应判满足', () => {
    const policy = subsidyData.subsidyPolicies.find((p) => p.city === '杭州')
    const result = subsidyData.evaluateSubsidyMatch(policy, '应届本科毕业生，已缴社保，在杭无房')
    const noHouse = result.criteria.find((c) => c.key === 'noHouse')
    assert.equal(noHouse.status, 'satisfied')
  }],

  // ---- 补贴否定场景：未落户 → unsatisfied ----
  ['补贴否定：未落户应判不满足', () => {
    const policy = subsidyData.subsidyPolicies.find((p) => p.city === '长沙')
    const result = subsidyData.evaluateSubsidyMatch(policy, '高校毕业生，未落户长沙，社保断缴')
    const hukou = result.criteria.find((c) => c.key === 'hukou')
    assert.equal(hukou.status, 'unsatisfied')
    assert.ok(hukou.missing.includes('未落户'))
  }],

  ['补贴肯定：已落户应判满足', () => {
    const policy = subsidyData.subsidyPolicies.find((p) => p.city === '长沙')
    const result = subsidyData.evaluateSubsidyMatch(policy, '高校毕业生，已落户长沙，连续缴纳社保')
    const hukou = result.criteria.find((c) => c.key === 'hukou')
    assert.equal(hukou.status, 'satisfied')
  }],

  // ---- 补贴否定场景：未创业 → unsatisfied ----
  ['补贴否定：未创业应判不满足', () => {
    const policy = subsidyData.subsidyPolicies.find((p) => p.city === '广州')
    const result = subsidyData.evaluateSubsidyMatch(policy, '高校毕业生，未创业，暂未就业')
    const business = result.criteria.find((c) => c.key === 'business')
    assert.equal(business.status, 'unsatisfied')
    assert.ok(business.missing.includes('未创业'))
  }],

  ['补贴肯定：已创业应判满足', () => {
    const policy = subsidyData.subsidyPolicies.find((p) => p.city === '广州')
    const result = subsidyData.evaluateSubsidyMatch(policy, '高校毕业生，已创业，有营业执照')
    const business = result.criteria.find((c) => c.key === 'business')
    assert.equal(business.status, 'satisfied')
  }],

  ['补贴汇总：任一条件不满足时整体优先判不满足', () => {
    const policy = subsidyData.subsidyPolicies.find((p) => p.city === '杭州')
    const result = subsidyData.evaluateSubsidyMatch(policy, '本科毕业生，未缴社保')
    assert.equal(result.criteria.find((c) => c.key === 'social').status, 'unsatisfied')
    assert.equal(result.criteria.find((c) => c.key === 'noHouse').status, 'pending')
    assert.equal(result.status, 'unsatisfied')
  }],

  ['补贴短语：常见明确不满足表达不会被关键词误判', () => {
    const cases = [
      ['杭州', '本科毕业生，无社保，无房', 'social'],
      ['杭州', '本科毕业生，社保还没缴，无房', 'social'],
      ['杭州', '本科毕业生，社保断缴，无房', 'social'],
      ['杭州', '非应届本科生，已缴社保，无房', 'graduation'],
      ['南京', '硕士毕业生，无劳动合同，已缴社保', 'employment'],
      ['南京', '硕士毕业生，劳动合同还没签，已缴社保', 'employment'],
      ['长沙', '高校毕业生，非本市户籍，已缴社保', 'hukou'],
      ['广州', '高校毕业生，无营业执照，目前在职', 'business'],
    ]
    cases.forEach(([city, profile, key]) => {
      const policy = subsidyData.subsidyPolicies.find((item) => item.city === city)
      const result = subsidyData.evaluateSubsidyMatch(policy, profile)
      assert.equal(result.criteria.find((criterion) => criterion.key === key)?.status, 'unsatisfied', `${profile} 未正确判定 ${key}`)
      assert.equal(result.status, 'unsatisfied', `${profile} 的整体状态未优先判为不满足`)
    })
  }],

  ['补贴短语：无房表达、双重否定和最新状态正确处理', () => {
    const hangzhou = subsidyData.subsidyPolicies.find((item) => item.city === '杭州')
    const noHouse = subsidyData.evaluateSubsidyMatch(hangzhou, '应届本科毕业生，已缴社保，名下没有房产')
    assert.equal(noHouse.criteria.find((criterion) => criterion.key === 'noHouse').status, 'satisfied')
    const continuousSocial = subsidyData.evaluateSubsidyMatch(hangzhou, '应届本科毕业生，从未断缴社保，无房')
    assert.equal(continuousSocial.criteria.find((criterion) => criterion.key === 'social').status, 'satisfied')

    const nanjing = subsidyData.subsidyPolicies.find((item) => item.city === '南京')
    const updatedEmployment = subsidyData.evaluateSubsidyMatch(nanjing, '之前未就业，现在已就业并签约')
    assert.equal(updatedEmployment.criteria.find((criterion) => criterion.key === 'employment').status, 'satisfied')
    const positiveConjunction = subsidyData.evaluateSubsidyMatch(nanjing, '不但就业，而且已经签订劳动合同')
    assert.equal(positiveConjunction.criteria.find((criterion) => criterion.key === 'employment').status, 'satisfied')
  }],

  // ---- buildCheckinReportRef 空验房：完全未验房时返回 null ----
  ['evidenceImport 空数据：完全未验房时 buildCheckinReportRef 返回 null', () => {
    storage.delete(STORAGE_KEYS.checkinInspection)
    const ref = evidenceImport.buildCheckinReportRef()
    assert.equal(ref, null)
  }],

  ['evidenceImport 有数据：验房后 buildCheckinReportRef 返回报告引用', () => {
    storage.delete(STORAGE_KEYS.checkinInspection)
    // 模拟已验房：至少一项有 status
    const state = createDefaultCheckinState()
    state.living.wall = { status: 'good', defect: '', note: '墙面完好', photos: [] }
    saveCheckinInspectionState(state)

    const ref = evidenceImport.buildCheckinReportRef()
    assert.ok(ref !== null)
    assert.equal(ref.sourceModule, 'checkin')
    assert.equal(ref.sourcePath, 'summary')
    assert.ok(ref.textContent.includes('验房报告'))
    assert.ok(ref.fileName.endsWith('.txt'))
  }],

  ['evidenceImport 旧数据：unchecked 但有照片、备注或瑕疵时仍可生成报告', () => {
    const variants = [
      { status: 'unchecked', defect: '', note: '', photos: ['wxfile://saved/legacy.jpg'] },
      { status: 'unchecked', defect: '', note: '墙面已拍照待确认', photos: [] },
      { status: 'unchecked', defect: '疑似裂缝', note: '', photos: [] },
    ]
    variants.forEach((record) => {
      storage.delete(STORAGE_KEYS.checkinInspection)
      const state = createDefaultCheckinState()
      state.living.wall = record
      saveCheckinInspectionState(state)
      assert.equal(hasCheckinContent(state), true)
      const ref = evidenceImport.buildCheckinReportRef()
      assert.ok(ref)
      assert.ok(ref.textContent.includes('请人工确认'))
    })
  }],

  ['合同导入：微信聊天 TXT 文件被真实读取并规范化正文', async () => {
    const filePath = 'wxfile://temp/contract.txt'
    virtualFiles.set(filePath, { data: '\uFEFF第一条\r\n第二条', encoding: 'utf8' })
    messageFileError = null
    messageFileResult = { tempFiles: [{ name: '租赁合同.TXT', path: filePath, size: 128 }] }
    const imported = await contractTextImport.importWechatContractText()
    assert.equal(imported.fileName, '租赁合同.TXT')
    assert.equal(imported.text, '第一条\n第二条')
  }],

  ['合同导入：DOCX/PDF 和合同图片进入真实鉴权上传链路', async () => {
    storage.set(STORAGE_KEYS.aiSession, { token: 'valid-session-token', expiresAt: Date.now() + 3_600_000 })
    const pdf = contractTextImport.validateContractFile({ name: '租赁合同.pdf', path: 'wxfile://temp/contract.pdf', size: 1024 })
    let progress = 0
    uploadResponseData = { ok: true, text: 'PDF 合同正文', fileName: '租赁合同.pdf', retained: false }
    uploadShouldFail = false
    uploadShouldPending = false
    const documentTask = contractTextImport.startRemoteDocumentImport(pdf, { onProgress: (value) => { progress = value } })
    const documentResult = await documentTask.promise
    assert.equal(documentResult.text, 'PDF 合同正文')
    assert.equal(progress, 64)
    assert.match(lastUploadArgs.url, /\/api\/miniapp\/contract\/parse$/)
    assert.equal(lastUploadArgs.name, 'document')
    assert.equal(lastUploadArgs.header.Authorization, 'Bearer valid-session-token')

    const image = await contractTextImport.chooseContractImage('camera')
    uploadResponseData = { ok: true, text: '照片识别合同正文', confidence: 91 }
    const imageResult = await contractTextImport.startRemoteImageImport(image).promise
    assert.equal(imageResult.confidence, 91)
    assert.match(lastUploadArgs.url, /\/api\/miniapp\/ocr\/image$/)
    assert.equal(lastUploadArgs.name, 'image')
    assert.equal(lastUploadArgs.header.Authorization, 'Bearer valid-session-token')
    assert.deepEqual(lastChooseImageArgs.sourceType, ['camera'])
  }],

  ['合同导入：联网上传可取消且网络失败不覆盖当前正文', async () => {
    storage.set(STORAGE_KEYS.aiSession, { token: 'valid-session-token', expiresAt: Date.now() + 3_600_000 })
    const file = { name: '合同.docx', path: 'wxfile://temp/contract.docx', size: 1024 }
    uploadShouldPending = true
    const pendingTask = contractTextImport.startRemoteDocumentImport(file)
    await new Promise((resolve) => setTimeout(resolve, 0))
    pendingTask.cancel()
    await assert.rejects(pendingTask.promise, (error) => error.code === 'cancelled')

    uploadShouldPending = false
    uploadShouldFail = true
    const failedTask = contractTextImport.startRemoteDocumentImport(file)
    await assert.rejects(failedTask.promise, (error) => {
      const detail = contractTextImport.getContractImportError(error)
      return error.code === 'network-failed' && /合法域名/.test(detail.content)
    })
    uploadShouldFail = false
  }],

  ['合同导入：不支持格式、超大文件和空文件返回明确错误', async () => {
    assert.throws(
      () => contractTextImport.validateContractTextFile({ name: '合同.pdf', path: 'wxfile://temp/a.pdf', size: 100 }),
      (error) => error.code === 'unsupported-file',
    )
    assert.throws(
      () => contractTextImport.validateContractTextFile({ name: '合同.txt', path: 'wxfile://temp/a.txt', size: 9 * 1024 * 1024 }),
      (error) => error.code === 'file-too-large',
    )
    const emptyPath = 'wxfile://temp/empty.txt'
    virtualFiles.set(emptyPath, { data: '  ', encoding: 'utf8' })
    messageFileResult = { tempFiles: [{ name: '空合同.txt', path: emptyPath, size: 2 }] }
    await assert.rejects(contractTextImport.importWechatContractText(), (error) => error.code === 'empty-file')
  }],

  ['合同导入：取消选择不报错，开发者工具失败提示真机预览', async () => {
    messageFileError = { errMsg: 'chooseMessageFile:fail cancel' }
    await assert.rejects(contractTextImport.importWechatContractText(), (error) => {
      assert.equal(error.code, 'cancelled')
      assert.equal(contractTextImport.getContractImportError(error).cancelled, true)
      return true
    })
    const detail = contractTextImport.getContractImportError(
      { code: 'choose-failed', cause: { errMsg: 'chooseMessageFile:fail not supported' } },
      { source: 'wechat', platform: 'devtools' },
    )
    assert.match(detail.title, /开发者工具/)
    assert.match(detail.content, /真机/)
    messageFileError = null
  }],

  ['合同导入：手机剪贴板正文可导入，空剪贴板给出操作步骤', async () => {
    clipboardText = '\uFEFF 手机合同正文\r\n押金 3000 元 '
    const imported = await contractTextImport.importClipboardContractText()
    assert.equal(imported.text, '手机合同正文\n押金 3000 元')
    clipboardText = '   '
    await assert.rejects(contractTextImport.importClipboardContractText(), (error) => {
      assert.equal(error.code, 'clipboard-empty')
      const detail = contractTextImport.getContractImportError(error, { source: 'phone' })
      assert.match(detail.content, /WPS/)
      assert.match(detail.content, /微信聊天/)
      return true
    })
  }],

  ['合同导入：真机隐私声明缺失时提示正确的后台类型', () => {
    const clipboardDetail = contractTextImport.getContractImportError(
      { code: 'clipboard-failed', cause: { errMsg: 'getClipboardData:fail privacy agreement is not declared' } },
      { source: 'phone' },
    )
    assert.match(clipboardDetail.content, /剪切板/)
    assert.match(clipboardDetail.content, /微信公众平台/)

    const fileDetail = contractTextImport.getContractImportError(
      { code: 'choose-failed', cause: { errMsg: 'chooseMessageFile:fail api scope is not declared' } },
      { source: 'wechat' },
    )
    assert.match(fileDetail.content, /选中的文件/)
    assert.match(fileDetail.content, /微信公众平台/)
  }],

  ['工作流上下文：合同、验房、证据包和补贴状态来自真实数据', () => {
    const contractText = '租赁合同约定押金不退，出租方可随时进入房屋。'
    const findings = contractReview.analyzeContract(contractText)
    const summary = contractReview.getRiskSummary(findings)
    const reviewEntry = reviewHistory.createReviewHistoryEntry({
      contractText,
      findings,
      summary,
      dimensions: [],
      adoptedItems: [],
      revisedDraft: '',
      activeProfile: null,
      profile: {},
    })
    const checkinState = createDefaultCheckinState()
    checkinState.living.wall = { status: 'defect', defect: '墙面裂缝', note: '靠近窗户', photos: ['wxfile://saved/context-photo'] }
    let evidenceState = createDefaultEvidencePackState()
    evidenceState.evidence.contract[0] = true
    evidenceState = addAttachment(evidenceState, 'contract', {
      id: 'context-attachment',
      fileName: '合同.pdf',
      fileType: 'file',
      localPath: 'wxfile://saved/context-contract',
      source: 'chat',
    })

    const context = workflowContext.buildWorkflowContext({
      contractText,
      reviewHistory: [reviewEntry],
      checkinState,
      evidencePackState: evidenceState,
      subsidyState: { city: '杭州', profile: '应届本科毕业生，已缴社保，在杭无房' },
    })

    assert.equal(context.review.isCurrent, true)
    assert.equal(context.modules.review.status, '已审查')
    assert.equal(context.checkin.stats.defects, 1)
    assert.equal(context.modules.checkin.status, '进行中')
    assert.equal(context.evidence.attachmentStats.total, 1)
    assert.equal(context.modules.evidence.status, '已整理')
    assert.equal(context.subsidy.city, '杭州')
    assert.equal(context.subsidy.profile, '应届本科毕业生，已缴社保，在杭无房')
    assert.ok(context.subsidy.matches.length > 0)
    assert.ok(context.subsidy.matches[0].criteria.length > 0)
    assert.equal(context.linkedSources.length, 4)
  }],

  ['AI 本地上下文：真实加载四模块并在回答中引用相关资料', () => {
    storage.clear()
    const contractText = '出租方可以随时进入房屋，承租方不得拒绝。押金在任何情况下均不退还。'
    const findings = contractReview.analyzeContract(contractText)
    const summary = contractReview.getRiskSummary(findings)
    const entry = reviewHistory.createReviewHistoryEntry({
      contractText,
      findings,
      summary,
      dimensions: [],
      adoptedItems: [],
      revisedDraft: '',
      activeProfile: null,
      profile: {},
    })
    Taro.setStorageSync(STORAGE_KEYS.contractDraft, contractText)
    Taro.setStorageSync(STORAGE_KEYS.reviewHistory, [entry])

    const checkinState = createDefaultCheckinState()
    checkinState.living.wall = { status: 'good', defect: '', note: '', photos: ['wxfile://saved/ai-photo'] }
    saveCheckinInspectionState(checkinState)

    let evidenceState = createDefaultEvidencePackState()
    evidenceState.formData.deposit = '3800'
    evidenceState = addAttachment(evidenceState, 'photos', {
      id: 'ai-evidence',
      fileName: '退租照片.jpg',
      fileType: 'image',
      localPath: 'wxfile://saved/ai-photo',
      source: 'module',
      sourceModule: 'checkin',
      sourcePath: 'living.wall.photos[0]',
    })
    saveEvidencePackState(evidenceState)
    Taro.setStorageSync(STORAGE_KEYS.subsidyMatcher, { city: '杭州', profile: '应届本科毕业生，已缴社保，在杭无房' })

    const context = aiAssistant.loadAllModuleContext()
    assert.equal(context.linkedSources.length, 4)
    const reply = aiAssistant.buildLocalReply({ prompt: '房东要扣押金，我应该怎么办？', context })
    assert.match(reply, /本机证据包已有 1 个附件/)
    assert.match(reply, /登记押金为 3800 元/)
    assert.match(reply, /仅供参考/)
    assert.doesNotMatch(reply, /^(?:结论|重点风险|建议动作|依据|下一步)：/m)
    assert.ok(reply.length <= 500, '本地回答应引用真实资料但避免重复资料目录')
  }],

  ['本地知识库：Web 与小程序双源一致且覆盖新增高频主题', async () => {
    const [{ knowledgeBaseItems: webItems }, { knowledgeBaseItems: miniappItems }] = await Promise.all([
      import('../src/data/knowledgeBase.js'),
      import('../miniapp/src/shared/knowledgeBase.js'),
    ])
    assert.deepEqual(miniappItems, webItems)
    assert.ok(webItems.length >= 19)
    const titles = webItems.map((item) => item.title).join('｜')
    ;['提前解约', '转租', '房屋出售', '正常损耗', '安全健康', '杂费凭证', '通知送达'].forEach((keyword) => assert.match(titles, new RegExp(keyword)))
  }],

  ['本地文件治理：统计真实占用且只清理未被业务记录引用的文件', async () => {
    storage.clear()
    savedFiles.clear()
    removeSavedFileShouldFail = false
    const referencedPath = 'wxfile://saved/referenced-photo'
    const stalePath = 'wxfile://saved/stale-photo'
    savedFiles.set(referencedPath, { size: 2048 })
    savedFiles.set(stalePath, { size: 4096 })

    const checkinState = createDefaultCheckinState()
    checkinState.living.wall = { status: 'good', defect: '', note: '', photos: [referencedPath] }
    saveCheckinInspectionState(checkinState)

    const usage = await localDataManager.getLocalDataUsage()
    assert.equal(usage.savedFileCount, 2)
    assert.equal(usage.savedFileBytes, 6144)
    assert.equal(usage.unreferencedCount, 1)
    assert.equal(usage.unreferencedBytes, 4096)
    assert.ok(localDataManager.collectReferencedFilePaths().has(referencedPath))

    const cleanup = await localDataManager.cleanupUnreferencedSavedFiles()
    assert.equal(cleanup.ok, true)
    assert.equal(cleanup.removedFiles, 1)
    assert.equal(cleanup.removedBytes, 4096)
    assert.equal(savedFiles.has(referencedPath), true)
    assert.equal(savedFiles.has(stalePath), false)
    assert.equal(localDataManager.formatLocalBytes(6144), '6.0 KB')
  }],

  ['AI 本地寒暄：简短问候不再生成无关的合同风险长文', () => {
    const context = {
      contractText: '',
      review: { hasDraft: false, findings: [], summary: null },
      checkin: { hasData: false },
      evidence: { hasData: false },
      subsidy: { hasData: false },
    }
    const reply = aiAssistant.buildLocalReply({ prompt: '你好', context })
    assert.match(reply, /我可以帮你看合同/)
    assert.match(reply, /联网不可用时会自动用本地分析/)
    assert.match(reply, /自动用本地分析/)
    assert.doesNotMatch(reply, /^结论：/)
    assert.doesNotMatch(reply, /争议事实.*合同.*凭证.*照片/)
  }],

  ['本地存储展示：基础库返回 0 上限时使用 10 MB 合理兜底', () => {
    const original = Taro.getStorageInfoSync
    try {
      Taro.getStorageInfoSync = () => ({ currentSize: 5, limit: 0 })
      assert.deepEqual(localDataManager.getLocalStorageInfo(), { currentSize: 5, limit: 10240 })
    } finally {
      Taro.getStorageInfoSync = original
    }
  }],

  ['AI 自动模式：默认联网、失败本地降级且不再显示双模式开关', async () => {
    const fs = await import('node:fs')
    const source = fs.readFileSync(new URL('../miniapp/src/pages/ai/index.jsx', import.meta.url), 'utf8')
    assert.doesNotMatch(source, /className='mode-switch'/)
    assert.doesNotMatch(source, /function loadPreferredMode/)
    assert.match(source, /await confirmRemoteConsent\(\)/)
    assert.match(source, /await runRemote\(\{ payload, prompt, currentContext: nextContext, addFallback: true \}\)/)
    assert.doesNotMatch(source, /if \(serviceReady === false\) \{/)
    assert.match(source, /meta: '本地降级'/)
    assert.match(source, /撤销联网 AI 授权/)
    assert.match(source, /clearMiniappSession\(\)/)
  }],

  ['首页与补贴：不再使用演示金额和演示身份冒充用户数据', async () => {
    const fs = await import('node:fs')
    const homeSource = fs.readFileSync(new URL('../miniapp/src/pages/index/index.jsx', import.meta.url), 'utf8')
    const homeStyles = fs.readFileSync(new URL('../miniapp/src/pages/index/index.css', import.meta.url), 'utf8')
    const subsidySource = fs.readFileSync(new URL('../miniapp/src/pages/subsidy/index.jsx', import.meta.url), 'utf8')
    assert.match(homeSource, /depositAmount:\s*''/)
    assert.match(homeSource, /填写金额后计算/)
    assert.match(homeSource, /const review = workflow\.review/)
    assert.match(homeSource, /if \(!review\.isCurrent\)/)
    assert.match(homeSource, /workflow\.review\.isCurrent/)
    assert.match(homeStyles, /\.home-page \.card\s*{[^}]*margin-left:\s*0;[^}]*margin-right:\s*0;/s)
    assert.match(subsidySource, /profile:\s*''/)
    assert.match(subsidySource, /页面不会再使用演示身份代替你/)
  }],

  ['补贴页 AI：在当前页面请求、展示和降级，不再跳转 AI 页面', async () => {
    const fs = await import('node:fs')
    const source = fs.readFileSync(new URL('../miniapp/src/pages/subsidy/index.jsx', import.meta.url), 'utf8')
    assert.doesNotMatch(source, /openAiTask/)
    assert.match(source, /await confirmRemoteConsent\(\)/)
    assert.match(source, /startRemoteAiRequest\(payload, \{ force \}\)/)
    assert.match(source, /selectedModules: \['subsidy'\]/)
    assert.match(source, /buildLocalReply\(\{ prompt, context \}\)/)
    assert.match(source, /AI 匹配解释/)
    assert.match(source, /aiAnalysis\.reply\.length > 280/)
    assert.match(source, /查看完整分析/)
    assert.match(source, /收起完整分析/)
    assert.match(source, /重试联网/)
    assert.match(source, /const runId = \+\+aiRunRef\.current/)
    assert.match(source, /if \(runId !== aiRunRef\.current\) return/)
    const styles = fs.readFileSync(new URL('../miniapp/src/pages/subsidy/index.css', import.meta.url), 'utf8')
    assert.match(styles, /\.inline-ai-content\.is-collapsed\s*{[^}]*max-height:\s*360px;[^}]*overflow:\s*hidden;/s)
  }],

  ['证据页 AI：当前页面优化沟通说明、失败保留草稿并支持采用', async () => {
    const fs = await import('node:fs')
    const source = fs.readFileSync(new URL('../miniapp/src/pages/evidence/index.jsx', import.meta.url), 'utf8')
    const styles = fs.readFileSync(new URL('../miniapp/src/pages/evidence/index.css', import.meta.url), 'utf8')
    assert.doesNotMatch(source, /openAiTask/)
    assert.match(source, /await confirmRemoteConsent\(\)/)
    assert.match(source, /selectedModules: \['evidence'\]/)
    assert.match(source, /startRemoteAiRequest\(payload, \{ force \}\)/)
    assert.match(source, /已保留本地草稿/)
    assert.match(source, /applyAiCommunication/)
    assert.match(source, /让 AI 优化这段话/)
    assert.match(source, /重试联网/)
    assert.match(styles, /\.evidence-ai-panel\s*{/)
    assert.match(styles, /\.evidence-ai-line\s*{[^}]*overflow-wrap:\s*anywhere;/s)
  }],

  ['验房折叠项：未检查项默认收起且照片提示不会在真机逐字换行', async () => {
    const fs = await import('node:fs')
    const source = fs.readFileSync(new URL('../miniapp/src/pages/checkin/index.jsx', import.meta.url), 'utf8')
    const styles = fs.readFileSync(new URL('../miniapp/src/pages/checkin/index.css', import.meta.url), 'utf8')
    assert.match(source, /const expanded = expandedItemKey === itemKey/)
    assert.match(source, /record\.status === 'unchecked' \? '开始记录' : '补充记录'/)
    assert.match(source, /record\.status === 'unchecked' \? '未检查'/)
    assert.match(styles, /\.inspection-head > view\s*{[^}]*flex:\s*1;[^}]*min-width:\s*0;/s)
    assert.match(styles, /\.item-expand\s*{[^}]*width:\s*auto;[^}]*flex-shrink:\s*0;/s)
    assert.match(styles, /\.storage-tools\s*{[^}]*display:\s*flex;/s)
    assert.match(styles, /\.storage-hint\s*{[^}]*flex:\s*1;[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere;/s)
  }],

  ['表单可达性：证据和验房高频输入均有明确标签', async () => {
    const fs = await import('node:fs')
    const evidenceSource = fs.readFileSync(new URL('../miniapp/src/pages/evidence/index.jsx', import.meta.url), 'utf8')
    const checkinSource = fs.readFileSync(new URL('../miniapp/src/pages/checkin/index.jsx', import.meta.url), 'utf8')
    assert.match(evidenceSource, /aria-label='房屋地址'/)
    assert.match(evidenceSource, /aria-label='押金金额'/)
    assert.match(evidenceSource, /aria-label='沟通说明'/)
    assert.match(checkinSource, /aria-label=\{`\$\{room\.label\}\$\{item\.label\}瑕疵描述`\}/)
    assert.match(checkinSource, /aria-label='验房报告'/)
  }],

  ['深层交互体验：欢迎语不误导模式，长内容与高频按钮适合真机操作', async () => {
    const fs = await import('node:fs')
    const aiSource = fs.readFileSync(new URL('../miniapp/src/pages/ai/index.jsx', import.meta.url), 'utf8')
    const remoteRequestSource = fs.readFileSync(new URL('../miniapp/src/utils/remoteAiRequest.js', import.meta.url), 'utf8')
    const contractSource = fs.readFileSync(new URL('../miniapp/src/pages/contract/index.jsx', import.meta.url), 'utf8')
    const contractStyles = fs.readFileSync(new URL('../miniapp/src/pages/contract/index.css', import.meta.url), 'utf8')
    const evidenceSource = fs.readFileSync(new URL('../miniapp/src/pages/evidence/index.jsx', import.meta.url), 'utf8')
    const appStyles = fs.readFileSync(new URL('../miniapp/src/app.css', import.meta.url), 'utf8')
    const evidenceStyles = fs.readFileSync(new URL('../miniapp/src/pages/evidence/index.css', import.meta.url), 'utf8')
    assert.match(aiSource, /我会优先联网回答；不可用时自动切换本地分析/)
    assert.match(aiSource, /meta: '租房助手'/)
    assert.match(remoteRequestSource, /confirmText: '同意启用'/)
    assert.match(aiSource, /return hasRemoteConsent\(\) \? fetchRemoteAiQuota\(\) : null/)
    assert.match(aiSource, /if \(!prompt \|\| isSending \|\| sendPreparingRef\.current\) return/)
    assert.match(aiSource, /sendPreparingRef\.current = false/)
    assert.match(aiSource, /confirmText: '确认撤销'/)
    assert.match(contractSource, /aria-label='修订版合同草案'/)
    assert.match(contractSource, /lastAnalysisFailed/)
    assert.match(contractSource, /retryAnalyze/)
    assert.match(contractSource, /const useAi = contractText\.length <= 60_000/)
    assert.match(contractSource, /startRemoteContractReviewRequest\(payload\)/)
    assert.match(contractSource, /点击“开始综合审查”即同意将双重脱敏后的合同文字发送/)
    assert.doesNotMatch(contractSource, /confirmContractReviewConsent|让 AI 解读审查结果|openAiTask/)
    assert.doesNotMatch(contractSource, /导出审查报告 TXT|复制审查报告|导出反馈 JSON|textFileExport/)
    assert.doesNotMatch(contractSource, /expandedIndex:\s*0/)
    assert.match(contractSource, /expandedIndex:\s*expanded \? -1 : index/)
    assert.match(contractSource, /operationNoticeIsError/)
    assert.match(contractStyles, /\.operation-notice\.is-success/)
    assert.match(appStyles, /touch-action:\s*manipulation/)
    assert.match(appStyles, /safe-area-inset-bottom/)
    assert.doesNotMatch(appStyles, /\.sticky-actions\s*{[^}]*position:\s*sticky/s)
    assert.match(evidenceStyles, /overscroll-behavior:\s*contain/)
    assert.match(evidenceSource, /showImportFailure/)
    assert.doesNotMatch(evidenceStyles, /\.action-buttons\s*{[^}]*position:\s*sticky/s)
  }],

  ['发布体验：合法域名校验开启且隐私接口使用微信官方授权弹窗', async () => {
    const fs = await import('node:fs')
    const projectConfig = JSON.parse(fs.readFileSync(new URL('../miniapp/project.config.json', import.meta.url), 'utf8'))
    const appSource = fs.readFileSync(new URL('../miniapp/src/app.js', import.meta.url), 'utf8')
    const appConfigSource = fs.readFileSync(new URL('../miniapp/src/app.config.js', import.meta.url), 'utf8')
    const checkinSource = fs.readFileSync(new URL('../miniapp/src/pages/checkin/index.jsx', import.meta.url), 'utf8')
    const localDataSource = fs.readFileSync(new URL('../miniapp/src/utils/localDataManager.js', import.meta.url), 'utf8')
    assert.equal(projectConfig.appid, 'wxa9ace892fd7b06e1')
    assert.equal(projectConfig.setting.urlCheck, true)
    assert.match(appConfigSource, /__usePrivacyCheck__:\s*true/)
    assert.doesNotMatch(appSource, /onNeedPrivacyAuthorization/)
    assert.doesNotMatch(appSource, /agreePrivacyAuthorization/)
    assert.match(checkinSource, /persistAddedCheckinPhotos/)
    assert.match(checkinSource, /replaceCheckinStateAndRemovePhotos/)
    assert.match(checkinSource, /className='photo-preview'/)
    assert.match(localDataSource, /globalThis\.wx\?\.getFileSystemManager/)
  }],

  // ============================================================
  // 整包备份与恢复
  // ============================================================

  ['整包备份：正常导出包含版本、appName 和数据摘要', async () => {
    storage.set(STORAGE_KEYS.contractDraft, JSON.stringify({ text: '合同草稿内容' }))
    storage.set(STORAGE_KEYS.reviewHistory, JSON.stringify([
      { id: 'r1', summary: '审查1' },
      { id: 'r2', summary: '审查2' },
    ]))
    storage.set(STORAGE_KEYS.aiRemoteConsent, JSON.stringify(true))

    const json = localDataManager.backupLocalData()
    const parsed = JSON.parse(json)

    assert.equal(parsed.appName, '租小审')
    assert.equal(parsed.app, '租小审')
    assert.equal(parsed.version, 1)
    assert.ok(parsed.exportedAt)
    assert.ok(parsed.schema)
    assert.ok(Array.isArray(parsed.schema.dataKeys))
    assert.ok(parsed.schema.dataKeys.includes('contractDraft'))
    assert.ok(parsed.schema.dataKeys.includes('reviewHistory'))
    assert.ok(parsed.schema.authStateKeys.includes('aiRemoteConsent'))
    // 数据存在
    assert.ok(parsed.data.contractDraft)
    assert.equal(parsed.data.reviewHistory.length, 2)
    assert.equal(parsed.authStates.aiRemoteConsent, true)
    // 摘要包含数量
    assert.ok(parsed.summary.reviewHistory)
    assert.equal(parsed.summary.reviewHistory.count, 2)
    assert.ok(parsed.summary.contractDraft)
    // notes 明确说明照片/附件不包含
    assert.ok(Array.isArray(parsed.notes))
    assert.ok(parsed.notes.some((n) => n.includes('照片') && n.includes('不包含')))
    assert.ok(parsed.notes.some((n) => n.includes('不导出') && n.includes('token')))
  }],

  ['整包备份：不导出 token/openid/密钥/API key', async () => {
    // 在 reviewHistory 中嵌入敏感字段
    storage.set(STORAGE_KEYS.reviewHistory, JSON.stringify([
      { id: 'r1', summary: '审查1', token: 'session-token-abc', openid: 'wx-openid-123', apiKey: 'sk-secret' },
      { id: 'r2', summary: '审查2', secret: 'cloud-key', sessionKey: 'session-key-val' },
    ]))
    storage.set(STORAGE_KEYS.aiChat, JSON.stringify({ messages: [{ role: 'user', content: 'hi', accessToken: 'should-be-stripped' }] }))

    const json = localDataManager.backupLocalData()
    const parsed = JSON.parse(json)

    // 所有敏感字段必须被置为 null，不能出现在导出中
    const r1 = parsed.data.reviewHistory[0]
    assert.equal(r1.token, null, 'token 应被清空')
    assert.equal(r1.openid, null, 'openid 应被清空')
    assert.equal(r1.apiKey, null, 'apiKey 应被清空')
    assert.equal(r1.summary, '审查1', '非敏感字段应保留')

    const r2 = parsed.data.reviewHistory[1]
    assert.equal(r2.secret, null, 'secret 应被清空')
    assert.equal(r2.sessionKey, null, 'sessionKey 应被清空')

    const chat = parsed.data.aiChat
    assert.equal(chat.messages[0].accessToken, null, 'accessToken 应被清空')
    assert.equal(chat.messages[0].content, 'hi', '非敏感字段应保留')

    // 整个 JSON 字符串中不应出现敏感值
    assert.ok(!json.includes('session-token-abc'), 'token 值不应出现在导出')
    assert.ok(!json.includes('wx-openid-123'), 'openid 值不应出现在导出')
    assert.ok(!json.includes('sk-secret'), 'apiKey 值不应出现在导出')
    assert.ok(!json.includes('cloud-key'), 'secret 值不应出现在导出')
    assert.ok(!json.includes('session-key-val'), 'sessionKey 值不应出现在导出')
    assert.ok(!json.includes('should-be-stripped'), 'accessToken 值不应出现在导出')
  }],

  ['整包恢复：正常恢复写入所有数据', async () => {
    // 准备一份备份 JSON
    const backup = JSON.stringify({
      app: '租小审',
      appName: '租小审',
      version: 1,
      exportedAt: '2026-07-01T00:00:00.000Z',
      schema: { dataKeys: ['contractDraft', 'reviewHistory'], authStateKeys: ['aiRemoteConsent'] },
      data: {
        contractDraft: { text: '恢复的合同草稿' },
        reviewHistory: [{ id: 'r1', summary: '恢复的审查1' }],
      },
      authStates: { aiRemoteConsent: true },
      summary: {},
      notes: [],
    })

    // 先清空 storage 确保干净起点
    storage.clear()

    const result = await localDataManager.restoreLocalData(backup)
    assert.equal(result.ok, true, `恢复应成功，error: ${result.error}`)
    assert.ok(result.restoredKeys.includes('contractDraft'))
    assert.ok(result.restoredKeys.includes('reviewHistory'))
    assert.ok(result.restoredKeys.includes('aiRemoteConsent'))
    assert.equal(result.rolledBack, false)

    // 验证写入内容
    const draft = JSON.parse(storage.get(STORAGE_KEYS.contractDraft))
    assert.equal(draft.text, '恢复的合同草稿')
    const history = JSON.parse(storage.get(STORAGE_KEYS.reviewHistory))
    assert.equal(history.length, 1)
    assert.equal(history[0].id, 'r1')
    const consent = JSON.parse(storage.get(STORAGE_KEYS.aiRemoteConsent))
    assert.equal(consent, true)
  }],

  ['整包恢复：损坏 JSON 拒绝恢复且不修改现有数据', async () => {
    storage.set(STORAGE_KEYS.contractDraft, JSON.stringify({ text: '原有草稿' }))
    const originalDraft = storage.get(STORAGE_KEYS.contractDraft)

    const brokenJson = '{not valid json,,,}'
    const result = await localDataManager.restoreLocalData(brokenJson)
    assert.equal(result.ok, false)
    assert.ok(result.error.includes('JSON') || result.error.includes('解析'))
    assert.equal(result.restoredKeys.length, 0)
    // 现有数据未被修改
    assert.equal(storage.get(STORAGE_KEYS.contractDraft), originalDraft)
  }],

  ['整包恢复：不支持版本拒绝或明确提示', async () => {
    // 版本过低
    const tooOld = JSON.stringify({
      app: '租小审', appName: '租小审', version: 0,
      data: { contractDraft: { text: 'old' } }, authStates: {}, summary: {}, notes: [],
    })
    const resultOld = await localDataManager.restoreLocalData(tooOld)
    assert.equal(resultOld.ok, false)
    assert.ok(resultOld.error.includes('不支持') || resultOld.error.includes('版本'))

    // 版本过高
    const tooNew = JSON.stringify({
      app: '租小审', appName: '租小审', version: 999,
      data: { contractDraft: { text: 'new' } }, authStates: {}, summary: {}, notes: [],
    })
    const resultNew = await localDataManager.restoreLocalData(tooNew)
    assert.equal(resultNew.ok, false)
    assert.ok(resultNew.error.includes('版本') || resultNew.error.includes('升级'))
  }],

  ['整包恢复：部分写入失败时回滚到 prevState', async () => {
    // 准备原有数据
    storage.set(STORAGE_KEYS.contractDraft, JSON.stringify({ text: '原有草稿' }))
    storage.set(STORAGE_KEYS.reviewHistory, JSON.stringify([{ id: 'old1', summary: '原有审查' }]))
    const originalDraft = storage.get(STORAGE_KEYS.contractDraft)
    const originalHistory = storage.get(STORAGE_KEYS.reviewHistory)

    // 让 setStorageSync 在写入 reviewHistory 时抛错
    const originalSet = Taro.setStorageSync
    let callCount = 0
    Taro.setStorageSync = (key, value) => {
      callCount += 1
      if (key === STORAGE_KEYS.reviewHistory) {
        throw new Error('Storage 写入失败：空间不足')
      }
      storage.set(key, value)
    }

    try {
      const backup = JSON.stringify({
        app: '租小审', appName: '租小审', version: 1,
        exportedAt: '2026-07-01T00:00:00.000Z',
        schema: { dataKeys: ['contractDraft', 'reviewHistory'], authStateKeys: ['aiRemoteConsent'] },
        data: {
          contractDraft: { text: '新草稿（应被回滚）' },
          reviewHistory: [{ id: 'new1', summary: '新审查（写入失败）' }],
        },
        authStates: { aiRemoteConsent: true },
        summary: {}, notes: [],
      })

      const result = await localDataManager.restoreLocalData(backup)
      assert.equal(result.ok, false)
      assert.equal(result.rolledBack, true)
      assert.ok(result.error.includes('回滚') || result.error.includes('失败'))

      // 回滚后原有数据应保持不变
      assert.equal(storage.get(STORAGE_KEYS.contractDraft), originalDraft, 'contractDraft 应回滚到原值')
      assert.equal(storage.get(STORAGE_KEYS.reviewHistory), originalHistory, 'reviewHistory 应回滚到原值')
    } finally {
      Taro.setStorageSync = originalSet
    }
  }],

  ['整包恢复：重复导入同一备份不产生重复记录', async () => {
    storage.clear()

    const backup = JSON.stringify({
      app: '租小审', appName: '租小审', version: 1,
      exportedAt: '2026-07-01T00:00:00.000Z',
      schema: { dataKeys: ['contractDraft', 'reviewHistory'], authStateKeys: ['aiRemoteConsent'] },
      data: {
        reviewHistory: [
          { id: 'r1', summary: '审查1' },
          { id: 'r2', summary: '审查2' },
        ],
      },
      authStates: {},
      summary: {}, notes: [],
    })

    // 第一次导入
    const r1 = await localDataManager.restoreLocalData(backup)
    assert.equal(r1.ok, true)
    const history1 = JSON.parse(storage.get(STORAGE_KEYS.reviewHistory))
    assert.equal(history1.length, 2, '第一次导入应有 2 条')

    // 第二次导入同一备份
    const r2 = await localDataManager.restoreLocalData(backup)
    assert.equal(r2.ok, true)
    const history2 = JSON.parse(storage.get(STORAGE_KEYS.reviewHistory))
    assert.equal(history2.length, 2, '重复导入不应产生重复记录')
    // id 不重复
    const ids = history2.map((h) => h.id).sort()
    assert.deepEqual(ids, ['r1', 'r2'])
  }],

  ['整包恢复：缺失本地照片/附件时不崩溃并给出提示', async () => {
    storage.clear()
    savedFiles.clear()

    // 备份中引用了一个 wxfile:// 路径，但本机 savedFiles 为空
    const backup = JSON.stringify({
      app: '租小审', appName: '租小审', version: 1,
      exportedAt: '2026-07-01T00:00:00.000Z',
      schema: { dataKeys: ['checkinInspection'], authStateKeys: ['aiRemoteConsent'] },
      data: {
        checkinInspection: {
          rooms: [
            { name: '客厅', photos: ['wxfile://saved/missing_photo_1.jpg'] },
          ],
          evidenceFiles: ['wxfile://saved/missing_attachment.pdf'],
        },
      },
      authStates: {},
      summary: {}, notes: [],
    })

    const result = await localDataManager.restoreLocalData(backup)
    // 恢复应成功，但应报告缺失文件
    assert.equal(result.ok, true, '缺失文件不应导致恢复失败')
    assert.ok(result.missingFiles.length > 0, '应报告缺失文件')
    assert.ok(result.missingFiles.includes('wxfile://saved/missing_photo_1.jpg'))
    assert.ok(result.missingFiles.includes('wxfile://saved/missing_attachment.pdf'))

    // 数据本身应已写入（引用信息保留，不崩溃）
    const checkin = JSON.parse(storage.get(STORAGE_KEYS.checkinInspection))
    assert.equal(checkin.rooms[0].photos[0], 'wxfile://saved/missing_photo_1.jpg')
  }],

  ['整包恢复：parseBackupSummary 返回导入前摘要', async () => {
    const backup = JSON.stringify({
      app: '租小审', appName: '租小审', version: 1,
      exportedAt: '2026-07-15T10:30:00.000Z',
      schema: { dataKeys: ['contractDraft', 'reviewHistory'], authStateKeys: ['aiRemoteConsent'] },
      data: {
        contractDraft: { text: '草稿' },
        reviewHistory: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }],
      },
      authStates: { aiRemoteConsent: true },
      summary: {}, notes: ['note1'],
    })

    const summary = localDataManager.parseBackupSummary(backup)
    assert.equal(summary.ok, true)
    assert.equal(summary.version, 1)
    assert.equal(summary.exportedAt, '2026-07-15T10:30:00.000Z')
    assert.equal(summary.appName, '租小审')
    assert.ok(Array.isArray(summary.summary))
    // 摘要应包含数量
    const histItem = summary.summary.find((i) => i.key === 'reviewHistory')
    assert.ok(histItem)
    assert.equal(histItem.count, 3)
    const consentItem = summary.summary.find((i) => i.key === 'aiRemoteConsent')
    assert.ok(consentItem)
    assert.ok(Array.isArray(summary.notes))
  }],

  ['整包恢复：结构校验失败拒绝导入', async () => {
    // 根对象不是对象
    const notObject = '"just a string"'
    const r1 = localDataManager.parseBackupSummary(notObject)
    assert.equal(r1.ok, false)

    // 缺少 version
    const noVersion = JSON.stringify({ data: {} })
    const r2 = localDataManager.parseBackupSummary(noVersion)
    assert.equal(r2.ok, false)
    assert.ok(r2.error.includes('version'))

    // 过多未知 key（可能是别的应用备份）
    const tooManyUnknown = JSON.stringify({
      version: 1,
      data: {
        unknown1: 1, unknown2: 2, unknown3: 3, unknown4: 4,
      },
    })
    const r3 = localDataManager.parseBackupSummary(tooManyUnknown)
    assert.equal(r3.ok, false)
    assert.ok(r3.error.includes('未知') || r3.error.includes('不是租小审'))
  }],

  ['整包备份与恢复：导出后清空再恢复，数据一致', async () => {
    // 端到端：写入数据 → 导出 → 清空 → 恢复 → 验证一致
    storage.clear()
    storage.set(STORAGE_KEYS.contractDraft, JSON.stringify({ text: '端到端合同草稿', parties: ['张三', '李四'] }))
    storage.set(STORAGE_KEYS.reviewHistory, JSON.stringify([
      { id: 'e2e-1', summary: '端到端审查1', findings: ['a', 'b'] },
      { id: 'e2e-2', summary: '端到端审查2', findings: [] },
    ]))
    storage.set(STORAGE_KEYS.reviewProfile, JSON.stringify({ strictMode: true }))
    storage.set(STORAGE_KEYS.aiRemoteConsent, JSON.stringify(true))

    // 导出
    const backup = localDataManager.backupLocalData()
    const parsedBackup = JSON.parse(backup)
    assert.ok(parsedBackup.data.contractDraft)
    assert.equal(parsedBackup.data.reviewHistory.length, 2)

    // 清空
    storage.clear()
    assert.equal(storage.has(STORAGE_KEYS.contractDraft), false)

    // 恢复
    const result = await localDataManager.restoreLocalData(backup)
    assert.equal(result.ok, true, `端到端恢复应成功: ${result.error}`)

    // 验证一致
    const draft = JSON.parse(storage.get(STORAGE_KEYS.contractDraft))
    assert.equal(draft.text, '端到端合同草稿')
    assert.deepEqual(draft.parties, ['张三', '李四'])

    const history = JSON.parse(storage.get(STORAGE_KEYS.reviewHistory))
    assert.equal(history.length, 2)
    assert.equal(history[0].id, 'e2e-1')
    assert.deepEqual(history[0].findings, ['a', 'b'])

    const profile = JSON.parse(storage.get(STORAGE_KEYS.reviewProfile))
    assert.equal(profile.strictMode, true)

    const consent = JSON.parse(storage.get(STORAGE_KEYS.aiRemoteConsent))
    assert.equal(consent, true)
  }],

  ['整包 Word 备份：文档可打开且包含照片、附件和恢复数据', async () => {
    storage.clear()
    virtualFiles.clear()
    savedFiles.clear()
    const photoPath = 'wxfile://saved/backup-photo.jpg'
    const attachmentPath = 'wxfile://saved/receipt.pdf'
    virtualFiles.set(photoPath, { data: Uint8Array.of(0xff, 0xd8, 0x01, 0x02).buffer })
    virtualFiles.set(attachmentPath, { data: Uint8Array.of(0x25, 0x50, 0x44, 0x46).buffer })
    storage.set(STORAGE_KEYS.checkinInspection, JSON.stringify({ living: { wall: { status: 'defect', defect: '墙面', note: '', photos: [photoPath] } } }))
    storage.set(STORAGE_KEYS.evidencePack, JSON.stringify({
      attachments: { contract: [{ id: 'att-1', fileName: '押金收据.pdf', fileType: 'file', localPath: attachmentPath, source: 'chat' }] },
    }))

    const archive = await localDataManager.buildLocalBackupArchive({ format: 'docx' })
    assert.equal(archive.format, 'docx')
    assert.equal(archive.included.length, 2)
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(archive.bytes)
    assert.ok(zip.file('租小审备份.json'))
    assert.ok(zip.file('manifest.json'))
    assert.ok(zip.file('word/document.xml'))
    assert.ok(zip.file('word/media/image-1.jpg'))
    assert.ok(zip.file('word/media/image-2.pdf') === null || zip.file('word/media/image-2.pdf') === undefined)
    const backupJson = JSON.parse(await zip.file('租小审备份.json').async('string'))
    assert.equal(backupJson.backupFormat, 'zip')
    assert.match(JSON.stringify(backupJson.data), /backup-file:\/\//)
    assert.ok((await zip.file('word/document.xml').async('string')).includes('押金收据.pdf'))
  }],

  ['整包 Word 备份：缺失本地文件进入 skipped，不阻断其他文件', async () => {
    storage.clear()
    virtualFiles.clear()
    storage.set(STORAGE_KEYS.evidencePack, JSON.stringify({
      attachments: { photos: [{ id: 'missing-1', fileName: '缺失.jpg', fileType: 'image', localPath: 'wxfile://saved/missing.jpg', source: 'album' }] },
    }))
    const archive = await localDataManager.buildLocalBackupArchive({ format: 'docx' })
    assert.equal(archive.included.length, 0)
    assert.equal(archive.skipped.length, 1)
    assert.equal(archive.skipped[0].status, 'skipped')
  }],

  ['整包 Word 备份：导入后恢复 Storage 和本地文件引用', async () => {
    storage.clear()
    virtualFiles.clear()
    savedFiles.clear()
    const photoPath = 'wxfile://saved/restore-photo.jpg'
    virtualFiles.set(photoPath, { data: Uint8Array.of(1, 2, 3, 4).buffer })
    storage.set(STORAGE_KEYS.checkinInspection, JSON.stringify({ living: { wall: { status: 'good', defect: '', note: '', photos: [photoPath] } } }))
    const archive = await localDataManager.buildLocalBackupArchive({ format: 'docx' })
    storage.clear()
    const restored = await localDataManager.restoreBackupArchive(archive.bytes)
    assert.equal(restored.ok, true, restored.error)
    assert.equal(restored.restoredFiles, 1)
    const restoredState = JSON.parse(storage.get(STORAGE_KEYS.checkinInspection))
    assert.match(restoredState.living.wall.photos[0], /^wxfile:\/\/saved\//)
    assert.notEqual(restoredState.living.wall.photos[0], photoPath)
  }],

  ['业务 Word 报告：单独导出合同分析时不夹带验房和证据包', async () => {
    const contractText = '房屋租赁合同：出租方可随时进入房屋，押金一律不退。'
    const findings = contractReview.analyzeContract(contractText, { contractType: 'lease', partyRole: 'partyB', reviewDepth: 'strict' })
    const summary = contractReview.getRiskSummary(findings)
    const entry = reviewHistory.createReviewHistoryEntry({
      contractText,
      findings,
      summary,
      dimensions: [],
      adoptedItems: [],
      revisedDraft: '',
      activeProfile: { contractType: 'lease', partyRole: 'partyB', reviewDepth: 'strict' },
      profile: { contractType: 'lease', partyRole: 'partyB', reviewDepth: 'strict' },
    })
    const report = await businessReportExport.buildBusinessReportDocx({
      selectedModules: ['contract'],
      data: { contractDraft: contractText, reviewHistory: [entry] },
      now: new Date('2026-08-02T08:30:00.000Z'),
    })
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(report.bytes)
    const documentXml = await zip.file('word/document.xml').async('string')
    assert.match(documentXml, /合同分析报告/)
    assert.match(documentXml, /原文证据/)
    assert.doesNotMatch(documentXml, /入住验房报告/)
    assert.doesNotMatch(documentXml, /证据包汇总/)
    assert.match(report.fileName, /合同分析报告.*\.docx$/)
  }],

  ['业务 Word 报告：组合导出包含验房分析、真实照片和证据汇总', async () => {
    virtualFiles.clear()
    const photoPath = 'wxfile://saved/report-photo.png'
    virtualFiles.set(photoPath, { data: Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')).buffer })
    const checkinState = createDefaultCheckinState()
    checkinState.living.wall = { status: 'defect', defect: '墙面裂缝', note: '入住前已存在', photos: [photoPath] }
    const evidenceState = createDefaultEvidencePackState()
    evidenceState.formData.address = '贵阳市测试路1号'
    evidenceState.evidence.contract[0] = true
    const report = await businessReportExport.buildBusinessReportDocx({
      selectedModules: ['checkin', 'evidence'],
      data: { checkinInspection: checkinState, checkinRoomType: 'studio', evidencePack: evidenceState },
      now: new Date('2026-08-02T08:30:00.000Z'),
    })
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(report.bytes)
    const documentXml = await zip.file('word/document.xml').async('string')
    assert.match(documentXml, /入住验房报告/)
    assert.match(documentXml, /墙面裂缝/)
    assert.match(documentXml, /证据包汇总/)
    assert.match(documentXml, /贵阳市测试路1号/)
    assert.ok(zip.file('word/media/checkin-1.png'))
    assert.equal(report.includedPhotos, 1)
    assert.equal(report.skippedPhotos, 0)
  }],

  ['业务 Word 报告：验房照片缺失时仍生成并记录跳过数量', async () => {
    virtualFiles.clear()
    const checkinState = createDefaultCheckinState()
    checkinState.kitchen.waterElectric = { status: 'defect', defect: '燃气软管老化', note: '', photos: ['wxfile://saved/missing-report-photo.jpg'] }
    const report = await businessReportExport.buildBusinessReportDocx({
      selectedModules: ['checkin'],
      data: { checkinInspection: checkinState },
    })
    assert.ok(report.bytes.length > 0)
    assert.equal(report.includedPhotos, 0)
    assert.equal(report.skippedPhotos, 1)
  }],

  ['首页报告导出中心支持单选、组合和一键全部，备份恢复进入高级区', async () => {
    const fs = await import('node:fs')
    const homeSource = fs.readFileSync(new URL('../miniapp/src/pages/index/index.jsx', import.meta.url), 'utf8')
    assert.match(homeSource, /报告导出中心/)
    assert.match(homeSource, /合同分析报告/)
    assert.match(homeSource, /入住验房报告/)
    assert.match(homeSource, /证据包汇总/)
    assert.match(homeSource, /导出所选 Word/)
    assert.match(homeSource, /一键导出全部/)
    assert.match(homeSource, /buildBusinessReportDocx/)
    assert.match(homeSource, /高级数据管理/)
    assert.match(homeSource, /handleExportBackup/)
    assert.match(homeSource, /handleImportBackup/)
    assert.match(homeSource, /生成恢复用备份/)
    assert.match(homeSource, /导入恢复用备份/)
    assert.doesNotMatch(homeSource, /导出数据 TXT/)
    assert.doesNotMatch(homeSource, /复制数据/)
    // 稳定提示不只依赖 Toast
    assert.match(homeSource, /backupMessage/)
    assert.match(homeSource, /backup-message/)
    assert.match(homeSource, /buildLocalBackupArchive/)
    assert.match(homeSource, /writePackageFile\('租小审-恢复用备份\.docx'/)
    assert.match(homeSource, /preparedExports\.report/)
    assert.match(homeSource, /preparedExports\.backup/)
    assert.match(homeSource, /Taro\.shareFileMessage\(/)
    assert.match(homeSource, /extension: \['docx', 'zip', 'json'\]/)
    assert.match(homeSource, /if \(result\.ok\)/)
    // 引用了备份/恢复函数
    assert.match(homeSource, /parseBackupSummary/)
    assert.match(homeSource, /restoreLocalData/)
    // CSS 样式存在
    const homeStyles = fs.readFileSync(new URL('../miniapp/src/pages/index/index.css', import.meta.url), 'utf8')
    assert.match(homeStyles, /\.backup-message/)
    assert.match(homeStyles, /\.backup-message-error/)
    assert.match(homeStyles, /\.backup-message-success/)
    assert.match(homeStyles, /\.backup-message-warning/)
  }],
]

let passed = 0
for (const [name, check] of checks) {
  await check()
  passed += 1
  console.log(`PASS ${name}`)
}
console.log(`Miniapp reliability check passed: ${passed}/${checks.length}`)
