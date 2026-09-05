import { useData } from 'vitepress'

import { useLayout } from '../composables/use-layout'
import '../styles/components/VPFooter.scoped.css'

/** 页脚(theme.footer 且 frontmatter.footer !== false) */
export function VPFooter({ inert }: { inert?: boolean }) {
  const { theme, frontmatter } = useData()
  const { hasSidebar } = useLayout()
  const footer = (theme as { footer?: { message?: string; copyright?: string } })
    .footer
  if (!footer || (frontmatter as { footer?: boolean }).footer === false) return null
  return (
    <footer
      className={cx('footer', hasSidebar && 'hasSidebar', 'VPFooter', hasSidebar && 'has-sidebar')}
      {...({ inert: inert || undefined } as Record<string, unknown>)}
    >
      <div className="container">
        {footer.message ? (
          <p className="message" dangerouslySetInnerHTML={{ __html: footer.message }} />
        ) : null}
        {footer.copyright ? (
          <p className="copyright" dangerouslySetInnerHTML={{ __html: footer.copyright }} />
        ) : null}
      </div>
    </footer>
  )
}

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')
