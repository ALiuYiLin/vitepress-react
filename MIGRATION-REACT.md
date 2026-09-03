# VitePress React 化迁移报告

> 基线:`vitepress@2.0.0-alpha.19`(vuejs/vitepress 上游源码,仓库 `ALiuYiLin/vitepress-react`,2025-11 前后)
> 目标:将 `src/client`(Vue 3 实现)迁移为 React 实现,同时尽可能保留 VitePress 的架构骨架(双阶段构建、多入口页面 chunk、自研路由、SSG/水合模型、主题即用户代码)。
> 本文档所有代码位置均以本仓库实际源码为准,并已实际执行 `pnpm exec tsdown` 验证产物形态。

---

## 0. 摘要(TL;DR)

VitePress 里 Vue 承担了**四件**事,迁移成本完全不同:

| # | Vue 的职责 | 位置 | 与 Vue 的耦合强度 |
|---|---|---|---|
| 1 | **页面产物格式**:`.md` → 拼接成 Vue SFC 字符串(`vueSrc`)→ 交给 `@vitejs/plugin-vue` 编译 | `src/node/markdownToVue.ts`、`src/node/plugin.ts` | 强(产物格式、编译插件、模板语法都绑定 Vue) |
| 2 | **客户端运行时内核**:createApp / 自研 router / 数据注入(provide/inject)/ Content 渲染 / SSR 入口 | `src/client/app/*` | 强(Vue API + 响应式模型直接暴露给主题层 API) |
| 3 | **默认主题**:66 个 `.vue` SFC + composables(深度使用 `ref/computed/watch`、`@vueuse/core`) | `src/client/theme-default/*` | **不再机械迁移(已决策)**:上游主题整体弃用,以 shadcn/ui + Tailwind 重建参考主题(结构近似、内容顺序一致) |
| 4 | **构建期微优化与生态**:`lean.js` 静态内容剥离依赖 Vue 编译器输出特征(`createStaticVNode`)、`@vue/devtools-api`、`vue-tsc` 类型检查、scoped CSS、`linkVue()` 等 | `src/node/build/*`、工具链 | 中(有 React 等价物或可直接弃用) |

Node 侧(`src/node`)的编排逻辑——Vite 插件、页面扫描、rewrites、hashmap、多入口构建、SSG 骨架、图标收集、本地搜索、sitemap——绝大部分是 **Vue 无关**的,应原样保留;真正要替换的是一条"纵贯线":**`.md` 产物格式 → 站点编译插件 → 客户端渲染内核 → 默认主题 → SSR 渲染出口**。

推荐的主迁移路线(详见 §5):**保留全部架构,新增 `md → React 模块` 编译产物,重写 `client/app` 渲染内核,用 shadcn/ui + Tailwind 重建参考主题**,全部取舍已收敛为文末 **D1–D11 决策清单(全部已确认,见 §7)**。

**重要参考(§4.0)**:`C:\code\vitepress` 已存在一个同源**完整迁移工程**(ActPress:VitePress → JSX 系框架 ActView;73 个 `.tsx`、0 个 `.vue`,含 `src/node/markdownToActView.ts` 与 `design/` 设计文档、配套单测)。它的 **md → JSX 模块管线与 `.md` 插件接线**对 React 版可直接移植(差异仅在运行时 API 语义);其主题 `.vue→.tsx` 迁移模式**仅作理解参考,不采用**(React 版按 D6 用 shadcn/ui + Tailwind 重建主题)。D1/D2 由此从"待设计"降级为"**已验证、待移植**"。

预计工作量(单人全职,含验证;基于蓝本已验证,所有决策已定):核心内核 + md 管线 **2.5–3.5 周**,主题重建(shadcn,不机械迁移)**1–2 周**,打磨/测试 **1–2 周**,合计约 **4–7 周**;D4 已定放弃 lean、D9 删除 devtools、MPA 删除等均已计入。(粗糙估计,仅用于排期)

---

## 1. 现状:Vue 是怎么被"构建成 JS 并渲染页面"的

整条链路分**两个阶段、三个角色**:

```
┌─ 角色 A:本仓库(vitepress 包)自身源码
│
│ 【阶段一】框架打包  pnpm dev / pnpm build  → tsdown(rolldown)
│    src/node/*.ts        ─────────────►  dist/node/*(CLI+构建 API,node 侧)
│    src/client/*.ts|vue  ─────────────►  dist/client/*(ESM 模块 + 原样 .vue SFC + css/woff2)
│    src/shared/*.ts      ─(复制两份)──►  src/client/shared.ts、src/node/shared.ts → 各自编译
│
│ 【阶段二】站点构建/开发  vitepress dev | build(用户站点目录,由阶段一产物驱动)
│    dist/client + 用户 .md/.vue/theme ─► Vite(rolldown)多入口构建 + 插件链
│         ├─ dev : vite dev server,插件在浏览器侧即时转换,注入 HTML 壳 → 加载 app/index.js
│         └─ build:
│             (a) client build(多入口:app/index.js + 每个 .md 一个 chunk)
│             (b) ssr build(app/ssr.js + 每个 .md)→ tempDir
│             (c) 对每页 nativeImport(tempDir/app.js).render(path)
│                 → Node 里跑 Vue SSR(renderToString)→ 拼 HTML 壳(预载/元数据/head)
└─ 角色 C:浏览器
       首屏: HTML 已含 SSR 内容 → 下载 app chunk + 页面 .lean.js
       → createSSRApp(...).mount('#app') 水合
       → 后续导航:自研 router 拦截 <a> → history.pushState → 按 __VP_HASH_MAP__
         动态 import 页面 chunk(foo_bar.<hash>.js)→ route.component 切换 → 局部重渲
```

### 1.1 阶段一:框架自身是如何把 `src/client` 构建成 JS 的(`tsdown.config.ts`)

关键配置与机制(均已实测验证):

1. **shared 双环境复制**:`src/shared/` 在 buildStart 时被复制成 `src/client/shared/*` 与 `src/node/shared/*`(gitignored),同一份代码分别进入 client/node 产物,并处于 watch 中保持同步。
2. **client 配置**:`entry: src/client/**/*.ts`,`outDir: dist/client`,`unbundle: true` —— **不是打成一个 bundle**,而是每个模块产出独立 ESM 文件、保留相对 import;`dts: { vue: true }` 用 vue-tsc 产出 `.d.ts`(SFC 产出 `*.d.vue.ts`)。
3. **虚拟模块不打包**:`neverBundle: [ /^vitepress/, '@siteData', '@theme/index', '@localSearchIndex' ]` —— `vitepress` 自引用、三个虚拟模块(`@siteData`/`@theme/index`/`@localSearchIndex`)的解析**留给用户站点的 Vite 插件**完成。
4. **`.vue` 不预编译**:`vueSfcPlugin`(`vue-sfc-transformer`)把 `.vue` 当作 external 保留文件说明符,只在**框架打包时**做两件事:把 SFC 里的 TS 语法剥离(产出"纯 JS 版 SFC",例如 `dist/client/theme-default/Layout.vue` 的 `<script setup lang="ts">` 已变成 `<script setup>`),并为每个 SFC 生成声明文件。**模板编译不在阶段一发生**。
5. **样式/字体原样下发**:`clientAssets()` 把 `.css`/`.woff2` emit 为资源文件,并把源码里相对 `.css` import 保留为相对说明符(例如 `theme-default/index.js` 里 `import "./styles/fonts.css"`),由**用户站点的 Vite** 在阶段二真正收进样式表。

> 产物样貌(实测):
> ```
> dist/client/index.js、app/{index,ssr,router,data,theme,utils,...}.js    ← unbundle ESM
> dist/client/theme-default/{Layout.vue, NotFound.vue, components/*.vue}  ← TS 剥离后的原样 SFC
> dist/client/theme-default/styles/*.css、fonts/*.woff2                    ← 原样资源
> dist/client/theme-default/*.d.vue.ts                                     ← SFC 声明
> dist/client/shared.js
> ```

**结论**:框架包把"需要 Vue 编译器的工作"推迟到用户站点构建期完成——`vue` 与 `@vitejs/plugin-vue` 因此必须是 `dependencies`(用户无需自己装 vue,`linkVue()` 甚至在 build 时把 vue 软链进用户 `node_modules` 以保证 SSR 运行时能 `import 'vue'`)。

### 1.2 阶段二(dev):页面在浏览器里的转换与渲染

`src/node/plugin.ts` 组装了一个 **Vite 插件链**(`createVitePressPlugin`):

