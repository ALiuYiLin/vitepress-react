import { useEffect, type ReactNode } from 'react'

import { useThemeComponent } from '../composables/use-theme-component'
import { closeScreen, getScreenTriggerEl } from '../composables/use-nav'
import { useBodyScrollLock } from '../composables/use-body-scroll-lock'
import { useLayoutSlot } from '../layout-slots'
import { VPNavAppearance as VPNavAppearanceDefault } from './VPNavAppearance'
import { VPNavMenu as VPNavMenuDefault } from './VPNavMenu'
import { VPNavSocialLinks as VPNavSocialLinksDefault } from './VPNavSocialLinks'
import { VPNavTranslations as VPNavTranslationsDefault } from './VPNavTranslations'
/**
 * 移动端全屏导航(对应 Vue VPNavScreen.vue):
 * 打开时锁 body 滚动;Escape 关闭并把焦点还给触发按钮。
 * (进入动画以 CSS keyframes 近似,离开瞬时不另做。)
 * 插槽挂载点:navScreenContentBefore/After(容器前后)。
 */
export function VPNavScreen({
  open,
  before,
  after
}: {
  open: boolean
  before?: ReactNode
  after?: ReactNode
}) {
  const { lock, unlock } = useBodyScrollLock()
  // 内部子组件:可被 Theme.components 覆盖(默认兜底)
  const VPNavMenu = useThemeComponent('VPNavMenu', VPNavMenuDefault)
  const VPNavTranslations = useThemeComponent(
    'VPNavTranslations',
    VPNavTranslationsDefault
  )
  const VPNavAppearance = useThemeComponent(
    'VPNavAppearance',
    VPNavAppearanceDefault
  )
  const VPNavSocialLinks = useThemeComponent(
    'VPNavSocialLinks',
    VPNavSocialLinksDefault
  )
  const slotBefore = useLayoutSlot('navScreenContentBefore', before)
  const slotAfter = useLayoutSlot('navScreenContentAfter', after)

  useEffect(() => {
    if (open) {
      lock()
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== 'Escape') return
        closeScreen()
        getScreenTriggerEl()?.focus()
      }
      window.addEventListener('keydown', onKey)
      return () => {
        window.removeEventListener('keydown', onKey)
        unlock()
      }
    }
    unlock()
  }, [open, lock, unlock])

  if (!open) return null

  return (
    <div className="VPNavScreen" id="VPNavScreen">
      <div className="container">
        {slotBefore}
        <VPNavMenu screen className="menu" />
        <VPNavTranslations screen className="translations" />
        <VPNavAppearance row screen className="appearance" />
        <VPNavSocialLinks screen className="social-links" />
        {slotAfter}
      </div>
    </div>
  )
}
