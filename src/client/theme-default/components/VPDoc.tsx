import { Content } from '@10coding/vitepress-react'

import { useThemeComponent } from '../composables/use-theme-component'
import { useLayout } from '../composables/use-layout'
import { useLayoutSlot } from '../layout-slots'
import '../styles/components/VPDoc.scoped.css'
import { VPDocAside as VPDocAsideDefault } from './VPDocAside'
import { VPDocFooter as VPDocFooterDefault } from './VPDocFooter'

const cx = (...c: (string | false | undefined | null)[]) =>
  c.filter(Boolean).join(' ')

/**
 * 文档正文容器(侧栏 aside + main(.vp-doc by md root) + 页脚)。
 * 插槽挂载点:
 *   docBefore/docAfter          .doc 根首/末
 *   docTop/docBottom            .content-container 首/末
 *   docFooterBefore             <VPDocFooter/> 前
 *   asideTop/asideBottom/…      见 VPDocAside
 */
export function VPDoc() {
  const { hasSidebar, hasAside, leftAside } = useLayout()

  const VPDocAside = useThemeComponent('VPDocAside', VPDocAsideDefault)
  const VPDocFooter = useThemeComponent('VPDocFooter', VPDocFooterDefault)

  const slotDocBefore = useLayoutSlot('docBefore')
  const slotDocAfter = useLayoutSlot('docAfter')
  const slotDocTop = useLayoutSlot('docTop')
  const slotDocBottom = useLayoutSlot('docBottom')
  const slotDocFooterBefore = useLayoutSlot('docFooterBefore')

  return (
    <div
      className={cx(
        'doc',
        'VPDoc',
        hasSidebar && cx('hasSidebar', 'has-sidebar'),
        hasAside && cx('hasAside', 'has-aside')
      )}
    >
      {slotDocBefore}
      <div className="container">
        {hasAside ? (
          <div
            className={cx('aside', leftAside && cx('leftAside', 'left-aside'))}
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
            {slotDocTop}
            <main className="main">
              <Content />
            </main>
            {slotDocFooterBefore}
            <VPDocFooter />
            {slotDocBottom}
          </div>
        </div>
      </div>
      {slotDocAfter}
    </div>
  )
}
