import { useData } from 'vitepress'

import { useNavOverflow } from '../composables/use-nav-overflow'
import { VPSocialLinks, type VpSocialLink } from './vp-social-links'
const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

/**
 * 顶栏/屏幕社交链接(对应 Vue VPNavSocialLinks.vue):
 * 顶栏内联参与溢出引擎;屏幕内为整行展示。
 */
export function VPNavSocialLinks({
  screen,
  className
}: {
  screen?: boolean
  className?: string
}) {
  const { theme } = useData()
  const socialLinks = (theme as { socialLinks?: VpSocialLink[] }).socialLinks
  const overflow = screen ? null : useNavOverflow()
  const isCollapsed = Boolean(overflow) && !overflow!.state.socialLinks

  if (!socialLinks?.length) return null

  return (
    <VPSocialLinks
      links={socialLinks}
      className={cx(
        'VPNavSocialLinks',
        screen ? 'VPNavScreenSocialLinks' : 'VPNavBarSocialLinks',
        isCollapsed && 'collapsed',
        className
      )}
    />
  )
}
