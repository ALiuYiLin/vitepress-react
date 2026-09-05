---
description: 了解如何在 VitePress Markdown 文件中使用 YAML frontmatter 来控制页面级别的元数据和行为。
---

# frontmatter

## 用法 {#usage}

VitePress 支持在所有 Markdown 文件中使用 YAML frontmatter，并使用 [gray-matter](https://github.com/jonschlinkert/gray-matter) 解析。frontmatter 必须位于 Markdown 文件的顶部 (在任何元素之前，包括 `<script>` 标签)，并且需要在三条虚线之间采用有效的 YAML 格式。例如：

```md
---
title: Docs with VitePress
editLink: true
---
```

许多站点或默认主题配置选项在 frontmatter 中都有相应的选项。可以使用 frontmatter 来覆盖当前页面的特定行为。详细信息请参见 [frontmatter 配置参考](../reference/frontmatter-config)。

还可以定义自己的 frontmatter 数据，以在页面正文的动态表达式/组件中使用。

## 访问 frontmatter 数据 {#accessing-frontmatter-data}

本 fork 的 Markdown 是 React 语义（见[在 Markdown 中使用 React](./using-react)），没有 Vue 的 `$frontmatter` 全局与 `{{ }}` 插值。改为在 `<script>` 的 **page-scope** 中通过 [`useData()`](../reference/runtime-api#usedata) 读取（它是 hook，必须放在页面的 `<script>` 里，不能放模块顶层具名导出之外的位置），再用正文 `{expr}` 引用：

```md
---
title: Docs with VitePress
editLink: true
---

<script>
import { useData } from '@10coding/vitepress-react'

const { frontmatter } = useData()
</script>

本页 frontmatter 标题是：{frontmatter.title}

Guide content
```

正文只会求值“引用了 page-scope 绑定”的 `{expr}`；想展示字面 `{{ }}`/`$frontmatter` 等 Vue 写法时，请放入代码块或行内代码。


## 其他 frontmatter 格式 {#alternative-frontmatter-formats}

VitePress 也支持 JSON 格式的 frontmatter，以花括号开始和结束：

```json
---
{
  "title": "Blogging Like a Hacker",
  "editLink": true
}
---
```
