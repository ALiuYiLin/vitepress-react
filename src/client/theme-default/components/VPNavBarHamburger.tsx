import { useEffect, useRef } from 'react'
import { useData } from 'vitepress'

import { setScreenTriggerEl } from '../composables/use-nav'
const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

/**
 * 汉堡按钮(对应 Vue VPNavBarHamburger.vue):三条杠 ↔ × 动画切换。
 * 注册为屏幕导航触发按钮,供 Escape 归还焦点。
 */
export function VPNavBarHamburger({
  active,
  onClick,
  className
}: {
  active: boolean
  onClick: () => void
  className?: string
}) {
  const { theme } = useData()
  const t = theme as { mobileMenuLabel?: string }
  const el = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    setScreenTriggerEl(el.current)
    return () => setScreenTriggerEl(null)
  }, [])

  return (
    <button
      ref={el}
      type="button"
      className={cx('VPNavBarHamburger', active && 'active', className)}
      aria-label={t.mobileMenuLabel || 'Menu'}
      aria-expanded={active}
      onClick={onClick}
    >
      <span className="container" aria-hidden="true">
        <span className="top" />
        <span className="middle" />
        <span className="bottom" />
      </span>
    </button>
  )
}
