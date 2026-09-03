// 自定义主题布局(React):需要更多控制时可在此基于 useData() 组装页面。
// 使用默认主题并微调样式时,请在主题入口 extends DefaultTheme(见 index.js)。
import { Content, useData } from 'vitepress'

export default function Layout() {
  const data = useData()
  const { site, frontmatter } = data

  if (frontmatter.home) {
    return (
      <div>
        <h1>{site.title}</h1>
        <p>{site.description}</p>
        <ul>
          <li>
            <a href="/markdown-examples.html">Markdown Examples</a>
          </li>
          <li>
            <a href="/api-examples.html">API Examples</a>
          </li>
        </ul>
      </div>
    )
  }

  return (
    <div>
      <a href="/">Home</a>
      <Content />
    </div>
  )
}
