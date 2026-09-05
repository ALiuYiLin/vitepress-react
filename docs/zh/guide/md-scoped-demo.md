---
title: md 页面 scoped 样式(接线 demo)
description: 验证 themeConfig.markdownScopedCss —— <style scoped> 与 *.scoped.css 导入走 jsx-scoped 管线
---

# md 页面 scoped 样式(接线 demo)

> 该页用于验证 vitepress-react 的 md scoped css 接线:
> `<style scoped>` 内联块 + `*.scoped.css` 外部导入均编译为
> 「页面级 `[data-v-{hash}]` 样式」,样式只命中本页 DOM。

<script>
// 外部 scoped 样式文件(相对本 md 路径);内容见同目录 md-scoped-demo.scoped.css
import './md-scoped-demo.scoped.css'
</script>

## 内联 `<style scoped>` 标题 {.md-scoped-inline-demo}

<style scoped>
.md-scoped-inline-demo {
  color: var(--vp-c-brand-1);
}
.md-scoped-inline-demo:hover {
  text-decoration: underline;
}
</style>

标题的类名由 attrs 语法 `{.md-scoped-inline-demo}` 注入,上面的
`<style scoped>` 规则经 jsx-scoped 管线追加 `[data-v-xxxxxxxx]` 选择器,
只对本页标题生效。

## 外部 *.scoped.css 导入 {.md-scoped-h}

::: tip 效果
下方卡片样式来自 `md-scoped-demo.scoped.css`(通过 `<script>` 里
`import './md-scoped-demo.scoped.css'` 引入):类名命中后,选择器同样被
scope 化,不会泄漏到其它页面。
:::

这段文字本身不带类,仅用于让「带类卡片」独占一个段落块。

{.md-scoped-card}

上面的类由独立一行的 `{.md-scoped-card}` 注入,**加粗文字**应显示为 danger 色
(来自外部 scoped 文件的选择器 `.md-scoped-card strong`)。

::: details 检查方式
- dev:打开该页,元素检查可看到正文 DOM 标签带 `data-v-xxxxxxxx` 属性;
- build:`docs/.vitepress/dist/zh/guide/md-scoped-demo.html` 的 css 产物
  含 `[data-v-xxxxxxxx]` 选择器,且仅本页引入。
:::
