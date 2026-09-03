import { useData } from 'vitepress'

import { VPDocAsideOutline } from './VPDocAsideOutline'
import s from './VPDocAside.module.css'

/** 文档右侧侧栏(大纲 + 可选广告) */
export function VPDocAside() {
  const { theme } = useData()
  const carbonAds = (theme as { carbonAds?: unknown })?.carbonAds
  return (
    <div className="VPDocAside">
      <VPDocAsideOutline />
      <div className={s.spacer} />
      {carbonAds ? <div className={s.carbonAds}>Sponsored · Carbon Ads</div> : null}
    </div>
  )
}
