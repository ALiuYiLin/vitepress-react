import { useEffect, useRef, useState } from 'react'
import { useData } from 'vitepress'

import { cn } from './lib/utils'
import { headerTree, type VpHeader } from './theme-utils'

function scrollToHeading(id: string) {
  const el = document.getElementById(id)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  history.replaceState(null, '', `#${id}`)
}

// 右侧"本页目录":渲染 page.headers(树)+ 滚动侦测高亮
export function AsideOutline() {
  const { page } = useData()
  const headers = headerTree(page.headers)
  const [activeId, setActiveId] = useState<string | undefined>()
  const ticking = useRef(false)

  useEffect(() => {
    setActiveId(undefined)
    if (!headers.length) return
    const ids = new Set<string>()
    const collect = (hs: VpHeader[]) =>
      hs.forEach((h) => {
        ids.add(h.slug)
        collect(h.children)
      })
    collect(headers)

    // 滚动定位:选"第一个越过视口顶部的标题"
    const onScroll = () => {
      if (ticking.current) return
      ticking.current = true
      requestAnimationFrame(() => {
        ticking.current = false
        let current: string | undefined
        for (const id of ids) {
          const el = document.getElementById(id)
          if (el && el.getBoundingClientRect().top - 90 <= 0) {
            current = id
          }
        }
        setActiveId((prev) => (prev !== current ? current : prev))
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [headers])

  if (!headers.length) return null

  const renderList = (hs: VpHeader[], depth = 0) => (
    <ul
      className={cn('space-y-0.5', depth === 0 ? 'border-l' : '')}
      style={depth === 0 ? { borderColor: 'var(--border)' } : undefined}
    >
      {hs.map((h) => {
        const active = h.slug === activeId
        return (
          <li key={h.slug}>
            <a
              href={`#${h.slug}`}
              onClick={(e) => {
                e.preventDefault()
                scrollToHeading(h.slug)
                setActiveId(h.slug)
              }}
              className={cn(
                '-ml-px block border-l py-1 text-[13px] leading-5 transition-colors',
                depth === 0 ? 'pl-3' : 'pl-6',
                active
                  ? 'border-primary font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {h.title}
            </a>
            {h.children.length > 0 && renderList(h.children, depth + 1)}
          </li>
        )
      })}
    </ul>
  )

  return (
    <div className="pt-10 text-sm">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        本页目录
      </div>
      {renderList(headers)}
    </div>
  )
}
