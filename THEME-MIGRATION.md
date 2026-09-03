# 默认主题(theme-default)逐组件迁移 · 进度与任务清单

> 用途:记录 React 默认主题复刻 Vue 默认主题的**当前进度、已完成、待迁移清单与规范**。
> 上下文被压缩后,先读本文件即可无缝继续。
> 分支:`migrate-react-m0`;工作区:`E:\code3\vitepress-react`。

## 0. 目标
把 `src/client/theme-default` 重构为**严格复刻 Vue 默认主题**:
- DOM 类名/嵌套/状态类与 Vue 默认主题一致(`vp-*`、`.VPNavBar`、`.VPSidebarItem`、`is-active`/`active`/`open`/`collapsed` 等);
- **组件级 scoped 样式 → CSS Modules**(`X.module.css`,去掉 `[data-v-xxx]`,`:deep(.Y)`→`:global(.Y)`);
- 站点/正文样式**复用 Vue `styles/*`**(vars/base/icons/utils/custom-block/vp-code/vp-code-group/vp-doc/vp-sponsor + fonts),按上游顺序导入(已完成);
- **完全移除 shadcn/Tailwind**(已完成)。
- 全部**迁移完成后再整体验证**(tsc/tsdown/SSG + preview);搜索组件**无需联网**(本地 .tsx;@docsearch/js 运行时懒加载,可选)。

## 1. 参照(只读)
- Vue 默认主题(权威):`E:\code3\vitepress-react.worktrees\vitepress-vue\src\client\theme-default\components\*.vue`
- (可选参考,不同框架)`C:\code\vitepress\src\client\theme-default\components\*.tsx`(ActView 版 React 实现,但用 `actview`/`@actview/press`,需适配,勿直接复制)

## 2. 规范(迁移每个组件)
- 读 `.vue` 的 `<template>` → 写同名 `.tsx`;`<style scoped>` → 同名 `.module.css`。
- **不要用子代理**,自己逐件迁移。
- React 19 + TSX;从 `'vitepress'` import `useData/useRoute/useRouter/useNavigate/useAppearance/useLocale/Content`。
  - `useData()` → `{ site, theme, page, frontmatter, lang, dir, localeIndex, title, description }`(theme = site.themeConfig)。
  - `useRoute()` → `{ path, data }`(data.headers 可用);`useRouter()`/`useNavigate()`;`useAppearance()`→`{isDark,toggle}`;`useLocale()`→`[idx,setLocale]`。
- 复用已有 composables:`../composables/use-nav`(useNav/useNavItemLink/useAppearanceSwitch)、`use-sidebar`、`use-layout`、`use-prev-next`、`use-active-anchor`、`use-langs`、`use-flyout`、`use-body-scroll-lock`、`use-edit-link`;`../theme-utils`(normalizePath/isNavActive/sidebarGroupsFor/flattenSidebarItems/headerTree,类型 VpNavItem/VpSidebarItem/VpSidebarGroup/VpSidebarConfig/VpHeader)。
- DOM 类名与 Vue 模板一致;v-if→条件、v-for→map、`v-html`→`dangerouslySetInnerHTML`(仅 HTML 文本)/`{text}`,事件→onClick。
- 组件自身类用 `import s from './X.module.css'` + `s.className`;跨组件/`:deep` 用 `:global(.Y)`(module.css 里用 `:global(...)` 包住外来类)。
- 自建组合文件命名 `vp-*`(小写):`vp-home.tsx(VPHome/VPHero/VPFeatures)`、`vp-team.tsx(VPTeamMembers/VPTeamMembersItem)`、`vp-sponsors.tsx(VPSponsors/VPSponsorsGrid)`、`vp-social-links.tsx(VPSocialLinks)`、`vp-carbon-ads.tsx(VPCarbonAds)`、`vp-nav-bar-search.tsx(VPNavBarSearchButton)`、`vp-doc-footer-last-updated.tsx(VPDocFooterLastUpdated)`。**注意**:将来可选将这些拆为 `<Name>.tsx` 大写下划线命名,与 Vue 文件一一对应(待办)。
- 每个组件完成后 commit(先在 `migrate-react-m0` 分支)。工作区需干净再继续。

