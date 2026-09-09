import { useId, useState } from 'react'
import { useRoute } from '@10coding/vitepress-react'

import { isActive } from '../../shared'
import { useThemeComponent } from '../composables/use-theme-component'
import type { VpNavItem } from '../theme-utils'
import { VPFlyout as VPFlyoutDefault } from './VPFlyout'
import { VPMenuGroup as VPMenuGroupDefault } from './VPMenuGroup'
import { VPMenuLink as VPMenuLinkDefault } from './VPMenuLink'
const cx = (...c: (string | false | undefined | null)[]) =>
  c.filter(Boolean).join(' ')

export type VpNavMenuGroupItem = VpNavItem & {
  noIcon?: boolean
  component?: unknown
  props?: unknown
  items?: VpNavMenuGroupItem[]
}

/** 子项是否命中当前页(对齐 Vue VPNavMenuGroup.vue isChildActive) */
function isChildActive(
  relativePath: string,
  hash: string,
  item: VpNavMenuGroupItem
): boolean {
  if (item.component) return false
  if (item.link) {
    return isActive(
      relativePath,
      hash,
      item.activeMatch || item.link,
      Boolean(item.activeMatch)
    )
  }
  return (item.items ?? []).some((i) => isChildActive(relativePath, hash, i))
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
  const relativePath = route.data?.relativePath ?? ''
  const hash = route.hash ?? ''
  const isActiveGroup = item.activeMatch
    ? isActive(relativePath, hash, item.activeMatch, true)
    : isChildActive(relativePath, hash, item)

  // 屏幕手风琴状态与 id(钩子无条件调用)
  const [isOpen, setIsOpen] = useState(false)
  const groupId = useId()

  const VPMenuGroup = useThemeComponent('VPMenuGroup', VPMenuGroupDefault)
  const VPFlyout = useThemeComponent('VPFlyout', VPFlyoutDefault)
  const VPMenuLink = useThemeComponent('VPMenuLink', VPMenuLinkDefault)

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
        <span
          className="button-text"
          dangerouslySetInnerHTML={{ __html: item.text ?? '' }}
        />
        <span className="vpi-plus button-icon" aria-hidden="true" />
      </button>

      <ul
        style={isOpen ? undefined : { display: 'none' }}
        id={groupId}
        className="items"
      >
        {((item.items as VpNavMenuGroupItem[] | undefined) ?? []).map(
          (child) => {
            if (child.link) return <VPMenuLink key={child.text} item={child} />
            if (child.component) return null
            return (
              <VPMenuGroup
                key={child.text}
                text={child.text}
                items={child.items ?? []}
              />
            )
          }
        )}
      </ul>
    </div>
  )
}
