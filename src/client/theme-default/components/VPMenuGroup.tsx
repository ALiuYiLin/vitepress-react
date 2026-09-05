import '../styles/components/VPMenuGroup.scoped.css'
import { VPMenuLink } from './VPMenuLink'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

export interface VPMenuGroupProps {
  text?: string
  items: any[]
}

/** 菜单分组(递归;子项可为链接或嵌套组) */
export function VPMenuGroup({
  text,
  items,
  className
}: VPMenuGroupProps & { className?: string }) {
  const hasSubGroups = items.some(
    (item) => !('link' in item) && !('component' in item)
  )
  return (
    <li className={cx('group', 'VPMenuGroup', className)}>
      {text ? <p className="title">{text}</p> : null}
      <ul className={cx(hasSubGroups && 'subGroups')}>
        {items.map((item, i) => {
          if ('link' in item) return <VPMenuLink key={i} item={item} />
          if ('component' in item) return null
          return (
            <VPMenuGroup key={i} text={item.text} items={item.items ?? []} />
          )
        })}
      </ul>
    </li>
  )
}
