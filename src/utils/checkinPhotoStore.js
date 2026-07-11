const DB_NAME = 'rental-safe-media'
const STORE_NAME = 'checkin-photos'

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function runTransaction(mode, operation) {
  const database = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode)
      const request = operation(transaction.objectStore(STORE_NAME))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally {
    database.close()
  }
}

export function saveCheckinPhoto(id, dataUrl) {
  return runTransaction('readwrite', (store) => store.put(dataUrl, id))
}

export function loadCheckinPhoto(id) {
  return runTransaction('readonly', (store) => store.get(id))
}

export function deleteCheckinPhoto(id) {
  return runTransaction('readwrite', (store) => store.delete(id))
}

export function clearCheckinPhotos() {
  return runTransaction('readwrite', (store) => store.clear())
}

export function listCheckinPhotos() {
  return runTransaction('readonly', (store) => store.getAll())
}
