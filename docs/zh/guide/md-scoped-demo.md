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

## 用法三:选择器宏(`:global()` / `:deep()`)

scoped 样式里可用 Vue 同款的两个选择器宏,它们在**选择器 AST 层**展开(dev 与
build 行为一致),`*.scoped.css` 与 `<style scoped>` 都支持:

| 写法                | 展开结果                 | 语义                                        |
| ------------------- | ------------------------ | ------------------------------------------- |
| `:global(.x)`       | `.x`                     | 整条全局(不带任何 `data-v-*`)             |
| `.a :global(.b)`    | `.a[data-v-x] .b`        | `.a` 仍属本页,`.b` 不加 scope               |
| `.a :global(.b) .c` | `.a[data-v-x] .b .c[data-v-x]` | 只有括号内放行,`.c` 回到本页         |
| `.a :deep(.b)`      | `.a[data-v-x] .b`        | 进入子组件作用域(`.b` 起不再加 scope)      |
| `:deep(.b)`         | `[data-v-x] .b`          | 从本页普通元素开始,命中子组件内部元素       |

::: warning 注意点

- 只支持**函数式**写法;`>>>`、`/deep/`、`::v-deep` 等旧别名会被当作普通伪类,
  按普通规则追加 scope 属性。
- 一条选择器里**只认第一个宏**:写两个(如 `:global(.dark) .a :global(.b)`)
  时第二个不会展开、会原样残留在 CSS 里,浏览器按无效选择器整条丢弃。需要整条
  全局时把整条选择器放进一个宏:`:global(.dark .a .b)`。
- 复合写法 `.a:global(.b) .c` 会被展开成**后代**关系(`.a[data-v-x] .b .c[…]`),
  与 Vue 的复合语义不同;这种场景直接写普通复合选择器 `.a.b .c` 即可。

:::

scoped 文件里的 `@keyframes` 会自动改名为 `name-data-v-{hash}`(避免不同页面/组件
的同名动画互相覆盖),同文件内的 `animation` / `animation-name` 引用会同步改写。

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
- **同一进程只能有一份 jsx-scoped 插件实例**:内联 `<style scoped>` 的虚拟模块
  靠插件实例的会话级 registry 传递内容。monorepo / 多包共存时若各 workspace
  锁定了不同版本(安装出两份物理副本),registry 单例会分裂,`load` 阶段就会报
  `找不到组件 … 第 0 个 <style scoped>(内容或顺序已变化?)`——把各处的
  `@10coding/vite-plugin-jsx-scoped`、`@10coding/postcss-jsx-scoped` 版本对齐即可;
- **构建产物**:scoped css 交给 Vite css 管线(dev 注入 + HMR,build 抽取成 css
  资源、仅由对应页面引入)。

::: details 检查方式
- dev:打开本页,元素检查可见正文 DOM 带 `data-v-xxxxxxxx` 属性;
- build:产物 html 同样带 `data-v-xxxxxxxx`,对应 css 资源里选择器形如
  `.md-scoped-card[data-v-xxxxxxxx]`。
:::
