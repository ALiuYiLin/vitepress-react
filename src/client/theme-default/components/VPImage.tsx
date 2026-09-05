import { withBase } from 'vitepress'

import '../styles/components/VPImage.scoped.css'
import { cx } from '../lib/cx'

export type ThemeableImage =
  | string
  | { src: string; alt?: string }
  | {
      light: ThemeableImage
      dark: ThemeableImage
      alt?: string
    }

export type VPImageProps = {
  image?: ThemeableImage
  alt?: string
  className?: string
} & Record<string, unknown>

/**
 * 对应 Vue VPImage.vue:字符串/{src} 直接出 <img>,{light,dark} 递归渲染两份,
 * 亮/暗各显一张(CSS: html.dark/.light 控制 display)。
 */
export function VPImage({ image, alt, className, ...rest }: VPImageProps) {
  if (!image) return null

  // 字符串或含 src 的对象 → 单个 <img>
  if (typeof image === 'string' || 'src' in image) {
    const src = typeof image === 'string' ? image : image.src
    const imageAlt = alt ?? (typeof image === 'string' ? '' : image.alt || '')
    return (
      <img
        className={cx('VPImage', className)}
        src={withBase(src)}
        alt={imageAlt}
        {...rest}
      />
    )
  }

  // { light, dark } → 两份递归
  return (
    <>
      <VPImage
        image={image.dark}
        alt={image.alt}
        className={cx('dark', className)}
        {...rest}
      />
      <VPImage
        image={image.light}
        alt={image.alt}
        className={cx('light', className)}
        {...rest}
      />
    </>
  )
}
