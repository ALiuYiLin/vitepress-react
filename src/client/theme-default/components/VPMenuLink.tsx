import { useNavItemLink } from '../composables/use-nav'
import type { VpNavItem } from '../theme-utils'
import '../styles/components/VPMenuLink.scoped.css'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

export interface VPMenuLinkProps {
  item: VpNavItem
  /** 额外属性(如语言切换的 lang/hreflang/dir/data-allow-mismatch) */
  attrs?: Record<string, unknown>
}

/** 下拉/菜单中的链接项 */
export function VPMenuLink({ item, attrs }: VPMenuLinkProps) {
  const { href, isActiveLink, isCurrentLink } = useNavItemLink(item)
  const link = item.link
  return (
    <li className="VPMenuLink">
      <a
        className={cx('link', isActiveLink && 'active')}
        href={link ?? href}
        aria-current={isCurrentLink ? 'page' : undefined}
        target={attrs?.target as string | undefined}
        rel={attrs?.rel as string | undefined}
        {...attrs}
        dangerouslySetInnerHTML={{ __html: item.text ?? '' }}
      />
    </li>
  )
}
