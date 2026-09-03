import { Languages, Menu, Moon, Sun, X } from 'lucide-react'
import { Button } from '../components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../components/ui/dropdown-menu'
import { cn } from '../lib/utils'
import {
  isNavActive,
  site,
  normalizePath,
  type VpNavItem
} from '../lib/vp-data'
import {
  useAppearance,
  useData,
  useLocale,
  useNavigate,
  useRoute
} from '../lib/vp-store'

export interface TopNavProps {
  mobileOpen: boolean
  onToggleMobile: () => void
}

export function TopNav({ mobileOpen, onToggleMobile }: TopNavProps) {
  const { site: resolvedSite, theme, localeIndex } = useData()
  const route = useRoute()
  const navigate = useNavigate()
  const [isDark, toggleDark] = useAppearance()
  const [, setLocale] = useLocale()

  const currentPath = normalizePath(route.path)
  const currentLocaleLabel =
    resolvedSite.locales[localeIndex]?.label ??
    site.locales.root?.label ??
    localeIndex

  const renderNav = (items: VpNavItem[], mobile = false) =>
    items.map((item) => {
      const active = isNavActive(item, currentPath)
      return (
        <a
          key={item.link}
          href={item.link}
          onClick={(e) => {
            e.preventDefault()
            navigate(item.link)
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
          href="/guide/"
          onClick={(e) => {
            e.preventDefault()
            navigate('/guide/')
          }}
          className="flex shrink-0 items-center gap-2 font-semibold"
        >
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground">
            V
          </span>
          <span className="hidden sm:inline">VitePress-React</span>
        </a>

        {/* 导航项(桌面):指南 → 参考 … */}
        <nav className="hidden items-center gap-1 lg:flex">
          {renderNav(theme.nav)}
        </nav>

        <div className="flex-1" />

        {/* 右端簇:语言 → 外观 →(移动端菜单占位) */}
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
                onValueChange={(v) => setLocale(v)}
              >
                {Object.entries(resolvedSite.locales).map(([key, loc]) => (
                  <DropdownMenuRadioItem key={key} value={key}>
                    {loc.label}
                  </DropdownMenuRadioItem>
                ))}
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
