import '../styles/components/VPSocialLink.scoped.css'
import { VPIcon } from './VPIcon'

const EXTERNAL = /^(https?:|mailto:|tel:)/

export interface VPSocialLinkProps {
  icon: string
  link: string
  ariaLabel?: string
  target?: string
  /** 声明 rel="me"(站主身份,默认开启;第三方嵌页场景可关) */
  me?: boolean
}

/** 社交链接项(icon 为 simple-icons 名或图标类) */
export function VPSocialLink({
  icon,
  link,
  ariaLabel,
  target,
  me
}: VPSocialLinkProps) {
  const external = EXTERNAL.test(link)
  const qualified =
    typeof icon === 'string' && !icon.includes(':') ? `simple-icons:${icon}` : icon
  return (
    <a
      className={cx('link', 'VPSocialLink no-icon')}
      href={link}
      aria-label={ariaLabel ?? (typeof icon === 'string' ? icon : '')}
      target={target ?? (external ? '_blank' : undefined)}
      rel={me === false ? 'noopener' : 'me noopener'}
    >
      <VPIcon icon={qualified} />
    </a>
  )
}

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')
