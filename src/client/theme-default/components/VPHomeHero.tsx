import { useData } from '@10coding/vitepress-react'

import { type ThemeableImage } from './VPImage'
import { VPHero, type VpHeroAction } from './VPHero'

/** 首页 hero 包装(对应 Vue VPHomeHero.vue):fm.hero 存在才渲染 */
export function VPHomeHero() {
  const { frontmatter } = useData()
  const hero = (frontmatter as {
    hero?: {
      name?: string
      text?: string
      tagline?: string
      image?: ThemeableImage
      actions?: VpHeroAction[]
    }
  }).hero

  if (!hero) return null

  return (
    <VPHero
      className="VPHomeHero"
      name={hero.name}
      text={hero.text}
      tagline={hero.tagline}
      image={hero.image}
      actions={hero.actions}
    />
  )
}
