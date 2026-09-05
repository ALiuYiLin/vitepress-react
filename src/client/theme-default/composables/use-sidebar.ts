import { useCallback, useEffect, useState } from 'react'
import { useRoute } from 'vitepress'

import { flattenSidebarItems, normalizePath, type VpSidebarItem } from '../theme-utils'

/** 侧栏抽屉开合(桌面 sticky / 移动抽屉);函数稳定以便做 watcher */
export function useSidebarControl() {
  const [isOpen, setOpen] = useState(false)
  const open = useCallback(() => setOpen(true), [])
  const close = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen((v) => !v), [])
  return { isOpen, open, close, toggle }
}

/** Esc 关闭侧栏 */
export function useCloseSidebarOnEscape(close: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])
}

function itemHasActive(item: VpSidebarItem, current: string): boolean {
  return flattenSidebarItems([{ items: item.items ?? [] }]).some(
    (l) => normalizePath(l.link) === current
  )
}

/**
 * 单个侧栏项的控制(语义对齐 Vue composables/sidebar.ts):
 * - collapsible = 配置了 collapsed 字段(而非有无子项)
 * - collapsed 初值/随 item 变化重置为配置值;自身或子树含当前页时自动展开
 */
export function useSidebarItemControl(item: VpSidebarItem) {
  const route = useRoute()
  const current = normalizePath(route.path)
  const normalized = normalizePath(item.link ?? '')
  const isLink = Boolean(item.link)
  const isCurrentLink = isLink && normalized === current
  const isActiveLink =
    isLink &&
    (isCurrentLink ||
      (normalized !== '/' && current.startsWith(normalized + '/')))
  const hasChildren = Boolean(item.items?.length)
  const collapsible = item.collapsed != null
  const [collapsed, setCollapsed] = useState<boolean>(
    () => !!(collapsible && item.collapsed)
  )

  // item 变化(换页 → 新侧栏配置)时重置为配置的 collapsed 值
  useEffect(() => {
    setCollapsed(!!(item.collapsed != null && item.collapsed))
  }, [item])

  // 自身激活或子树含当前页 → 自动展开(item 变化后同样生效)
  const hasActiveLink = isActiveLink || itemHasActive(item, current)
  useEffect(() => {
    if (hasActiveLink) setCollapsed(false)
  }, [hasActiveLink, item])

  return {
    collapsed,
    collapsible,
    isLink,
    isActiveLink,
    isCurrentLink,
    hasActiveLink,
    hasChildren,
    toggleCollapsed: useCallback(() => setCollapsed((v) => !v), [])
  }
}
