---
title: md 页面 scoped 样式
description: 在 Markdown 中使用 Vue-like 页面级 scoped 样式 —— <style scoped> 内联块与 *.scoped.css 外部导入
---

# md 页面 scoped 样式

在 Markdown 页面里,除了全局 `<style>`(运行时注入,作用到全站),还可以写
**Vue-like 的页面级 scoped 样式**:样式编译后选择器会追加 `[data-v-{hash}]`,
同一页面的 DOM 也会带上 `data-v-{hash}` 属性——规则**只命中当前页面**,不会
泄漏到其它页面(hash 由页面 md 文件的绝对路径生成,各页互不相同)。

开启后有两种写法:

| 写法 | 说明 |
| --- | --- |
| 内联 `<style scoped>…</style>` | CSS 直接写在 md 里(可带 `lang="scss"` 等) |
| 外部 `*.scoped.css` 导入 | 在 `<script>` 里 `import './xx.scoped.css'`,样式放独立文件 |

<!-- 本页实时示例需要:下面的外部 scoped 样式导入(见「用法二」) -->

<script>
import './md-scoped-demo.scoped.css'
</script>

## 启用

该功能默认关闭(`false`)。需要两步:

1. 站点安装插件(虚拟 css 模块的 resolve/load 由它提供):

```bash
pnpm add -D @10coding/vite-plugin-jsx-scoped
```

2. 在站点配置里打开开关并注册插件:

```ts
// .vitepress-react/config.ts
import jsxScopedVitePlugin from '@10coding/vite-plugin-jsx-scoped'
import { defineConfig } from '@10coding/vitepress-react'

export default defineConfig({
  themeConfig: {
    // 开启 md 页面 scoped 样式
    markdownScopedCss: true
  },
  vite: {
    plugins: [jsxScopedVitePlugin()]
  }
})
```

::: tip 说明
vitepress-react 内置该插件的编译管线,但虚拟 css 的加载需要**站点自己注册**
一个插件实例(vitepress 核心与站点插件共享进程级 registry)。
开启后,没有任何 `<style scoped>` / `*.scoped.*` 标记的页面完全不受影响
(编译期快速检测,未命中时零解析开销)。
:::

## 用法一:内联 `<style scoped>`

样式块直接写在 md 里;正文中想被选中的元素用 attrs 语法 `{.class}` 加类
(标题写在行尾,段落写在独立一行):

```md
## 卡片标题 {.scoped-card-title}

<style scoped>
.scoped-card-title {
  color: var(--vp-c-brand-1);
  border-bottom: 2px solid var(--vp-c-brand-2);
}
</style>
```

样式块也支持 `lang` 属性(站点需已安装对应预处理器):

```md
<style scoped lang="scss">
.scoped-card-title {
  &:hover {
    text-decoration: underline;
  }
}
</style>
```

### 实时效果

`#### 这就是标题 {.md-scoped-live-title}` + 下面的 `<style scoped>`:

#### 这就是标题 {.md-scoped-live-title}

<style scoped>
.md-scoped-live-title {
  color: var(--vp-c-brand-1);
  border-bottom: 2px solid var(--vp-c-brand-2);
}
.md-scoped-live-title:hover {
  text-decoration: underline;
}
</style>

编译结果:标题 DOM 带 `data-v-xxxxxxxx`,规则被改写为
`.md-scoped-live-title[data-v-xxxxxxxx]`,只作用于本页(悬停有下划线)。

## 用法二:外部 `*.scoped.css` 导入

把样式放进独立文件(文件名必须以 `.scoped.css` / `.scoped.scss` / `.scoped.sass`
/ `.scoped.less` 结尾),再在页面的 `<script>` 里按**相对本 md 文件**的路径导入:

```css
/* md-scoped-demo.scoped.css(与页面同目录) */
.md-scoped-card {
  border: 2px dashed var(--vp-c-brand-2);
  border-radius: 10px;
  padding: 0.9rem 1.1rem;
}
.md-scoped-card strong {
  color: var(--vp-c-danger-1);
}
```

```md
<script>
import './md-scoped-demo.scoped.css'
</script>

带类卡片段落,`strong` 加粗文字应显示 danger 色。

{.md-scoped-card}
```

### 实时效果

下方卡片用的就是 `./md-scoped-demo.scoped.css`(本页顶部 `<script>` 已真实导入;
类名由独立一行的 `{.md-scoped-card}` 注入):

{.md-scoped-card}

**加粗文字**的 danger 色来自外部 scoped 文件的选择器
`.md-scoped-card strong`(同样被 scope 化)。

## 作用域语义与注意点

- **hash 唯一**:`data-v-{hash}` 由 md 文件绝对路径生成,每一页各不相同;
  同页多个 scoped 资源(内联 + 外部)共用同一 hash;
- **页面内所有 DOM 都会被注入 `data-v-{hash}`**(编译期由管线统一注入),
  因此选择器也可以直接按元素写,例如 `.vp-doc p`(只会命中本页段落);
- **给正文元素加类**:标题 `## x {.class}` 行尾、段落换行后独立一行 `{.class}`、
  行内文本 `文字{.class}`(attrs 语法);若在正文里直接写整行 JSX(React 接管),
  则按 JSX 规则用 `className`;
- **全局样式**仍写不带 `scoped` 的 `<style>`(运行时注入全站),两种写法可同时
  出现在一页;
- **失败降级**:极少数语法边界导致页面代码无法解析时,管线会告警并跳过 scoped
  处理,页面照常编译;
- **构建产物**:scoped css 交给 Vite css 管线(dev 注入 + HMR,build 抽取成 css
  资源、仅由对应页面引入)。

::: details 检查方式
- dev:打开本页,元素检查可见正文 DOM 带 `data-v-xxxxxxxx` 属性;
- build:产物 html 同样带 `data-v-xxxxxxxx`,对应 css 资源里选择器形如
  `.md-scoped-card[data-v-xxxxxxxx]`。
:::
