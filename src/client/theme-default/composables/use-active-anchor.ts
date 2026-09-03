import { useEffect } from 'react'

import type { VpHeader } from '../theme-utils'

/** 大纲标题文本 */
export function resolveTitle(theme: { outline?: { label?: string } }): string {
  return theme.outline?.label ?? '页面导航'
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

/** 按 range 过滤并构建树 */
export function resolveHeaders(headers: VpHeader[], range?: number): VpHeader[] {
  const filtered = range
    ? headers.filter((h) => h.level <= range)
    : headers
  const tree: VpHeader[] = []
  const stack: { node: VpHeader; level: number }[] = []
  for (const h of filtered) {
    const node: VpHeader = { ...h, children: [] }
    while (stack.length && stack[stack.length - 1]!.level >= h.level) stack.pop()
    const parent = stack[stack.length - 1]?.node
    if (parent) parent.children.push(node)
    else tree.push(node)
    stack.push({ node, level: h.level })
  }
  return tree
}

/** 滚动侦测:给大纲链接加/去 active,并同步 marker 位置 */
export function useActiveAnchor(
  container: React.RefObject<HTMLElement | null>,
  marker: React.RefObject<HTMLElement | null>
) {
  useEffect(() => {
    const doc = container.current
    if (!doc) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const links = doc.querySelectorAll<HTMLAnchorElement>('a.outline-link')
        const ids = Array.from(links).map((a) => {
          const href = a.getAttribute('href') ?? ''
          return href.startsWith('#') ? href.slice(1) : ''
        })
        let currentId = ''
        for (const id of ids) {
          const el = document.getElementById(id)
          if (el && el.getBoundingClientRect().top - 88 <= 0) currentId = id
        }
        links.forEach((a) => {
          const id = (a.getAttribute('href') ?? '').slice(1)
          const active = id === currentId
          a.classList.toggle('active', active)
        })
        if (marker.current) {
          const activeLink = Array.from(links).find((a) =>
            a.classList.contains('active')
          )
          if (activeLink) {
            const offset = activeLink.offsetTop - doc.offsetTop
            marker.current.style.opacity = '1'
            marker.current.style.top = `${offset}px`
          } else {
            marker.current.style.opacity = '0'
          }
        }
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [container, marker])
}
