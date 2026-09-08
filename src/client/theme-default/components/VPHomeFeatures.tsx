import { useData } from '@10coding/vitepress-react'

import { useThemeComponent } from '../composables/use-theme-component'
import { VPFeatures as VPFeaturesDefault, type VpFeature } from './VPFeatures'

/** 首页特性区包装(对应 Vue VPHomeFeatures.vue) */
export function VPHomeFeatures() {
  const { frontmatter } = useData()
  const VPFeatures = useThemeComponent('VPFeatures', VPFeaturesDefault)
  const features = (frontmatter as { features?: VpFeature[] }).features
  if (!features) return null
  return <VPFeatures className="VPHomeFeatures" features={features} />
}
