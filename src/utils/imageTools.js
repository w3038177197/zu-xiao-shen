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

export async function compressImageToDataUrl(file, { maxEdge, quality, passthroughSize = 900 * 1024 }) {
  const dataUrl = await readFileAsDataUrl(file)
  const image = await loadImageFromDataUrl(dataUrl)
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height))

  if (scale >= 1 && file.size <= passthroughSize) {
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
  const blob = await canvasToBlob(canvas, 'image/jpeg', quality)
  return readFileAsDataUrl(blob)
}
