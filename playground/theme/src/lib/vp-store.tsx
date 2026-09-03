// ============================================================================
// DataProvider + useData / useRoute / useAppearance —— mock 版数据注入
//
// 语义对齐迁移计划 D3-S2(快照 + 订阅):每次路由/外观/语言变化都产生一份新
// 快照,消费方直接读值。接入真实框架时,本文件整体替换为框架注入(模块只依赖
// 自身声明的 hook,主题组件无需改动)。
// ============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'

import {
  defaultPath,
  getPage,
  normalizePath,
  site,
  type VpPageData,
  type VpSiteData
} from './vp-data'

export interface VpRouteState {
  path: string
  hash: string
  query: string
  data: VpPageData
}

/** 对齐上游 VitePressData(快照形态,非 Ref) */
export interface VpDataSnapshot {
  site: VpSiteData & { localeIndex: string }
  theme: VpSiteData['themeConfig']
  page: VpPageData
  frontmatter: VpPageData['frontmatter']
  params: Record<string, unknown> | undefined
  title: string
  description: string
  lang: string
  dir: 'ltr' | 'rtl'
  localeIndex: string
  isDark: boolean
}

interface VpContextValue {
  data: VpDataSnapshot
  route: VpRouteState
  navigate: (to: string) => void
  setLocale: (key: string) => void
  toggleDark: () => void
}

const VpContext = createContext<VpContextValue | null>(null)

const APPEARANCE_KEY = 'vitepress-theme-appearance'

function readStoredDark(): boolean {
  try {
    const stored = localStorage.getItem(APPEARANCE_KEY)
    if (stored === 'dark') return true
    if (stored === 'light') return false
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return false
}

function initialPath(): string {
  const p = typeof window !== 'undefined' ? window.location.pathname : defaultPath
  const page = getPage(p)
  return page.path // 规范化到已知页面;404 兜底
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState<string>(() => initialPath())
  const [localeIndex, setLocaleIndex] = useState<string>('root')
  const [isDark, setIsDark] = useState<boolean>(() => readStoredDark())

  const navigate = useCallback((to: string) => {
    const next = getPage(to).path
    setPath(next)
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', next)
      window.scrollTo({ top: 0 })
    }
  }, [])

  const setLocale = useCallback((key: string) => {
    setLocaleIndex(key)
  }, [])

  const toggleDark = useCallback(() => {
    setIsDark((v) => !v)
  }, [])

  // 历史前进/后退
  useEffect(() => {
    const onPop = () => setPath(getPage(window.location.pathname).path)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // 暗色:同步 <html> class 与 localStorage
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    try {
      localStorage.setItem(APPEARANCE_KEY, isDark ? 'dark' : 'light')
    } catch {
      /* ignore */
    }
  }, [isDark])

  // 语言:同步 <html lang/dir>
  const resolved = useMemo(() => {
    const locale =
      site.locales[localeIndex] ?? site.locales.root ?? site.locales.zh
    return { lang: locale.lang, dir: (locale.dir ?? 'ltr') as 'ltr' | 'rtl' }
  }, [localeIndex])

  useEffect(() => {
    document.documentElement.lang = resolved.lang
    document.documentElement.dir = resolved.dir
  }, [resolved])

  const route = useMemo<VpRouteState>(() => {
    const data = getPage(path)
    return { path: normalizePath(path), hash: '', query: '', data }
  }, [path])

  const data = useMemo<VpDataSnapshot>(() => {
    const page = route.data
    const localeCfg = site.locales[localeIndex]
    const title =
      page.title && page.title !== site.title
        ? `${page.title} · ${site.title}`
        : site.title
    return {
      site: {
        ...site,
        localeIndex,
        lang: localeCfg?.lang ?? site.lang,
        dir: (localeCfg?.dir ?? site.dir) as 'ltr' | 'rtl'
      },
      theme: site.themeConfig,
      page,
      frontmatter: page.frontmatter,
      params: undefined,
      title,
      description: page.description || site.description,
      lang: localeCfg?.lang ?? site.lang,
      dir: (localeCfg?.dir ?? site.dir) as 'ltr' | 'rtl',
      localeIndex,
      isDark
    }
  }, [route.data, localeIndex, isDark])

  const value = useMemo<VpContextValue>(
    () => ({ data, route, navigate, setLocale, toggleDark }),
    [data, route, navigate, setLocale, toggleDark]
  )

  return <VpContext.Provider value={value}>{children}</VpContext.Provider>
}

function useVp(): VpContextValue {
  const ctx = useContext(VpContext)
  if (!ctx) throw new Error('useData/useRoute 必须在 <DataProvider> 内使用')
  return ctx
}

/** 对齐上游 useData():site/theme/page/frontmatter/title/isDark 等快照 */
export function useData(): VpDataSnapshot {
  return useVp().data
}

/** 对齐上游 useRoute() */
export function useRoute(): VpRouteState {
  return useVp().route
}

/** 导航(SPA 语义,自动滚动到顶) */
export function useNavigate() {
  return useVp().navigate
}

/** 外观(暗色/亮色)与切换 */
export function useAppearance(): [boolean, () => void] {
  const { data, toggleDark } = useVp()
  return [data.isDark, toggleDark]
}

/** 语言切换 */
export function useLocale() {
  const { data, setLocale } = useVp()
  return [data.localeIndex, setLocale] as const
}
