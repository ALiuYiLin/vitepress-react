import type { MouseEvent, ReactNode } from 'react'

import { useSidebarItemControl } from '../composables/use-sidebar'
import { type VpSidebarItem as VpItem } from '../theme-utils'
import { VPLink } from './VPLink'
import '../styles/components/VPSidebarItem.scoped.css'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

/**
 * 侧栏条目(递归)。DOM/状态类与 Vue VPSidebarItem.vue 一致:
 * 根 section|div(带文本时 h2..h6/p),level-N、collapsible/collapsed/is-link/
 * is-active/has-active;item 文本按 v-html 渲染。
 *
 * 说明:根节点与标题文本用显式 JSX 渲染(而非 createElement),这样构建期
 * jsx-scoped 的 babel 注入才能给这些元素带上 data-v-{hash},使 scoped 规则
 * (如 .VPSidebarItem.level-0 的 padding、.text 的字号/字重)命中。
 */
export function VPSidebarItem({
  item,
  depth
}: {
  item: VpItem
  depth: number
}) {
  const {
    collapsed,
    collapsible,
    isLink,
    isActiveLink,
    isCurrentLink,
    hasActiveLink,
    hasChildren,
    toggleCollapsed
  } = useSidebarItemControl(item)

  const text = item.text
  const textTag: 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' =
    hasChildren && depth < 5
      ? (`h${depth + 2}` as 'h2' | 'h3' | 'h4' | 'h5' | 'h6')
      : 'p'
  // 一级分组文本即小标题,用 section 包裹(语义)
  const isSection = text && textTag !== 'p'

  const textEl: ReactNode = text ? (
    textTag === 'p' ? (
      <p className="text" dangerouslySetInnerHTML={{ __html: text }} />
    ) : textTag === 'h2' ? (
      <h2 className="text" dangerouslySetInnerHTML={{ __html: text }} />
    ) : textTag === 'h3' ? (
      <h3 className="text" dangerouslySetInnerHTML={{ __html: text }} />
    ) : textTag === 'h4' ? (
      <h4 className="text" dangerouslySetInnerHTML={{ __html: text }} />
    ) : textTag === 'h5' ? (
      <h5 className="text" dangerouslySetInnerHTML={{ __html: text }} />
    ) : (
      <h6 className="text" dangerouslySetInnerHTML={{ __html: text }} />
    )
  ) : null

  const onItemClick = () => {
    if (!item.link) toggleCollapsed()
  }

  const onCaretClick = (e: MouseEvent) => {
    e.stopPropagation()
    toggleCollapsed()
  }

  const hasCaret = collapsible && hasChildren
  const rootClass = cx(
    'VPSidebarItem',
    `level-${depth}`,
    collapsible && 'collapsible',
    collapsed && 'collapsed',
    isLink && 'is-link',
    isActiveLink && 'is-active',
    hasActiveLink && 'has-active'
  )

  const body: ReactNode = text ? (
    <div className="item" onClick={onItemClick}>
      <div className="indicator" />
      {item.link ? (
        <VPLink
          tag="a"
          className="link"
          aria-current={isCurrentLink ? 'page' : undefined}
          href={item.link}
          rel={item.rel}
          target={item.target}
        >
          {textEl}
        </VPLink>
      ) : (
        textEl
      )}
      {hasCaret ? (
        <button
          type="button"
          className="caret"
          aria-label="toggle section"
          aria-expanded={!collapsed}
          onClick={onCaretClick}
        >
          <span className={cx('caretIcon', 'caret-icon', 'vpi-chevron-right')} />
        </button>
      ) : null}
    </div>
  ) : null

  const list: ReactNode = hasChildren ? (
    <ul className="items">
      {depth < 5 ? (
        <li>
          {item.items!.map((i, idx) => (
            <VPSidebarItem key={i.text ?? idx} item={i} depth={depth + 1} />
          ))}
        </li>
      ) : null}
    </ul>
  ) : null

  return isSection ? (
    <section className={rootClass}>
      {body}
      {list}
    </section>
  ) : (
    <div className={rootClass}>
      {body}
      {list}
    </div>
  )
}
