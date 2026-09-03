import { useData, useRoute } from 'vitepress'

type VpLocale = {
  label?: string
  link?: string
  lang?: string
  dir?: string
}

export type VpLocaleLink = {
  text: string
  link: string
  lang?: string
  dir?: string
}

/**
 * 语言切换(对齐 Vue composables/langs.ts):
 * - linkToCorrespondingPage=true 时,把当前页路径改写到目标语言(如
 *   /zh/guide/markdown ↔ /guide/markdown),而不是跳到目标语言首页;
 * - themeConfig.i18nRouting === false 时退化为首页链接。
 */
export function useLangs({
  linkToCorrespondingPage = false
}: {
  linkToCorrespondingPage?: boolean
} = {}): {
  currentLang: { label?: string; link: string }
  localeLinks: VpLocaleLink[]
} {
  const { site, localeIndex, theme } = useData()
  const route = useRoute()

  const locales = (site.locales ?? {}) as Record<string, VpLocale>
  const currentLabel = locales[localeIndex]?.label
  const currentLocaleLink =
    locales[localeIndex]?.link ||
    (localeIndex === 'root' ? '/' : `/${localeIndex}/`)

  const currentLang = { label: currentLabel, link: currentLocaleLink }

  const i18nRouting = (theme as { i18nRouting?: unknown })?.i18nRouting
  const path = route.path

  const localeLinks: VpLocaleLink[] = Object.entries(locales).flatMap(
    ([key, loc]) => {
      const label = loc.label
      // 同一语言(按 label)不重复列出
      if (!label || label === currentLabel) return []
      const home = loc.link || (key === 'root' ? '/' : `/${key}/`)
      return [
        {
          text: label,
          link: resolveLocaleLink(path, {
            targetLocaleLink: home,
            currentLocaleLink,
            linkToCorrespondingPage:
              linkToCorrespondingPage && i18nRouting !== false
          }),
          lang: loc.lang,
          dir: loc.dir
        }
      ]
    }
  )

  return { currentLang, localeLinks }
}

/** 把当前页面 URL 改写到目标语言(保持 cleanUrls 形态,继承 query/hash 由链接自然携带) */
function resolveLocaleLink(
  path: string,
  {
    targetLocaleLink,
    currentLocaleLink,
    linkToCorrespondingPage
  }: {
    targetLocaleLink: string
    currentLocaleLink: string
    linkToCorrespondingPage: boolean
  }
): string {
  if (!linkToCorrespondingPage) return targetLocaleLink

  // 从当前 URL 里剥离本语言前缀,得到相对页面路径
  const prefix = currentLocaleLink.replace(/\/$/, '')
  let suffix = ''
  if (prefix && prefix !== '' && path.startsWith(prefix)) {
    suffix = path.slice(prefix.length)
  } else if (!prefix || path.startsWith('/')) {
    suffix = path
  }
  if (suffix && !suffix.startsWith('/')) suffix = `/${suffix}`

  const target = targetLocaleLink.replace(/\/$/, '')
  // '/' 根或空后缀 → 首页(去掉多余斜杠)
  if (!suffix || suffix === '/') return target ? `${target}/` : '/'
  return `${target}${suffix}`
}
