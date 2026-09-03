import { ChevronDown, Languages, Moon, Sun } from 'lucide-react'
import { useAppearance, useData, useLocale, useNavigate, useRoute } from 'vitepress'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './components/ui/dropdown-menu'
import { SidebarTrigger } from './components/ui/sidebar'
import { Button } from './components/ui/button'
import { isNavActive, normalizePath, type VpNavItem } from './theme-utils'

/** 顶栏(shadcn 原语:侧栏触发器 + 导航下拉 + 语言/外观) */
export function TopNav() {
  const { site, theme, localeIndex } = useData()
  const route = useRoute()
  const navigate = useNavigate()
  const { isDark, toggle: toggleDark } = useAppearance()
  const [, setLocale] = useLocale()

  const cfg = theme as {
    nav?: VpNavItem[]
    logo?: string
    siteTitle?: string | false
  }
  const currentPath = normalizePath(route.path)
  const brandTitle =
    cfg.siteTitle === false ? '' : (cfg.siteTitle ?? site.title)
  const logo = typeof cfg.logo === 'string' ? cfg.logo : undefined
  const currentLocaleLabel = (site.locales as Record<string, { label?: string }>)?.[
    localeIndex
  ]?.label ?? localeIndex

  const nav = cfg.nav ?? []

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur sm:px-6 lg:px-8">
      {/* 侧栏开关(桌面折叠 / 移动端抽屉,由 shadcn Sidebar 处理) */}
      <SidebarTrigger />

      {/* 品牌 */}
      <a
        href="/"
        onClick={(e) => {
          e.preventDefault()
          navigate('/')
        }}
        className="flex shrink-0 items-center gap-2 font-semibold"
      >
        {logo ? (
          <img src={logo} alt="" className="size-6" />
        ) : (
          <span className="flex size-6 items-center justify-center rounded-md bg-primary font-bold text-primary-foreground">
            {brandTitle.slice(0, 1) || 'V'}
          </span>
        )}
        <span className="hidden truncate sm:inline">{brandTitle}</span>
      </a>

      {/* 桌面导航:链接或下拉 */}
      <nav className="hidden items-center gap-1 md:flex">
        {nav.map((item, i) => {
          const link = item.link
          const active = isNavActive(item, currentPath)
          if (item.items?.length) {
            return (
              <DropdownMenu key={i}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    data-active={active}
                  >
                    {item.text}
                    <ChevronDown data-icon="inline-end" className="text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuGroup>
                    {item.items.map((sub, j) =>
                      (sub as VpNavItem).link ? (
                        <DropdownMenuItem
                          key={j}
                          asChild
                          data-active={isNavActive(sub as VpNavItem, currentPath)}
                        >
                          <a
                            href={(sub as VpNavItem).link}
                            onClick={(e) => {
                              e.preventDefault()
                              navigate((sub as VpNavItem).link!)
                            }}
                          >
                            {(sub as VpNavItem).text}
                          </a>
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem key={j} asChild>
                          <span>{(sub as VpNavItem).text}</span>
                        </DropdownMenuItem>
                      )
                    )}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )
          }
          if (!link) return null
          return (
            <Button
              key={i}
              variant="ghost"
              size="sm"
              asChild
              data-active={active}
            >
              <a
                href={link}
                onClick={(e) => {
                  e.preventDefault()
                  navigate(link)
                }}
              >
                {item.text}
              </a>
            </Button>
          )
        })}
      </nav>

      <div className="flex-1" />

      {/* 右端簇:语言 → 外观 */}
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5">
              <Languages />
              <span className="max-w-24 truncate">{currentLocaleLabel}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>语言 / Language</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={localeIndex}
              onValueChange={(v: string) => setLocale(v)}
            >
              {Object.entries(site.locales as Record<string, { label?: string }>).map(
                ([key, loc]) => (
                  <DropdownMenuRadioItem key={key} value={key}>
                    {loc.label}
                  </DropdownMenuRadioItem>
                )
              )}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleDark}
          aria-label="切换外观"
        >
          {isDark ? <Sun /> : <Moon />}
        </Button>
      </div>
    </header>
  )
}
