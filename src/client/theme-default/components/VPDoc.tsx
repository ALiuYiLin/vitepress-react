import { Content } from 'vitepress'

import { useLayout } from '../composables/use-layout'
import '../styles/components/VPDoc.scoped.css'
import { VPDocAside } from './VPDocAside'
import { VPDocFooter } from './VPDocFooter'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

/** 文档正文容器(侧栏 aside + main(.vp-doc by md root) + 页脚) */
export function VPDoc() {
  const { hasSidebar, hasAside, leftAside } = useLayout()
  return (
    <div
      className={cx(
        'doc',
        'VPDoc',
        hasSidebar && cx('hasSidebar', 'has-sidebar'),
        hasAside && cx('hasAside', 'has-aside')
      )}
    >
      <div className="container">
        {hasAside ? (
          <div
            className={cx(
              'aside',
              leftAside && cx('leftAside', 'left-aside')
            )}
          >
            <div className="asideCurtain" />
            <div className="asideContainer">
              <div className="asideContent">
                <VPDocAside />
              </div>
            </div>
          </div>
        ) : null}

        <div className="content">
          <div className={cx('contentContainer', 'content-container')}>
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
