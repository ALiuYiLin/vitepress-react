import s from './vp-sponsors.module.css'

export type VpSponsor = {
  name?: string
  img?: string
  link?: string
}

/** 赞助商网格 */
export function VPSponsors({ sponsors }: { sponsors: VpSponsor[] }) {
  if (!sponsors.length) return null
  return (
    <div className="VPSponsors">
      <div className={s.grid}>
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
    </div>
  )
}
