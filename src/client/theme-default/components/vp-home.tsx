import { useData } from 'vitepress'

import s from './vp-home.module.css'

export type VpHero = {
  name?: string
  text?: string
  tagline?: string
  image?: { src?: string }
  actions?: { text?: string; link?: string; theme?: 'brand' | 'alt' | 'sponsor' }[]
}

export type VpFeature = {
  icon?: string
  title?: string
  details?: string
}

/** Hero:首页顶部大标题区 */
export function VPHero({ hero }: { hero: VpHero }) {
  return (
    <div className="VPHero">
      <div className={s.hero}>
        {hero.name && <h1 className={s.heroName}>{hero.name}</h1>}
        {hero.text && <p className={s.heroText}>{hero.text}</p>}
        {hero.tagline && <p className={s.heroTagline}>{hero.tagline}</p>}
        {hero.actions?.length ? (
          <div className={s.heroActions}>
            {hero.actions.map((a, i) => (
              <a key={i} className={s.heroAction} href={a.link} target="_blank" rel="noreferrer">
                {a.text}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** Features:三列特性卡片 */
export function VPFeatures({ features }: { features: VpFeature[] }) {
  if (!features.length) return null
  return (
    <div className="VPFeatures">
      <div className={s.featuresGrid}>
        {features.map((f, i) => (
          <div key={i} className={s.featureCard}>
            {f.icon && <div className={s.featureIcon}>{f.icon}</div>}
            {f.title && <h3 className={s.featureTitle}>{f.title}</h3>}
            {f.details && <p className={s.featureDetails}>{f.details}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Home 首页(layout: home):渲染 hero + features */
export function VPHome() {
  const { frontmatter } = useData()
  const fm = frontmatter as {
    hero?: VpHero
    features?: VpFeature[]
  }
  return (
    <div className="VPHome">
      {fm.hero && <VPHero hero={fm.hero} />}
      {fm.features?.length && <VPFeatures features={fm.features} />}
    </div>
  )
}
