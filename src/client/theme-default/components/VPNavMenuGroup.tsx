import { useId, useState } from 'react'
import { useRoute } from 'vitepress'

import { normalizePath, type VpNavItem } from '../theme-utils'
import { VPFlyout } from './VPFlyout'
import { VPMenuGroup } from './VPMenuGroup'
import { VPMenuLink } from './VPMenuLink'
const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

export type VpNavMenuGroupItem = VpNavItem & {
  noIcon?: boolean
  component?: unknown
  props?: unknown
  items?: VpNavMenuGroupItem[]
}

function isActiveOn(routePath: string, item: VpNavItem): boolean {
  if (item.activeMatch) {
    return new RegExp(item.activeMatch.replace('$', '\\$')).test(routePath)
  }
  const link = item.link
  if (!link) return false
  const current = normalizePath(routePath)
  const normalized = normalizePath(link)
  return (
    (normalized !== '/' && current.startsWith(normalized + '/')) ||
    normalized === current
  )
}

function isChildActive(routePath: string, item: VpNavMenuGroupItem): boolean {
  if (item.component) return false
  if (item.link) return isActiveOn(routePath, item)
  return (item.items ?? []).some((i) => isChildActive(routePath, i))
}

/**
 * 导航分组(对应 Vue VPNavMenuGroup.vue)三形态:
 * - 顶栏 flyout(VPNavBarMenuGroup)
 * - ⋯ 菜单内有标题分组(menu)
 * - 屏幕导航内手风琴(VPNavScreenMenuGroup)
 */
export function VPNavMenuGroup({
  item,
  screen,
  menu,
  className
}: {
  item: VpNavMenuGroupItem
  /** 屏幕导航内手风琴 */
  screen?: boolean
  /** ⋯ 菜单内平铺有标题分组 */
  menu?: boolean
  className?: string
}) {
  const route = useRoute()
  const isActiveGroup = item.activeMatch
    ? new RegExp(item.activeMatch.replace('$', '\\$')).test(route.path)
    : isChildActive(route.path, item)

  // 屏幕手风琴状态与 id(钩子无条件调用)
  const [isOpen, setIsOpen] = useState(false)
  const groupId = useId()

  // ⋯ 菜单内:平铺分组
  if (menu) {
    return (
      <VPMenuGroup
        className={cx('VPNavMenuGroup', className)}
        text={item.text}
        items={item.items ?? []}
      />
    )
  }

  // 顶栏:悬停/点击 flyout
  if (!screen) {
    return (
      <VPFlyout
        className={cx(
          'VPNavMenuGroup VPNavBarMenuGroup',
          isActiveGroup && 'active',
          className
        )}
        button={item.text}
        items={item.items ?? []}
      />
    )
  }

  // 屏幕导航:手风琴(重挂即重置)

  return (
    <div
      className={cx(
        'VPNavMenuGroup VPNavScreenMenuGroup',
        isOpen && 'open',
        isActiveGroup && 'active',
        className
      )}
    >
      <button
        type="button"
        className="button"
        aria-expanded={isOpen}
        aria-controls={groupId}
        onClick={() => setIsOpen((v) => !v)}
      >
        <span className="button-text" dangerouslySetInnerHTML={{ __html: item.text ?? '' }} />
        <span className="vpi-plus button-icon" aria-hidden="true" />
      </button>

      <ul
        style={isOpen ? undefined : { display: 'none' }}
        id={groupId}
        className="items"
      >
        {(item.items as VpNavMenuGroupItem[] | undefined ?? []).map((child) => {
          if (child.link) return <VPMenuLink key={child.text} item={child} />
          if (child.component) return null
          return (
            <VPMenuGroup key={child.text} text={child.text} items={child.items ?? []} />
          )
        })}
      </ul>
    </div>
  )
}
