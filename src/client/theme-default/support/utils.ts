// 默认主题组件级链接工具(Vue theme-default/support/utils 的 React 版)。
// 注意:上游 normalizeLink 内部调用响应式 useData;React 侧没有响应式上下文,
// 因此改为纯函数 + 显式传入 site 快照(调用方在组件顶层无条件 useData())。

import { withBase } from '@10coding/vitepress-react'

import { isExternal, isRelativeBase, treatAsHtml } from '../../shared'

export function ensureStartingSlash(path: string): string {
  return path.startsWith('/') ? path : `/${path}`
}

export function isLinkExternal(
  href?: string,
  target?: string,
  external?: boolean
): boolean {
  if (external !== undefined) return external
  return (!!href && isExternal(href)) || target === '_blank'
}

/** normalizeLink 需要的 site 字段(useData().site 的子集) */
export type NormalizeSite = {
  cleanUrls?: boolean
  base?: string
}

/**
 * 把内部链接规范化为可导航地址(补 .html / index.html、withBase)。
 * 与上游区别:site 不再从内部数据拉取,由调用方传入;缺省时仅做 withBase。
 */
export function normalizeLink(url: string, site?: NormalizeSite): string {
  const { pathname, search, hash, protocol } = new URL(url, 'http://a.com')

  if (
    isExternal(url) ||
    url.startsWith('#') ||
    !protocol.startsWith('http') ||
    !treatAsHtml(pathname)
  ) {
    return url
  }

  let normalizedPath =
    pathname.endsWith('/') || pathname.endsWith('.html')
      ? url
      : url.replace(
          /(?:(^\.+)\/)?.*$/,
          `$1${pathname.replace(
            /(\.md)?$/,
            site?.cleanUrls ? '' : '.html'
          )}${search}${hash}`
        )

  if (site && isRelativeBase(site.base ?? '/') && !site.cleanUrls) {
    const pathPart = normalizedPath.replace(/[?#].*$/, '')
    if (pathPart.endsWith('/')) {
      normalizedPath =
        pathPart + 'index.html' + normalizedPath.slice(pathPart.length)
    }
  }

  return withBase(normalizedPath)
}

export function throttleAndDebounce(fn: () => void, delay: number): () => void {
  let timeoutId: number | undefined
  let called = false

  return () => {
    if (timeoutId) window.clearTimeout(timeoutId)

    if (!called) {
      fn()
      called = true
      window.setTimeout(() => (called = false), delay)
    } else {
      timeoutId = window.setTimeout(fn, delay)
    }
  }
}

export function uniqBy<T>(array: T[], keyFn: (item: T) => unknown): T[] {
  const seen = new Set<unknown>()
  return array.filter((item) => {
    const k = keyFn(item)
    return seen.has(k) ? false : (seen.add(k), true)
  })
}
