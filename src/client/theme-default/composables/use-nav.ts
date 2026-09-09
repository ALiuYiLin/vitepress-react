import { useEffect, useSyncExternalStore } from 'react'
import { inBrowser, useData, useRoute } from '@10coding/vitepress-react'

import { isActive } from '../../shared'
import type { VpNavItem } from '../theme-utils'

/**
 * 屏幕导航状态(对应 Vue composables/nav.ts):模块级单例,
 * VPNav 与所有子组件共享同一开合状态;路由/放大到平板宽度自动关闭。
 */
let isScreenOpen = false
let screenTriggerEl: HTMLButtonElement | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return isScreenOpen
}

function setScreenOpen(v: boolean) {
  isScreenOpen = v
  emit()
}

export function openScreen() {
  setScreenOpen(true)
}

export function closeScreen() {
  setScreenOpen(false)
}

export function toggleScreen() {
  setScreenOpen(!isScreenOpen)
}

/** 记录打开屏幕的触发按钮(汉堡),供 Escape 归还焦点 */
export function setScreenTriggerEl(el: HTMLButtonElement | null) {
  screenTriggerEl = el
}

export function getScreenTriggerEl() {
  return screenTriggerEl
}

export function useNav() {
  const isOpen = useSyncExternalStore(subscribe, getSnapshot, () => false)
  const route = useRoute()

  // 路由变化关闭屏幕导航
  useEffect(() => {
    setScreenOpen(false)
  }, [route.path])

  // 放大到平板宽度(≥48rem)关闭
  useEffect(() => {
    if (!inBrowser) return
    const mq = window.matchMedia('(min-width: 48rem)')
    const onMq = (e: MediaQueryListEvent) => {
      if (e.matches) setScreenOpen(false)
    }
    mq.addEventListener('change', onMq)
    return () => mq.removeEventListener('change', onMq)
  }, [])

  return {
    isScreenOpen: isOpen,
    open: openScreen,
    close: closeScreen,
    toggle: toggleScreen,
    setScreenTriggerEl
  }
}

/** 是否显示外观开关:site.appearance 存在且非 force-dark/force-auto */
export function useAppearanceSwitch() {
  const { site } = useData()
  const appearance = (site as { appearance?: unknown }).appearance
  return Boolean(
    appearance && appearance !== 'force-dark' && appearance !== 'force-auto'
  )
}

/** 导航项链接信息:href / 是否当前页 / 是否高亮(对齐 Vue composables/nav.ts) */
export function useNavItemLink(item: VpNavItem) {
  const route = useRoute()
  const href = item.link ?? ''
  const activeMatch = item.activeMatch
  const relativePath = route.data?.relativePath ?? ''
  const hash = route.hash ?? ''
  // 用 relativePath + isActive 判定:URL 带 .html/query 或页面为 index 时也命中;
  // activeMatch 作为正则匹配(若提供)
  const isActiveLink = activeMatch
    ? isActive(relativePath, hash, activeMatch, true)
    : isActive(relativePath, hash, href)
  // 仅精确匹配——宽的 activeMatch 负责视觉高亮,不冒充 aria-current
  const isCurrentLink = isActive(relativePath, hash, href)
  return { href, isActiveLink, isCurrentLink }
}
