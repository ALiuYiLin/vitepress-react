import { VPLink } from './VPLink'
import { VPImage, type ThemeableImage } from './VPImage'
import type { VpFeatureIcon } from './VPFeatures'

/**
 * 单个特性卡片(对应 Vue VPFeature.vue):
 * VPLink(a|div) > article.box > (icon / image) + title + details + link-text。
 */
export function VPFeature({
  icon,
  title,
  details,
  link,
  linkText,
  rel,
  target
}: {
  icon?: VpFeatureIcon
  title: string
  details?: string | string[]
  link?: string
  linkText?: string
  rel?: string
  target?: string
}) {
  const iconObj = typeof icon === 'object' && icon !== null ? icon : undefined
  const isImageIcon = Boolean(
    iconObj && ('src' in iconObj || 'light' in iconObj || 'dark' in iconObj)
  )
  const image = isImageIcon ? (iconObj as unknown as ThemeableImage) : undefined
  const wrapped = Boolean(iconObj && 'wrap' in iconObj && iconObj.wrap)
  const iconAlt = (iconObj as { alt?: string } | undefined)?.alt
  const iconHeight =
    iconObj && 'height' in iconObj && typeof iconObj.height === 'number'
      ? iconObj.height
      : undefined
  const iconWidth =
    iconObj && 'width' in iconObj && typeof iconObj.width === 'number'
      ? iconObj.width
      : undefined

  const imageEl = image ? (
    <VPImage
      image={image}
      alt={iconAlt}
      height={iconHeight || 48}
      width={iconWidth || 48}
    />
  ) : null

  return (
    <VPLink
      className="VPFeature"
      tag={link ? 'a' : 'div'}
      href={link}
      rel={rel}
      target={target}
      noIcon
    >
      <article className="box">
        {wrapped ? <div className="icon">{imageEl}</div> : imageEl}
        {!image && icon ? (
          <div className="icon" dangerouslySetInnerHTML={{ __html: icon }} />
        ) : null}

        <h2 className="title" dangerouslySetInnerHTML={{ __html: title }} />

        {Array.isArray(details) ? (
          <ul className="details">
            {details.map((item) => (
              <li key={item} dangerouslySetInnerHTML={{ __html: item }} />
            ))}
          </ul>
        ) : details ? (
          <p className="details" dangerouslySetInnerHTML={{ __html: details }} />
        ) : null}

        {linkText ? (
          <div className="link-text">
            <p className="link-text-value">
              {linkText} <span className="vpi-arrow-right link-text-icon" />
            </p>
          </div>
        ) : null}
      </article>
    </VPLink>
  )
}
