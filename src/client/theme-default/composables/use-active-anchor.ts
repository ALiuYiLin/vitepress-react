import { useEffect } from 'react'

import type { VpHeader } from '../theme-utils'

/** 大纲标题文本(label 由各语言 themeConfig.outline.label 提供,缺省英文) */
export function resolveTitle(theme: { outline?: { label?: string } }): string {
  return theme.outline?.label ?? 'On this page'
}

/** 从 DOM .vp-doc 收集 h1..h6(带 id)并序列化为扁平 headers */
export function getHeaders(range?: number): VpHeader[] {
  const headers: VpHeader[] = []
  const doc = document.querySelector('.vp-doc')
  if (!doc) return headers
  const nodes = doc.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')
  for (const el of nodes) {
    const level = Number(el.tagName[1])
    if (range && level > range) continue
    if (el.classList.contains('ignore')) continue
    const slug = el.id
    const title = el.textContent?.trim() ?? ''
    if (!slug || !title) continue
    headers.push({ level, title, slug, link: `#${slug}`, children: [] })
  }
  return headers
}

/** themeConfig.outline.level:数字 / 区间 / 'deep' */
export type OutlineLevel = number | [number, number] | 'deep'
/** resolveHeaders 的 range 参数:对齐 DefaultTheme.Config['outline'] */
export type OutlineRange = false | OutlineLevel | { level?: OutlineLevel }

/** resolveHeaders 可接受的最小标题形状(完整 VpHeader 或部分字段均可) */
export type OutlineHeaderInput = {
  level: number
  title?: string
  slug?: string
  link?: string
}

/**
 * 按 outline level 配置过滤扁平 headers 并构建树
 * (对齐 Vue composables/outline.ts resolveHeaders):
 * - `false` → 空;
 * - 数字 n → 只保留 level === n;
 * - `[min, max]` → 保留该区间;
 * - `'deep'` → 保留 2..6;
 * - `{ level }` → 取其中 level;
 * - 缺省 → 与 Vue 一致默认 level 2。
 */
export function resolveHeaders(
  headers: OutlineHeaderInput[],
  range?: OutlineRange
): VpHeader[] {
  if (range === false) return []

  const levelsRange =
    (typeof range === 'object' && !Array.isArray(range)
      ? range.level
      : range) || 2

  let min: number
  let max: number
  if (typeof levelsRange === 'number') {
    min = max = levelsRange
  } else if (levelsRange === 'deep') {
    min = 2
    max = 6
  } else {
    ;[min, max] = levelsRange
  }

  const tree: VpHeader[] = []
  const stack: { node: VpHeader; level: number }[] = []
  for (const h of headers) {
    // 透传输入字段并补 children;部分字段输入由调用方保证(title/slug/link
    // 缺省时不会凭空出现键,保持与输入一致的输出形状)
    const node: VpHeader = { ...h, children: [] } as VpHeader
    // 弹出到第一个不比本标题浅的祖先(与 Vue 一致:越界的标题也参与出栈,
    // 只是不进入树)
    while (stack.length && stack[stack.length - 1]!.level >= h.level)
      stack.pop()
    if (node.level > max || node.level < min) continue
    const parent = stack[stack.length - 1]?.node
    if (parent) parent.children.push(node)
    else tree.push(node)
    stack.push({ node, level: h.level })
  }
  return tree
}

/**
 * 滚动侦测:跟随视口高亮当前标题并同步 marker(对齐 Vue composables/outline.ts):
 * - 绝对定位算各标题真实 top(考虑 sticky/translate);
 * - 页顶清除、页底高亮最后一项;用 scroll-margin-top 补偿吸附;
 * - 点击大纲链接后跳过紧随其后的滚动重算。
 */
export function useActiveAnchor(
  container: React.RefObject<HTMLElement | null>,
  marker: React.RefObject<HTMLElement | null>
) {
  useEffect(() => {
    const doc = container.current
    if (!doc) return
    const root = doc

    let ignoreScrollOnce = false
    let prev: HTMLAnchorElement | null = null
    let raf = 0

    const onClick = (e: Event) => {
      const target = e.target as Element | null
      const anchor = target?.closest?.('a')
      if (anchor?.hash) {
        ignoreScrollOnce = true
        activate(hashToId(anchor.hash))
      }
    }

    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        if (ignoreScrollOnce) {
          ignoreScrollOnce = false
          return
        }
        setActive()
      })
    }

    function setActive() {
      const links = Array.from(
        root.querySelectorAll<HTMLAnchorElement>('a.outline-link')
      )
      const measured = links
        .map((a) => {
          const id = hashToId(a.getAttribute('href') ?? '')
          const el = id ? document.getElementById(id) : null
          if (!el) return null
          return {
            link: a,
            top: getAbsoluteTop(el),
            scrollMarginTop:
              Number.parseFloat(getComputedStyle(el).scrollMarginTop) || 0
          }
        })
        .filter(
          (
            x
          ): x is {
            link: HTMLAnchorElement
            top: number
            scrollMarginTop: number
          } => x != null
        )
        .sort((x, y) => x.top - y.top)

      if (!measured.length) {
        activate(null)
        return
      }

      const scrollY = window.scrollY
      const innerHeight = window.innerHeight
      const offsetHeight = document.body.offsetHeight

      // 页顶:清除高亮;页底:高亮最后一个标题
      if (scrollY < 1) {
        activate(null)
        return
      }
      if (scrollY + innerHeight - offsetHeight >= 0) {
        activate(
          hashToId(
            measured[measured.length - 1]!.link.getAttribute('href') ?? ''
          )
        )
        return
      }

      // 最后一个位于视口顶部的标题
      let activeId: string | null = null
      for (const { link, top, scrollMarginTop } of measured) {
        if (top > scrollY + scrollMarginTop + 4) break
        activeId = hashToId(link.getAttribute('href') ?? '')
      }
      activate(activeId)
    }

    function activate(id: string | null) {
      const activeLink = id
        ? (root.querySelector<HTMLAnchorElement>(
            `a.outline-link[href="#${CSS.escape(id)}"]`
          ) ?? null)
        : null
      if (activeLink === prev) return
      prev?.classList.remove('active')
      prev = activeLink
      if (activeLink) {
        activeLink.classList.add('active')
        if (marker.current) {
          const parent = activeLink.offsetParent as HTMLElement | null
          marker.current.style.top =
            activeLink.offsetTop +
            (parent?.offsetTop ?? 0) +
            (activeLink.offsetHeight - marker.current.offsetHeight) / 2 +
            'px'
          marker.current.style.opacity = '1'
        }
        // 使当前项在 outline 中可见
        activeLink.scrollIntoView({ block: 'nearest' })
      } else if (marker.current) {
        marker.current.style.top = ''
        marker.current.style.opacity = '0'
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    root.addEventListener('click', onClick)
    requestAnimationFrame(setActive)
    return () => {
      window.removeEventListener('scroll', onScroll)
      root.removeEventListener('click', onClick)
      cancelAnimationFrame(raf)
    }
  }, [container, marker])
}

function hashToId(hash: string): string {
  return hash.startsWith('#') ? decodeURIComponent(hash.slice(1)) : ''
}

/** 累加 offsetParent 得到元素绝对位置(返回 NaN 表示脱离文档流/隐藏) */
function getAbsoluteTop(element: HTMLElement): number {
  let top = 0
  let el: HTMLElement | null = element
  while (el && el !== document.body) {
    if (el === null) return NaN
    top += el.offsetTop
    el = el.offsetParent as HTMLElement | null
  }
  return top
}
