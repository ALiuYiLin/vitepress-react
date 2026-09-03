import { useRef } from 'react'
import { Content, useAppearance, useData, useLocale, useNavigate } from 'vitepress'

import { resolveHeaders, resolveTitle, useActiveAnchor } from './composables/use-active-anchor'
import { useLangs } from './composables/use-langs'
import { useLayout } from './composables/use-layout'
import { useNav, useNavItemLink } from './composables/use-nav'
import { usePrevNext } from './composables/use-prev-next'
import { useSidebarItemControl } from './composables/use-sidebar'
import { type VpHeader, type VpSidebarItem } from './theme-utils'
import s from './layout.module.css'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

function OutlineItem({ headers }: { headers: VpHeader[] }) {
  return (
    <ul>
      {headers.map((h) => (
        <li key={h.slug}>
          <a className="outline-link" href={`#${h.slug}`}>
            {h.title}
          </a>
          {h.children.length > 0 && <OutlineItem headers={h.children} />}
        </li>
      ))}
    </ul>
  )
}

function SidebarItem({ item }: { item: VpSidebarItem }) {
  const { collapsed, collapsible, isActiveLink, hasChildren, toggleCollapsed } =
    useSidebarItemControl(item)
  const link = item.link
  return (
    <div className={cx(s.sidebarItem, isActiveLink && 'is-active')}>
      {item.text && (
        <div className={s.item}>
          {link ? (
            <a
              className={cx(s.link, 'link')}
              href={link}
              onClick={(e) => {
                e.preventDefault()
                history.pushState(null, '', link)
                window.dispatchEvent(new PopStateEvent('popstate'))
              }}
            >
              <span className="text">{item.text}</span>
            </a>
          ) : (
            <span className="text">{item.text}</span>
          )}
          {collapsible && (
            <button className="caret" onClick={toggleCollapsed} aria-expanded={!collapsed}>
              <span className="vpi-chevron-right caret-icon" />
            </button>
          )}
        </div>
      )}
      {hasChildren && (
        <ul className={s.items} style={collapsed ? { display: 'none' } : undefined}>
          {item.items!.map((child, i) => (
            <li key={i}>
              <SidebarItem item={child} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Layout() {
  const { site, theme, frontmatter } = useData()
  const navigate = useNavigate()
  const { isDark, toggle: toggleDark } = useAppearance()
  const [, setLocale] = useLocale()
  const { isScreenOpen, open, toggle: toggleScreen } = useNav()
  const { sidebarGroups, hasSidebar, hasAside, leftAside, headers, hasLocalNav } =
    useLayout()
  const { prev, next } = usePrevNext()
  const { currentLang, localeLinks } = useLangs()
  const outlineRef = useRef<HTMLDivElement | null>(null)
  const markerRef = useRef<HTMLDivElement | null>(null)
  useActiveAnchor(outlineRef, markerRef)

  const cfg = theme as {
    nav?: { text?: string; link?: string; activeMatch?: string; items?: any[] }[]
    sidebar?: unknown
    outline?: { label?: string }
  }
  const nav = cfg.nav ?? []
  const outlineTitle = resolveTitle(cfg)
  const outlineHeaders = resolveHeaders(
    headers as VpHeader[],
    (cfg.outline as any)?.level === 'deep' ? 6 : 2
  )
  const pageClass = (frontmatter as { pageClass?: string })?.pageClass

  const brandLc = (site.locales as any)?.[0]?.link ?? '/'
  const isDarkFlavor = Boolean(isDark)

  return (
    <div className={cx('Layout', pageClass && pageClass)}>
      {/* 顶栏 */}
      <header className={cx(s.nav, 'VPNav', (isScreenOpen && 'is-screen-open') || '')}>
        <div className={cx(s.navBar, 'VPNavBar', hasSidebar && 'has-sidebar', hasLocalNav && 'has-local-nav')}>
          <div className={s.navBarWrapper}>
            <div className={s.navBarContainer}>
              <div className={cx(s.navBarTitle, 'title' as string)}>
                <a className="title" href={brandLc} onClick={(e) => { e.preventDefault(); navigate('/') }}>
                  <img alt="" className="logo vp-icon" src={((theme as any)?.logo) || undefined} width={24} height={24} />
                  <span>{site.title}</span>
                </a>
              </div>
              <div className={s.navBarContent}>
                <div className={s.menuGroup}>
                  {nav.map((item, i) => (
                    <NavItem key={i} item={item} />
                  ))}
                </div>
              </div>
              <div className={s.navRight}>
                <div className="VPNavTranslations">
                  <button
                    className="button"
                    onClick={() => setLocale(localeLinks[0]?.lang ?? 'zh')}
                    title={currentLang.label}
                  >
                    <span className="text">{currentLang.label}</span>
                  </button>
                </div>
                <div className="VPNavAppearance">
                  <button className="button" onClick={toggleDark} title="切换外观">
                    {isDarkFlavor ? '☀' : '☾'}
                  </button>
                </div>
                <button className={cx(s.hamburger, 'VPNavBarHamburger')} onClick={toggleScreen} aria-label="打开菜单">
                  <span className="vpi-align-left menu-icon" />
                </button>
              </div>
            </div>
          </div>
          <div className="divider"><div className="divider-line" /></div>
        </div>
      </header>

      {/* 本地导航(移动/中屏) */}
      {hasLocalNav && (
        <div className={cx(s.localNav, 'VPLocalNav', hasSidebar && 'has-sidebar')}>
          <div className="menu" onClick={open}>
            <span className="vpi-align-left menu-icon" />
            <span className="menu-text">导航</span>
          </div>
        </div>
      )}

      <div className={cx(s.layout, 'VPContent', hasSidebar && 'has-sidebar', (frontmatter as any)?.layout === 'home' && 'is-home')}>
        {/* 侧栏 */}
        {hasSidebar && (
          <aside className={cx(s.sidebar, 'VPSidebar')}>
            <nav className="nav" id="VPSidebarNav" aria-label="侧栏导航">
              <span className="visually-hidden" id="sidebar-aria-label">侧栏导航</span>
              {sidebarGroups.map((group, gi) => (
                <div key={gi} className={cx(s.sidebarGroup, 'VPSidebarGroup')}>
                  {group.text && <div className={cx(s.groupLabel, 'group-label')}>{group.text}</div>}
                  {group.items.map((item, ii) => (
                    <SidebarItem key={ii} item={item} />
                  ))}
                </div>
              ))}
            </nav>
          </aside>
        )}

        {/* 文档 */}
        <div className={cx(s.content, 'content')}>
          <div className={cx(s.contentContainer, 'content-container', hasAside && 'has-aside')}>
            <main className={cx(s.main, 'main')}>
              <Content />
            </main>
            {(prev || next) && (
              <footer className={cx(s.docFooter, 'VPDocFooter')}>
                <div className="prev-next">
                  <span className="visually-hidden">上一页 / 下一页</span>
                  <div className="pager">
                    {prev && <LinkCard dir="prev" item={prev} />}
                    {next && <LinkCard dir="next" item={next} />}
                  </div>
                </div>
              </footer>
            )}
          </div>

          {/* 页面导航 */}
          {hasAside && outlineHeaders.length > 0 && (
            <aside className={cx(s.aside, 'VPDocAside', leftAside && 'left-aside')}>
              <nav className="VPDocAsideOutline" aria-label="页面导航">
                <div className="content">
                  <div className={s.outlineMarker} ref={markerRef} />
                  <div className="outline-title">{outlineTitle}</div>
                  <div className="outline" ref={outlineRef}>
                    <OutlineItem headers={outlineHeaders} />
                  </div>
                </div>
              </nav>
            </aside>
          )}
        </div>
      </div>

      {/* 页脚 */}
      <footer className={cx(s.footer, 'VPFooter', hasSidebar && 'has-sidebar')}>
        <div className="container">
          {((theme as any)?.footer as any)?.message && <p className="message">{(theme as any).footer.message}</p>}
          {((theme as any)?.footer as any)?.copyright && <p className="copyright">{(theme as any).footer.copyright}</p>}
        </div>
      </footer>
    </div>
  )
}

function NavItem({ item }: { item: any }) {
  const { href, isActiveLink } = useNavItemLink(item)
  if (item.items?.length) {
    return (
      <div className={cx(s.menu, 'VPNavMenuGroup')}>
        <button className={cx(s.menuButton, isActiveLink && 'active')}>
          {item.text}
          <span className="vpi-chevron-down option-icon" />
        </button>
        <div className={s.menuPanel}>
          {item.items.map((sub: any, i: number) => {
            const l = sub.link
            return l ? (
              <a key={i} className="VPFlyoutLink" href={l} onClick={(e) => { e.preventDefault(); history.pushState(null, '', l); window.dispatchEvent(new PopStateEvent('popstate')) }}>
                {sub.text}
              </a>
            ) : (
              <span key={i}>{sub.text}</span>
            )
          })}
        </div>
      </div>
    )
  }
  return (
    <a className={cx(s.menu, 'VPNavMenuLink', isActiveLink && 'active')} href={href} onClick={(e) => { e.preventDefault(); if (href) { history.pushState(null, '', href); window.dispatchEvent(new PopStateEvent('popstate')) } }}>
      {item.text}
    </a>
  )
}

function LinkCard({ dir, item }: { dir: 'prev' | 'next'; item: { text?: string; link?: string } }) {
  const link = item.link
  return (
    <a className={cx(s.pagerLink, 'pager-link', dir)} href={link} onClick={(e) => { e.preventDefault(); if (link) { history.pushState(null, '', link); window.dispatchEvent(new PopStateEvent('popstate')) } }}>
      <span className="desc">{dir === 'prev' ? '上一页' : '下一页'}</span>
      <span className="title">{item.text ?? ''}</span>
    </a>
  )
}
