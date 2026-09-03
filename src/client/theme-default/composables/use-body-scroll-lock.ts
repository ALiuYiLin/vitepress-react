import { useCallback, useState } from 'react'

// 引用计数(共享单例):多个组件同时锁 body 滚动,最后一个解锁时恢复
let lockCount = 0
let prevOverflow = ''

function lock() {
  if (lockCount === 0) {
    prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  lockCount++
}

function unlock() {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) document.body.style.overflow = prevOverflow
}

/** 锁定 body 滚动(引用计数),返回 lock/unlock */
export function useBodyScrollLock() {
  const [locked, setLocked] = useState(false)
  const doLock = useCallback(() => {
    lock()
    setLocked(true)
  }, [])
  const doUnlock = useCallback(() => {
    unlock()
    setLocked(false)
  }, [])
  return { lock: doLock, unlock: doUnlock, locked }
}