1. **别名**(`src/node/alias.ts`):`vitepress → dist/client/index.js`、`vitepress/theme → dist/client/theme-default/index.js`;非 SSR 时把 `vue` 指向 **runtime-only 构建** `vue.runtime.esm-bundler.js`(强制只用预编译模板,保证体积)。
2. **虚拟模块**:`@siteData` → `/@siteData` 由 `load()` 返回序列化的站点配置(prod client build 下直接输出 `export default window.__VP_SITE_DATA__`);`@theme/index` → 解析到用户 `.vitepress/theme/index.(j|t)s`(没有则回落到默认主题路径)。
3. **`.md` → Vue SFC**(核心耦合点,详见 §1.5)。
4. **插件装配**:`@vitejs/plugin-vue`(`include: /\.(vue|md)$/`)—— 编译框架自带 SFC、用户 `.vue`、以及 md 生成的 SFC;**同一条编译管线**,所以用户 `.vue`、默认主题、markdown 页面在产物层面无差别。
5. dev 时由 `configureServer` 注入 HTML 壳:`<div id="app">` + `<script type="module" src="/@fs/.../dist/client/app/index.js">`,浏览器随后经 vite 转换加载整棵应用。

### 1.3 阶段二(build):静态站点如何被"烤"出来

`src/node/build/build.ts → bundle.ts → render.ts`:

1. **client build**(`bundle.ts`):多入口构建。入口 = `app: dist/client/app/index.js` + **每个 `.md` 页面一个入口 chunk**(命名规则 `foo/bar.md → foo_bar.md`,输出为 `assets/foo_bar.<hash>.js`,产物里有 `export const __pageData` 与 `default` 组件)。
   - 每个页面 chunk 还会被克隆一份 **`.lean.js`**:`renderChunk` 阶段用正则给 Vue 编译器产出的 `createStaticVNode("大段静态字符串", n)` 打上 `__VP_STATIC_START/END__` 标记 → `generateBundle` 剥离静态字符串后另存为 lean 版。**首屏只下载 lean 版**(静态内容 SSR 已进 HTML),交互需要完整组件时才加载完整 chunk。
   - 输出 `pageToHashMap`(`hashmap.json`,部署后客户端按它定位带 hash 的页面 chunk)。
2. **SSR build**:同样的页面集合 + `app: dist/client/app/ssr.js`,输出到 `config.tempDir`(SSR 产物命名无 hash:`foo_bar.md.js`);`ssr.noExternal: ['vitepress', ...]`,`vue` 保持 external(运行时从用户根目录解析,靠 `linkVue()` 兜底)。
3. **SSG 渲染**(`render.ts`):对 `404.md` + 所有页面,`nativeImport(tempDir/app.js)` 后调用 `render(path)`:
   - `src/client/app/ssr.ts`:`createApp()`(同一个应用工厂!)→ `router.go(path)` → **`renderToString(app, ctx)`**,渲染结果放 `ctx.content`,副作用收集放 `ctx`(`vpIcons: Set`,body `teleports`)。
   - 拼 HTML:title/description/head 合并(`mergeHead`)、每个 head 项序列化、`metadata.<hash>.js`(内含 `__VP_HASH_MAP__` + `__VP_SITE_DATA__` 函数反序列化)、modulepreload 页面 lean chunk 与 app chunk、样式 link、icons css 占位链接等。
4. **收尾**:汇总全部页面用到的图标名,生成仅含这些图标的 `vpi-icons.<hash>.css` 并回填 HTML 占位;写 `hashmap.json`。

### 1.4 客户端运行时:浏览器里的 Vue

`src/client/app/index.ts`(即 dist/client/app/index.js,自启动):

```
inBrowser
 └─ createApp():
     ├─ resolveThemeExtends():处理主题 extends 链(enhanceApp/setup 叠加)
     ├─ newRouter():createRouter(loadPageModule) —— 自研路由,非 vue-router
     │    loadPageModule: pathToFile(path) → import(/*@vite-ignore*/ 'assets/foo_bar.<hash>.js')
     │    (dev 直接 import 源 .md;首屏优先 .lean.js)
     ├─ newApp():PROD → createSSRApp(VitePressApp) / DEV → createApp
     │    VitePressApp:setup() 里 useData()、usePrefetch()、useCopyCode()、useCodeGroups()、Theme.setup()
     │    渲染函数返回 h(Theme.Layout!)      ← 主题 Layout 就是普通 Vue 组件
     ├─ provide(RouterSymbol, router);provide(dataSymbol, initData(route))
     ├─ app.component('Content', Content);app.component('ClientOnly', ClientOnly)  ← 全局组件,md 里可直接用
     ├─ globalProperties.$frontmatter/$params
     ├─ Theme.enhanceApp({ app, router, siteData })   ← 主题/用户增强入口
     └─ dev: setupDevtools(@vue/devtools-api)
 └─ router.go(location.href, {initialLoad}) → useUpdateHead(route, site) → app.mount('#app')
```

- **路由**(`app/router.ts`):`Route` 用 `reactive()` 做成响应式对象(`{path, hash, query, data, component}`);拦截 capture 阶段的 `<a>` 点击 + `popstate`;`route.component = markRaw(comp)` 后 Vue 渲染系统自动重渲。**没有 router-view**,`Content` 组件读 `route.component` 直接 `h(route.component)`。
- **数据**(`app/data.ts`):`siteDataRef`(模块级 shallowRef 单例)+ `initData(route)` 产出 `VitePressData`:全部字段都是 **`computed`/`ref`**(site、theme、page、frontmatter、params、title、description、isDark…),经 `dataSymbol` provide 出去;**`useData()` = `inject(dataSymbol)`**。
- **`Content`**(`app/components/Content.ts`):watch frontmatter + `onVnodeMounted/Updated/Unmounted` → 触发 `contentUpdatedCallbacks`(代码块复制、代码组、大纲等"内容副作用"靠它);`frontmatter.layout === false` 时 Layout 直接渲染 `<Content/>`。
- **图标**(`app/composables/icon.ts`):SSR 侧用 **`useSSRContext()`** 把用到的图标名写进 `ctx.vpIcons`;dev 侧动态抓取 svg;prod 用已生成的 hash css。主题组件通过 `useIcon()` 得到 `vpi-*` class。
- **utils**:`defineClientComponent` 基于异步组件 + `onMounted` 的客户端专载组件工厂;`onContentUpdated` 基于 `tryOnUnmounted` 的全局回调注册表;`pathToFile` 完成 URL → chunk 文件名换算(依赖 `__VP_HASH_MAP__`、`__ASSETS_DIR__`、`__ASSETS_BASE__`)。

### 1.5 关键耦合点 ①:`.md` → Vue SFC(`src/node/markdownToVue.ts`)

对每个 `.md`(rewrites/动态路由/params/多语言处理之后):

1. `createMarkdownRenderer()` 建 markdown-it 渲染器,装配:语法插件 + `@mdit-vue/plugin-component`(markdown 里的组件标签)、`plugin-frontmatter`、`plugin-headers`、`plugin-sfc`(提取 md 内嵌的 `<script>`/`<style>` 等块)、`plugin-title`、`plugin-toc`,以及容器、锚点、高亮、include 等。
2. `md.renderAsync(src, env)` 产出**整页 HTML 字符串**。
3. 收集 `pageData`(title/frontmatter/headers/params/lastUpdated/relativePath…),算出死链。
4. **拼 SFC**(`vueSrc`):用户 md 内嵌 `<script>` 块 + 注入的 `export const __pageData = JSON.parse(...)` + 兜底 `export default {name: relativePath}` + `<template><div>${html}</div></template>` + 内嵌 `<style>` 块。
5. 返回给 plugin.ts 的 `transform` 钩子 → **plugin-vue 把这个字符串当 SFC 编译**(所以 md 里的 HTML 实际是"Vue 模板":`{{ }}` 插值、指令、组件标签都生效;markdown 管道的各处 `v-pre`/`raw`/插值转义插件都在为此兜底)。

> 这一环是 React 化必须整体替换、且替换方案会决定整份迁移工作量的环节(见 §4-L1 / 决策 D1、D2)。**可行性与实现模式已由 §4.0 的同构参考工程(ActPress)验证并产出可移植代码**——`C:\code\vitepress\src\node\markdownToActView.ts`。

### 1.6 关键耦合点 ②:SSR 上下文通道

`types/shared.d.ts`:`SSGContext extends SSRContext(vue/server-renderer)`,渲染期把 `content`、`vpIcons`、`teleports` 塞进 **Vue SSR 上下文**(`renderToString(app, ctx)` 第二个参数;组件内 `useSSRContext()` 读取)。React 没有等价的"渲染上下文收集"通道——需要自建(见 §4-M4)。

### 1.7 Vue 能力在 `src/client` 的全量使用盘点(迁移面)

| 目录 | 内容 | 规模 |
|---|---|---|
| `client/app` | 渲染内核(自启动、SSR 入口、router、data、theme、head、utils、Content/ClientOnly、icon/copyCode/codeGroups/preFetch 等 composables、devtools) | 14 个 TS |
| `client/theme-default` | 默认主题:Layout/NotFound + 64 个 `VP*` 组件(components)+ 12 composables + support(reactivity/lru/translation/utils/sidebar/docsearch) | 66 个 `.vue` + 20 个 TS + 11 个 css |
| 框架包根导出 | `vitepress` 公共 API:useData/useRoute/useRouter/Content/ClientOnly/useIcon/onContentUpdated/withBase/defineClientComponent/_escapeHtml;模块增强 `declare module 'vue'`(全局组件 `Content/ClientOnly`、`$frontmatter/$params`) | `client/index.ts` |

