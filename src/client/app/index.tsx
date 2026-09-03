import { StrictMode, useEffect, type ReactElement } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'

import RawTheme from '@theme/index'
import { VpStoreProvider, createStore, useData, type VpStore } from './data'
import { createRouter, type Router } from './router'
import { Content } from './components/Content'
import { syncHead } from './composables/head'
import { inBrowser, pathToFile } from './utils'
import type { PageModule } from './router'

function resolveThemeExtends(theme: typeof RawTheme): typeof RawTheme {
  if (theme.extends) {
    const base = resolveThemeExtends(theme.extends)
    return {
      ...base,
      ...theme,
      async enhanceApp(ctx) {
        await base.enhanceApp?.(ctx)
        await theme.enhanceApp?.(ctx)
      }
    }
  }
  return theme
}

const Theme = resolveThemeExtends(RawTheme)

/** 根组件:数据来自 store 快照;只负责组装主题 Layout */
export function VitePressApp() {
  const data = useData()

  // 文档级属性 + head 同步(SSR 阶段也安全:仅浏览器分支写入;
  // data 是快照对象,导航/外观变化都会生成新引用触发本 effect)
  useEffect(() => {
    if (!inBrowser) return
    document.documentElement.lang = data.lang
    document.documentElement.dir = data.dir
    document.documentElement.classList.toggle('dark', data.isDark)
    syncHead(data)
  }, [data])

  useEffect(() => {
    if (!inBrowser) return
    Theme.setup?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const Layout = Theme.Layout
  return Layout ? <Layout /> : <Content />
}

export interface CreatedApp {
  store: VpStore
  router: Router
  element: ReactElement
}

export async function createApp(): Promise<CreatedApp> {
  ;(globalThis as any).__VITEPRESS__ = true

  const store = createStore()
  const router = createRouter(loadPageModule(), store, Theme.NotFound)
  store.router = router

  if (Theme.enhanceApp) {
    const siteData = store.state.data.site
    await Theme.enhanceApp({ router, siteData })
  }

  const element = (
    <StrictMode>
      <VpStoreProvider store={store}>
        <VitePressApp />
      </VpStoreProvider>
    </StrictMode>
  )

  return { store, router, element }
}

function loadPageModule(): (path: string) => Promise<PageModule | null> {
  return async (path) => {
    const pageFilePath = pathToFile(path)
    let pageModule: PageModule | null = null

    if (pageFilePath) {
      if (import.meta.env.DEV) {
        pageModule = await import(/*@vite-ignore*/ pageFilePath).catch((e) => {
          // page load could fail for other reasons, don't swallow
          console.error(e)
          // try with/without trailing slash
          const url = new URL(pageFilePath!, 'http://a.com')
          const retry =
            (url.pathname.endsWith('/index.md')
              ? url.pathname.slice(0, -9) + '.md'
              : url.pathname.slice(0, -3) + '/index.md') +
            url.search +
            url.hash
          return import(/*@vite-ignore*/ retry)
        })
      } else {
        pageModule = await import(/*@vite-ignore*/ pageFilePath)
      }
    }

    return pageModule
  }
}

if (inBrowser) {
  createApp().then(async ({ store, router, element }) => {
    const container = document.getElementById('app')
    if (!container) throw new Error('no #app container found')

    // 同步初始外观(避免水合前闪动)
    document.documentElement.classList.toggle('dark', store.state.data.isDark)

    // wait until page component is fetched before mounting
    await router.go(location.href, { initialLoad: true })

    // 默认 404 页(无自定义 404.md)的 HTML 不预渲染内容,#app 为空——
    // 对空容器必须用 createRoot 而非 hydrateRoot,否则会因空 vs 内容
    // 的差异产生 hydration mismatch(React 水合无法恢复)。
    const hasSsrContent = container.firstChild != null
    if (import.meta.env.PROD && hasSsrContent) {
      hydrateRoot(container, element)
    } else {
      createRoot(container).render(element)
    }
  })
}