## 3. 已完成(已提交,tsc/tsdown/SSG 骨架绿)
- 全局:shadcn/Tailwind 移除;`styles/*`+fonts 复用并按序导入(`without-fonts.ts`/`index.ts`);`themes` composables(9 hooks)+ `theme-utils.ts`。
- 骨架:`Layout.tsx`(**自包含**:已内联 VPNavBar/VPSidebar/VPContent/VPDocAside/VPFooter/VPLocalNav 结构 + `layout.module.css`)、`NotFound.tsx`。后续可把内联结构拆为 `components/VP*` 并用上面已迁移组件替换(待办)。
- 已迁移组件(文件已存在于 `src/client/theme-default/components/`):
  - 基础:`VPBackdrop`、`VPBadge`、`VPIcon`、`VPImage`、`VPLink`、`VPSkipLink`(早前子代理落盘)、`VPButton`(自己迁)、`VPPage`、`VPSwitch`、`VPSocialLink`、`VPMenuLink`、`VPFooter`、`VPSwitchAppearance`、`VPMenuGroup`、`VPMenu`、`VPDocOutlineItem`、`VPDocAsideOutline`、`VPDocAside`、`VPDocFooter`、`VPDoc`(自己迁)。
  - 页面/功能:`vp-home(VPHome/VPHero/VPFeatures)`、`vp-team`、`vp-sponsors`、`vp-social-links`、`vp-carbon-ads`、`vp-nav-bar-search`、`vp-doc-footer-last-updated`。
  - 侧栏:`VPSidebar`/`VPSidebarGroup`/`VPSidebarItem`(递归,已迁移;useSidebarItemControl 语义对齐 Vue:collapsible=collapsed!=null、自动展开、item 变化重置)。
  - 本地导航:`VPLocalNav`/`VPLocalNavOutlineDropdown`(已迁移;v-show、vh、body lock、Esc/外部/内容更新关闭)。
  - 顶栏/导航全套:`VPFlyout`、`VPNav`、`VPNavBar`、`VPNavBarTitle`、`VPNavBarHamburger`、`VPNavBarSearchButton`(vp-nav-bar-search)、`VPNavMenu`/`VPNavMenuGroup`/`VPNavMenuLink`、`VPNavAppearance`、`VPNavTranslations`、`VPNavSocialLinks`、`VPNavBarExtra`、`VPNavScreen`。
- 支持设施:useNav 改**模块单例**(useSyncExternalStore;路由/≥48rem 自动关闭、trigger 焦点);`nav-context.ts`(closeScreen);`use-nav-overflow.ts`(**默认不折叠占位**,state.*=true、visibleItemCount=∞);`use-window-scroll-y.ts`。
- 验证:`tsc(client)` 绿;`tsdown` 绿;SSG(`m0-smoke`)绿;preview 骨架下文档页/`/home`/`/team`/`/sponsors` 正常;生产 hydration #418 为已知(dev 无、页面正常)。

## 4. 待办/简化项(尚未做或有意简化)
- **Layout 重接线(下一步)**:把 `Layout.tsx` 内联骨架替换为真实组件树 —— `VPNav`(+slots)、`VPSidebar open`(移动抽屉 + VPLocalNav menu 按钮开)、`VPLocalNav`、`VPSidebarItem` 替换内联 `SidebarItem`、`VPDoc*`/`VPPage`、`VPContent`、`VPFooter`、`NotFound`。
- 简化(可接受偏差):溢出引擎未实现(默认不折叠);`VPNavBarSearch` 仅保留按钮 stub(未迁 Algolia/LocalSearchBox 弹层);flyout/屏幕动画用 CSS keyframes 近似 Vue Transition;部分 scoped CSS 用全 `:global` 字面量类名(类名唯一,安全);VPMenuLink 等按本项目先例近似。
- 可选细分:`VPDocAsideCarbonAds`/`VPDocAsideSponsors`(VPDocAside 已内联碳广告占位)、`VPHomeContent/VPHomeHero/VPHomeFeatures/VPHomeSponsors`(现并入 vp-home)、`VPTeamPage*`(`VPTeamPage/VPTeamPageSection/VPTeamPageTitle`)、`VPSidebar` curtain 背景在桌面 >90rem 的微调验证。
- 风格:小写 `vp-*.tsx` 文件将来可拆为 `<Name>.tsx` 与 Vue 一一对应(待办,不改优先级)。

## 5. 下一步(恢复后从这里继续)
1. **Layout 重接线**(见 §4 第一项)——把自包含骨架替换成已迁移组件树;必要时给 `VPSidebar`/`VPLocalNav`/`VPNav` 补接线(侧栏 open 状态由 Layout 持有,传 `VPSidebar open`;`VPLocalNav` 的 `open`/`onOpenMenu` 由 Layout 提供;移动抽屉状态可与 `useSidebarControl` 结合)。
2. 需要时补 `VPTeamPage*`/`VPHome*` 细分与其余可选组件。
3. 完成后统一验证:tsc/tsdown/SSG/preview —— DOM 类名(`vp-*`)、`.vp-doc` 排版、暗色、本地导航、404、搜索按钮不联网;再处理剩余 #418 与 CSS Modules 残留问题。

## 6. 注意事项
- 分支保持在 `migrate-react-m0`;提交前确认 `git status --short` 干净。
- **不要用子代理**;不要因为"追求完美"而停在读文件(用户强调)。
- m0 站点仅作验证;用户指示**先全部组件,最后再验证**。
- 搜索等组件**不需要联网**;`@docsearch/js` 运行时懒加载(尚未接线)。
- 全 `:global` 的 module.css 规则直接作用字面量类名——保持类名全局唯一即可。
