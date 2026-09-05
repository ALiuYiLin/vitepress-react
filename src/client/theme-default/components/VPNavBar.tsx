import { type ReactNode } from 'react'

import { useWindowScrollY } from './use-window-scroll-y'

import { useLayout } from '../composables/use-layout'
import { useNavOverflow } from '../composables/use-nav-overflow'
import { VPNavAppearance } from './VPNavAppearance'
import { VPNavBarExtra } from './VPNavBarExtra'
import { VPNavBarHamburger } from './VPNavBarHamburger'
import { VPNavBarTitle } from './VPNavBarTitle'
import { VPNavMenu } from './VPNavMenu'
import { VPNavSocialLinks } from './VPNavSocialLinks'
import { VPNavTranslations } from './VPNavTranslations'
import { VPNavBarSearch } from './vp-nav-bar-search'
import './VPNavBar.module.css'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

/**
 * 顶栏主体(对应 Vue VPNavBar.vue):
 * title 列 + content-body(搜索/菜单/语言/外观/社交/溢出/汉堡)。
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
              {contentBefore}
              <VPNavBarSearch className="search" />
              <VPNavMenu className="menu" />
              <VPNavTranslations className="translations" />
              <VPNavAppearance className="appearance" />
              <VPNavSocialLinks className="social-links" />
              <VPNavBarExtra className="extra" />
              {contentAfter}
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
