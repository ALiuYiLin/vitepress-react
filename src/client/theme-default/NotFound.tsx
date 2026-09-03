import { withBase, useData } from 'vitepress'

import { useLangs } from './composables/use-langs'

/** 404 页(对应 Vue NotFound.vue;文案缺省英文,由各语言 notFound 配置覆盖) */
export function NotFound() {
  const { theme } = useData()
  const { currentLang } = useLangs()
  const nf = (theme as {
    notFound?: {
      code?: string
      title?: string
      quote?: string
      link?: string
      linkLabel?: string
      linkText?: string
    }
  })?.notFound ?? {}

  const home = withBase(nf.link ?? currentLang.link)

  return (
    <div className="NotFound">
      <p className="code">{nf.code ?? '404'}</p>
      <h1 className="title">{nf.title ?? 'PAGE NOT FOUND'}</h1>
      <div className="divider" />
      <blockquote className="quote">
        {nf.quote ??
          "But if you don't change your direction, and if you keep looking, you may end up where you are heading."}
      </blockquote>

      <div className="action">
        <a
          className="link"
          href={home}
          aria-label={nf.linkLabel ?? 'go to home'}
        >
          {nf.linkText ?? 'Take me home'}
        </a>
      </div>
    </div>
  )
}
