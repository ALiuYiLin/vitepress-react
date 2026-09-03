import siteDataRaw from '@siteData'
import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode
} from 'react'

import type { Router } from './router'
import {
  createTitle,
  notFoundPageData,
  resolveSiteDataByRoute,
  type Route,
  type SiteData,
  type VitePressData
} from '../shared'

// ============================================================================
// 渲染内核的数据 store(迁移 D3-S2:快照 + useSyncExternalStore)
//
// - createApp 每次调用 new 一个 store(SSR 逐页独立,避免并发串扰);
// - store.state 是不可变快照(替换式更新 + emit),组件通过订阅读取;
// - useData()/useRoute() 从 React Context 拿到 store(框架自持,非模块单例)。
// ============================================================================

const APPEARANCE_KEY = 'vitepress-theme-appearance'

export interface VpAppState {
  route: Route
  data: VitePressData
}

export interface VpStore {
  state: VpAppState
  router: Router | null
  subscribe: (fn: () => void) => () => void
  getSnapshot: () => VpAppState
  updateRoute: (route: Route) => void
  setDark: (dark: boolean) => void
}

export function getSiteDataBase(): string {
  return siteDataRaw.base
}

const defaultRoute = (): Route => ({
  path: '/',
  hash: '',
  query: '',
  component: null,
  data: notFoundPageData
})

function initialDark(): boolean {
  const appearance = siteDataRaw.appearance
  if (appearance === 'force-dark' || appearance === 'dark') return true
  if (appearance === 'force-auto' || appearance === false) return false
  if (typeof window === 'undefined') return false
  try {
    const stored = window.localStorage.getItem(APPEARANCE_KEY)
    if (stored === 'dark') return true
    if (stored === 'light') return false
  } catch {
    /* ignore */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function computeData(route: Route, dark: boolean): VitePressData {
  const page = route.data
  const site = resolveSiteDataByRoute(
    siteDataRaw,
    page.relativePath,
    page.filePath
  ) as SiteData & {
    localeIndex?: string
    contentProps?: Record<string, unknown>
    dir?: 'ltr' | 'rtl'
  }
  return {
    site,
    theme: site.themeConfig,
    page,
    frontmatter: page.frontmatter,
    params: page.params,
    title: createTitle(site, page),
    description: page.description || site.description,
    lang: (page.frontmatter as any).lang || site.lang,
    dir: (page.frontmatter as any).dir || site.dir || 'ltr',
    localeIndex: site.localeIndex || 'root',
    isDark: dark
  }
}

export function createStore(): VpStore {
  let dark = false
  // SSR 阶段不做 DOM/系统偏好探测
  if (typeof window !== 'undefined') {
    dark = initialDark()
  }
  const initial = defaultRoute()
  let state: VpAppState = {
    route: initial,
    data: computeData(initial, dark)
  }

  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((fn) => fn())

  const store: VpStore = {
    router: null,
    get state() {
      return state
    },
    subscribe: (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    getSnapshot: () => state,
    updateRoute: (route) => {
      state = { route, data: computeData(route, dark) }
      emit()
    },
    setDark: (value) => {
      dark = value
      state = { route: state.route, data: computeData(state.route, dark) }
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', value)
        try {
          window.localStorage.setItem(APPEARANCE_KEY, value ? 'dark' : 'light')
        } catch {
          /* ignore */
        }
      }
      emit()
    }
  }
  return store
}

// ---------------- React 接入 ----------------

export const VpStoreContext = createContext<VpStore | null>(null)

export function VpStoreProvider({
  store,
  children
}: {
  store: VpStore
  children: ReactNode
}) {
  return (
    <VpStoreContext.Provider value={store}>{children}</VpStoreContext.Provider>
  )
}

function useStore(): VpStore {
  const store = useContext(VpStoreContext)
  if (!store) {
    throw new Error('vitepress store not properly injected in app')
  }
  return store
}

/** 对齐上游 useData():返回当前快照;store 变化时订阅重渲 */
export function useData<T = any>(): VitePressData<T> {
  const store = useStore()
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot // SSR 需要 getServerSnapshot
  )
  return state.data as unknown as VitePressData<T>
}

/** 对齐上游 useRoute() */
export function useRoute(): Route {
  const store = useStore()
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot // SSR 需要 getServerSnapshot
  ).route
}

/** 访问 router(导航等) */
export function useRouter(): Router {
  const store = useStore()
  if (!store.router) {
    throw new Error('router not initialized yet')
  }
  return store.router
}
