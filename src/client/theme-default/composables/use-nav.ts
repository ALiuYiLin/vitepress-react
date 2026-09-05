import { useEffect, useSyncExternalStore } from 'react'
import { inBrowser, useData, useRoute } from '@10coding/vitepress-react'

import { normalizePath, type VpNavItem } from '../theme-utils'

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

/** 导航项链接信息:href / 是否当前页 / 是否高亮 */
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
