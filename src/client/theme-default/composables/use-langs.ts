import { useData } from 'vitepress'

/** 语言切换链接(排除当前 locale),可选跳转对应页 */
export function useLangs() {
  const { site, localeIndex } = useData()
  const locales = (site.locales ?? {}) as Record<
    string,
    { label?: string; link?: string; lang?: string; dir?: string }
  >
  const currentLang = locales[localeIndex] ?? { label: localeIndex }
  const localeLinks = Object.entries(locales)
    .filter(([key]) => key !== localeIndex)
    .map(([key, loc]) => ({
      text: loc.label ?? key,
      link: loc.link ?? (key === 'root' ? '/' : `/${key}/`),
      lang: loc.lang ?? key,
      dir: loc.dir
    }))
  return { currentLang, localeLinks }
}
