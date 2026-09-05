import { useData } from 'vitepress'

import { useNavOverflow } from '../composables/use-nav-overflow'
import { VPNavMenuGroup, type VpNavMenuGroupItem } from './VPNavMenuGroup'
import { VPNavMenuLink } from './VPNavMenuLink'
const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

/**
 * 导航菜单列表(对应 Vue VPNavMenu.vue):
 * 顶栏每项为 VPNavMenuLink / VPNavMenuGroup(flyout);
 * 屏幕内(screen)全部显示、组变手风琴。
 */
export function VPNavMenu({
  screen,
  className
}: {
  /** 屏幕导航内(全部显示,不参与溢出) */
  screen?: boolean
  className?: string
}) {
  const { theme } = useData()
  const t = theme as { nav?: VpNavMenuGroupItem[]; navMenuLabel?: string }
  const nav = t.nav
  const overflow = screen ? null : useNavOverflow()
  const visibleCount = overflow ? overflow.state.visibleItemCount : Infinity

  if (!nav) return null

  return (
    <nav
      aria-label={t.navMenuLabel || 'Main Navigation'}
      className={cx(
        'VPNavMenu',
        screen ? 'VPNavScreenMenu' : 'VPNavBarMenu',
        className
      )}
    >
      <ul className="list">
        {nav.map((item, index) => (
          <li
            key={JSON.stringify(item)}
            className={cx(!screen && index >= visibleCount && 'collapsed')}
          >
            {item.link ? (
              <VPNavMenuLink item={item} screen={screen} />
            ) : item.component ? null : (
              <VPNavMenuGroup item={item} screen={screen} />
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}
