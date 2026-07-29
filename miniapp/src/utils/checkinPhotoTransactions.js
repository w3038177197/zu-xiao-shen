function cloneWithPhotos(state, roomKey, itemKey, photos) {
  return {
    ...state,
    [roomKey]: {
      ...state[roomKey],
      [itemKey]: {
        ...state[roomKey]?.[itemKey],
        photos,
      },
    },
  }
}

export function collectCheckinPhotoPaths(state) {
  return Object.values(state || {}).flatMap((room) => Object.values(room || {})
    .flatMap((record) => Array.isArray(record?.photos) ? record.photos.filter(Boolean) : []))
}

export function createCheckinStateWithoutPhotos(state) {
  return Object.fromEntries(Object.entries(state || {}).map(([roomKey, room]) => [
    roomKey,
    Object.fromEntries(Object.entries(room || {}).map(([itemKey, record]) => [
      itemKey,
      { ...record, photos: [] },
    ])),
  ]))
}

async function removeFiles(paths, removeFile) {
  const results = await Promise.all(paths.filter(Boolean).map((path) => removeFile(path)))
  return {
    cleanupFailed: results.filter((result) => !result?.ok).length,
    retainedFiles: results.filter((result) => result?.reason === 'evidence-reference').length,
  }
}

export async function persistAddedCheckinPhotos({
  state,
  roomKey,
  itemKey,
  savedPaths,
  saveState,
  removeFile,
}) {
  const previousPhotos = state[roomKey]?.[itemKey]?.photos || []
  const nextState = cloneWithPhotos(state, roomKey, itemKey, [...previousPhotos, ...savedPaths])
  if (!saveState(nextState)) {
    const cleanup = await removeFiles(savedPaths, removeFile)
    return { ok: false, reason: 'storage-failed', state, cleanupFailed: cleanup.cleanupFailed }
  }
  return { ok: true, state: nextState, added: savedPaths.length }
}

export async function deleteCheckinPhoto({
  state,
  roomKey,
  itemKey,
  photoIndex,
  saveState,
  removeFile,
}) {
  const photos = [...(state[roomKey]?.[itemKey]?.photos || [])]
  const [removedPath] = photos.splice(photoIndex, 1)
  if (!removedPath) return { ok: false, reason: 'not-found', state }

  const nextState = cloneWithPhotos(state, roomKey, itemKey, photos)
  if (!saveState(nextState)) return { ok: false, reason: 'storage-failed', state }

  const removed = await removeFile(removedPath)
  if (removed?.ok) {
    return {
      ok: true,
      state: nextState,
      removedPath,
      retainedFile: removed.reason === 'evidence-reference',
    }
  }

  const rolledBack = saveState(state)
  return {
    ok: false,
    reason: rolledBack ? 'file-failed' : 'rollback-failed',
    state: rolledBack ? state : nextState,
    removedPath,
  }
}

export async function replaceCheckinStateAndRemovePhotos({
  previousState,
  nextState,
  saveState,
  removeFile,
}) {
  if (!saveState(nextState)) {
    return { ok: false, reason: 'storage-failed', state: previousState, cleanupFailed: 0 }
  }
  const cleanup = await removeFiles(collectCheckinPhotoPaths(previousState), removeFile)
  return { ok: true, state: nextState, ...cleanup }
}
