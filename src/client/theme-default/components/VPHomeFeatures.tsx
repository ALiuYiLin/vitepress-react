import { useData } from '@10coding/vitepress-react'

import { VPFeatures, type VpFeature } from './VPFeatures'

/** 首页特性区包装(对应 Vue VPHomeFeatures.vue) */
export function VPHomeFeatures() {
  const { frontmatter } = useData()
  const features = (frontmatter as { features?: VpFeature[] }).features
  if (!features) return null
  return <VPFeatures className="VPHomeFeatures" features={features} />
}
