import { useEffect, useState } from 'react'
import { useData } from 'vitepress'

import { useLayout } from '../composables/use-layout'
import { VPLocalNavOutlineDropdown } from './VPLocalNavOutlineDropdown'
import s from './VPLocalNav.module.css'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

/**
 * 本地导航条(对应 Vue VPLocalNav.vue):侧栏菜单按钮 + 本页大纲下拉;
 * 页面无大纲/侧栏时,滚动越过导航高度才固定出现(仅剩返回顶部)。
 */
export function VPLocalNav({
  open,
  onOpenMenu,
  inert
}: {
  open: boolean
  onOpenMenu: () => void
  /** 全屏导航打开时使其不可交互(inert) */
  inert?: boolean
}) {
  const { theme } = useData()
  const themeCfg = theme as { sidebarMenuLabel?: string; outline?: { label?: string } }
  const { isHome, hasSidebar, headers, hasLocalNav } = useLayout()
  const [navHeight, setNavHeight] = useState(0)
  const [isScrolled, setIsScrolled] = useState(false)

  // getComputedStyle 对自定义属性返回原始 token("4rem"),故实测高度
  useEffect(() => {
    const probe = document.createElement('div')
    probe.style.cssText =
      'position: absolute; visibility: hidden; height: var(--vp-nav-height)'
    document.body.appendChild(probe)
    setNavHeight(probe.offsetHeight)
    probe.remove()
  }, [])

  useEffect(() => {
    const update = () => setIsScrolled(window.scrollY >= navHeight)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [navHeight])

  if (isHome || (!hasLocalNav && !hasSidebar && !isScrolled)) return null

  return (
    <div
      className={cx(
        s.localNav,
        'VPLocalNav',
        hasSidebar && 'has-sidebar',
        !hasLocalNav && 'empty',
        !hasLocalNav && !hasSidebar && 'fixed'
      )}
      {...({ inert: inert || undefined } as Record<string, unknown>)}
    >
      <div className={cx(s.container, 'container')}>
        {hasSidebar ? (
          <button
            type="button"
            className={cx(s.menu, 'menu')}
            aria-expanded={open}
            aria-controls="VPSidebarNav"
            onClick={onOpenMenu}
          >
            <span className={cx(s.menuIcon, 'vpi-align-left', 'menu-icon')} aria-hidden="true" />
            <span className="menu-text">{themeCfg.sidebarMenuLabel || 'Menu'}</span>
          </button>
        ) : null}

        <VPLocalNavOutlineDropdown headers={headers} navHeight={navHeight} />
      </div>
    </div>
  )
}
