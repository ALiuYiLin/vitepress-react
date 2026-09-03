# VitePress-React Theme Playground

在接入真实框架之前,先用 **mock 的 VitePress 数据(useData)** 在
Vite + React + TypeScript + Tailwind v4 + shadcn/ui 中把**文档站布局**与核心交互
做出来,便于手工调试。本目录**独立**于 `vitepress-react` 主仓库(不在根 pnpm
workspace 内),不参与主仓库构建;迁移计划(MIGRATION-REACT.md)不因此改动。

## 快速开始(workspace 成员,使用 pnpm)

本目录已注册进根 `pnpm-workspace.yaml`(`playground/*`),依赖由仓库根统一管理:

```bash
# 1. 在仓库根安装(会同时装好 playground/theme 的依赖;已装过则自动跳过)
pnpm install

# 2. 启动本调试台(两种等价写法任选)
pnpm --filter vp-react-theme-playground dev
# 或:cd playground/theme && pnpm dev
```

其他命令:`pnpm --filter vp-react-theme-playground build|preview|typecheck`。

## 你正在调试什么

| 区块 | 对应文件 | 说明 |
|---|---|---|
| 顶栏(导航项顺序:指南 → 参考 → 语言 → 外观) | `src/theme/TopNav.tsx` | 导航来自 `themeConfig.nav`,语言来自 `site.locales`,外观持久化到 localStorage |
| 左栏侧边栏(分组/递归/高亮) | `src/theme/Sidebar.tsx` | 按当前路径最长前缀命中 `themeConfig.sidebar` 分组 |
| 移动端抽屉 | `src/theme/MobileNav.tsx` | 简单覆盖层,将来可换 shadcn `Sheet` |
| 右栏"本页目录"(滚动高亮 + 平滑滚动) | `src/theme/AsideOutline.tsx` | 数据来自 `page.headers`(由 blocks 的 h2/h3 自动生成) |
| 正文 | `src/content/render.tsx` | 由 `page.blocks` 渲染,含代码块/表格/列表 |
| 上一页/下一页 | `src/theme/PrevNext.tsx` | 由激活侧边栏分组的扁平顺序计算 |

## 数据从哪来(与真实框架的对接点)

所有"看起来来自 VitePress 的数据"都在:

- `src/lib/vp-data.ts` —— 纯数据(mock),**形状刻意对齐上游 `types/shared.d.ts`**:
  - `site`:base / lang / dir / title / description / appearance / themeConfig / locales;
  - `site.themeConfig`:nav(顶栏)与 sidebar(侧栏)与 footer;
  - `page`:path / title / description / frontmatter / headers / blocks。
- `src/lib/vp-store.tsx` —— **mock 的运行时注入**(对应迁移计划 D3-S2:快照 + 订阅):
  - `<DataProvider>` + `useData()` / `useRoute()` / `useNavigate()` / `useAppearance()` / `useLocale()`;
  - 内部维护 path / locale / isDark 三个状态,路由变化即产生新快照。

将来接入真实框架时:**替换 `vp-store.tsx` 的实现**(改从框架的 Context/store 读值),
主题组件(`src/theme/*`、`src/components/ui/*`)不需要动。若真实框架的
`useData()` 返回值形状与本调试台的快照不同,也只需在 store 层做一次适配。

## 调整调试内容

- 改导航/侧边栏:编辑 `vp-data.ts` 中 `site.themeConfig` 即可(顺序即展示顺序);
- 改某个页面正文:编辑对应页面的 `blocks`(h2/h3 的 id 同时驱动大纲与锚点);
- 新增页面:加一个 `makePage(...)` 并放进 `pages` 数组 + 侧边栏条目;
- 换主题色/圆角:改 `src/index.css` 的 `:root` / `.dark` CSS 变量(shadcn 令牌)。

## 已知取舍(仅本调试台)

- 页面是 TSX 数据(mock),不是真实 `.md`;正文渲染器对应未来"md → React 模块"产物的消费方;
- 语言切换只切 `lang`/`dir`,不做内容翻译;URL 使用 `history.pushState` 便于前进/后退;
- 未接入真实框架的 head 管理 / 本地搜索 / docsearch / 构建产物(hashmap、SSG 等)。
