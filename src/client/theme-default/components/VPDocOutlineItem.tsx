import type { VpHeader } from '../theme-utils'
import '../styles/components/VPDocOutlineItem.scoped.css'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

/** 大纲链接项(递归) */
export function VPDocOutlineItem({
  headers,
  root
}: {
  headers: VpHeader[]
  root?: boolean
}) {
  return (
    <ul
      className={cx(
        'VPDocOutlineItem',
        root ? 'root' : 'nested',
        root ? 'root' : 'nested'
      )}
    >
      {headers.map(({ children, link, title }, i) => (
        <li key={i}>
          <a className={cx('outlineLink', 'outline-link')} href={link} title={title}>
            {title}
          </a>
          {children?.length ? (
            <VPDocOutlineItem headers={children} />
          ) : null}
        </li>
      ))}
    </ul>
  )
}
