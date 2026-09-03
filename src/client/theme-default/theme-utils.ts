// 默认主题数据工具:路径归一化、导航/侧栏匹配、大纲树、prev/next 展平。
// 供 React 组件使用;类型与 Vue 默认主题 themeConfig 结构对齐。

export type VpNavItem = {
  text?: string
  link?: string
  activeMatch?: string
  items?: VpNavItem[]
}

export type VpSidebarItem = VpNavItem & {
  collapsed?: boolean
}

export type VpSidebarGroup = {
  text?: string
  items: VpSidebarItem[]
}

export type VpSidebarConfig = {
  [path: string]: VpSidebarGroup[] | VpSidebarItem[] | undefined
}

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

/** 为给定 path 挑选 sidebar 分组(匹配最长的前缀键) */
export function sidebarGroupsFor(
  path: string,
  sidebar?: VpSidebarConfig
): VpSidebarGroup[] {
  if (!sidebar) return []
  const current = normalizePath(path)
  const keys = Object.keys(sidebar).sort((a, b) => b.length - a.length)
  let matched: string | undefined
  for (const key of keys) {
    const normalized = normalizePath(key)
    if (
      current === normalized ||
      current.startsWith(normalized + '/') ||
      normalized === '/'
    ) {
      matched = key
      break
    }
  }
  if (matched == null) return []
  const value = sidebar[matched as string]
  if (!value) return []
  return value.map((g) => {
    if (Array.isArray(g)) {
      return { items: g }
    }
    const v = g as VpSidebarGroup
    return { text: v.text, items: v.items ?? [] }
  })
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
