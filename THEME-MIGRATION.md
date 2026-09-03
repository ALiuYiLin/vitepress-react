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
  - 基础:`VPBackdrop`、`VPBadge`、`VPIcon`、`VPImage`、`VPLink`、`VPSkipLink`(早前子代理落盘)、`VPButton`(自己迁)、`VPPage`、`VPSwitch`、`VPSocialLink`、`VPMenuLink`(自己迁)。
  - 页面/功能:`vp-home(VPHome/VPHero/VPFeatures)`、`vp-team`、`vp-sponsors`、`vp-social-links`、`vp-carbon-ads`、`vp-nav-bar-search`、`vp-doc-footer-last-updated`。
- 验证:`tsc(client)` 绿;`tsdown` 绿;SSG(`m0-smoke`)绿;preview 骨架下文档页/`/home`/`/team`/`/sponsors` 正常;生产 hydration #418 为已知(dev 无、页面正常)。

## 4. 待迁移组件(按 Vue 参照 `components/*.vue`,尚未建对应 React 文件)
- 文档:`VPContent`、`VPDoc`、`VPDocAside`、`VPDocAsideOutline`、`VPDocOutlineItem`(递归)、`VPDocFooter`、`VPDocFooterLastUpdated`(已自建,可复用)、`VPDocAsideCarbonAds`、`VPDocAsideSponsors`、`VPFooter`(正在做)。
- 顶栏:`VPNav`、`VPNavBar`、`VPNavBarTitle`、`VPNavBarAppearance`、`VPNavBarHamburger`、`VPNavBarExtra`、`VPNavSocialLinks`、`VPNavTranslations`、`VPNavBarSearch`(用已建 vp-nav-bar-search)。
- 菜单:`VPNavMenu`、`VPNavMenuGroup`、`VPNavMenuLink`、`VPMenu`、`VPMenuGroup`、`VPFlyout`。
- 屏幕菜单:`VPNavScreen`、`VPNavScreenMenu`、`VPNavScreenMenuGroup`、`VPNavScreenMenuLink`。
- 侧栏:`VPSidebar`、`VPSidebarGroup`、`VPSidebarItem`(递归)。
- 本地导航:`VPLocalNav`、`VPLocalNavOutlineDropdown`。
- 其他:`VPSwitchAppearance`、`VPButton`(完成)、`VPSocialLink`(完成)、`VPSponsorsGrid`(已并入 vp-sponsors)。
- 页面组件:`VPHomeContent`、`VPHomeHero`、`VPHomeFeatures`、`VPHomeSponsors`(当前已并入 vp-home,可选细分)、`VPTeamPage`、`VPTeamPageSection`、`VPTeamPageTitle`。

## 5. 下一步(恢复后从这里继续)
1. 先完成已在做的 **`VPFooter`**(读 `components/VPFooter.vue` 已读;写 `VPFooter.tsx` + `VPFooter.module.css`:footer 根 `.VPFooter[has-sidebar]` + `.container` + `.message/.copyright`,`:deep(a)`→`:global(a)`;数据 theme.footer+frontmatter.footer!==false+hasSidebar(useLayout))。
2. 然后按第 4 节清单逐个迁移(优先文档/顶栏/侧栏/菜单/本地导航)。
3. 全部迁移后,统一验证(tsc/tsdown/SSG/preview),再决定是否拆分 `Layout` 内联为 `components/VP*` 与消除 #418。

## 6. 注意事项
- 分支保持在 `migrate-react-m0`;提交前确认 `git status --short` 干净。
- **不要用子代理**;不要因为"追求完美"而停在读文件(用户强调)。
- m0 站点仅作验证;用户指示**先全部组件,最后再验证**。
- 搜索等组件**不需要联网**。
