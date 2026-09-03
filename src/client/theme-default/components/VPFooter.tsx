import { useData } from 'vitepress'

import { useLayout } from '../composables/use-layout'
import s from './VPFooter.module.css'

/** 页脚(theme.footer 且 frontmatter.footer !== false) */
export function VPFooter({ inert }: { inert?: boolean }) {
  const { theme, frontmatter } = useData()
  const { hasSidebar } = useLayout()
  const footer = (theme as { footer?: { message?: string; copyright?: string } })
    .footer
  if (!footer || (frontmatter as { footer?: boolean }).footer === false) return null
  return (
    <footer
      className={cx(s.footer, hasSidebar && s.hasSidebar, 'VPFooter', hasSidebar && 'has-sidebar')}
      {...({ inert: inert || undefined } as Record<string, unknown>)}
    >
      <div className={s.container}>
        {footer.message ? (
          <p className={s.message} dangerouslySetInnerHTML={{ __html: footer.message }} />
        ) : null}
        {footer.copyright ? (
          <p className={s.copyright} dangerouslySetInnerHTML={{ __html: footer.copyright }} />
        ) : null}
      </div>
    </footer>
  )
}

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')
