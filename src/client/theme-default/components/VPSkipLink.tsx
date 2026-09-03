import { useEffect, useRef } from 'react'
import { useData, useRoute } from 'vitepress'

import s from './VPSkipLink.module.css'

export type VPSkipLinkProps = {
  // Vue 版注释:组件有两个根节点,`inert` 无法自动落到 a 上,需显式传入
  inert?: boolean
}

/**
 * 对应 Vue VPSkipLink.vue:路由变化时把焦点移到隐藏的锚点 span,
 * 再让可聚焦的「跳到内容」链接接管。
 */
export function VPSkipLink({ inert }: VPSkipLinkProps) {
  const { theme } = useData()
  const route = useRoute()
  const backToTop = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    backToTop.current?.focus()
  }, [route.path])

  return (
    <>
      <span ref={backToTop} tabIndex={-1} />
      <a
        href="#VPContent"
        className={`${s.VPSkipLink} visually-hidden`}
        {...({ inert: inert || undefined } as Record<string, unknown>)}
      >
        {(theme as { skipToContentLabel?: string }).skipToContentLabel ||
          'Skip to content'}
      </a>
    </>
  )
}
