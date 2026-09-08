import { useData } from '@10coding/vitepress-react'

import { useThemeComponent } from '../composables/use-theme-component'
import { useLayoutSlot } from '../layout-slots'
import '../styles/components/VPDocAside.scoped.css'
import { VPDocAsideOutline as VPDocAsideOutlineDefault } from './VPDocAsideOutline'

/**
 * 文档右侧侧栏(大纲 + 可选广告)。
 * 插槽挂载点:
 *   asideTop/asideBottom           本组件根首/末
 *   asideOutlineBefore/After       大纲(<VPDocAsideOutline/>)前后
 *   asideAdsBefore/After           广告区(存在 carbonAds 时)前后
 */
export function VPDocAside() {
  const { theme } = useData()
  const carbonAds = (theme as { carbonAds?: unknown })?.carbonAds

  const VPDocAsideOutline = useThemeComponent(
    'VPDocAsideOutline',
    VPDocAsideOutlineDefault
  )

  const slotAsideTop = useLayoutSlot('asideTop')
  const slotAsideBottom = useLayoutSlot('asideBottom')
  const slotOutlineBefore = useLayoutSlot('asideOutlineBefore')
  const slotOutlineAfter = useLayoutSlot('asideOutlineAfter')
  const slotAdsBefore = useLayoutSlot('asideAdsBefore')
  const slotAdsAfter = useLayoutSlot('asideAdsAfter')

  return (
    <div className="VPDocAside">
      {slotAsideTop}
      {slotOutlineBefore}
      <VPDocAsideOutline />
      {slotOutlineAfter}
      <div className="spacer" />
      {carbonAds ? (
        <>
          {slotAdsBefore}
          <div className="carbonAds">Sponsored · Carbon Ads</div>
          {slotAdsAfter}
        </>
      ) : null}
      {slotAsideBottom}
    </div>
  )
}
