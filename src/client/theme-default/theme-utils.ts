// 默认主题(React)数据 helpers:从框架 useData() 的 themeConfig / page.headers
// 派生 nav / sidebar / 大纲树所需结构。原 playground/theme 的 mock vp-data 逻辑
// 在此改写为消费真实框架数据。

import type { Header } from '../shared'

export interface VpNavItem {
  text?: string
  link?: string
  items?: (VpNavItem | { text?: string; items: VpNavItem[] })[]
  activeMatch?: string
}

export interface VpSidebarItem {
  text?: string
  link?: string
  items?: VpSidebarItem[]
  docFooterText?: string
}

export type VpSidebarConfig =
  | VpSidebarItem[]
  | Record<
      string,
      VpSidebarItem[] | { items: VpSidebarItem[]; base?: string }
    >

export type VpHeader = Header

/** '/guide.md' / '/guide/' / '/guide' → '/guide' */
export function normalizePath(p: string): string {
  let r = p.replace(/\.(md|html)$/i, '')
  r = r.replace(/(^|\/)index$/, '$1')
  return r.replace(/\/+$/, '') || '/'
}

/** 导航项活动态:activeMatch 正则优先,否则 link 归一比较 */
export function isNavActive(item: VpNavItem, currentPath: string): boolean {
  if (item.activeMatch) {
    try {
      return new RegExp(item.activeMatch).test(currentPath)
    } catch {
      /* ignore */
    }
  }
  if (!item.link) return false
  return normalizePath(item.link) === currentPath
}

/** 当前路径命中的 sidebar 分组列表(每组 { text?, items }) */
export function sidebarGroupsFor(
  path: string,
  sidebar?: VpSidebarConfig
): { text?: string; items: VpSidebarItem[] }[] {
  if (!sidebar) return []
  const arr = Array.isArray(sidebar)
    ? sidebar
    : (() => {
        const keys = Object.keys(sidebar).sort((a, b) => b.length - a.length)
        const norm = normalizePath(path)
        const key =
          keys.find((k) =>
            norm === '/' ? k === '/' : norm.startsWith(normalizePath(k))
          ) ?? keys[0]
        if (key == null) return []
        const val = sidebar[key]
        if (!val) return []
        if (Array.isArray(val)) return val
        const base = val.base
        const items = (val.items ?? []).map((item) => ({
          ...item,
          items: item.items?.length && base
            ? item.items.map((sub) => ({
                ...sub,
                link: sub.link
                  ? `${base.replace(/\/$/, '')}/${sub.link.replace(/^\//, '')}`
                  : undefined
              }))
            : item.items
        }))
        return items
      })()

  // 顶层项:有子项 → 作为分组;无子项的链接项 → 单条分组
  return arr.map((top) =>
    top.items?.length
      ? { text: top.text, items: top.items }
      : { text: undefined, items: [top] }
  )
}

/** 展平侧边栏(保持顺序)为有序链接项,供 PrevNext 使用 */
export function flattenSidebarItems(
  groups: { text?: string; items: VpSidebarItem[] }[]
) {
  const out: { text: string; link?: string }[] = []
  for (const group of groups) {
    const walk = (items: VpSidebarItem[], parent?: string) => {
      for (const item of items) {
        const label = item.docFooterText || item.text || parent || ''
        if (item.link) out.push({ text: label, link: item.link })
        if (item.items?.length) walk(item.items, label)
      }
    }
    walk(group.items, group.text)
  }
  return out
}

/** 扁平 headers → 树(children 以 level 组装;若已带 children 则原样) */
export function headerTree(headers: Header[]): VpHeader[] {
  const hasChildren = headers.some((h) => h.children?.length)
  if (hasChildren) return headers as VpHeader[]

  const roots: VpHeader[] = []
  const stack: { level: number; node: VpHeader }[] = []
  for (const h of headers) {
    const node: VpHeader = { ...h, children: [] }
    while (stack.length && stack[stack.length - 1]!.level >= h.level) {
      stack.pop()
    }
    if (stack.length) {
      stack[stack.length - 1]!.node.children.push(node)
    } else {
      roots.push(node)
    }
    stack.push({ level: h.level, node })
  }
  return roots
}
