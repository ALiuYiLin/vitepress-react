import { useData } from '@10coding/vitepress-react'

import { useEditLink } from '../composables/use-edit-link'
import { usePrevNext } from '../composables/use-prev-next'
import '../styles/components/VPDocFooter.scoped.css'
import { VPDocFooterLastUpdated } from './vp-doc-footer-last-updated'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

/** 文档页脚(编辑链接 / 最后更新 / 上一页下一页) */
export function VPDocFooter() {
  const { theme, page, frontmatter } = useData()
  const editLink = useEditLink()
  const { prev, next } = usePrevNext()
  const t = theme as {
    editLink?: unknown
    docFooter?: { prev?: string; next?: string }
  }
  const fm = frontmatter as { editLink?: boolean }
  const hasEdit = Boolean(t.editLink) && fm.editLink !== false
  const hasUpdated = Boolean((page as { lastUpdated?: number })?.lastUpdated)
  const show = hasEdit || hasUpdated || (prev?.link ?? '') || (next?.link ?? '')
  if (!show) return null

  return (
    <footer className={cx('footer', 'VPDocFooter')}>
      {(hasEdit || hasUpdated) ? (
        <div className="editInfo">
          {hasEdit && editLink.url ? (
            <a className={cx('editLinkButton', 'edit-link-button')} href={editLink.url}>
              <span className="vpi-square-pen edit-link-icon" />
              {editLink.text}
            </a>
          ) : null}
          {hasUpdated ? (
            <div className="last-updated">
              <VPDocFooterLastUpdated />
            </div>
          ) : null}
        </div>
      ) : null}

      {(prev?.link || next?.link) ? (
        <nav className="prevNext" aria-labelledby="doc-footer-aria-label">
          <span className="visually-hidden" id="doc-footer-aria-label">
            Pager
          </span>
          <div className="pager">
            {prev?.link ? (
              <a
                className={cx('pagerLink', 'pager-link', 'prev')}
                href={prev.link}
                target={(prev as any)?.target}
                rel={(prev as any)?.rel}
              >
                <span
                  className="desc"
                  dangerouslySetInnerHTML={{
                    __html: t.docFooter?.prev || 'Previous page'
                  }}
                />
                <span
                  className="title"
                  dangerouslySetInnerHTML={{ __html: prev.text ?? '' }}
                />
              </a>
            ) : null}
            {next?.link ? (
              <a
                className={cx('pagerLink', 'pager-link', 'next')}
                href={next.link}
                target={(next as any)?.target}
                rel={(next as any)?.rel}
              >
                <span
                  className="desc"
                  dangerouslySetInnerHTML={{
                    __html: t.docFooter?.next || 'Next page'
                  }}
                />
                <span
                  className="title"
                  dangerouslySetInnerHTML={{ __html: next.text ?? '' }}
                />
              </a>
            ) : null}
          </div>
        </nav>
      ) : null}
    </footer>
  )
}
