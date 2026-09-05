import { VPFeature } from './VPFeature'

export type VpFeatureIcon =
  | string
  | {
      src?: string
      wrap?: boolean
      alt?: string
      height?: number
      width?: number
    }

export type VpFeature = {
  icon?: VpFeatureIcon
  title: string
  details?: string | string[]
  link?: string
  linkText?: string
  rel?: string
  target?: string
}

/**
 * 特性网格(对应 Vue VPFeatures.vue):按条目数选 grid-2/3/4/6,
 * 每项 li > VPFeature。
 */
export function VPFeatures({
  features,
  className
}: {
  features: VpFeature[]
  className?: string
}) {
  const length = features.length

  let grid: string | undefined
  if (length === 2) grid = 'grid-2'
  else if (length === 3) grid = 'grid-3'
  else if (length % 3 === 0) grid = 'grid-6'
  else if (length > 3) grid = 'grid-4'

  return (
    <div className={className ? `VPFeatures ${className}` : 'VPFeatures'}>
      <div className="container">
        <ul className="items">
          {features.map((feature) => (
            <li key={feature.title} className={`item${grid ? ` ${grid}` : ''}`}>
              <VPFeature
                icon={feature.icon}
                title={feature.title}
                details={feature.details}
                link={feature.link}
                linkText={feature.linkText}
                rel={feature.rel}
                target={feature.target}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
