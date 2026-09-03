import { useData } from 'vitepress'

import s from './vp-carbon-ads.module.css'

/** 广告占位(theme.carbonAds 配置存在时渲染于右侧栏) */
export function VPCarbonAds() {
  const { theme } = useData()
  const cfg = (theme as { carbonAds?: { code?: string; placement?: string } })
    .carbonAds
  if (!cfg) return null
  return (
    <div className="VPCarbonAds">
      <div className={s.wrap}>
        <span className={s.label}>Sponsored</span>
        <div className={s.placeholder}>Carbon Ads</div>
      </div>
    </div>
  )
}
