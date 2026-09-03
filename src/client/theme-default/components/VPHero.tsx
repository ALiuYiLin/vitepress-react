import { VPButton } from './VPButton'
import { VPImage, type ThemeableImage } from './VPImage'

export type VpHeroAction = {
  theme?: 'brand' | 'alt'
  text: string
  link: string
  target?: string
  rel?: string
}

/**
 * 首页 Hero(对应 Vue VPHero.vue):
 * 标题(name/text)→ tagline → actions(VPButton)→ image。
 */
export function VPHero({
  className,
  name,
  text,
  tagline,
  image,
  actions
}: {
  className?: string
  name?: string
  text?: string
  tagline?: string
  image?: ThemeableImage
  actions?: VpHeroAction[]
}) {
  const hasImage = Boolean(image)
  const rootClass = hasImage
    ? `VPHero has-image${className ? ` ${className}` : ''}`
    : `VPHero${className ? ` ${className}` : ''}`

  return (
    <div className={rootClass}>
      <div className="container">
        <div className="main">
          <h1 className="heading">
            {name ? (
              <span className="name clip" dangerouslySetInnerHTML={{ __html: name }} />
            ) : null}
            {text ? (
              <span className="text" dangerouslySetInnerHTML={{ __html: text }} />
            ) : null}
          </h1>
          {tagline ? (
            <p className="tagline" dangerouslySetInnerHTML={{ __html: tagline }} />
          ) : null}

          {actions ? (
            <div className="actions">
              {actions.map((action) => (
                <div key={action.link} className="action">
                  <VPButton
                    tag="a"
                    size="medium"
                    theme={action.theme}
                    text={action.text}
                    href={action.link}
                    target={action.target}
                    rel={action.rel}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {image ? (
          <div className="image">
            <div className="image-container">
              <div className="image-bg" />
              <VPImage className="image-src VPImage" image={image} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
