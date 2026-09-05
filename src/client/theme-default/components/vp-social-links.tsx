import { VPSocialLink, type VPSocialLinkProps } from './VPSocialLink'
import '../styles/components/vp-social-links.scoped.css'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

export type VpSocialLink = VPSocialLinkProps

/** 社交链接组(ul > li > VPSocialLink,对应 Vue VPSocialLinks.vue) */
export function VPSocialLinks({
  links,
  className
}: {
  links: VpSocialLink[]
  className?: string
}) {
  if (!links.length) return null
  return (
    <ul className={cx('VPSocialLinks', className)}>
      {links.map((l) => (
        <li key={l.link}>
          <VPSocialLink
            icon={l.icon}
            link={l.link}
            ariaLabel={l.ariaLabel}
            target={l.target}
            me
          />
        </li>
      ))}
    </ul>
  )
}