**使用的 Vue 能力清单**(迁移时逐项对照,React 对应物见 §3 映射表):

- 运行时:`createApp/createSSRApp/defineComponent/h/ref/computed/watch/watchEffect/watchPostEffect/reactive/readonly/markRaw/shallowRef/nextTick/inject/provide/useId/useTemplateRef(3.5)/useSSRContext/onMounted/onUnmounted/onBeforeUnmount/useSlots/defineAsyncComponent/resolveDynamicComponent/onVnode* / provide-typed InjectionKey`。
- 响应式模型作为**公共 API 语义**(`VitePressData` 各字段是 `Ref<T>`,`Route` 是 reactive 对象)。
- `@vueuse/core`:useDark/usePreferredDark/useMediaQuery/useWindowScroll/useEventListener/onKeyStroke/whenever/tryOnUnmounted/useFocusTrap。
- SSR:`vue/server-renderer` 的 `renderToString` 与 `SSRContext`(teleports、`@vue/shared` 的 `isBooleanAttr` 用于 node 侧 head 属性渲染)。
- 编译器/工具链:`@vitejs/plugin-vue`、Vue 模板编译器的静态提升产物(`createStaticVNode` + lean 剥离)、`vue-tsc` 类型检查、scoped style 的 `data-v-*`、`vue-sfc-transformer`、runtime-only vue 别名、`optimizeDeps` include vue、`linkVue()`。
- devtools:`@vue/devtools-api`。
- Vue 专属运行时约定:全局组件注册供 md 模板使用;`Content` 的 wrapper 元素(vnode hooks 触发内容副作用);`useSSRContext` 图标收集;`v-pre`/`raw` 容器;md 内 `<script setup lang="ts">`、SFC-style 内嵌样式。

---

## 2. 迁移目标与原则

**目标架构**:同一张 VitePress 骨架,把渲染内核整条换成 React;默认主题**不机械迁移**——以 shadcn/ui + Tailwind 重建一套 React 主题,只保证信息架构与内容顺序一致(已决策,见 D6/D11):

```
阶段一(框架打包): tsdown 保持;src/client .ts→.js 不变;.vue/.vue 专用产物全部移除,
                   默认主题替换为 React 主题(tsx + 普通 css/tailwind 产物)
阶段二(站点构建): 插件链中 plugin-vue → JSX 编译(vitepress 插件内 esbuild);
                   .md 不再产出 vueSrc,改为产出 React 模块(默认导出组件 + __pageData)
SSR 出口:          vue renderToString → react-dom/server 渲染;
                   上下文通道(ctx.vpIcons/teleports)自建
浏览器:            createSSRApp().mount → createRoot/hydrateRoot;自研 router 不变,组件类型换 React
默认主题:          shadcn/ui + Tailwind 重建(布局/导航/侧边栏/大纲结构近似即可,不逐像素/逐 class 对齐;
                   导航项等内容的顺序必须与 themeConfig 数据一致)
```

**原则**:

1. **架构层零重构**:页面扫描、rewrites、动态路由、多入口 chunk 命名、hashmap、metadata 注入、preload/prefetch、SSG 逐页流程、sitemap——全部与渲染框架/主题无关,尽量**只改类型不改逻辑**。
2. **把 Vue 压缩到最少文件里**:理想终态是全仓库无 `vue` import、`package.json` 无 vue 依赖、`types/*` 无 vue 类型;迁移顺序保证"先换内核、后换主题",任意中间态可构建可回退。
3. **公共 API 保留,主题契约按 React 重设计**:`useData/useRoute/useRouter/Content/onContentUpdated/withBase` 等保留名称与职责(D3/D5);Vue 专属主题(如 `Layout.vue` 插槽体系、provide/inject 约定)**不作为兼容目标**。
4. **正文内容一致性是硬指标,外壳只是"结构相似"**:md 渲染产物的**内容顺序、文本、标题层级、锚点链接、代码块等语义**必须与上游一致(水合后页面内容符合预期);**展示层(类名、间距、配色、组件视觉)不追求与 VitePress 默认主题一致**,由新主题(Tailwind/shadcn)自由发挥。
5. **产物级微优化不阻塞主线**:lean chunk、内容副作用时机等作为独立里程碑,先正确后优化。

---

## 3. Vue ↔ React 关键技术映射表

