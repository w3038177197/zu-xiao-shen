import Taro from '@tarojs/taro'

function callFileSystem(method, options, legacy) {
  const fs = Taro.getFileSystemManager?.()
  if (typeof fs?.[method] === 'function') {
    return new Promise((resolve, reject) => fs[method]({ ...options, success: resolve, fail: reject }))
  }
  if (typeof legacy === 'function') return legacy(options)
  return Promise.reject(new Error(`当前基础库不支持文件操作：${method}`))
}

export function getFileInfo(filePath) {
  return callFileSystem('getFileInfo', { filePath }, Taro.getFileInfo?.bind(Taro))
}

export function saveFile(tempFilePath) {
  return callFileSystem('saveFile', { tempFilePath }, Taro.saveFile?.bind(Taro))
}

export function removeSavedFile(filePath) {
  return callFileSystem('removeSavedFile', { filePath }, Taro.removeSavedFile?.bind(Taro))
}
