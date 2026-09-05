import { useData } from 'vitepress'

import { useLangs } from '../composables/use-langs'
import { useLayout } from '../composables/use-layout'
import { normalizeLink } from '../support/utils'
import '../styles/components/VPNavBarTitle.scoped.css'
import { VPImage } from './VPImage'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

/**
 * 顶栏站点标题(对应 Vue VPNavBarTitle.vue):logo + siteTitle,
 * logoLink 可配置(字符串或 { link, rel, target })。
 */
export function VPNavBarTitle({
  titleBefore,
  titleAfter
}: {
  titleBefore?: React.ReactNode
  titleAfter?: React.ReactNode
}) {
  const { site, theme } = useData()
  const { hasSidebar } = useLayout()
  const { currentLang } = useLangs()
  const t = theme as {
    logo?: unknown
    logoLink?: string | { link?: string; rel?: string; target?: string }
    siteTitle?: string | false
  }

  const logoLink =
    typeof t.logoLink === 'string'
      ? t.logoLink
      : (t.logoLink as { link?: string } | undefined)?.link
  const rel =
    typeof t.logoLink === 'string' ? undefined : (t.logoLink as { rel?: string } | undefined)?.rel
  const target =
    typeof t.logoLink === 'string'
      ? undefined
      : (t.logoLink as { target?: string } | undefined)?.target

  // 纯文本标题(可能含 HTML 的 siteTitle 去掉标签后作为原生 tooltip)
  const rawTitle =
    t.siteTitle === false ? '' : (t.siteTitle ?? site.title ?? '')
  const textTitle = rawTitle
    ? rawTitle.replace(/<[^>]+>/g, '').trim() || undefined
    : undefined

  return (
    <div className={cx('VPNavBarTitle', hasSidebar && 'has-sidebar')}>
      <a
        className="title"
        href={logoLink ?? normalizeLink(currentLang.link || '/')}
        rel={rel}
        target={target}
        title={textTitle}
      >
        {titleBefore}
        {t.logo ? <VPImage className="logo" image={t.logo as never} /> : null}
        {t.siteTitle ? (
          <span dangerouslySetInnerHTML={{ __html: t.siteTitle }} />
        ) : t.siteTitle === undefined ? (
          <span>{site.title}</span>
        ) : null}
        {titleAfter}
      </a>
    </div>
  )
}
