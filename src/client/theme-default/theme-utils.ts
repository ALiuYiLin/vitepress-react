// 默认主题数据工具:路径归一化、导航/侧栏匹配、大纲树、prev/next 展平。
// 供 React 组件使用;类型与 Vue 默认主题 themeConfig 结构对齐。

export type VpNavItem = {
  text?: string
  link?: string
  activeMatch?: string
  rel?: string
  target?: string
  items?: VpNavItem[]
}

export type VpSidebarItem = VpNavItem & {
  collapsed?: boolean
}

export type VpSidebarGroup = {
  text?: string
  items: VpSidebarItem[]
}

/** 某个路径的侧栏值:分组/条目数组,或 { items, base } 对象 */
export type VpSidebarConfigValue =
  | VpSidebarGroup[]
  | VpSidebarItem[]
  | { items: VpSidebarItem[]; base?: string }
  | false

/** 与 Vue DefaultTheme.Sidebar 一致:多路径表 / 全局单数组 / false */
export type VpSidebarConfig =
  | {
      [path: string]: VpSidebarConfigValue | undefined
    }
  | VpSidebarItem[]
  | false

export type VpHeader = {
  level: number
  title: string
  slug: string
  link: string
  children: VpHeader[]
}

/** 归一化路径:相对斜杠、去尾斜杠(保留根 "/") */
export function normalizePath(path: string): string {
  let p = path
  if (p.startsWith('./')) p = p.slice(2)
  if (p.startsWith('//') || p.startsWith('\\/\\/')) {
    p = p.replace(/^\/\//, '')
  }
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  return p
}

const getLink = (item: VpNavItem): string => item.link ?? ''

/** 导航项是否应高亮(支持 activeMatch 与精确匹配) */
export function isNavActive(item: VpNavItem, path: string): boolean {
  const link = normalizePath(getLink(item))
  const current = normalizePath(path)
  if (!link) return false
  if (item.activeMatch) {
    const m = item.activeMatch.replace('$', '\\$')
    return new RegExp(m).test(path)
  }
  if (current === link) return true
  // 父路径匹配(如 /guide 高亮 /guide/getting-started)
  return link !== '/' && current.startsWith(link + '/')
}

/**
 * 为给定 path 取出侧栏条目(对齐 Vue support/sidebar.ts getSidebar):
 * - 配置为数组 → 全局适用;
 * - 多路径表:按“/”段数降序取首个前缀命中;值为 { items, base } 时取 items;
 * - 其余情况返回空数组。
 */
export function getSidebarItems(
  sidebar: VpSidebarConfig | undefined,
  path: string
): VpSidebarItem[] {
  if (Array.isArray(sidebar)) return addBase(sidebar)
  if (sidebar == null || sidebar === false) return []

  const current = ensureStartSlash(path)
  const dir = Object.keys(sidebar)
    .sort((a, b) => b.split('/').length - a.split('/').length)
    .find((key) => current.startsWith(ensureStartSlash(key)))

  const value = dir ? sidebar[dir] : undefined
  if (value == null || value === false) return []
  if (Array.isArray(value)) return addBase(value)
  // 对象形态 { base, items }(如各语言侧栏 '{/zh/guide/: { base, items }}'):
  // base 需随条目一起传递,相对 link 才解析成 '/zh/guide/xxx'
  return addBase(value.items, value.base)
}

function ensureStartSlash(p: string): string {
  return p.startsWith('/') ? p : `/${p}`
}

function addBase(items: VpSidebarItem[], _base?: string): VpSidebarItem[] {
  return items.map((_item) => {
    const item = { ..._item } as VpSidebarItem & { base?: string }
    const base = item.base || _base
    if (base && item.link && !/^(?:https?:|mailto:|tel:|\/\/)/.test(item.link)) {
      item.link = base + item.link.replace(/^\//, base.endsWith('/') ? '' : '/')
    }
    if (item.items) {
      item.items = addBase(item.items as VpSidebarItem[], base) as never
    }
    return item
  })
}

/**
 * 为给定 path 挑选 sidebar 分组(对齐 Vue support/sidebar.ts getSidebar +
 * getSidebarGroups):带 items 的条目自成一组;裸链接并入最近一组(没有则建匿名组)。
 */
export function sidebarGroupsFor(
  sidebar: VpSidebarConfig | undefined,
  path: string
): VpSidebarGroup[] {
  const items = getSidebarItems(sidebar, path)
  const groups: VpSidebarGroup[] = []
  let lastGroupIndex = -1

  for (const item of items) {
    if (item.items) {
      groups.push(item as VpSidebarGroup)
      lastGroupIndex = groups.length - 1
      continue
    }
    if (lastGroupIndex === -1 || !groups[lastGroupIndex]) {
      groups.push({ items: [] })
      lastGroupIndex = groups.length - 1
    }
    groups[lastGroupIndex]!.items.push(item)
  }

  return groups
}

/** 把当前分组展开成扁平链接序列(用于 prev/next 与活动项) */
export function flattenSidebarItems(
  groups: VpSidebarGroup[]
): { text?: string; link: string }[] {
  const result: { text?: string; link: string }[] = []
  const walk = (items: VpSidebarItem[]) => {
    for (const item of items) {
      const link = item.link
      const text = item.text ?? ''
      if (link) {
        const normalized = normalizePath(link)
        if (result.every((r) => normalizePath(r.link) !== normalized)) {
          result.push({ text, link: normalized })
        }
      }
      if (item.items?.length) walk(item.items)
    }
  }
  for (const group of groups) walk(group.items ?? [])
  return result
}

/** 把页面 headers(扁平)构建成树(用于大纲、多级) */
export function headerTree(headers: VpHeader[]): VpHeader[] {
  const tree: VpHeader[] = []
  const stack: { node: VpHeader; level: number }[] = []
  for (const h of headers) {
    const node: VpHeader = {
      level: h.level,
      title: h.title,
      slug: h.slug,
      link: h.link ?? `#${h.slug}`,
      children: []
    }
    while (stack.length && stack[stack.length - 1]!.level >= h.level) {
      stack.pop()
    }
    const parent = stack[stack.length - 1]?.node
    if (parent) {
      parent.children.push(node)
    } else {
      tree.push(node)
    }
    stack.push({ node, level: h.level })
  }
  return tree
}
