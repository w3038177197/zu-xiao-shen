export function createDebouncedSaver(save, delay = 800) {
  let timer = null
  let pendingValue

  const run = () => {
    timer = null
    if (pendingValue === undefined) return true
    const value = pendingValue
    try {
      if (save(value) === false) {
        // save 返回 false 表示失败，保留 pendingValue 以便下次重试
        console.warn('[debounceSave] 保存返回 false，pendingValue 已保留')
        return false
      }
    } catch (error) {
      // save 抛异常，保留 pendingValue 以便下次重试
      console.warn('[debounceSave] 保存异常', String(error?.message || error).slice(0, 100))
      return false
    }
    pendingValue = undefined
    return true
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
