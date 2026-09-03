import { useEffect, useRef, useState } from 'react'

export interface OutlineHeader {
  level: number
  title: string
  slug: string
}

/**
 * 右侧大纲(基于 page.headers):点击平滑滚动、滚动时高亮当前章节。
 */
export function AsideOutline({ headers }: { headers: OutlineHeader[] }) {
  const [activeId, setActiveId] = useState('')
  const ticking = useRef(false)

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return
      ticking.current = true
      requestAnimationFrame(() => {
        ticking.current = false
        // 选第一个位于视口上缘附近的标题
        let current = ''
        for (const h of headers) {
          const el = document.getElementById(h.slug)
          if (!el) continue
          if (el.getBoundingClientRect().top <= 90) {
            current = h.slug
          } else if (current) {
            break
          }
        }
        // 页面滚到底部时高亮最后一节
        if (!current && window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
          current = headers[headers.length - 1]?.slug ?? ''
        }
        setActiveId(current)
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [headers])

  return (
    <nav className="vp-outline" aria-label="Page outline">
      <p className="vp-outline-title">On this page</p>
      {headers.map((h) => (
        <a
          key={h.slug}
          href={`#${h.slug}`}
          className={`${h.level >= 3 ? 'l3' : ''}${activeId === h.slug ? ' active' : ''}`}
        >
          {h.title}
        </a>
      ))}
    </nav>
  )
}
