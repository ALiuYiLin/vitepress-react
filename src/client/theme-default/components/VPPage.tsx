import { Content } from '@10coding/vitepress-react'

/** layout: page 的页面容器(仅渲染 Content) */
export function VPPage() {
  return (
    <div className="VPPage">
      <Content />
    </div>
  )
}
