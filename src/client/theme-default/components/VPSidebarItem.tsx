import { createElement, type MouseEvent } from 'react'

import { useSidebarItemControl } from '../composables/use-sidebar'
import { type VpSidebarItem as VpItem } from '../theme-utils'
import { VPLink } from './VPLink'
import '../styles/components/VPSidebarItem.scoped.css'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

/**
 * 侧栏条目(递归)。DOM/状态类与 Vue VPSidebarItem.vue 一致:
 * 根 section|div(带文本时 h2..h6/p),level-N、collapsible/collapsed/is-link/
 * is-active/has-active;item 文本按 v-html 渲染。
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
  const RootTag: 'section' | 'div' = text && textTag !== 'p' ? 'section' : 'div'

  const textEl = text
    ? createElement(textTag, {
        className: cx('text', 'text'),
        dangerouslySetInnerHTML: { __html: text }
      })
    : null

  const onItemClick = () => {
    if (!item.link) toggleCollapsed()
  }

  const onCaretClick = (e: MouseEvent) => {
    e.stopPropagation()
    toggleCollapsed()
  }

  const hasCaret = collapsible && hasChildren

  return createElement(
    RootTag,
    {
      className: cx(
        'VPSidebarItem',
        `level-${depth}`,
        collapsible && 'collapsible',
        collapsed && 'collapsed',
        isLink && 'is-link',
        isActiveLink && 'is-active',
        hasActiveLink && 'has-active'
      )
    },
    text ? (
      <div className={cx('item', 'item')} onClick={onItemClick}>
        <div className={cx('indicator', 'indicator')} />
        {item.link ? (
          <VPLink
            tag="a"
            className={cx('link', 'link')}
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
            className={cx('caret', 'caret')}
            aria-label="toggle section"
            aria-expanded={!collapsed}
            onClick={onCaretClick}
          >
            <span className={cx('caretIcon', 'caret-icon', 'vpi-chevron-right')} />
          </button>
        ) : null}
      </div>
    ) : null,
    hasChildren ? (
      <ul className={cx('items', 'items')}>
        {depth < 5 ? (
          <li>
            {item.items!.map((i, idx) => (
              <VPSidebarItem key={i.text ?? idx} item={i} depth={depth + 1} />
            ))}
          </li>
        ) : null}
      </ul>
    ) : null
  )
}

