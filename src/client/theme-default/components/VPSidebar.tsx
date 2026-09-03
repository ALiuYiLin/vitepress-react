import { useEffect, useMemo, useRef } from 'react'

import { useBodyScrollLock } from '../composables/use-body-scroll-lock'
import { useLayout } from '../composables/use-layout'
import { type VpSidebarItem } from '../theme-utils'
import { VPSidebarGroup } from './VPSidebarGroup'
import s from './VPSidebar.module.css'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

/**
 * 侧栏抽屉(对应 Vue VPSidebar.vue):
 * - 打开时锁定 body 滚动并把焦点移入导航(可访问性);
 * - 侧栏分组深层变化时整体重挂(key)以复位折叠状态。
 */
export function VPSidebar({ open }: { open: boolean }) {
  const { hasSidebar, sidebarGroups } = useLayout()
  const navEl = useRef<HTMLElement | null>(null)
  const { lock, unlock } = useBodyScrollLock()

  useEffect(() => {
    if (open) {
      lock()
      navEl.current?.focus()
    } else {
      unlock()
    }
    return () => unlock()
  }, [open, lock, unlock])

  // Vue 对 sidebarGroups 做 deep watch 后自增 key 重挂分组;这里用内容序列化等效
  const groupKey = useMemo(() => JSON.stringify(sidebarGroups), [sidebarGroups])

  if (!hasSidebar) return null

  return (
    <aside
      ref={navEl}
      className={cx(s.sidebar, 'VPSidebar', open && 'open')}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={cx(s.curtain, 'curtain')} />

      <nav
        className={cx(s.nav, 'nav')}
        id="VPSidebarNav"
        aria-labelledby="sidebar-aria-label"
        tabIndex={-1}
      >
        <span className="visually-hidden" id="sidebar-aria-label">
          Sidebar Navigation
        </span>

        <VPSidebarGroup
          key={groupKey}
          items={sidebarGroups as unknown as VpSidebarItem[]}
        />
      </nav>
    </aside>
  )
}
