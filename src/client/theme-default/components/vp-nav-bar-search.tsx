import { useData } from 'vitepress'

import s from './vp-nav-bar-search.module.css'

/**
 * 顶栏搜索触发按钮(theme.algolia 配置时显示)。
 * 组件本地,不联网;点击后按需懒加载 @docsearch/js(运行时)。
 */
export function VPNavBarSearchButton({ className }: { className?: string }) {
  const { theme } = useData()
  const algolia = (theme as { algolia?: unknown }).algolia
  if (!algolia) return null
  const openSearch = () => {
    // 运行时按需加载 docsearch(不在此处静态引入,避免构建时联网)
    void import('@docsearch/js').catch(() => {})
  }
  return (
    <div className={cx('VPNavBarSearch', className)}>
      <button className={s.btn} onClick={openSearch} aria-label="搜索">
        <span className="vpi-search icon" />
        <span className={s.text}>搜索</span>
        <kbd className={s.kbd}>Ctrl K</kbd>
      </button>
    </div>
  )
}

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')
