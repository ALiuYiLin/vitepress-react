import {
  Languages,
  Menu,
  Moon,
  Sun,
  X
} from 'lucide-react'
import { useAppearance, useData, useLocale, useNavigate, useRoute } from 'vitepress'

import { Button } from './components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './components/ui/dropdown-menu'
import { cn } from './lib/utils'
import {
  isNavActive,
  normalizePath,
  type VpNavItem
} from './theme-utils'

export interface TopNavProps {
  mobileOpen: boolean
  onToggleMobile: () => void
}

export function TopNav({ mobileOpen, onToggleMobile }: TopNavProps) {
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
  const currentLocaleLabel =
    (site.locales as Record<string, { label?: string }>)?.[localeIndex]?.label ??
    localeIndex
  const brandTitle =
    cfg.siteTitle === false ? '' : (cfg.siteTitle ?? site.title)
  const logo = typeof cfg.logo === 'string' ? cfg.logo : undefined

  const renderNav = (items: VpNavItem[], mobile = false) =>
    items.map((item) => {
      const link = item.link
      if (!link) return null
      const active = isNavActive(item, currentPath)
      return (
        <a
          key={link ?? item.text}
          href={link}
          onClick={(e) => {
            e.preventDefault()
            navigate(link)
          }}
          className={
            mobile
              ? cn(
                  'block rounded-md px-3 py-2 text-base font-medium transition-colors',
                  active
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )
              : cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )
          }
        >
          {item.text}
        </a>
      )
    })

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        {/* 移动端菜单按钮 */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onToggleMobile}
          aria-label="切换菜单"
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>

        {/* 品牌(左侧) */}
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
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground">
              {brandTitle.slice(0, 1) || 'V'}
            </span>
          )}
          <span className="hidden sm:inline">{brandTitle}</span>
        </a>

        {/* 导航项(桌面):指南 → 参考 … */}
        <nav className="hidden items-center gap-1 lg:flex">
          {renderNav(cfg.nav ?? [])}
        </nav>

        <div className="flex-1" />

        {/* 右端簇:语言 → 外观 */}
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Languages className="size-4" />
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
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </div>
    </header>
  )
}
