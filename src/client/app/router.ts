import type { ComponentType } from 'react'

import { inBrowser, withBase } from './utils'
import type { VpStore } from './data'
import {
  notFoundPageData,
  treatAsHtml,
  type Awaitable,
  type PageData,
  type Route
} from '../shared'

export type { Route } from '../shared'

const fakeHost = 'http://a.com'

export interface PageModule {
  __pageData: PageData
  default: ComponentType
}

export interface Router {
  /**
   * Current route.
   */
  route: Route
  /**
   * Navigate to a new URL.
   */
  go: (
    to: string,
    options?: { initialLoad?: boolean; replace?: boolean }
  ) => Promise<void>
  onBeforeRouteChange?: (to: string) => Awaitable<void | boolean>
  onBeforePageLoad?: (to: string) => Awaitable<void | boolean>
  onAfterRouteChange?: (to: string) => Awaitable<void>
}

export function createRouter(
  loadPageModule: (path: string) => Awaitable<PageModule | null>,
  store: VpStore,
  fallbackComponent?: ComponentType
): Router {
  const router: Router = {
    get route() {
      return store.state.route
    },
    async go(href, options) {
      if ((await router.onBeforeRouteChange?.(href)) === false) return
      // 首帧(initialLoad)时 store 还停在默认 notFound 路由;即使 URL 与
      // 初始 route.path 相同也要真正加载页面模块,否则 Content 会以 404
      // 文本水合(见 M0 调试:changeRoute 同路径短路导致页面从未加载)
      const changed = inBrowser
        ? await changeRoute(href, { replace: options?.replace ?? false })
        : true
      if (changed || options?.initialLoad) {
        await loadPage(href, { initialLoad: options?.initialLoad })
      }
      await router.onAfterRouteChange?.(href)
    }
  }

  async function loadPage(
    href: string,
    { initialLoad = false }: { initialLoad?: boolean } = {}
  ) {
    if ((await router.onBeforePageLoad?.(href)) === false) return
    const targetLoc = new URL(href, fakeHost)

    try {
      let page: PageModule | null = null
      // 在浏览器里(dev/prod)动态 import 页面 chunk;SSR 阶段由 app/index.tsx
      // 传入的 loadPageModule 基于相同换算规则读取产物模块
      page = await loadPageModule(targetLoc.pathname)
      if (!page) throw new Error(`Page not found: ${targetLoc.pathname}`)

      const { default: comp, __pageData } = page
      store.updateRoute({
        path: inBrowser ? targetLoc.pathname : withBase(targetLoc.pathname),
        hash: targetLoc.hash,
        query: targetLoc.search,
        component: comp,
        data: __pageData ?? notFoundPageData
      })
    } catch (e) {
      // SSR 阶段(默认 404 页等)缺失 chunk 属预期,不打印;仅在浏览器调试时提示
      if (import.meta.env.DEV) {
        console.error('[vitepress] failed to load page:', href, e)
      }
      store.updateRoute({
        path: targetLoc.pathname,
        hash: targetLoc.hash,
        query: targetLoc.search,
        component: fallbackComponent ?? null,
        data: notFoundPageData
      })
    }

    // 滚动处理
    if (inBrowser) {
      scrollToRoute(targetLoc)
    }
    if (!initialLoad && inBrowser) {
      // trigger a re-render of anything listening on hash changes
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    }
  }

  function scrollToRoute(target: URL) {
    if (target.hash) {
      const el = document.getElementById(
        decodeURIComponent(target.hash.slice(1))
      )
      if (el) {
        el.scrollIntoView()
        return
      }
    }
    window.scrollTo(0, 0)
  }

  async function changeRoute(
    to: string,
    { replace }: { replace: boolean }
  ): Promise<boolean> {
    const nextUrl = new URL(to, fakeHost)
    const currentUrl = new URL(window.location.href)

    if (nextUrl.pathname === currentUrl.pathname) {
      if (nextUrl.hash !== currentUrl.hash) {
        history.replaceState({}, '', to)
        const el = document.getElementById(
          decodeURIComponent(nextUrl.hash.slice(1))
        )
        el?.scrollIntoView()
      }
      return false
    }

    if (replace) {
      history.replaceState({}, '', to)
    } else {
      history.pushState({}, '', to)
    }
    return true
  }

  if (inBrowser) {
    // capture-phase click interception for internal links
    document.addEventListener(
      'click',
      (e) => {
        const link = (e.target as Element | null)?.closest?.('a')
        if (!link) return
        if (link.target && link.target !== '_self') return
        if (link.hasAttribute('download')) return
        const href = link.getAttribute('href')
        if (!href) return

        let url: URL
        try {
          url = new URL(link.href)
        } catch {
          return
        }
        if (url.origin !== window.location.origin) return
        const p = url.pathname
        // 站内资源(.md/.html 之外的真实页面路径)才拦截;跳过会按静态资源
        // 请求的扩展名
        if (!treatAsHtml(p) && !/\/$/.test(p) && !/\.(md|html)$/.test(p)) {
          return
        }
        e.preventDefault()
        void router.go(url.pathname + url.search + url.hash)
      },
      true
    )

    window.addEventListener('popstate', () => {
      const { pathname, search, hash } = window.location
      void router.go(pathname + search + hash, { replace: true })
    })
  }

  return router
}
