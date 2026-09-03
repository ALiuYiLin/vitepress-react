import { useNavItemLink } from '../composables/use-nav'
import type { VpNavItem } from '../theme-utils'

import s from './VPMenuLink.module.css'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

export interface VPMenuLinkProps {
  item: VpNavItem
  rel?: string
}

/** 下拉/菜单中的链接项 */
export function VPMenuLink({ item, rel }: VPMenuLinkProps) {
  const { href, isActiveLink, isCurrentLink } = useNavItemLink(item)
  const link = item.link
  return (
    <li className="VPMenuLink">
      <a
        className={cx(s.link, isActiveLink && s.active)}
        href={link ?? href}
        aria-current={isCurrentLink ? 'page' : undefined}
        target={(item as { target?: string }).target}
        rel={rel ?? (item as { rel?: string }).rel}
        dangerouslySetInnerHTML={{ __html: item.text ?? '' }}
      />
    </li>
  )
}
