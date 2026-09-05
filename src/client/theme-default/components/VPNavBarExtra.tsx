import { useData } from 'vitepress'

import { useLangs } from '../composables/use-langs'
import { useAppearanceSwitch } from '../composables/use-nav'
import { useNavOverflow } from '../composables/use-nav-overflow'
import { VPFlyout } from './VPFlyout'
import { VPMenuGroup } from './VPMenuGroup'
import { VPMenuLink } from './VPMenuLink'
import { VPNavAppearance } from './VPNavAppearance'
import { VPNavTranslations } from './VPNavTranslations'
import { VPSocialLinks, type VpSocialLink } from './vp-social-links'
import { type VpNavMenuGroupItem } from './VPNavMenuGroup'
const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

/**
 * 顶栏 "⋯" 溢出菜单(对应 Vue VPNavBarExtra.vue):
 * 被溢出引擎挤出的导航项 + 语言/外观/社交(当前默认不折叠,hasContent=false 时整体不渲染)。
 */
export function VPNavBarExtra({ className }: { className?: string }) {
  const { theme } = useData()
  const t = theme as {
    nav?: VpNavMenuGroupItem[]
    socialLinks?: VpSocialLink[]
    extraMenuLabel?: string
  }
  const { localeLinks, currentLang } = useLangs()
  const hasAppearanceSwitch = useAppearanceSwitch()
  const overflow = useNavOverflow()

  // 被优先级引擎挤出顶栏的导航项(连续后缀)
  const count = overflow.state.visibleItemCount
  const overflowItems =
    count === Infinity || !t.nav ? [] : t.nav.slice(count)

  const showTranslations =
    Boolean(localeLinks.length && currentLang.label) && !overflow.state.translations
  const showAppearance = hasAppearanceSwitch && !overflow.state.appearance
  const showSocialLinks =
    Boolean(t.socialLinks?.length) && !overflow.state.socialLinks

  const hasContent =
    overflowItems.length > 0 || showTranslations || showAppearance || showSocialLinks

  if (!hasContent) return null

  return (
    <VPFlyout
      className={cx('VPNavBarExtra', className)}
      label={t.extraMenuLabel || 'More options'}
    >
      {overflowItems.length ? (
        <ul className="group overflow-items">
          {overflowItems.map((item) => {
            if (item.link) return <VPMenuLink key={item.text} item={item} />
            if (item.component) return null
            return (
              <VPMenuGroup key={item.text} text={item.text} items={item.items ?? []} />
            )
          })}
        </ul>
      ) : null}

      {showTranslations ? <VPNavTranslations menu /> : null}

      {showAppearance ? (
        <div className="group">
          <VPNavAppearance row />
        </div>
      ) : null}

      {showSocialLinks ? (
        <div className="group">
          <div className="item social-links">
            <VPSocialLinks className="social-links-list" links={t.socialLinks!} />
          </div>
        </div>
      ) : null}
    </VPFlyout>
  )
}
