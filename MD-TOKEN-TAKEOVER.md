# JSX 区域识别下沉 markdown-it 设计决策(Token 级接管)

> 状态:草稿(供决策讨论,未实施)
> 日期:2026-09-07 · 分支:`refactor/md`
> 依据代码:V2 落地后的字符串预扫 Pass(`markdown/jsxMasking.ts` 的 `maskScriptBlocks` / `maskJsxHtmlLines` + `jsxRegionEnd` 行尾切分)与决策 [`MD-DYNAMIC-SYNTAX-V2.md`](./MD-DYNAMIC-SYNTAX-V2.md) §4.3/§7.4(Phase-3 token 化候选)
> 触发问题:配平启发式的三处边角 —— ① fence 闭合未校验“同字符 + 长度 ≥ 开 fence”,内容行形似闭合会提前退出、后续 `<>` 被误扫;② 4 空格缩进代码块内的 `<Tag/>`/`<>` 会被当行内接管(hijack);③ 正文把 `<>…</>` 当字面文字写且同段配平会被误当 JSX(中间字面 `{x}` 会被求值)。根因:**在 markdown-it 之前用字符串重实现了一遍 CommonMark 边界**(fence/缩进代码/行内码/实体/段落切分)。建议把“哪些文本是 React 接管区”的识别下沉到 markdown-it **内部、块级结构确定之后**执行。

---

## 1. 决策问题

现状(V2,M1)管线:

```
maskScriptBlocks(字符串) → maskJsxHtmlLines+Fragment(字符串) → md.renderAsync → html
→ serializeHtmlToJsx(html + @@VP_HTML_n@@/data-vp-jsx + store → JSX)
```

两个字符串 Pass 必须在 markdown-it **之前**,因为 md 不能识别 Fragment(`<>` 非法 HTML)与 JSX 语义。代价是必须自己维护 fence/缩进代码/行内码/frontmatter/表格等状态机,并承受上文三处边角。

要决策的新架构:

> 组件/HTML 标签识别与 `<>…</>` Fragment 识别,都改为 **markdown-it 内部的 token 级规则**,在 md 自己的块级规则(fence / 缩进代码 / html_block / 容器)匹配完成之后执行;产物(占位 marker + env store)与下游保持一致。

关键前提修正(讨论结论):

