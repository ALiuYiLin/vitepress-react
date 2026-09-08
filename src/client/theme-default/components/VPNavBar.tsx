import { type ReactNode } from 'react'

import { useWindowScrollY } from './use-window-scroll-y'

import { useThemeComponent } from '../composables/use-theme-component'
import { useLayout } from '../composables/use-layout'
import { useNavOverflow } from '../composables/use-nav-overflow'
import { useLayoutSlot } from '../layout-slots'
import { VPNavAppearance as VPNavAppearanceDefault } from './VPNavAppearance'
import { VPNavBarExtra as VPNavBarExtraDefault } from './VPNavBarExtra'
import { VPNavBarHamburger as VPNavBarHamburgerDefault } from './VPNavBarHamburger'
import { VPNavBarTitle as VPNavBarTitleDefault } from './VPNavBarTitle'
import { VPNavMenu as VPNavMenuDefault } from './VPNavMenu'
import { VPNavSocialLinks as VPNavSocialLinksDefault } from './VPNavSocialLinks'
import { VPNavTranslations as VPNavTranslationsDefault } from './VPNavTranslations'
import { VPNavBarSearch as VPNavBarSearchDefault } from './vp-nav-bar-search'
const cx = (...c: (string | false | undefined | null)[]) =>
  c.filter(Boolean).join(' ')

/**
 * 顶栏主体(对应 Vue VPNavBar.vue):
 * title 列 + content-body(搜索/菜单/语言/外观/社交/溢出/汉堡)。
 * 插槽挂载点:navBarContentBefore/After(content-body 前后)。
 */
export function VPNavBar({
  isScreenOpen,
  onToggleScreen,
  titleBefore,
  titleAfter,
  contentBefore,
  contentAfter
}: {
  isScreenOpen: boolean
  onToggleScreen: () => void
  titleBefore?: ReactNode
  titleAfter?: ReactNode
  contentBefore?: ReactNode
  contentAfter?: ReactNode
}) {
  const { isHome, hasSidebar, hasLocalNav } = useLayout()
  const isTop = useWindowScrollY() <= 0
  const overflow = useNavOverflow()

  // 内部子组件:可被 Theme.components 覆盖(默认兜底)
  const VPNavBarTitle = useThemeComponent('VPNavBarTitle', VPNavBarTitleDefault)
  const VPNavBarSearch = useThemeComponent(
    'VPNavBarSearch',
    VPNavBarSearchDefault
  )
  const VPNavMenu = useThemeComponent('VPNavMenu', VPNavMenuDefault)
  const VPNavTranslations = useThemeComponent(
    'VPNavTranslations',
    VPNavTranslationsDefault
  )
  const VPNavAppearance = useThemeComponent(
    'VPNavAppearance',
    VPNavAppearanceDefault
  )
  const VPNavSocialLinks = useThemeComponent(
    'VPNavSocialLinks',
    VPNavSocialLinksDefault
  )
  const VPNavBarExtra = useThemeComponent('VPNavBarExtra', VPNavBarExtraDefault)
  const VPNavBarHamburger = useThemeComponent(
    'VPNavBarHamburger',
    VPNavBarHamburgerDefault
  )

  // 具名插槽(content-body 前后;fallback 兼容旧 prop 通道)
  const slotContentBefore = useLayoutSlot('navBarContentBefore', contentBefore)
  const slotContentAfter = useLayoutSlot('navBarContentAfter', contentAfter)

  return (
    <div
      className={cx(
        'VPNavBar',
        hasSidebar && 'has-sidebar',
        !isHome && hasLocalNav && 'has-local-nav',
        isHome && 'home',
        isTop && 'top',
        isScreenOpen && 'screen-open'
      )}
    >
      <div className="wrapper">
        <div className="container">
          <div className="title">
            <VPNavBarTitle titleBefore={titleBefore} titleAfter={titleAfter} />
          </div>

          <div className="content">
            <div
              className="content-body"
              ref={(el) => overflow.setContainerEl(el as HTMLElement | null)}
            >
              {slotContentBefore}
              <VPNavBarSearch className="search" />
              <VPNavMenu className="menu" />
              <VPNavTranslations className="translations" />
              <VPNavAppearance className="appearance" />
              <VPNavSocialLinks className="social-links" />
              <VPNavBarExtra className="extra" />
              {slotContentAfter}
              <VPNavBarHamburger
                className="hamburger"
                active={isScreenOpen}
                onClick={onToggleScreen}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="divider">
        <div className="divider-line" />
      </div>
    </div>
  )
}