| Vue 能力(用法位置) | React 对应物 | 备注 |
|---|---|---|
| `createSSRApp(VitePressApp)` / `createApp` | `createRoot` / `hydrateRoot` | 入口结构保留:`<VitePressApp/>` 变 React 根组件,内部 render Theme.Layout |
| `h(Theme.Layout)` + slots | `<Theme.Layout>{children}</Theme.Layout>` + props 渲染函数 | Layout 契约从 "Vue 组件" 变 "React 组件类型" |
| `renderToString(app, ctx)` | `react-dom/server` 的 `renderToString`(或 `renderToPipeableStream`) | **ctx 无等价物**,需自建收集通道(§4-M4) |
| `route.component` 是 Vue 组件 | 页面模块默认导出 React 组件 | 类型:`Component`→`ComponentType` |
| `reactive(route)` + 模板自动重渲 | 外部 store + `useSyncExternalStore`(或自研版本化快照) | 见 §4-M3 |
| `computed/ref` 作为 `useData()` 返回值语义 | **决策 D3**:兼容 Ref 语义 / 快照+订阅 / 状态库 | 影响整个主题层写法 |
| `inject/provide` | React Context | `RouterSymbol/dataSymbol` → Context |
| `watch(frontmatter, cb, {deep, flush:'post'})` + `onVnodeMounted/Updated` | `useEffect`(路由数据变化)+ 提交后回调队列;`useLayoutEffect` | `onContentUpdated` 语义需保序、post-render 触发 |
| `onMounted`/`onUnmounted`/`onBeforeUnmount` | `useEffect` cleanup | |
| `watchEffect/watchPostEffect` | `useEffect` / `useLayoutEffect`(依赖粗粒度) | 部分场景改事件订阅 |
| `ref(el)` / `useTemplateRef` | `useRef` + ref callback | `VPLocalNavOutlineDropdown` 等注意时机 |
| `shallowRef` 单例 `siteDataRef` | 模块级不可变对象 + 版本号订阅 | |
| `defineAsyncComponent` | `React.lazy` + `Suspense`(或自实现 mounted 后载入) | `defineClientComponent` 有 DOM 副作用,React 版需"挂载后补挂"或 island 化 |
| `resolveDynamicComponent`(VPContent) | 组件注册表对象 + 变量组件 | |
| `useId`(Vue 3.5) | `useId`(React 18+) | 直接对应 |
| `@vueuse/core`(useDark/useMediaQuery/…) | 等价 React 库(usehooks-ts / @react-hookz/web 等,逐个映射) | **已决策 D7** |
| `@vue/devtools-api` | React DevTools 自定义 或 弃用 | **决策 D9** |
| `template refs/scoped CSS/`v-if`/`v-for`/指令 | JSX + Tailwind/shadcn(主题不再使用 scoped 编译) | **已决策 D6**:上游 scoped 主题整体弃用,无需对应物 |
| `@vitejs/plugin-vue`(include .vue/md) | `@vitejs/plugin-react`(fast-refresh、jsx runtime) | md 的 transform 在 vitepress 插件内自写并**插件内用 esbuild 编译 JSX**(照蓝本);plugin-react 只服务用户/主题 `.tsx` 的 fast-refresh |
| vue-tsc / vue-sfc-transformer / `dts:{vue:true}` | 纯 tsc(tsdown dts) | SFC 类型检查消失 |
| `v-pre`/`raw`/eager frontmatter 插值等 md→模板适配插件 | 正文已字面化,不再有模板语义 | v-pre 语义与插值转义插件删除;`raw` 容器保留(其"原样 HTML/不处理链接"语义仍被引用);eager frontmatter 插值功能一并砍掉 |
| Vue 编译器静态提升产物 + lean.js 剥离 | **无等价物**(React 无编译期静态 vnode 概念) | 见 §4-M5 / 决策 D4 |
| runtime-only vue 别名 / `optimizeDeps` include vue / linkVue | react/react-dom 直接成为 dependencies;SSR 运行时解析同样需要 link 兜底(linkVue → linkReact 或改为 `ssr.noExternal: ['react','react-dom']` 内联) | **决策 D8** |
| `useSSRContext` 图标收集 | 自建"渲染期注册表 + 渲染后回收" | §4-M4 |
| `ctx.teleports`(body 级内容,如弹层) | SSR 下 React portal 无输出点 → 自建 TeleportCollector | §4-M4 |
| `$frontmatter/$params` 全局属性 + md 正文模板插值 | **不再支持正文插值(已决策 D1)**:`{{ }}` 一律字面;动态内容 = script 块组件 + 正文引用(组件在渲染树内,可用 useData/useRoute) | D1(已定) |
| `declare module 'vue' { GlobalComponents }` 类型增强 | 无(React 全局组件=注册表) | D5 |

---

## 4. 迁移设计:分层方案与关键机制

按依赖方向分为 6 层,每层给出:改动面、目标形态、验证标准。

### 4.0 先看蓝本:ActPress(Vue → JSX 系框架 ActView 的完整迁移,已跑通)

> 位置:`C:\code\vitepress`(独立分支仓库,`@actview/press`)。它把 VitePress 客户端 + 默认主题从 Vue 迁移到 JSX 系框架 ActView(`actview` + `@actview/jsx` + `@actview/plugin-vite`,Babel 插件 + esbuild 编译 JSX),产物 73 个 `.tsx`、**0 个 `.vue`**,并沉淀了设计文档 `design/md-pipeline.md`(编译链路)、`design/magrite.md`(原理)、`design/plan.md`(分期计划)、`design/setup-snapshot.md` 与单测。以下事实均已逐一核实;React 与 ActView 同为 JSX 运行时,该工程除"运行时 API 语义"外几乎整份可平移。

**① md → 模块源码管线(核心,可直接移植为 `markdownToReact.ts`)**

```
md 源文件
 ├─ maskScriptBlocks():真实 <script setup>/<script lang="tsx"> 块 → 三行占位
 │     (fence 感知:``` 内的示例代码跳过;规避 html_block 以任意 </pre> 截断 script)
 ├─ markdown-it renderAsync(高亮/容器/锚点/死链/pageData 全不动)
 │     tsxSfcPlugin(html_block 规则,注册在 plugin-component 之后):提取 script 块,
 │     从 env 还原原始源码 → sfcBlocks.scripts
 ├─ serializeHtmlToJsx(html, componentNames):手写 tokenizer(约 400 行)解析最终 HTML → JSX 源码
 │     · 顶层 <div> 包裹(与 vueSrc 版 <template><div>…</div></template> 输出一致)
 │     · 文本一律字面 {JSON.stringify(decoded)};相邻文本合并;<pre> 内空白保留
 │     · 实体单遍解码(命名实体表 + 数字实体,与浏览器 innerHTML 语义一致)
 │     · on* 字符串属性、@click/:foo 等绑定 → 丢弃 + 告警
 │     · 大写标签:仅在 script 块具名导出/顶层声明集合内 → <Comp/>;否则按文本渲染 + 告警
 └─ createActViewSrc():组装模块源码
       · 所有 script 内容 import 去重后提升模块顶层;用户 export default 剥离(注释保留)
       · export const __pageData = JSON.parse(...)   ← 契约不变
       · <style> 块 → 客户端运行时注入 <style> 标签(SSR 不注入);custom block 注释保留
       · 正文 JSX 包进组件:defineComponent(function(){ return () => (<div>…</div>) })
```

**② `.md` 模块的 JSX 编译接线(照抄即可)**:vitepress 插件(`enforce: 'pre'`)的 transform 返回上述 TSX 源码,**并在插件内部用 vite 的 `transformWithEsbuild(src, 'page.md.tsx', { loader: 'tsx', jsx: 'automatic', jsxImportSource })` 编译成纯 JS**——不改扩展名、不依赖第三方插件处理 `.md`,同时避免 import-analysis 提前 parse md 报错;`optimizeDeps.include` 显式列出 jsx-runtime / jsx-dev-runtime(蓝本 bug#1 教训:漏了会在首次进入含自定义组件的页面触发 re-optimize + full reload)。

**③ 客户端/主题迁移模式**:`.vue` → `.tsx`;scoped `<style>` 先平移为 `styles/components/*.css` 全局化(VP 前缀类,与 CSS 变量体系并存),后补了构建期 `?scoped` css + babel 注入 `data-v-*` 的烘焙;`@vueuse` 全手写替换;`v-html` 改文本渲染或 ref+onMounted 注入;具名插槽 props 透传。(⚠️ 该主题迁移路径仅供理解参考——React 版已按 D6 **不采用**机械迁移,主题改为 shadcn/ui + Tailwind 重建。)

**④ 蓝本取舍 vs React 版建议(关键差异表,也是本报告各决策的依据)**

| 蓝本(ActPress)选择 | React 版建议(差异即 React 的优势/代价) |
|---|---|
| **砍掉 SSR/水合**:只做构建期 `renderToString` 静态 HTML,浏览器端全量重新挂载(无 hydrate,接受首帧替换) | **保留 SSR + hydrateRoot**(React 原生能力,静态 HTML 与客户端树天然一致,无需 ActView 式取舍);代价是首屏页面 chunk 需完整下载(即 D4-A) |
| 三种 `<script>` 一律提升为模块顶层(蓝本为"setup 只执行一次"的快照语义配套了 `setup-snapshot.md`) | **React 版采用同一模型(已决策 D1)**:所有 script 块内容统一提升到模块顶层;页面组件只渲染字面正文;模块顶层函数组件里 `useState` 等 hooks 本就合法,不存在"setup 快照"问题 |
| 正文 `{{ }}` **一律字面文本、不求值**(蓝本契约) | **采纳(已决策)**;理由:`{{ }}` 与 markdown-it attrs(`{#id}`)冲突——正文若被当表达式编译,`{{ #id }}` 等会被 attrs 插件解析吞掉或产生非法表达式;字面化后与 md 语法零冲突,v-pre/raw 插值转义体系整体删除;动态内容一律"script 块导出组件 + 正文 `<Comp/>` 引用" |
| `defineComponent(setup)` + render 函数(需要 Babel 把裸函数组件包一层) | React 函数组件即组件本身,生成代码零包装;正文 JSX 就是函数体 return |
| 主题 composables 继续用框架自带响应式(`ref/computed` 与原 Vue 代码几乎不改) | **React 无响应式 API** → 主题层全部 hook 化或快照订阅,这是 React 版特有、蓝本没有帮你解决的问题(D3) |
| 换用框架自带 `@actview/router` | 自研 router 保留(其逻辑本身无框架依赖;React 侧仅把 `reactive(route)` 换成 store 订阅,L2) |
| `?scoped` + babel `data-v-*` 烘焙(先全局化,按需补 scoped) | **不采用(已决策 D6)**:不做上游主题样式迁移;新主题直接走 shadcn/ui + Tailwind |

**⑤ 可直接参考的测试与验收**:蓝本配套单测(`__tests__/unit/node/markdownToActView.test.ts`、serializer 单测、happy-dom 冒烟 shell:Layout → Content → md 页面组件真实渲染)可改造为 React 断言;其「renderToString 输出与挂载后 innerHTML 逐字符一致」「`__pageData` 契约、实体单遍解码、`on*` 不输出、void 元素不闭合」等断言项与 React 的 SSR/hydrate 验收同构。

### L0 `src/shared` / 根 `types/*` —— 去 Vue 化(约 2–3 天)

- `types/shared.d.ts`:`SSGContext extends SSRContext` → 改为自有 `SSGContext { content, vpIcons, teleports? }`;`Route.component: Component|null` → `ComponentType|null`;`VitePressData` 的 `Ref<T>` → **取决于 D3**;`SfcBlock/MarkdownSfcBlocks`(Vue SFC 概念)按 D1 删除或改造。
- `src/shared/shared.ts` 纯 TS 函数(mergeHead/stackView/isActive/…)**全部保留不动**。
- `tsconfig.base/client/node/shared.json`:摘除 vue-tsc;client 的 jsx 配置(`"jsx": "react-jsx"`)。

### L1 页面产物格式:`.md → React 模块`(核心改造,≈1–1.5 周;蓝本已验证,主体是移植 + React 语义适配)

新建 `markdownToReact.ts`(`C:\code\vitepress\src\node\markdownToActView.ts` 直接对照移植),五段管线:

1. **script 占位 + fence 感知**(蓝本 `maskScriptBlocks` 原样移植):渲染 markdown 前,把正文中顶格的、**带 `setup` 或 `lang="tsx"` 属性的 `<script>` 块**替换为三行占位(原始内容暂存;识别范围与蓝本一致,其余 script 形态不进本管线),规避 markdown-it `html_block` 被 script 内 `</pre>` 等闭合标签提前截断的问题;逐行跟踪 fenced code block(``` 内示例代码不占位,否则占位符会泄漏到页面)。渲染后由自写的 html_block 规则(蓝本 `tsxSfcPlugin`,注册在 `@mdit-vue/plugin-component` **之后**)把占位块提取进 `sfcBlocks.scripts` 并还原原始源码。
2. **markdown-it 渲染(零改动)**:现有渲染器与全部插件(高亮/容器/锚点/表格/include/死链收集/toc…)照旧,输出整页 HTML;`markdownToVue.ts` 骨架里与 Vue 无关的部分(缓存、pageData 推导、transformPageData、git 时间戳、deadLinks 校验)整体保留。
3. **HTML → JSX 序列化**(蓝本 `serializeHtmlToJsx` 移植,React 适配点用 ⚡ 标出):
   - 文本合并、`<pre>` 内空白保留、实体单遍解码(命名实体表 + 数字实体)照搬;
   - ⚡ **React 属性名映射(蓝本无需、移植必做)**:HTML 属性名 → React prop 名——`class`→`className`、`tabindex`→`tabIndex`、`for`→`htmlFor`、`readonly`→`readOnly`、`colspan`→`colSpan`、`contenteditable`→`contentEditable` 等(约 30 项小表;`data-*`/`aria-*` 原样通过);`style="prop: value; …"` 字符串需解析为**对象字面量表达式**输出(`--custom` 自定义属性保留引号、普通属性 camelCase——shiki 高亮的 `--shiki-light/--shiki-dark` 就靠它);无值属性 → JSX 布尔属性;
   - `on*` 字符串属性、`@click`/`:foo` 绑定 → 丢弃并告警(与蓝本一致);
   - **正文文本一律字面**(已决策 D1-A1):所有文本(含 `{{ }}`、`{ }` 形态)原样转义输出为 JSX 字符串,**不求值**——原因:`{{ }}` 与 markdown-it 的 attrs 语法冲突(`{#id}` 等:双括号内以 `#`/`.` 开头的内容会被 attrs 插件解析吞掉或编译成非法表达式),字面化后与 md 语法零冲突,序列化器不需要插值解析,v-pre/raw 插值转义体系也不需要了;
   - ⚡ 大写标签解析:组件名集合 = **模块顶层**大写声明/import(蓝本 `extractComponentNames` 原样可用;脚本全部提升到模块顶层,无函数体内声明);命中 → `<Comp/>` 组件引用,未命中 → 按文本渲染 + 告警;
   - 顶层 `<div>` 包裹,与上游 `<template><div>…</div></template>` 的正文结构一致;正文产物的 `class` 只保留语义必需部分(如代码块高亮所需的类),`vp-doc`/`header-anchor` 等上游展示类**不属契约**,由主题排版层自行处理(锚点链接 `href="#id"` 功能保留)。
4. **模块组装**(`createReactSrc`;已决策 D1-A1 后与蓝本结构一致):

   ```tsx
   // —— 模块顶层:被提取的 <script> 块内容(setup / lang="tsx" 不再区分;
   //    import 跨块去重;用户 export default 剥离为注释;可在此定义/导出组件与工具函数)
   export const __pageData = JSON.parse(`{...}`)     // 契约不变,主题 useData() 消费
   export default function Page() {
     return (
       <div>{/* 步骤 3 序列化出的正文 JSX(字面;仅以 <Comp/> 引用模块顶层的组件)*/}</div>
     )
   }
   // <style> 块:直接输出为「页面组件渲染 <style>{css}</style>」(React 对 style/script 按 raw text 处理,
   //   SSR/hydrate 两端一致;优于蓝本的"客户端运行时注入、SSR 不注入");custom block → 注释保留
   ```

   说明:脚本块中定义的组件是普通 React 函数组件,`useState` 等 hooks 在模块顶层函数里完全合法;它们在渲染树内被引用时,和主题组件一样可以调用框架注入的 `useData()`/`useRoute()`(Context)。正文不引用脚本局部变量,因此不存在"正文表达式作用域"问题。
5. **JSX → JS 编译接线**(照抄蓝本 `compileActViewSrc` 模式):vitepress 插件(`enforce: 'pre'`)的 `.md` transform 返回步骤 4 的 TSX 源码,并在**插件内部**用 vite `transformWithEsbuild(code, 'page.md.tsx', { loader: 'tsx', jsx: 'automatic' })` 编译成纯 JS(jsxImportSource 默认 react,产物 import `react/jsx-runtime`);同时把 `react/jsx-runtime`、`react/jsx-dev-runtime` 加进 `optimizeDeps.include`(蓝本 bug#1:漏配会导致首次进入含自定义组件页面时 re-optimize + full reload)。

**产物示例**(最终契约:正文全字面;动态内容 = script 块导出组件 + 正文引用):

````markdown
# 源文件 counter.md
<script setup>
import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)
  return (
    <p>
      counter value is {count}{' '}
      <button onClick={() => setCount(count + 1)}>+1</button>
    </p>
  )
}
</script>
## counter

<Counter/>

正文里写 `{{ count }}` 会作为字面文本原样显示(不求值;插值与 attrs 语法如 `{#id}` 的冲突也因此不存在)
````

```tsx
// 编译产物(示意;JSX 由插件内 esbuild 转成纯 JS)
import { useState } from 'react'              // script 内容整体提升到模块顶层
export function Counter() { … }               // 供正文 <Counter/> 引用(hooks 合法;
                                              // 渲染树内仍可 useData()/useRoute())
export const __pageData = JSON.parse(`{...}`) // 契约不变
export default function Page() {
  return (
    <div>
      <h2 id="counter" tabIndex="-1">counter<a className="header-anchor" href="#counter">…</a></h2>
      <Counter />
      <p>正文里写{'{{ count }}'}会作为字面文本原样显示(不求值…)</p>
      {/* 说明:所有正文文本经 JSON.stringify 输出,{{ }} 不会被解释,也不需要 v-pre/raw 插值转义 */}
    </div>
  )
}
```

**验证标准**:dev 与 build 下渲染 md 页面,静态正文按"**语义一致**"对比基线(标签、文本、内容顺序、锚点 id/href、代码块内容;展示类与主题壳差异不计入,已决策 D6);`__pageData`、headers、死链、include/HMR 全部保持;照蓝本补 serializer 单测与「md → 组件 → Content」happy-dom 冒烟。

### L2 客户端渲染内核:重写 `client/app`(约 2 周)

逐文件目标形态:

| 现文件 | React 版职责 |
|---|---|
| `index.ts` | 根组件 `VitePressApp`(Lang/Dir 副作用、prefetch/copyCode/codeGroups 全局副作用、Theme.setup 等价物);`createApp()` 工厂(`createRoot`/`hydrateRoot`、Context 注入、全局组件注册表、Theme.enhanceApp 等价物、devtools);浏览器自启动逻辑不变(先 router.go 再 mount) |
| `ssr.ts` | `render(path)`:createApp(SSR 模式)→ router.go → react-dom/server 渲染 → 返回 `SSGContext`(content/teleports/vpIcons) |
| `router.ts` | **保留自研路由几乎全部逻辑**(拦截、normalize、popstate、scroll、HMR pageData、fallback);`reactive(route)` 改为外部 store;`useRouter/useRoute` 改为 hook;`route.component` 类型换 React |
| `data.ts` | `siteDataRef` + `initData(route)` 的数据工厂按 D3 实现;`useData()` 为 hook(依赖注入层) |
| `theme.ts` | `Theme` 类型:`Layout: ComponentType`、`enhanceApp` 改名/改签名(**D5**)、`setup` → 根组件副作用注册、`extends` 合并逻辑保留 |
| `components/Content.tsx` | 用 React 重写:`props.as`、内容副作用回调在渲染提交后触发、渲染 `route.component` |
| `components/ClientOnly.tsx` | `useEffect` 挂载后显示子内容(或 18 前经典 isMounted 模式) |
| `composables/icon.ts` | SSR 收集注册表版;dev 内联版;prod class 版(hook) |
| `utils.ts` | 纯工具保留;`defineClientComponent` 改造(客户端补挂/懒加载);`pathToFile` 等保留 |
| `devtools.ts` | 按 D9 |
| `composables/head.ts` | 逻辑(合并/增删 head 元素)本身与框架无关,把 `watchEffect` 改为显式调用(router 变化后执行);**不需要 React Helmet 类库**(项目现状就是命令式管理,保持) |

内核其余细节:

- **Content 与 Layout 的关系**:React 版中 `Content` 渲染路由组件。由于 React 没有细粒度响应式,导航时最小重渲范围是 `Content` 子树;**Layout 其余部分**(导航、侧栏高亮等)依赖 route/data 的订阅粒度——订阅粒度按 M3 的 store 设计,组件内部用 selector 订阅,React 自动把更新裁剪到用到的组件。
- **`onContentUpdated` 语义**:commit 后回调队列 + 导航时 frontmatter 变更也触发;用 `useLayoutEffect`/`flushSync` 后队列保证与 Vue 的 `flush: 'post'` 行为对齐(文档代码块复制/代码组/大纲滚动这类副作用依赖它)。

### L3 数据与状态模型(与 L2 交织,列出单独设计;1 周并入 L2)

**决策 D3 是 L2/L4 工作量最大的单点**,三个选项:

- **V3(兼容优先)**:继续使用 `@vue/reactivity`(`ref/computed/watch`)作为 store 内核,`useData()` 内部用 `useSyncExternalStore` 把 Ref 值同步给 React(需要自定义订阅:对 shallowRef 做 get/set 拦截或外层事件桥)。优点:主题 composables 几乎零改写、md 脚本块语义接近、SSR/CSR 同构数据流照搬;缺点:**vue 包(或 reactivity 子包)仍然在依赖里**,与"彻底 React 化"目标冲突,且每组件订阅粒度需要桥接层,易出 bug。
- **S2(推荐)**:**版本化快照 store**:`site`/`page` 等数据在导航/事件时生成新快照 + bump 版本;`useData()` = `useSyncExternalStore(subscribe, () => version + snapshot)` 分片返回;内部"计算派生值"(title/description/lang 等)用 useMemo。主题 composables 全部改为"在组件内调用 hook"或"纯函数 + 显式依赖"。
- **Z1**:引入 zustand/jotai 之类状态库。多一个运行时依赖,且把 VitePress 数据模型翻译成 store 形状仍要设计,收益一般。

另注意:`isDark`/appearance(useDark)是**浏览器全局副作用状态**(localStorage + 系统偏好 + 媒体查询),与路由数据正交,做成独立 hook + 外部事件即可,不放进主 store。

> 蓝本对照:ActPress 的主题 composables 几乎零改写,是因为 ActView 自带 `ref/computed/watch`(与 Vue 同名);**React 版没有这一层,D3 是蓝本没遇到、React 版独有的最大设计决策(已定 S2)**。蓝本仍可借鉴两点:① 去掉 provide/inject,data/router 用模块级 context(单例,React 侧用 Context 或 store 皆可);② 替代 `@vueuse` 的行为参考(React 版按 D7 选等价库;蓝本的手写版可作行为对照)。

### L4 默认主题:用 shadcn/ui + Tailwind 重建(约 1–2 周;不做机械迁移——已决策 D6/D11)

**不做的事**:不迁移 66 个 `.vue`、不保留 `VP*` 组件树、不搬运 scoped 样式、不做 `.vue`→`.tsx` 机械翻译。理由:React/Vue 差异大,逐组件生搬工作量高且产物不 React;目标站点的视觉由新主题决定。

**做的是"按信息架构重建"**:默认主题不再是"上游默认主题的 React 版",而是一套**参考主题**,满足两条硬约束:

1. **内容顺序契约**:导航栏、侧边栏、大纲等所有**数据驱动内容的渲染顺序**必须与 `themeConfig.nav` / `sidebar` / frontmatter 一致(例如顶部导航右侧:指南 → 参考 → 多语言切换,迁移后顺序相同);结构/组件拆分/类名可以有差异。
2. **正文水合正确**:md 页面在 SSR HTML 与 hydrate 后内容一致(见 L1 产物 + 原则 4)。

重建清单(对标上游布局,但全部用 shadcn/ui + Tailwind):

| 上游布局块(参考) | React 重建要点 |
|---|---|
| 顶部导航 `VPNav`(标题、菜单、右侧 指南/参考/语言等,含移动端汉堡/抽屉) | `nav` 数据来自 `themeConfig.nav`;多语言切换用 `site.locales`;shadcn `NavigationMenu`/`DropdownMenu`/`Sheet`;dark 切换(等价库 hook,D7) |
| 侧边导航 `VPSidebar`(分组/折叠、当前页高亮、上一页/下一页) | `themeConfig.sidebar` + `useRoute` 高亮(`isActive` 逻辑在 shared 层,保留);`VPSidebarItem` 等价物 |
| 内容区布局 `VPContent`(doc / home / page 布局分发、大纲栏、广告位等) | 页面 `frontmatter.layout` 分发:`doc` → 正文 + `VPDocAsideOutline` 等价(TOC 从 `page.headers` 渲染 + 滚动高亮 hook);`home`/`page` 布局由新主题自由实现 |
| 正文排版 | md 产物 DOM(标题/段落/代码块/表格…)语义不变;样式由主题侧 typography 层负责(Tailwind 或 `@tailwindcss/typography` prose 等),不再依赖上游 `.vp-doc` CSS |
| 页脚/404/搜索框等 | 可选:docsearch(纯 JS 接入)或本地搜索(`localSearchPlugin` 产物格式保留,主题自写 UI) |

工程要点:

- 主题目录沿用 `.vitepress/theme/index.ts` 契约(默认导出 `{ Layout, enhanceApp, extends }` 的 React 版,包面 `vitepress/theme` 保留),新主题 = 这份 theme 的 React 默认实现;用户覆盖方式与上游相同(自定义主题/`extends`);
- composables 层只留框架 API 所需(useData/useRoute 等由 `client/app` 提供,见 L2/L3);`useDark`、`useMediaQuery` 等**优先选用等价 React 库**(D7 已决策),库未覆盖的(如大纲滚动 spy、聚焦陷阱)按 React hook 少量自写;
- **样式体系**:Tailwind(v4,用 CSS 层与 vite 插件接入即可)+ shadcn/ui(组件源码放进主题仓库,不引入额外运行时依赖);上游 `theme-default/styles/*`、`fonts/*`(Inter)、icons css 机制不再需要;
- 原 `theme-default/` 目录处置:整目录删除或保留为参考快照(见 D11 的仓库布局决策);`client.d.ts`/`theme.d.ts` 类型随主题契约(D5)重写。

**验证**:以 `docs/` 为 dogfood:SSR HTML 中导航项文本与顺序、侧边栏分组与顺序、正文标题/锚点与源 md 一致;hydrate 后交互(导航跳转、折叠、暗色切换、大纲定位)正常;playwright e2e 断言"内容顺序 + 关键节点存在 + 水合无 mismatch"。

### L5 构建链路/工具链替换(与 L1/L2 并行推进;约 1 周)

| 项 | Vue 现状 | React 目标 |
|---|---|---|
| 页面/组件编译插件 | `@vitejs/plugin-vue`(include .vue\|.md) | `@vitejs/plugin-react`;md 的 transform 在 vitepress 插件内完成后再走 jsx 编译 |
| 别名 | `vue` → runtime-only | 无;react/jsx-runtime 由插件自动注入 |
| define | `__VUE_PROD_HYDRATION_MISMATCH_DETAILS__` 等 | 删除;React 无生产水合详情开关 |
| optimizeDeps | include vue/@vueuse 等 | react/react-dom/jsx-runtime 无需(或按需) |
| SSR 外部化 | `noExternal: vitepress`;vue external;`linkVue()` 软链 | react/react-dom 保持 external + 把 `linkVue` 泛化成 `linkReact`(或 D8) |
| `render.ts` 的 `@vue/shared isBooleanAttr` | 从 vue 包 import | 拷一份约 60 行布尔属性表到 `src/shared`(纯数据,无框架耦合) |
| 产物级优化 | lean.js 依赖 `createStaticVNode` 输出 | 按 D4 |
| 包依赖 | vue/@vueuse/@vue/devtools-api/plugin-vue/vue-tsc/vue-sfc-transformer… | react/react-dom/plugin-react;其余删除或替换(见 D7/D9) |
| 类型检查 | `vue-tsc -p tsconfig.client.json` | `tsc -p tsconfig.client.json`(react-jsx) |
| devtools | @vue/devtools-api 插件 | 按 D9 |

### 关键机制深水区

#### M4 SSR 上下文与 teleports(自建通道)

现状:`renderToString(app, ctx)` 依赖 Vue 把 ctx 传遍组件树(`useSSRContext`),收集 `vpIcons`、`ctx.teleports`。React 的 SSR 渲染**不接受外部可变上下文**。自建方案:

- 图标收集:模块级"注册表"对象 + 每页渲染**入口处重置/隔离**。由于 SSG 是 `pMap` 并发逐页渲染,同一模块实例会被并发使用,不能用裸模块单例;用 **AsyncLocalStorage(node 内置)** 承载注册表,或在 build 流程把逐页渲染改为小并发/串行(几十页的静态站并发收益有限),或给每页 `nativeImport` 独立上下文(现有 nativeImport 已有模块缓存,需要参数化)。推荐:页面渲染仍可并行,但 `render()` 工厂改为**每次调用创建新注册表实例,以 `react-dom/server` 无 ctx → 用全局 `AsyncLocalStorage.run(registry, ...)` 包裹**;`useIcon()` 内部 `getCurrentRegistry()`。`react-dom/server` 本身支持并发无状态渲染,AsyncLocalStorage 可行且对主题代码无感。
- teleports:`ctx.teleports.body` 被 `render.ts` 拼进 `<body>`。React 等价:`createPortal` 在 SSR 没有目标节点,输出会丢失。自建 `VPTeleport` 组件:SSR 时把 children 写入当前注册表的 `body` 列表(组件树顺序),`render.ts` 收尾拼入 body;客户端水合时同一个组件用真正的 `createPortal(document.body)` 渲染——两端一致。

#### M5 hydration 与首屏 JS 瘦身(决策 D4)

现状:SSR 输出完整内容;首屏只下 `.lean.js`——它是页面 chunk 的副本,把其中 `createStaticVNode("大段静态HTML", n)` 的**字符串清空为 `""`**(保留结构、`n` 个静态根节点的计数不变)。水合时 Vue 对 Static 节点执行**"收养"(adopt)**:`hydrateNode` 的 `case Static` 检测到 `vnode.children` 为空(`needToAdoptContent`),会逐个认领现有 DOM 节点并把 `outerHTML` 读回 vnode——所以 **SSR 已写进 HTML 的内容文本在客户端无需重复下载、也无需重新生成**,水合只做结构级认领;此后客户端 SPA 导航(此时 DOM 是 JS 生成的)才动态加载带完整内容的 chunk 用 innerHTML 重建。整个机制依赖 **Vue 编译器把静态 HTML 聚合成 `createStaticVNode`** 的输出特征——React 没有编译期静态节点概念(JSX 产物是全量元素代码,`react-dom` 水合要求客户端树逐文本与 SSR 标记一致,**没有"空内容 + 收养"通道**,无法跳过任何子树的文本生成)。

候选:
- **D4-A(推荐首版):放弃 lean,整页 chunk 首屏加载并全量水合**。与 Vue 1.x 早期/多数 SSG(Next SSG)一致;代价:大文档页首屏 JS 从"几十 KB 静态内容"变全量(页面 chunk 通常仍 < 200 KB gzip,文档站可接受)。
- D4-B:islands 化(仅对 md 内交互组件水合,静态正文 `dangerouslySetInnerHTML`):静态正文不参与 React 树,水合量最小;但 md 内组件/事件与静态区混排能力受限,需"静态 HTML + island 挂载点"两段式产物(相当于把 lean 思想做进产物格式),工程量最大、收益与 A 相比只在超大页面显著。可作二期。
- D4-C:首屏"非交互页面用 `dangerouslySetInnerHTML` + 事件委托全局补绑"——不推荐,与 React 模型冲突且坑多。

#### M6 markdown 相关 HMR 与内容副作用

- md 更新 → `vitepress:pageData` HMR + 模块热更:router 的 `handleHMR` 保留(纯框架代码);react-refresh 对页面 chunk 的整模块替换按 vite 默认处理。
- 现在 plugin.ts 的 `importerMap`(include 文件 → md)机制与框架无关,保留。

---

## 5. 里程碑与验收(建议顺序)

| 里程碑 | 内容 | 验收 | 依赖决策 |
|---|---|---|---|
| M0 骨架冒烟(2–3 天) | 依赖替换、别名、`linkReact`/external 策略、最小 `app/ssr` + 根组件 + `createRoot/hydrateRoot`、dev/prod HTML 壳 | 一个硬编码页在 dev 与 `vitepress build` 下 SSR+水合成功 | 已定,按 §4 实施 |
| M1 md 管线移植(1 周) | 照蓝本移植 `markdownToReact` 五段管线(script 占位/提取还原/HTML→JSX(字面契约)/模块组装/插件内 esbuild 编译);script 块统一提升模块顶层、正文全字面(D1 已定);Content 渲染路由组件、router store 版、useData 骨架 | serializer + md 渲染单测(照蓝本改造);**正文产物语义对比**(标签/文本/顺序/锚点,排除主题壳与展示类)与基线一致;docs 若干纯文档页 dev/build/水合/导航一致 | 已定,按 §4 实施 |
| M2 SSR 完善(1 周) | ctx 通道(AsyncLocalStorage 注册表)、teleport 收集、head 管理、preload/prefetch、metadata、404 | 输出 HTML 结构(head/content/script 顺序)与基线对齐;图标 css 两阶段生成工作 | 已定,按 §4 实施 |
| M3 内核补全(0.5 周) | onContentUpdated/代码组/复制/预取/scroll/多语言 lang/dir/暗色 | 与基线 e2e 子集通过 | 已定,按 §4 实施 |
| M4 主题重建(1–2 周) | 用 shadcn/ui + Tailwind 重建参考主题:Layout/顶部导航(含多语言)/侧边栏/大纲/正文排版/页脚/404;所需 hook 选等价库或少量自写(D7) | dogfood 站点 SSR 与水合后:导航、侧边栏项文本与顺序同 themeConfig;正文标题/锚点/顺序同源 md;无 hydration mismatch;playwright 关键路径 e2e(内容顺序断言) | 全部已定 |
| M5 打磨(1 周) | 产物体积与水合性能测量优化(D4 已定:放弃 lean,无等价物)、本地搜索、docsearch 集成、sitemap、web types、类型发布检查(publint/attw) | 全量测试:`pnpm typecheck/test:base/test:e2e`;体积/首屏对比报告 | 全部已定 |

测试基建现状(几乎不依赖 Vue,可直接沿用):`vitest` 单测、playwright e2e(`__tests__/e2e` 断言 DOM 行为,与框架无关)、`docs` 为 dogfood 站点、publint/attw 产物检查;仅 `test:types` 中 `vue-tsc` 部分需要替换。

---

## 6. 风险与注意点

1. **正文一致性口径(仅 md 正文产物)**:Vue 与 React 对属性/布尔属性/空白/实体等的处理存在差异(`className`/`style` 对象等)。golden 对比只针对 **md 正文产物**并按"语义一致"评估(标签、文本、顺序、锚点 id/href、代码块内容),**主题壳不参与对比**(已决策);水合后断言无 mismatch 日志、正文关键节点文本与 SSR HTML 一致。
2. **md 内 Vue 生态存量内容**(D1 已决策):带 `setup`/`lang="tsx"` 的 script 块语法保留(内容整体提升模块顶层),但其中 **Vue 特有 API 需改写**:`reactive/ref/watch/computed` → `useState/useMemo/useEffect` 等(Vue 指令 `v-if/v-for` 无法支持,需改为组件/删减);上游依赖**正文插值或 `{{ $frontmatter.* }}` 内插**的存量页面需改写为「script 块导出组件 + 正文引用」或删除(上游把这些场景依赖 raw/`v-pre` 转义,React 版全部不需要)。蓝本的 docs 全量清理("from 'vue'"、```vue、`v-*`、`{{ }}` 教学示例清零)可作为 codemod 工作量参照。
3. **信息架构对照清单缺失风险**(D6/D11):重建主题前先产出"上游默认主题 → 新主题"对照清单(导航项文本与顺序、侧边栏分组、页面类型分发 doc/home/page、暗色/语言切换入口、404 文案等,以 `themeConfig` 数据驱动项为主),防止漏项;e2e 断言用文本/顺序,不依赖 class。
4. **React 水合的陷阱**:主题里大量"渲染后改 DOM"的代码(vue 的 watchPostEffect/nextTick 模式)在 React 里若时序不对会引发水合 mismatch——M2/M3 需要把这类副作用统一收口(commit 后队列)。
5. **并发 SSG**:AsyncLocalStorage 方案需在并发 + 模块缓存下验证无串扰(icon 收集是每页独立文件,正确性必须测试)。
6. **第三方/生态**:docsearch(纯 JS)、mark.js、focus-trap、minisearch、shiki 均与框架无关;`@vueuse` 的行为由所选等价 React 库(D7)承接,`useDark` 语义(系统偏好/存储键/初始值)需与上游对齐,是暗色模式相关测试的重点。
7. **产物级依赖**:`renderChunk` 里针对 Vue 编译器输出写的正则、`plugin-vue:export-helper` 等 chunk 分组判断(codeSplitting groups)需要删除或改写(`framework`/`theme` chunk 分组仍可保留,依据改为新编译产物特征)。
8. 本仓库是上游 alpha 代码,升级冲突面大;建议迁移全程锁定基线 commit 记录,定期与上游 merge 只取 node 侧修复。

---

## 7. 决策清单(全部已确认)

> **2025-11 全部决策如下(✔ 均已确认,可直接进入实施)**:✔ **D1 = A1**(正文 `{{ }}` 一律字面不求值;md 内 script 块统一提升模块顶层、组件引用契约,§4-L1)。✔ **D2 = A**(编译期 HTML→JSX 序列化,蓝本已验证)。✔ **D3 = S2**(快照 + `useSyncExternalStore`)。✔ **D4 = A**(放弃 lean,整页 chunk 水合)。✔ **D5 = A**(React 原生主题契约)。✔ **D6**(主题不机械迁移,shadcn/ui + Tailwind 重建,内容顺序一致)。✔ **D7**(`@vueuse` → 等价 React 库)。✔ **D8 = A**(react/react-dom 随包 dependencies + link 兜底)。✔ **D9 = A**(首版不接 devtools)。✔ **D10**(保留 SSR+水合;不支持 `.vue`;**删除 MPA 模式**——上游标注为实验功能,先把 SPA+SSG 基础路径做稳)。✔ **D11 = A**(shadcn 参考主题随包发布)。

| ID | 问题 | 选项 | 影响 |
|---|---|---|---|
| **D1** ✔ 已决策(A1) | md 内嵌 `<script>` 块与正文插值的语义 | **A1(蓝本契约)**:带 `setup` 或 `lang="tsx"` 的 script 块由编译管线提取(占位/fence 感知/html_block 还原),内容 import 去重后**统一提升模块顶层**(与普通 script 不再区分),`export default` 剥离,可定义/导出组件(hooks 合法,渲染树内可用 useData/useRoute);正文 **`{{ }}` 一律字面不求值**——`{{ }}` 会与 markdown-it attrs(`{#id}` 等)冲突(双括号内 `#`/`.` 起头会被 attrs 插件吞成属性或产生非法表达式),字面化后与 md 语法零冲突,v-pre/raw/插值转义插件(eager frontmatter 插值等)整体删除;动态内容 = script 块导出组件 + 正文大写标签引用 | md 语法契约与文档迁移(codemod:正文插值/`$frontmatter` 内插页面改为组件引用) |
| **D2** ✔ 已决策(A) | md 正文 HTML 以什么形式进入 React? | ✔ **A:编译期 HTML→JSX 序列化**(蓝本手写 tokenizer 约 400 行已验证:顶层 div 包裹、实体单遍解码、文本合并、on*/绑定丢弃告警、React 属性名映射;正文 DOM 语义(标签/文本/顺序/锚点)与上游一致、md 内组件可用、浏览器零运行时开销);B/C 不采纳 | M1 核心实现、正文语义一致性、md 内组件/交互支持 |
| **D3** ✔ 已决策(S2) | `useData()` 的数据与状态模型(**蓝本未遇到此问题**——ActView 自带响应式,React 版独有) | ✔ **S2 快照 + `useSyncExternalStore`**:site/page 等数据在导航/事件时生成新快照 + 版本号,useData() 按分片订阅;派生值组件内 useMemo。其余备选不采纳(V3 残留 vue 依赖;Z1 多一个状态库) | 主题 composables 全部 hook 化/显式依赖,主题层迁移工作量 |
| **D4** ✔ 已决策(A) | 首屏 JS 瘦身策略(现状 lean.js 依赖 Vue 编译器特征,无 React 等价物) | ✔ **A:首版放弃 lean,整页 chunk 全量加载 + 全量水合**(与 Next SSG 等一致;页面 chunk 通常 <200KB gzip,可接受);B islands 化留作远期(本表不再跟踪) | 大页面首屏字节数(记录基线、M5 测量) |
| **D5** ✔ 已决策(A) | 主题契约(`Theme`/`enhanceApp`)如何定义? | ✔ **A:React 原生契约**`Theme = { Layout: ComponentType; enhanceApp?(ctx); setup?(); extends? }`,`enhanceApp` 的 ctx = `{ router; siteData; registerComponents? }`;**不承诺**上游插槽体系/VP* 组件/全局组件注册兼容(Vue 主题无法复用,第三方主题需 React 重写,与 D6 一致);备选 B(纯 Context 组合)不采纳 | 公共 API 与第三方主题边界、`theme.d.ts` 类型 |
| **D6** ✔ 已决策 | 上游默认主题(66 个 `.vue` 与 scoped 样式)如何处理? | ✔ **不做机械迁移、不搬运 scoped/VP 样式**(React/Vue 差异大,逐组件生搬成本高且不 React);默认主题改为 **shadcn/ui + Tailwind 重建的参考主题**:页面布局、顶部导航、侧边导航、大纲等**结构近似即可**,视觉与 class 自由;**导航项/侧边栏等数据驱动内容的顺序必须与 themeConfig 一致** | 主题工作量降至 1–2 周、样式体系(Tailwind)、上游 theme-default 目录删除 |
| **D7** ✔ 已决策(B) | `@vueuse` 的替代方案 | ✔ **B:引入等价 React 库**(如 usehooks-ts、@react-hookz/web、@uidotdev/usehooks;`useDark` 语义、`useMediaQuery`、`useLocalStorage` 等逐个映射),不再自研;个别缺失(如文档大纲滚动 spy)按 React hook 少量自写;备选 A(全自研)不采纳 | 依赖体积(可接受)、行为需与上游 @vueuse 语义对齐(暗色模式存储键/系统偏好) |
| **D8** ✔ 已决策(A) | `react`/`react-dom` 如何参与站点构建?(用户要不要自己装 React) | ✔ **A:镜像 vue 现状**——react/react-dom 作为 vitepress dependencies + `linkVue()` 泛化为 `linkReact()`(用户 root 无 react 时 build 期软链),用户零安装;备选 B(peer deps)不采纳 | 安装体验、SSR external 解析 |
| **D9** ✔ 已决策(A) | devtools 支持 | ✔ **A:首版不接任何框架 devtools 集成**(删除 @vue/devtools-api 等价物;调试依赖 React DevTools 原生能力);备选 B(自定义协议)留作远期 | 调试体验(可接受)、少一块工作量 |
| **D10** ✔ 已决策(范围) | SSR/hydration、`.vue` 支持、MPA 模式的取舍 | ✔ **保留 SSR + hydrateRoot**(React 原生,SSG 逐页流程与上游一致,server/client 双构建 + 水合);✔ **不支持用户 `.vue`**(plugin-vue 不接入插件链、tsdown 移除 vue-sfc-transformer,用户主题/组件必须 React,脚手架 template 输出 .tsx,主题契约见 D5);✔ **删除 MPA 模式**(上游 `--mpa` 为实验特性;`config.mpa`、`buildMPAClient.ts`、`clientJSMap` 管线、`<script client>` 支持一并移除,先把 SPA+SSG 主路径做稳) | 用户生态边界、plugin.ts/bundle.ts/tsdown/config 简化 |
| **D11** ✔ 已决策(A) | shadcn 重建的参考主题放在哪里、是否随包发布? | ✔ **A:仓库内保留并随包发布一份"默认 React 主题"**(shadcn 重建,`vitepress/theme` 指向它,用户可 `extends` 或整体替换;备选 B 仅 docs 示例、不随包,不采纳) | 包结构/`files` 清单、脚手架 template、`theme.d.ts`、开箱即用体验 |

---

## 附录 A:需要大改的关键文件清单

| 文件 | 角色 | 迁移动作 |
|---|---|---|
| `src/node/markdownToVue.ts` | md → vueSrc 组装 | 照 §4.0/L1 移植蓝本 `markdownToActView.ts` 的五段管线(script 占位/fence 感知、html_block 提取还原、HTML→JSX 序列化、模块组装、插件内 JSX 编译);骨架逻辑(缓存/pageData/死链/include)保留,入口改名 `markdownToReact.ts` |
| `src/node/plugin.ts` | 站点插件链、虚拟模块、md transform、页面 chunk 处理 | md 分支改为「返回 TSX + 插件内 `transformWithEsbuild`(jsx: automatic)编译成纯 JS」(照蓝本 `compileActViewSrc`),插件置 `enforce: 'pre'`;`optimizeDeps.include` 加 jsx-runtime 系;删 Vue 输出特征正则(static marker/lean)按 D4;devtools/define 清理 |
| `src/node/alias.ts` | vitepress/vue 别名 | 去 vue 别名;保留 vitepress/theme 别名;APP_PATH 不变 |
| `src/node/build/bundle.ts` | 双构建编排、chunk 分组 | 仅删/改 plugin-vue 专属分组规则;SSR external 策略按 D8;MPA 相关(clientJSMap/mpa 分支)删除 |
| `src/node/build/buildMPAClient.ts` + `config.ts`/`cli.ts` 的 mpa 项 | MPA 模式(实验特性) | **整体删除(D10)**:`config.mpa`、`--mpa`、buildMPAClient、`<script client>` 管线移除,先做稳 SPA+SSG |
| `src/node/build/render.ts` | SSG html 组装 | `isBooleanAttr` 本地化;SSGContext 类型;teleports 处理自建版 |
| `src/node/build/build.ts` | 顶层流程 | `linkVue` → `linkReact`(D8) |
| `src/node/markdown/markdown.ts` | md-it 渲染器 | 保留;插件裁剪与 D1/D2 相关 |
| `src/client/app/*` | 客户端内核 | 全部重写为 React(L2) |
| `src/client/index.ts` | 公共 API | 导出不变(useData 等)+ 模块增强删除(vue 声明) |
| `src/client/theme-default/*` | 上游默认主题(现状) | 不机械迁移:整目录替换为 shadcn/ui + Tailwind 参考主题(L4),或删除并移入示例站点(D11);`vitepress/theme` 导出随 D5/D11 |
| `types/shared.d.ts`、`client.d.ts`、`theme.d.ts` | 类型包面 | 去 vue 类型(D3/D5) |
| `tsdown.config.ts` | 框架打包 | 摘 vueSfcPlugin;entry 加 tsx;**产物不再含 .vue**;`dts.vue` 关掉 |
| `tsconfig*.json` | 类型检查 | vue-tsc → tsc;jsx: react-jsx |
| `package.json` | 依赖 | vue 系移除;react/react-dom/plugin-react 加入(D7/D8/D9 后定终态) |
| `template/.vitepress/theme/*` | 脚手架模板 | Layout.vue → Layout.tsx/index.jsx 模板(与主题新契约一致) |

## 附录 B:src/client 现状规模

```
client/app ................. 7 ts + 2 components + 5 composables    ← 渲染内核(重写)
client/theme-default ....... 66 .vue + 12 composables + 6 support + 4 根文件  ← 上游现状(重建后整体替换/移除,D6/D11)
client 根 .................. index.ts(公共 API)/ shims.d.ts
样式 ....................... 11 css + Inter 字体子集(woff2,原样保留)
```