- “其他规则匹配后执行”要按**两件事分开定序**:标签行/组件/html_block 接管适合在块级结构确定后的 core 链上做;但 Fragment 内容**不透明**,必须在 inline 解析**早期**(backticks / emphasis / math / linkify 之前)捕获,否则内部 `*`/`` ` ``/`[`/`$` 已被拆成其它 token。二者不是同一个执行点。
- 因此本方案是 **markdown-it 内部三个执行点**,而不是“一个 core 末段钩子扫 token”。

## 2. 目标形态:三个执行点

| 执行点 | 注册位置 | 职责 | 现状对应物 |
| --- | --- | --- | --- |
| A. `<script>`/`<style>` 块捕获 | block ruler(在 md-it 自带 html_block 匹配**之前**)捕获 `<script …>…</script>` 为**不透明块 token** | 根治 type-7 被块内 `</(script|pre|style|textarea)>` 提前截断;内容写 env(与 plugin-sfc 同形或接管其契约) | `maskScriptBlocks` / `restoreMaskedScripts`(字符串) |
| B. Fragment 捕获 | inline ruler **高优先级**(backticks / emphasis / math_inline 之前) | `<>{…}</>` / `<>…</>` 整段捕获为不透明 inline token,内容原样 | `firstTagIndex`/`tagDepth`/`jsxRegionEnd` 里的 `<>` 分支 |
| C. 标签/组件/html_block 接管判定 | core 链**末段**(attrs / anchor / container 之后),遍历 token | 对 html_block / html_inline token 与文本 token 中的独立标签行做“是否 React 接管”判定;Vue 特征(`v-*`、`:x`、`@x`、`{{ }}`)保持退回旧 HTML 路径 | `maskJsxHtmlLines`(字符串逐行) |

A/B/C 统一产出同一种 `vp_jsx` 语义:原文 push 进 `env.jsxStore`,token 换为 marker(行内 `@@VP_HTML_n@@` / 块级 `<div data-vp-jsx>`),由**自建 renderer rule** 输出——下游 `serializeHtmlToJsx`、`buildReactPageModule`、死链/pageData 流程**完全不改**。

## 3. 执行顺序矩阵(以 markdown.ts 插件注册顺序为锚,实施时实证补单测)

| md 机制 / 插件 | 相对 A/B/C | 理由 |
| --- | --- | --- |
| fence / 缩进代码(code_block / fence token) | 先于一切 | 内容天然不是接管候选 → 边角② 结构性消失 |
| html_block(自带) | A 前可先被拦截;B/C 在其后 | C 只处理 md 已认可的 html token → 边角① 的“漏扫”不再存在 |
| 自定义容器 `::: … :::` | 先于 C | 容器内容以嵌套 token 再走 C,同现状“容器内整段 opaque”可保留 |
| inline 自带 backticks / emphasis / link / image / entity | 晚于 B | B 抢在它们之前,Fragment 内文本不被拆分/转义 |
| math(`md-it-mathjax3`) | 块 `$$` → math_block 先于一切;inline `$` 晚于 B | Fragment 内的 `$…$` 原样留在 JSX;正文 `$` 数学不受影响 |
| attrs(`{…}` 后缀) | 早于 C | attrs 消费段落尾 `{…}` 后,C 只见剩余文本;Fragment/标签行不产生 attr 文本 → 无冲突(沿用 V2 attrs 契约) |
| anchor / 标题(headers) | 标题行不接管(沿用);anchor 早于 C | heading id / aria-label / 大纲不受 marker 影响 |
| plugin-sfc | 与 A 二选一或协调 | A 产出同形 env 后可整体退役 plugin-sfc 路径?见 §5 |
| linkify / include(`<<<`) | include 若在 block/core 早期展开则先于 B/C;linkify 晚于 B | include 展开时机与 Fragment 跨 include 边界为开放问题(§7) |

## 4. Token 形态与数据流(下游不变)

```
env.jsxStore: PlaceholderEntry[] { html }(与 placeholders.ts 现有契约一致)

A/B/C 规则命中:push({ html: raw });原 token 替换为 marker 文本
renderer(vp_jsx / marker):输出 @@VP_HTML_n@@ 或 <div data-vp-jsx="n">(行号注释 {/* JSX md:n */} 保留,token.map 可取真实行号)

→ html + store 与现状字节形态一致 → serializeHtmlToJsx / buildReactPageModule / markdownToReact 的还原逻辑不用动
```

清理面(Phase D):`markdownToReact.ts` 编排移除两个预扫调用;`jsxMasking.ts` 大部分函数退役(视 A/B 归属保留 `restoreMaskedScripts` 或删除);`jsxLexer.ts` 保留纯词法工具给 B 用(可缩为片段扫描);`placeholders.ts` 契约与注释更新。

## 5. `<script>`/`<style>` 归属(子决策)

> **决策(2026-09-07):方案 A,与 B/C 同批实施** —— 块规则 A 直接捕获 `<script>` 并写 `env.sfcBlocks`,删除 `maskScriptBlocks`+`restoreMaskedScripts`,plugin-sfc 的 script 提取退役。

- **方案 A(已定)**:块规则 A 直接捕获 `<script>` 并把内容写进 `env.sfcBlocks`(沿用现有字段 `scripts`/`scriptSetup`/`styles`/`customBlocks`,buildReactPageModule 消费点不变)→ 可整体删除 `maskScriptBlocks`+`restoreMaskedScripts`,plugin-sfc 的 script 提取部分退役(或仅保留 style)。
- 方案 B(保守,未采纳):本期只迁 B/C,`<script>` 字符串掩码保留、后续单独迁。
- `<style>` body 不参与接管判定(天然)。

## 6. 一期 scope 与明确不做

- **做**:A + B + C **同批**;`<>{expr}</>` 独立行/行内/多行、标签行、组件行、html_block、`: : : react` 的 token 化;三处边角单测;docs(zh+en)构建等价回归。
- **不做**:AST 判定(V2 §7.4 已否决);V2 字面语义的任何改动;动态标题;新依赖(只用 markdown-it ruler);不改 serializeHtmlToJsx 的机器 HTML 适配(§4.4 分层保持)。
- **开放问题(实施时实证)**:
  1. `md-it-mathjax3` 与 `md-it-attrs` 在 markdown.ts 的精确注册点、inline ruler 优先级数值;
  2. include(`<<<`)展开发生在 block/core 哪一步、Fragment 能否跨 include 边界;
  3. Fragment 内容若含用户自定义 inline 规则产物(如 emoji)时 B 的优先级是否足够早 → 不够则降级为“仅单 text token 内捕获”并文档化;
  4. plugin-sfc 退役后 `<style lang=scss>` 的预处理/加载路径是否不变。

## 7. 收益与代价

| | 说明 |
| --- | --- |
| 收益① | 三处配平边角结构性消失(fence/缩进代码/html_block 已由 md token 化) |
| 收益② | 行尾切分 hack(`jsxRegionEnd`)消失:片段后文字在段落 token 里天然仍是 md |
| 收益③ | 与 attrs/anchor/math 的顺序可控,不再依赖“掩码文本不含 `{`/`<`”的巧合 |
| 收益④ | `<script>` type-7 截断在 block 层根治,字符串掩码退役,代码更短 |
| 代价① | 顺序矩阵与第三方 inline 插件耦合,需实证 + 顺序单测 |
| 代价② | 重构是“结构等价”而非字节等价:回归依赖 V2 单测(23 条,已全绿)+ docs 自举构建 |
| 代价③ | env/store 生命周期需贯穿 render(plugin-sfc 先例:env.sfcBlocks) |
| 风险 | B 的 inline 优先级若不够早,Fragment 内 md 语法会被拆 token(降级方案见 §6) |

## 8. 实施路线与验收

- **Phase 0(本文)**:评审;§5 已定 A 同批。
- **Phase 1**:小实验打点(markdown.ts 里顺序矩阵实证:inline ruler 优先级、math/attrs 注册点)→ 冻结顺序约束。
- **Phase 2**:实现 A + B + C(同批)→ 现有 V2 单测(走整管线)必须保持全绿;新增三处边角单测(红 → 绿):
  1. 4 空格缩进代码内的 `<Badge/>`/`<>…</>` 按字面输出;
  2. 内容行“形似闭合 fence”(异长/异字符)后紧跟含 `<>` 的行不误扫;
  3. 正文字面 `<> 文字 </>`(内部无 `{`/`<`)按 md 转义输出,不接管。
- **Phase 3**:清理退役 Pass(`maskScriptBlocks`/`restoreMaskedScripts`/`maskJsxHtmlLines` 与相关 lexer 精简、`markdownToReact.ts` 编排简化、注释与 placeholders 契约更新)。
- **Phase 4**:typecheck(shared/client/node)+ prettier + `pnpm build` + `pnpm docs:build:only`(zh 活体示例 + en Vue 镜像原样通过)+ 抽查 using-react/md-react-rules 输出 → 提交。
