import { useCallback, useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { useRoute } from 'vitepress'

import { useFlyout } from '../composables/use-flyout'
import '../styles/components/VPFlyout.scoped.css'
import { VPMenu } from './VPMenu'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

/**
 * 导航悬停/点击两用下拉(对应 Vue VPFlyout.vue):
 * 鼠标悬停打开(移入按钮∪面板不关闭)、点击切换、Escape/失焦/路由变化关闭。
 */
export function VPFlyout({
  icon,
  button,
  label,
  items,
  className,
  children
}: {
  icon?: string
  button?: string
  label?: string
  items?: unknown[]
  className?: string
  children?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const openedByHover = useRef(false)
  const el = useRef<HTMLDivElement | null>(null)
  const buttonEl = useRef<HTMLButtonElement | null>(null)
  const menuEl = useRef<HTMLDivElement | null>(null)
  const menuId = useId()
  const route = useRoute()

  const close = useCallback(() => {
    setOpen(false)
    openedByHover.current = false
  }, [])

  // 失焦(焦点移出 按钮∪面板)关闭
  useFlyout(el, undefined, close)

  // 路由变化关闭
  useEffect(() => {
    close()
  }, [route.path, close])

  // Escape 关闭;焦点在面板内则归还给触发按钮
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const restoreFocus = el.current?.contains(document.activeElement)
      close()
      if (restoreFocus) el.current?.querySelector('button')?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  // 触屏:点按不可聚焦区域不会移动焦点,故需额外 pointerdown 外部关闭
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: Event) => {
      if (el.current && !el.current.contains(e.target as Node)) close()
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [open, close])

  function onPointerEnter(e: PointerEvent) {
    if (e.pointerType !== 'mouse') return
    if (!open) {
      setOpen(true)
      openedByHover.current = true
    }
  }

  function onPointerLeave(e: PointerEvent) {
    if (e.pointerType !== 'mouse') return
    const to = e.relatedTarget as Node | null
    // 仍处于 按钮 ∪ 面板 区域,不算离开
    if (to && (buttonEl.current?.contains(to) || menuEl.current?.contains(to))) return
    close()
  }

  function toggle() {
    if (open && openedByHover.current) {
      openedByHover.current = false
      return
    }
    openedByHover.current = false
    setOpen((v) => !v)
  }

  return (
    <div className={cx('root', 'VPFlyout', className)} ref={el}>
      <button
        ref={buttonEl}
        type="button"
        className={'button'}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={label}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onClick={toggle}
      >
        {button || icon ? (
          <span className={'text'}>
            {icon ? (
              <span className={cx(icon, 'option-icon')} aria-hidden="true" />
            ) : null}
            {button ? <span dangerouslySetInnerHTML={{ __html: button }} /> : null}
            <span className={cx('textIcon', 'vpi-chevron-down', 'text-icon')} aria-hidden="true" />
          </span>
        ) : (
          <span className={cx('icon', 'vpi-more-horizontal')} aria-hidden="true" />
        )}
      </button>

      <div ref={menuEl} className={'menu'} id={menuId} onPointerLeave={onPointerLeave}>
        <VPMenu items={items as any[]}>{children}</VPMenu>
      </div>
    </div>
  )
}

