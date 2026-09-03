// 链接预取:PROD 下(站点默认开启)对 hover/触摸的内部链接提前加载其页面
// 模块,后续导航命中浏览器/模块缓存,跳转即时。
// (DEV 关闭:dev 页面 URL 带时间戳,预取会与 HMR 竞争。)

export function setupLinkPrefetch(
  load: (path: string) => Promise<unknown>,
  enabled: boolean
): () => void {
  if (typeof document === 'undefined' || !enabled) return () => {}

  const onOver = (e: Event) => {
    const target = e.target as Element | null
    const a = target?.closest?.('a[href]') as HTMLAnchorElement | null
    if (!a) return
    if (a.target && a.target !== '_self') return
    if (a.hasAttribute('download')) return
    let url: URL
    try {
      url = new URL(a.href)
    } catch {
      return
    }
    if (url.origin !== window.location.origin) return
    if (url.pathname === window.location.pathname) return
    // 只预取同源 HTML 路径的页面;资源类链接(.png/.pdf/…)跳过
    const path = url.pathname
    if (/\.(css|js|json|png|jpe?g|gif|svg|webp|ico|pdf|zip|woff2?)$/i.test(path)) {
      return
    }
    void load(path)
  }

  document.addEventListener('mouseover', onOver, { passive: true })
  document.addEventListener('touchstart', onOver, { passive: true })
  return () => {
    document.removeEventListener('mouseover', onOver)
    document.removeEventListener('touchstart', onOver)
  }
}
