import { useData } from 'vitepress'

export function NotFound() {
  const { theme } = useData()
  const cfg = theme as {
    notFound?: {
      code?: string
      title?: string
      quote?: string
      linkLabel?: string
      link?: string
    }
  }
  const nf = cfg.notFound ?? {}
  return (
    <div className="NotFound">
      <p className="code">{nf.code ?? '404'}</p>
      <h1 className="title">{nf.title ?? '页面未找到'}</h1>
      <div className="divider" />
      <blockquote className="quote">{nf.quote ?? '但如果你不介意,可以继续留在这里。'}</blockquote>
      <div className="action">
        <a className="link" href={nf.link ?? '/'}>
          {nf.linkLabel ?? '返回首页'}
        </a>
      </div>
    </div>
  )
}
