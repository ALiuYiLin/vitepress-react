import s from './vp-social-links.module.css'

export type VpSocialLink = {
  icon?: string
  link?: string
}

/** 顶栏社交链接(theme.socialLinks) */
export function VPSocialLinks({ links }: { links: VpSocialLink[] }) {
  if (!links.length) return null
  return (
    <div className="VPSocialLinks">
      <div className={s.list}>
        {links.map((l, i) => (
          <a
            key={i}
            className={s.link}
            href={l.link}
            target="_blank"
            rel="noreferrer"
            title={(l.icon || '').replace(/-/g, ' ')}
          >
            {l.icon ? l.icon.replace(/^[a-z]/, (c) => c.toUpperCase()) : 'L'}
          </a>
        ))}
      </div>
    </div>
  )
}
