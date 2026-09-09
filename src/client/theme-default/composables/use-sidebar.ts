import { useCallback, useEffect, useState } from 'react'
import { useRoute } from '@10coding/vitepress-react'

import { isActive } from '../../shared'
import type { VpSidebarItem } from '../theme-utils'

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

/**
 * 子树里是否存在"当前页"条目(递归;对齐 Vue support/sidebar.ts
 * hasActiveLink:每条 link 用 isActive 精确判定,不再做前缀/扁平匹配)。
 */
function subtreeHasActive(
  items: VpSidebarItem[] | undefined,
  currentPath: string,
  hash: string,
  skipHashCheck: boolean
): boolean {
  if (!items) return false
  for (const child of items) {
    if (
      child.link &&
      isActive(currentPath, hash, child.link, false, skipHashCheck)
    ) {
      return true
    }
    if (
      child.items &&
      subtreeHasActive(child.items, currentPath, hash, skipHashCheck)
    ) {
      return true
    }
  }
  return false
}

/**
 * 单个侧栏项的控制(语义对齐 Vue composables/sidebar.ts):
 * - 高亮判定用 route.data.relativePath + isActive(Vue 同款):URL 带 .html、
 *   页面是 /guide/index 之类时也能命中,且不受 base 前缀影响;
 * - collapsible = 配置了 collapsed 字段(而非有无子项)
 * - collapsed 初值/随 item 变化重置为配置值;自身或子树含当前页时自动展开
 */
export function useSidebarItemControl(item: VpSidebarItem) {
  const route = useRoute()
  const relativePath = route.data?.relativePath ?? ''
  const hash = route.hash ?? ''

  // SSR/首帧没有可靠的 URL hash:先用 skipHash 渲染,挂载后再按真实 hash
  // 精确判定(对齐 Vue:setup/SSR 传 skipHashCheck=true,onMounted 后重算)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const skipHashCheck = !mounted

  const isLink = Boolean(item.link)
  const isActiveLink =
    isLink &&
    isActive(relativePath, hash, item.link as string, false, skipHashCheck)
  // 仅精确匹配(hash 也算)才给 aria-current —— 宽高亮不该冒充当前页
  const isCurrentLink =
    isLink && isActive(relativePath, hash, item.link as string)
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
  const hasActiveLink =
    isActiveLink ||
    subtreeHasActive(item.items, relativePath, hash, skipHashCheck)
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
