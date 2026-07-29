export function createDebouncedSaver(save, delay = 800) {
  let timer = null
  let pendingValue

  const run = () => {
    timer = null
    if (pendingValue === undefined) return true
    const value = pendingValue
    pendingValue = undefined
    try {
      return save(value) !== false
    } catch {
      return false
    }
  }

  return {
    schedule(value) {
      pendingValue = value
      if (timer) clearTimeout(timer)
      timer = setTimeout(run, delay)
    },
    flush() {
      if (timer) clearTimeout(timer)
      return run()
    },
    cancel() {
      if (timer) clearTimeout(timer)
      timer = null
      pendingValue = undefined
    },
  }
}
