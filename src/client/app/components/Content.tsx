import { useLayoutEffect, type ElementType } from 'react'

import { useRoute } from '../data'
import { contentUpdatedCallbacks } from '../utils'

const runCbs = () => contentUpdatedCallbacks.forEach((fn) => fn())

/**
 * 渲染当前路由的页面组件(React 版;对上游 Content)。
 *
 * 内容副作用(onContentUpdated 等)在每次路由内容提交后触发——React 没有
 * vnode hooks,用 layout effect + 路由依赖模拟"post-render"语义。
 */
export function Content(props: { as?: ElementType }) {
  const route = useRoute()
  const Tag: ElementType = props.as ?? 'div'

  // 内容提交后触发副作用(mounted/updated 语义的近似;M3 完善)
  useLayoutEffect(() => {
    runCbs()
  }, [route.path])

  const Component = route.component
  return (
    <Tag>
      {Component ? (
        <Component key={route.path} />
      ) : (
        // 与上游一致:组件缺失时输出 404 文本(默认主题可据此自定义)
        '404 Page Not Found'
      )}
    </Tag>
  )
}

// 兼容 `import Content from ...`(公共 API 用具名导出,此处给默认导出兜底)
export default Content
