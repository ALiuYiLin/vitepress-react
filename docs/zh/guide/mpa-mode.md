---
description: 在 VitePress 中启用 MPA（多页面应用）模式，实现零 JavaScript 页面以获得更好的初始性能。
---

# MPA 模式 <Badge type="warning" text="experimental" /> {#mpa-mode}

可以通过命令行输入 `vitepress build --mpa` 或在配置文件中指定 `mpa: true` 配置选项来启用 MPA (Multi-Page Application) 模式。

在 MPA 模式下，所有页面都默认不会包含任何 JavaScript。因此，站点也许可以在评估工具中获得更好的初始访问性能分数。

但是，由于缺少 SPA 路由，在 MPA 模式下切换页面时会重新加载整个页面，而不会像 SPA 模式那样立即响应。

同时请注意，默认情况下不使用 JavaScript 意味着页面只是预渲染出来的静态 HTML（Markdown 被当作模板输出），浏览器不会附加任何事件处理程序，因此不会有任何交互性。要加载客户端 JavaScript，需要使用特殊的 `<script client>` 标签：

```html
<script client>
document.querySelector('h1').addEventListener('click', () => {
  console.log('client side JavaScript!')
})
</script>

# Hello
```

`<script client>` 是 VitePress 独有的功能。它可以在 `.md` 页面脚本和主题组件中使用，但只能在 MPA 模式下生效。所有主题/组件中的客户端脚本将被打包在一起，而特定页面的客户端脚本将会分开处理。

请注意，`<script client>` **不会按普通页面脚本编译**（不走 page-scope / JSX 管线），它就是一段独立的普通 JavaScript 模块。因此，只有在站点需要极少的客户端交互时，才应该使用 MPA 模式。
