import { useEffect, useId, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { onContentUpdated, useData } from 'vitepress'

import { resolveTitle } from '../composables/use-active-anchor'
import { useBodyScrollLock } from '../composables/use-body-scroll-lock'
import { type VpHeader } from '../theme-utils'
import { VPDocOutlineItem } from './VPDocOutlineItem'
import '../styles/components/VPLocalNavOutlineDropdown.scoped.css'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

/**
 * 本地导航的"本页大纲"下拉(对应 Vue VPLocalNavOutlineDropdown.vue):
 * 打开时锁 body 滚动,点外部/Escape/内容更新后关闭。
 */
export function VPLocalNavOutlineDropdown({
  headers,
  navHeight
}: {
  headers: VpHeader[]
  navHeight: number
}) {
  const { theme } = useData()
  const themeCfg = theme as { returnToTopLabel?: string; outline?: { label?: string } }
  const [open, setOpen] = useState(false)
  const [vh, setVh] = useState(0)
  const mainRef = useRef<HTMLDivElement | null>(null)
  const itemsRef = useRef<HTMLDivElement | null>(null)
  const itemsId = useId()
  const { lock, unlock } = useBodyScrollLock()

  // 打开 → 锁滚动 + 注册关闭途径(点外部/Escape);关闭 → 解锁
  useEffect(() => {
    if (!open) {
      unlock()
      return
    }
    lock()
    const closeOnClickOutside = (e: Event) => {
      if (!mainRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('click', closeOnClickOutside)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', closeOnClickOutside)
      window.removeEventListener('keydown', onKey)
      unlock()
    }
  }, [open, lock, unlock])

  // 路由内容提交后关闭(对应 Vue onContentUpdated)
  useEffect(() => onContentUpdated(() => setOpen(false)), [])

  function toggle() {
    setOpen((v) => !v)
    setVh(window.innerHeight + Math.min(window.scrollY - navHeight, 0))
  }

  function onItemClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('outline-link')) {
      // 锚点跳转时禁用动画(瞬时收合),下一帧关闭
      if (itemsRef.current) itemsRef.current.style.transition = 'none'
      window.setTimeout(() => setOpen(false), 0)
    }
  }

  function scrollToTop() {
    setOpen(false)
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
  }

  const label = themeCfg.returnToTopLabel || 'Return to top'

  return (
    <div
      ref={mainRef}
      className={cx('root', 'VPLocalNavOutlineDropdown')}
      style={{ '--vp-vh': `${vh}px` } as CSSProperties}
      data-allow-mismatch="style"
    >
      {headers.length > 0 ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={itemsId}
          className={cx(open && 'open')}
          onClick={toggle}
        >
          <span className="menu-text">{resolveTitle(themeCfg)}</span>
          <span className={cx('icon', 'icon', 'vpi-chevron-right')} aria-hidden="true" />
        </button>
      ) : (
        <button type="button" onClick={scrollToTop}>
          {label}
        </button>
      )}

      {open ? (
        <div
          ref={itemsRef}
          id={itemsId}
          className={cx('items', 'items', 'flyoutEnter')}
          onClick={onItemClick}
        >
          <div className={cx('header', 'header')}>
            <a
              className={cx('topLink', 'top-link')}
              href="#"
              onClick={(e) => {
                e.preventDefault()
                scrollToTop()
              }}
            >
              {label}
            </a>
          </div>
          <div className={cx('outline', 'outline')}>
            <VPDocOutlineItem headers={headers} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

