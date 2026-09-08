import { Content, useData } from '@10coding/vitepress-react'

import { useThemeComponent } from '../composables/use-theme-component'
import { VPHomeContent as VPHomeContentDefault } from './VPHomeContent'
import { VPHomeFeatures as VPHomeFeaturesDefault } from './VPHomeFeatures'
import { VPHomeHero as VPHomeHeroDefault } from './VPHomeHero'

/**
 * 首页容器(对应 Vue VPHome.vue):
 * VPHomeHero → VPHomeFeatures → VPHomeContent(内含 Content)。
 */
export function VPHome() {
  const { frontmatter, theme } = useData()
  const VPHomeContent = useThemeComponent('VPHomeContent', VPHomeContentDefault)
  const VPHomeFeatures = useThemeComponent(
    'VPHomeFeatures',
    VPHomeFeaturesDefault
  )
  const VPHomeHero = useThemeComponent('VPHomeHero', VPHomeHeroDefault)
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
