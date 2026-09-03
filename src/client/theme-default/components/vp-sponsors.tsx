import s from './vp-sponsors.module.css'

export type VpSponsor = {
  name?: string
  img?: string
  link?: string
}

const gridCols: Record<string, number> = {
  xmini: 1,
  mini: 2,
  small: 3,
  medium: 4,
  big: 5
}

/** 赞助商网格(带 data-vp-grid 列数,供 vp-sponsor.css/JS 使用) */
export function VPSponsorsGrid({
  sponsors,
  size = 'medium'
}: {
  sponsors: VpSponsor[]
  size?: 'xmini' | 'mini' | 'small' | 'medium' | 'big'
}) {
  return (
    <div className={s.grid} data-vp-grid={gridCols[size] ?? 4}>
      {sponsors.map((sp, i) => (
        <a key={i} className={s.item} href={sp.link} target="_blank" rel="noreferrer">
          {sp.img ? (
            <img className={s.logo} src={sp.img} alt={sp.name ?? ''} />
          ) : (
            <span className={s.fallback}>{sp.name}</span>
          )}
        </a>
      ))}
    </div>
  )
}

/** 赞助商区块 */
export function VPSponsors({ sponsors }: { sponsors: VpSponsor[] }) {
  if (!sponsors.length) return null
  return (
    <div className="VPSponsors">
      <VPSponsorsGrid sponsors={sponsors} />
    </div>
  )
}
