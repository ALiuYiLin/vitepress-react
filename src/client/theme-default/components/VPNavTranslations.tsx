import { useId, useState } from 'react'
import { useData } from 'vitepress'

import { useLangs } from '../composables/use-langs'
import { useNavOverflow } from '../composables/use-nav-overflow'
import { VPFlyout } from './VPFlyout'
import { VPLink } from './VPLink'
import { VPMenuLink } from './VPMenuLink'
import './VPNavTranslations.module.css'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

/**
 * 语言切换(对应 Vue VPNavTranslations.vue),三种形态:
 * - 顶栏内联 flyout(icon 地球)
 * - ⋯ 菜单内带标题分组(menu)
 * - 屏幕导航内手风琴(screen)
 */
export function VPNavTranslations({
  screen,
  menu,
  className
}: {
  /** 屏幕导航内手风琴 */
  screen?: boolean
  /** ⋯ 菜单内有标题分组 */
  menu?: boolean
  className?: string
}) {
  const { theme } = useData()
  const t = theme as { langMenuLabel?: string }
  const { localeLinks, currentLang } = useLangs()
  const show = Boolean(localeLinks.length && currentLang.label)

  // 只有顶栏内联 flyout 参与溢出引擎
  const overflow = screen || menu ? null : useNavOverflow()
  const isCollapsed = Boolean(overflow) && !overflow!.state.translations

  const [isOpen, setIsOpen] = useState(false)
  const listId = useId()

  if (!show) return null

  const localeProps = (locale: (typeof localeLinks)[number]) => ({
    lang: locale.lang,
    // React 用驼峰属性名渲染出小写 HTML 属性 hreflang
    hrefLang: locale.lang,
    rel: 'alternate',
    dir: locale.dir,
    'data-allow-mismatch': 'attribute'
  })

  // 屏幕导航内:手风琴
  if (screen) {
    return (
      <div
        className={cx('VPNavTranslations VPNavScreenTranslations', isOpen && 'open', className)}
      >
        <button
          type="button"
          className="title"
          aria-expanded={isOpen}
          aria-controls={listId}
          onClick={() => setIsOpen((v) => !v)}
        >
          <span className="vpi-languages icon lang" aria-hidden="true" />
          {currentLang.label}
          <span className="vpi-chevron-down icon chevron" aria-hidden="true" />
        </button>

        <ul
          style={isOpen ? undefined : { display: 'none' }}
          id={listId}
          className="list"
        >
          {localeLinks.map((locale) => {
            const { rel, ...linkAttrs } = localeProps(locale)
            return (
              <li key={locale.link} className="item">
                <VPLink
                  className="link"
                  href={locale.link}
                  rel={rel}
                  external={false}
                  {...linkAttrs}
                >
                  {locale.text}
                </VPLink>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  // ⋯ 菜单内:带标题分组
  if (menu) {
    return (
      <div className={cx('VPNavTranslations group translations', className)}>
        <p className="title">{currentLang.label}</p>
        <ul>
          {localeLinks.map((locale) => (
            <VPMenuLink
              key={locale.link}
              item={{ text: locale.text, link: locale.link }}
              attrs={localeProps(locale)}
            />
          ))}
        </ul>
      </div>
    )
  }

  // 顶栏内联 flyout
  return (
    <VPFlyout
      className={cx(
        'VPNavTranslations VPNavBarTranslations',
        isCollapsed && 'collapsed',
        className
      )}
      icon="vpi-languages"
      label={t.langMenuLabel || 'Change language'}
    >
      <p className="title">{currentLang.label}</p>

      <ul className="items">
        {localeLinks.map((locale) => (
          <VPMenuLink
            key={locale.link}
            item={{ text: locale.text, link: locale.link }}
            attrs={localeProps(locale)}
          />
        ))}
      </ul>
    </VPFlyout>
  )
}
