import { useData } from '@10coding/vitepress-react'

import '../styles/components/VPDocAside.scoped.css'
import { VPDocAsideOutline } from './VPDocAsideOutline'

/** 文档右侧侧栏(大纲 + 可选广告) */
export function VPDocAside() {
  const { theme } = useData()
  const carbonAds = (theme as { carbonAds?: unknown })?.carbonAds
  return (
    <div className="VPDocAside">
      <VPDocAsideOutline />
      <div className="spacer" />
      {carbonAds ? <div className="carbonAds">Sponsored · Carbon Ads</div> : null}
    </div>
  )
}
