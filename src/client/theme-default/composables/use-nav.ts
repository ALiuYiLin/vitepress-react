import { useEffect, useState } from 'react'
import { useAppearance, useRoute } from 'vitepress'

import { normalizePath, type VpNavItem } from '../theme-utils'

/** 侧栏/屏幕导航开合(移动端),路由变化自动关闭 */
export function useNav() {
  const [isScreenOpen, setScreenOpen] = useState(false)
  const route = useRoute()
  const close = () => setScreenOpen(false)
  useEffect(() => {
    setScreenOpen(false)
  }, [route.path])
  return {
    isScreenOpen,
    open: () => setScreenOpen(true),
    close,
    toggle: () => setScreenOpen((v) => !v)
  }
}

/** 外观开关是否为"普通"模式(非 force-*) */
export function useAppearanceSwitch() {
  const { isDark } = useAppearance()
  return Boolean(isDark)
}

/** 导航项链接信息:href / 是否为当前页 / 是否高亮 */
export function useNavItemLink(item: VpNavItem) {
  const route = useRoute()
  const link = item.link ?? ''
  const current = normalizePath(route.path)
  const normalized = normalizePath(link)
  const isCurrentLink = normalized === current
  const isActiveLink = item.activeMatch
    ? new RegExp(item.activeMatch.replace('$', '\\$')).test(route.path)
    : (normalized !== '/' && current.startsWith(normalized + '/')) || isCurrentLink
  return { href: link, isActiveLink, isCurrentLink }
}
