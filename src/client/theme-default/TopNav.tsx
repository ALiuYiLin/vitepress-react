import { useAppearance, useData, useRoute } from 'vitepress'

import { isExternal, normalizePath } from './theme-utils'
import type { NavItem } from './theme-utils'

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  )
}

function NavItemLink({
  item,
  routePath
}: {
  item: NavItem
  routePath: string
}) {
  if (!item.link) return null
  const active =
    normalizePath(routePath) === normalizePath(item.link) ||
    (item.activeMatch ? new RegExp(item.activeMatch).test(routePath) : false)
  const cls = `vp-nav-link${active ? ' active' : ''}`
  if (isExternal(item.link)) {
    return (
      <a className={cls} href={item.link} target="_blank" rel="noopener">
        {item.text}
      </a>
    )
  }
  return (
    <a className={cls} href={item.link}>
      {item.text}
    </a>
  )
}

/** 顶部导航栏(品牌 + 桌面 nav + 语言/外观 + 移动菜单按钮) */
export function TopNav({ onMenu }: { onMenu?: () => void }) {
  const { site, theme } = useData()
  const route = useRoute()
  const { isDark, toggle } = useAppearance()
  const cfg = theme as {
    nav?: NavItem[]
    siteTitle?: string | false
    logo?: string
    darkModeSwitchLabel?: string
  }
  const appearance = (site as any).appearance as
    | boolean
    | 'dark'
    | 'force-dark'
    | 'force-auto'
    | undefined

  // 品牌:logo 为字符串时显示图片,否则站点标题(可被 themeConfig.siteTitle 覆盖/关闭)
  const brandTitle =
    cfg.siteTitle === false ? '' : (cfg.siteTitle ?? site.title)
  const logo = typeof cfg.logo === 'string' ? cfg.logo : undefined

  // 语言菜单:site.locales 除 root 之外的语言
  const locales = (site.locales ?? {}) as Record<
    string,
    { label?: string } | undefined
  >
  const langKeys = Object.keys(locales).filter((k) => k !== 'root')
  const showLang = langKeys.length > 0
  const currentLangLabel =
    site.localeIndex && site.localeIndex !== 'root'
      ? locales[site.localeIndex]?.label || site.localeIndex
      : undefined

  const showAppearance = appearance !== false

  const nav = cfg.nav ?? []
  const routePath = route.path

  return (
    <header className="vp-header">
      <div className="vp-header-inner">
        <a className="vp-brand" href="/">
          {logo ? <img src={logo} alt="" /> : null}
          {brandTitle}
        </a>

        {nav.length ? (
          <nav className="vp-nav" aria-label="Main Navigation">
            {nav.map((item, i) =>
              item.items?.length ? (
                <div key={i} className="vp-nav-item">
                  <a className="vp-nav-link" href="#">
                    {item.text ?? ''} ▾
                  </a>
                  <div className="vp-nav-dropdown">
                    {item.items.map((sub, j) =>
                      sub.items?.length ? (
                        // 二级分组下拉中仅渲染可点项
                        <span key={j}>
                          {sub.items.map((leaf, k) => (
                            <NavItemLink key={k} item={leaf} routePath={routePath} />
                          ))}
                        </span>
                      ) : (
                        <NavItemLink key={j} item={sub as NavItem} routePath={routePath} />
                      )
                    )}
                  </div>
                </div>
              ) : (
                <NavItemLink key={i} item={item} routePath={routePath} />
              )
            )}
          </nav>
        ) : null}

        <div className="vp-header-actions">
          {showLang ? (
            <div className="vp-nav-item">
              <button className="vp-icon-btn" aria-label="Change language">
                {currentLangLabel ?? '🌐'}
              </button>
              <div className="vp-nav-dropdown" style={{ right: 0, left: 'auto' }}>
                {langKeys.map((key) => (
                  <a key={key} href={`/${key}/`}>
                    {locales[key]?.label || key}
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          {showAppearance ? (
            <button
              type="button"
              className="vp-icon-btn"
              aria-label={cfg.darkModeSwitchLabel ?? (isDark ? 'Switch to light theme' : 'Switch to dark theme')}
              onClick={() => toggle()}
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
          ) : null}

          <button
            type="button"
            className="vp-icon-btn vp-hamburger"
            aria-label="Menu"
            onClick={() => onMenu?.()}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}
