import { Content, useData } from 'vitepress'

import { VPHomeContent } from './VPHomeContent'
import { VPHomeFeatures } from './VPHomeFeatures'
import { VPHomeHero } from './VPHomeHero'

/**
 * 首页容器(对应 Vue VPHome.vue):
 * VPHomeHero → VPHomeFeatures → VPHomeContent(内含 Content)。
 */
export function VPHome() {
  const { frontmatter, theme } = useData()
  const fm = frontmatter as { markdownStyles?: boolean }
  const externalLinkIcon = (theme as { externalLinkIcon?: boolean })
    .externalLinkIcon

  const className = externalLinkIcon
    ? 'VPHome external-link-icon-enabled'
    : 'VPHome'

  return (
    <div className={className}>
      <VPHomeHero />
      <VPHomeFeatures />
      {fm.markdownStyles !== false ? (
        <VPHomeContent>
          <Content />
        </VPHomeContent>
      ) : (
        <Content />
      )}
    </div>
  )
}
