import { useNavContext } from '../nav-context'
import { useNavItemLink } from '../composables/use-nav'
import type { VpNavItem } from '../theme-utils'
import { VPLink } from './VPLink'
import './VPNavMenuLink.module.css'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

/**
 * 顶栏/屏幕导航链接项(对应 Vue VPNavMenuLink.vue)。
 * 屏幕内点击后关闭全屏导航(经 NavContext)。
 */
export function VPNavMenuLink({
  item,
  screen,
  className
}: {
  item: VpNavItem
  /** 屏幕导航内(点击后关闭屏幕) */
  screen?: boolean
  className?: string
}) {
  const { href, isActiveLink, isCurrentLink } = useNavItemLink(item)
  const { closeScreen } = useNavContext()

  const onClick = () => {
    if (screen) closeScreen()
  }

  const extra = item as { target?: string; rel?: string; noIcon?: boolean }

  return (
    <VPLink
      className={cx(
        'VPNavMenuLink',
        screen ? 'VPNavScreenMenuLink' : 'VPNavBarMenuLink',
        isActiveLink && 'active',
        className
      )}
      aria-current={isCurrentLink ? 'page' : undefined}
      href={href}
      target={extra.target}
      rel={extra.rel}
      noIcon={extra.noIcon}
      onClick={onClick}
    >
      <span dangerouslySetInnerHTML={{ __html: item.text ?? '' }} />
    </VPLink>
  )
}
