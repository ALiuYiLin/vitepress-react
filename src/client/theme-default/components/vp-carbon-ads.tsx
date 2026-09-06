import { useData } from '@10coding/vitepress-react'

import '../styles/components/vp-carbon-ads.scoped.css'

/** 广告占位(theme.carbonAds 配置存在时渲染于右侧栏) */
export function VPCarbonAds() {
  const { theme } = useData()
  const cfg = (theme as { carbonAds?: { code?: string; placement?: string } })
    .carbonAds
  if (!cfg) return null
  return (
    <div className="VPCarbonAds">
      <div className="wrap">
        <span className="label">Sponsored</span>
        <div className="placeholder">Carbon Ads</div>
      </div>
    </div>
  )
}
