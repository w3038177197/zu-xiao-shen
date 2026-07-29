export async function deleteEvidenceAttachmentTransaction({
  previousState,
  nextState,
  attachment,
  saveState,
  removeFile,
}) {
  if (!saveState(nextState)) {
    return { ok: false, reason: 'storage-failed', state: previousState }
  }

  if (attachment?.source === 'module') {
    return { ok: true, reason: 'reference-removed', state: nextState }
  }

  const removed = await removeFile(attachment?.localPath)
  if (removed?.ok) {
    return { ok: true, reason: removed.reason || 'removed', state: nextState }
  }

  const rolledBack = saveState(previousState)
  return {
    ok: false,
    reason: rolledBack ? 'file-failed' : 'rollback-failed',
    state: rolledBack ? previousState : nextState,
  }
}
