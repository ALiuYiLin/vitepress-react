import { Content } from 'vitepress'

import { useLayout } from '../composables/use-layout'
import { VPDocAside } from './VPDocAside'
import { VPDocFooter } from './VPDocFooter'
import s from './VPDoc.module.css'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

/** 文档正文容器(侧栏 aside + main(.vp-doc by md root) + 页脚) */
export function VPDoc() {
  const { hasSidebar, hasAside, leftAside } = useLayout()
  return (
    <div
      className={cx(s.doc, 'VPDoc', hasSidebar && 'has-sidebar', hasAside && 'has-aside')}
    >
      <div className={cx(s.container, 'container')}>
        {hasAside ? (
          <div className={cx(s.aside, 'aside', leftAside && 'left-aside')}>
            <div className={s.asideCurtain} />
            <div className={s.asideContainer}>
              <div className={s.asideContent}>
                <VPDocAside />
              </div>
            </div>
          </div>
        ) : null}

        <div className={cx(s.content, 'content')}>
          <div className={cx(s.contentContainer, 'content-container')}>
            <main className="main">
              <Content />
            </main>
            <VPDocFooter />
          </div>
        </div>
      </div>
    </div>
  )
}
