import { useEffect, type ReactNode } from 'react'
import { inBrowser, useData } from 'vitepress'

import { NavContext } from '../nav-context'
import { useNav } from '../composables/use-nav'
import { VPNavBar } from './VPNavBar'
import { VPNavScreen } from './VPNavScreen'
import './VPNav.module.css'

/**
 * 导航(对应 Vue VPNav.vue):顶栏 + 移动端全屏导航,
 * 拥有屏幕开合状态,并向子树提供 closeScreen。
 */
export function VPNav({
  contentBefore,
  contentAfter,
  screenBefore,
  screenAfter
}: {
  contentBefore?: ReactNode
  contentAfter?: ReactNode
  screenBefore?: ReactNode
  screenAfter?: ReactNode
}) {
  const { isScreenOpen, toggle, close } = useNav()
  const { frontmatter } = useData()
  const fm = frontmatter as { navbar?: boolean }
  const hasNavbar = fm.navbar !== false

  // frontmatter.navbar:false → 隐藏导航(html.hide-nav 供 CSS 调整)
  useEffect(() => {
    if (inBrowser) {
      document.documentElement.classList.toggle('hide-nav', !hasNavbar)
    }
  }, [hasNavbar])

  if (!hasNavbar) return null

  return (
    <NavContext.Provider value={{ closeScreen: close }}>
      <header className="VPNav">
        <VPNavBar
          isScreenOpen={isScreenOpen}
          onToggleScreen={toggle}
          contentBefore={contentBefore}
          contentAfter={contentAfter}
        />
        <VPNavScreen
          open={isScreenOpen}
          before={screenBefore}
          after={screenAfter}
        />
      </header>
    </NavContext.Provider>
  )
}
