import { useEffect, useState } from 'react'

/** 页面纵向滚动距离(对应 @vueuse useWindowScroll 的 y) */
export function useWindowScrollY() {
  const [y, setY] = useState(0)
  useEffect(() => {
    const update = () => setY(window.scrollY)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])
  return y
}
