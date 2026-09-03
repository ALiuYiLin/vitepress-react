import { useEffect, type ReactNode } from 'react'

import { closeScreen, getScreenTriggerEl } from '../composables/use-nav'
import { useBodyScrollLock } from '../composables/use-body-scroll-lock'
import { VPNavAppearance } from './VPNavAppearance'
import { VPNavMenu } from './VPNavMenu'
import { VPNavSocialLinks } from './VPNavSocialLinks'
import { VPNavTranslations } from './VPNavTranslations'
import './VPNavScreen.module.css'

/**
 * 移动端全屏导航(对应 Vue VPNavScreen.vue):
 * 打开时锁 body 滚动;Escape 关闭并把焦点还给触发按钮。
 * (进入动画以 CSS keyframes 近似,离开瞬时不另做。)
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
        {before}
        <VPNavMenu screen className="menu" />
        <VPNavTranslations screen className="translations" />
        <VPNavAppearance row screen className="appearance" />
        <VPNavSocialLinks screen className="social-links" />
        {after}
      </div>
    </div>
  )
}
