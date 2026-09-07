# 正文动态语法与 attrs 分隔符重设计决策(JSX 显式片段契约 V2)

> 状态:已实施(Phase 1 语义切换 + Phase 2 文档迁移均已落地;单测 23/23、tsc、`pnpm build`、docs 自举构建通过)
> 日期:2026-09-07 · 分支:`refactor/md`
> 实施记录(2026-09-07):按 §4.1 删除 EXPR 链路并支持 Fragment 接管;attrs 恢复 `{}`;新增两处实现期修订 —— ① `jsxRegionEnd` 行尾纯文本切分(标签行尾文字仍走 md);② `hasVueishAttr` 扩展 `v-*` 指令属性与 `{{ }}` 插值文本检测 + 关闭标签起头行不接管,使 en 上游 Vue 原样 HTML 文档页(using-vue 等)不经内容修改即可编译。en 文档未做任何重构(用户明确);其 2 条存量死链(`./using-react`,en 侧无 React 指南)在 docs/.vitepress-react/config.ts 以 `ignoreDeadLinks: [/using-react/]` 屏蔽并留 TODO。
> 依据代码:2026-09-07 拆分后的管线(`markdownToReact.ts` 编排层 + `markdown/{jsxMasking,jsxLexer,placeholders,serializeHtmlToJsx,buildReactPageModule,deadLinks,pageMeta,compileCache}.ts`)
> 触发问题:上一轮评审结论——「正文裸 `{expr}` 一律求值」这个契约怎么处理都不好:① 需要一整套渲染前表达式状态机(`maskJsxExpressions` 的 fence/行内码/数学/style/frontmatter/`\{`/`{{` 保护与 `$1600` 价格回归);② 为避让表达式语义,attrs 被迫从 `{}` 改成 `((…))`(见 2026-09-06 commit c0d04b58);③ 作者想写字面 `{x}`(CSS 示例、模板语法讨论)必须 `\{` 转义或进代码块。

---

## 1. 决策问题

现状契约(D2):

> 正文/标题任意位置的**单层 `{expr}` 一律按 JSX 表达式求值**(对齐 Vue `{{ }}`);字面花括号必须 `\{` 转义/行内码/代码块/`{{…}}`;attrs 用 `((…))` 分隔符。

要决策的新契约(V2):

> 正文里的**裸 `{…}` 永远是字面文本**(与 CommonMark / 上游 VitePress 一致,不再求值);
> 任何动态内容(变量、表达式、组件引用)都必须由作者**显式写成 JSX**:正文 `<>` Fragment 包裹的 `<>{expr}</>`、组件标签 `<Counter />`、`::: react` 容器;
> attrs 分隔符**恢复 `{}`**(`{#id}` / `{.cls}`,上游原生写法);
> 序列化器/提取器只对"`<` 起头、可配平的 JSX 区域"做占位接管,文本一律按字面序列化。

逐条追问:

1. 放弃"裸 `{expr}` 求值"是否成立?——成立(见 §3 收益),但它是 **Breaking Change**(§5/§6 清单)。
2. `<>{expr}</>` 能否被现有 html_block/html_inline 路径自然处理?——**不能**:`<>` 不是合法 HTML 标签名(CommonMark 要求字母开头),md 会当字面文本。必须有我们自己的 inline/block 占位接管(见 §4.2)。
3. attrs 恢复 `{}` 是否有新的歧义?——上游同款歧义回归:段落/标题**末尾**的字面 `{…}` 可能被 attrs 消费(§7.3,与上游行为一致,靠文档约定规避)。
4. 是否需要"AST 判定表达式有效性 + 非法回退文本"(上一轮讨论的宽容层)?——**不需要**(§7.4)。

## 2. 新契约的精确语义(V2)

### 2.1 正文文本

- 普通文本、`{x}`、`{{x}}`、`\{x\}`、`.a { color: red }`、`{模板语法}` → **一律字面文本**,序列化为 `{"…"}` 字符串字面量。
- 反斜杠转义退化为 markdown-it 默认行为(`\{` → `{`),不再是"防止求值"的手段。
- 数学 `$…$` / `$$…$$`:LaTeX 的 `{…}` 分组天然字面,**不再需要 `computeMathRanges` 之类的表达式保护**(mathjax 插件本身不变)。

> **时序(为什么安全)**:`@mdit/plugin-attrs` 是 **markdown-it 内部 token 期**插件,渲染链里消费它的 `{#id}`/`{.cls}` 后缀;`serializeHtmlToJsx` 运行在 **md 渲染完成的最终 HTML** 上。因此到达序列化器的文本里,attrs 该吃的 `{…}` 已经被吃掉,**残余的 `{…}` 按构造就是字面文本**——整段包 `{"…"}` 是安全的,序列化不是"抢先于 attrs",而是天然晚于它。占位机制两侧一致:作者 JSX 在 md **之前**已换成不含花括号的 `@@VP_HTML_n@@`,attrs 不会误消费,序列化期再原样还原。

### 2.2 正文动态(唯一入口:显式 JSX)

| 写法 | 位置 | 语义 |
| --- | --- | --- |
| `<>{expr}</>` | 独立成行 | Fragment 求值行,整行接管、原样恢复为 JSX |
| `<>{expr}</>` | 句子中间(行内) | 行内接管;`<>` 非合法 HTML,必须由我们的行内占位处理(§4.2) |
| `<Comp />` / `<b>bold</b>` 等 | 独立成行 | 与现状一致(整行占位接管,React 编译) |
| `::: react` 容器 | 块 | 与现状一致(markdown-it 完全不透明) |
| 标题 `<Badge />` | 标题行 | 与现状一致(纯文本标题,组件不参与 anchor 文本) |
| **标题 `<>{expr}</>`** | 标题行 | **V2 一期明确不支持**(anchor/大纲静态文本限制,§7.1) |

### 2.3 attrs

- 分隔符恢复 `{#id}` / `{.cls}`(改回 `markdown.ts:458-474` 的 `left:'{' right:'}'`?——按 `@mdit/plugin-attrs` 默认即为 `{}`,去掉显式 `(( ))` 覆盖即可)。
- 与字面花括号的边界、表格/列表内行为遵循上游文档;V2 一期只在 docs 说明(§7.3)。

### 2.4 保留不动

- `<script>`(page-scope/具名导出提升)/`<script client>`/`<style>`(`scoped` 与非)提取 → `env.sfcBlocks`(2026-09-07 拆分后仍在 jsxMasking/markdown.ts,后续 token 化见 §4.3);
- 主题组件自动导入(`Badge`/`VPBadge`)、未知组件降级警告、Vue 指令行退回旧路径;
- `serializeHtmlToJsx` 的 `vp-doc` 包裹与占位还原机制;`class→className`/`style` 对象/布尔属性映射**只作用于 markdown-it/md 插件生成的机器 HTML**(分层策略见 §4.4)。
- frontmatter / `useData()` page-scope 读取的用法(仅 docs 文案变化,把 `{expr}` 引用改成 `<>{expr}</>`)。

## 3. 收益与代价

### 3.1 收益

1. **删除最重最脆的一整层**:`maskJsxExpressions` 的状态机、`computeMathRanges`、`\{`/`{{`/空 `{}` 特判全部消失;`maskJsxHtmlLines` 与表达式掩码的耦合解除;`restoreHeaderExpressions` 简化为只处理 HTML 占位(若保留)。
2. **零转义写作**:字面 `{x}`/CSS/模板语法示例不再需要 `\{` 或代码块——与上游/CommonMark 一致,文档可移植性大增。
3. **语义无歧义**:正文里"哪段会求值"由 `<` 标签显式标注,不再依赖"作者记得裸 `{…}` 会被吃"。
4. **attrs 回归上游**:`{#id}`/`{.cls}` 原生写法,与 VitePress 文档示例一致,少一层 `((…))` 心智负担。
5. **接管判定收窄,不需要 AST**:候选接管区一律以作者显式写的 `<`/`<>` 开头;接管区原文还原、零转换,错误直接由 React/oxc/运行时暴露;`tagDepth`/`firstTagIndex` 只需补 `<>` Fragment 形态(§4.2),不引入 parser(§7.4)。

### 3.2 代价

1. **作者噪音**:内联动态从 `{count}` 变 `<>{count}</>`;句子中间需记忆 Fragment 写法;表格单元格内动态(含 `|` 转义)需实测。
2. **Breaking Change**:所有既有正文 `{expr}` 站点内容需迁移(§6);行为契约文档、规则手册、示例、实时演示全部翻新。包未发布(2.0.0-alpha),删除性变更随主版本直接生效,无兼容负担(§7.5)。
3. **attrs `{}` 歧义回归**:段落末尾字面 `{…}` 与 attrs 的冲突回到上游水平(§7.3)。
4. **标题动态受限**:`{expr}` 从标题消失,标题内动态 V2 一期不支持(§7.1)。

## 4. 管线与代码影响面

### 4.1 语义切换点(必须同 PR 落地的开关)

| 位置 | 现状 | V2 |
| --- | --- | --- |
| `markdown/jsxMasking.ts` `maskJsxExpressions` | 正文裸 `{…}` 掩码为 `@@VP_EXPR_n@@` | **删除**(或仅保留 HTML 占位不涉及的部分) |
| `markdown/jsxLexer.ts` `computeMathRanges` / `findMatchingBrace` 相关 | 表达式保护 | 随表达式掩码删除(lexer 其余保留) |
| `markdown/serializeHtmlToJsx.ts` `textWithExpr` | 文本里还原 EXPR/HTML token | 只剩 HTML token 还原;EXPR 分支删除 |
| `markdownToReact.ts` `restoreHeaderExpressions` | 标题 EXPR/HTML 占位还原 | EXPR 分支删除(标题无表达式) |
| `markdown/placeholders.ts` | `exprToken`/VP token 双类别 | 移除 expr 类别(HTML 保留);`PlaceholderEntry.expr` 字段删除 |
| `markdown.ts:458-474` attrs | `left:'((' right:')'` | 恢复 `{}`(去掉覆盖或用默认) |
| `markdown/plugins/eagerFrontmatterInterpolation.ts` | 基于 `{{ }}` 的 frontmatter 插值 | 保持(它管 frontmatter 字符串插值,与正文 V2 无关;确认不冲突) |

### 4.2 新增:Fragment(`<>…</>`)的行内/块接管

- **块**:`<>{expr}</>` 独立成行 → 走现有"独立成行标签行"占位路径(`tagDepth` 判定 `<>` 与 `</>` 配对需支持 Fragment 空标签名;`tagDepth`/`firstTagIndex` 目前要求标签名 `[A-Za-z]` 开头,需扩展识别 `<>` / `</>`);
- **行内**:句子中间的 `<>{expr}</>` 不是合法 CommonMark HTML → 需要行内接管(现状 case ③ 只认合法标签名,同样要扩展);这是 V2 的主要新增工作,建议单独实现 + 单测,而不是让它在旧路径里被当字面文本漏掉;
- `serializeHtmlToJsx` 还原 HTML 占位时按原文拼回即可(不需要改 DOM 解析,Fragment 不进 HTML)。

### 4.3 与"下沉 markdown-it"的关系(可选、不阻塞 V2)

V2 语义切换**独立于** 2026-09-07 讨论的"A/B/C token 化下沉"。建议顺序:先落地 V2 语义(本决策),再评估把 `<script>/<style>` 提取与 JSX 区域接管做成 md 插件(另立决策/PR)。两件事互相不依赖;本决策不承诺 token 化范围。

### 4.4 属性映射策略:只对"机器 HTML",不对"作者 JSX"

序列化器收到的 HTML 分两类来源,处理策略不同:

1. **markdown-it / md 插件生成的 HTML**(标题、段落、代码块 `<pre class="language-…">`、链接、表格、容器、锚点、行号等)——机器输出,不是作者写的 React。React DOM 不认 `class`/`for`/`tabindex`/`style="…"`,不映射渲染即坏;`class→className`/`style` 对象/布尔属性转换**必须保留**。这不是"给 Vue 语法兜底",是 React 运行时的机械适配,删除会破坏 md 全部特性。
2. **作者亲手写的接管区 JSX/HTML**——现状已**原样还原、零转换**(§4.2);作者必须写 `className`/驼峰事件,写 `class=` 由 React/oxc 报错提示,符合「React 使用者不该被静默转换」。

**灰色地带**:少量未被接管的作者原始 HTML(标题行内标签、接管判定回退后由 markdown-it 以 html_inline/html_block 放行的片段、表格单元格内标签)会混入机器 HTML 一起经过映射。序列化器工作在**最终 HTML 字符串**上,无法回溯 token 区分来源,此时映射只能充当**容错网**(不是承诺);若日后要求"作者 HTML 用错即编译期报错",需要在 token 层区分来源或扩大接管覆盖,另立设计(§7.4),**V2 不做**。

### 4.5 顺带修复(存量、非 V2 引入)

- `serializeHtmlToJsx.spec.ts`「emits boolean attributes bare」断言与实现的 `defaultChecked` 行为不符(重构前已存在)——在 V2 测试翻新时一并修正(改断言或改实现,二选一,倾向改断言以匹配现有行为并在文档说明 `checked`→`defaultChecked`)。

## 5. 单测改版清单

### 5.1 `__tests__/unit/node/markdownToReact.test.ts`

| 现用例 | 处理 |
| --- | --- |
| `math $…$ / $$…$$ keep LaTeX braces literal` | 保留(断言可删 `not.toContain('VP_EXPR')` 一行,语义仍应字面) |
| `unpaired $ (price-like) does not break later math or expressions` | 改:`cost: {price}` → `cost: <>{price}</>`(或字面断言);`$1600` 数学保护回归保留 |
| `escaped \{ stays literal, {{…}} double braces stay literal` | 改:输入简化为字面 `{x}`/`{{双花括号}}`,断言输出字符串字面量包含原文本;删除对 `\{` 转义的依赖说明 |
| `prose {expr} is always evaluated (JSX expression)` | **反转**:`{1 + 1}` 输出字面 `{"{1 + 1}"}`;新增同内容的 `<>{1 + 1}</>` 断言求值为表达式 `{1 + 1}` |
| `attrs use ((…)) delimiters, not braces` | **反转**:`((#custom-anchor))` → `{#custom-anchor}`、`((.cls))` → `{.cls}`,断言 `id="custom-anchor"` / `className="cls"` |

新增用例:

1. 裸 `{x}` / `{{x}}` / CSS 片段 `.a { color: red }` 全部字面输出(不进表达式、无 `@@VP` 残留);
2. `<>{expr}</>` 独立成行求值;句子中间 `<>{expr}</>` 行内求值(标题除外);
3. `<Comp/>` 行内/整行行为回归不变;
4. math 的 LaTeX `{…}` 在去掉保护层后仍字面(mathjax 回归);
5. attrs `{#id}` 生效;行内 `<>{x}</>` 与 attrs 并存的段落不互相污染;
6. 回归:正文 `<` 比较(`1 < 2`)、fence 内 `<>{x}</>` 仍为代码字面;
7. 新增文件级快照式断言(至少覆盖 §2 各形态)替代旧的 before/after 等价法(语义变更后不再逐字节等价)。

### 5.2 `__tests__/unit/markdown/serializeHtmlToJsx.spec.ts`

- `always renders text as string literals so {{ }} stays literal`:保留(语义仍为字面),可补 `{expr}` 直写字面断言;
- 新增:`@@VP_HTML_n@@` Fragment(`<>{expr}</>`)还原为原始 JSX;文本含 `{` 仍整体包字符串;
- `emits boolean attributes bare`:按 §4.5 修正。

### 5.3 其他

- 文档/示例相关的 e2e 与 docs 构建快照(如有断言 `{expr}` 渲染的)单列核对清单,实施时用 `grep` 全仓扫描(§6.4)。

## 6. docs 迁移清单

### 6.1 需重写的契约文档(zh)

| 文件 | 改点 |
| --- | --- |
| `docs/zh/guide/using-react.md` | 导语(第 7 行附近)、`## 正文求值规则`(整节重写:裸 `{…}` 字面、动态= `<>{expr}</>`)、转义说明(第 21 行)、attrs 指引(第 37 行 `((…))`→`{#id}`/`{.cls}`)、`## <script>` 一节「与正文 `{…}` 共享作用域」文案、`### 在正文直接写 HTML/JSX 行`(补 `<>{expr}</>` 是唯一正文动态写法;`onClick={…}` 等整行规则不变)、实时示例 `当前计数: {count}` → `当前计数: <>{count}</>`、`### 在标题中使用组件`(注明标题内不支持 `{expr}` 动态,仅组件标签) |
| `docs/zh/guide/md-react-rules.md` | 规则表与示例(第 20-21、94-98 行一带):`{expr}` 行删改,补充 Fragment 写法与字面 `{…}` 说明、attrs `{}` 恢复 |
| `docs/zh/guide/frontmatter.md` | 「访问 frontmatter 数据」(第 24 行起)与第 43 行字面说明:useData + `<>{expr}</>` 示例;`{{ }}`/`$frontmatter` 字面展示段落更新 |
| `docs/zh/guide/data-loading.md` | 导入 data 并「被正文 `{expr}` 引用」(第 27 行)示例 → Fragment 写法 |
| `docs/zh/guide/routing.md` | 「访问页面中的参数」(第 328 行)useData + `{expr}` 示例 → Fragment 写法 |
| `docs/zh/reference/runtime-api.md` | 「frontmatter / 参数」(第 153 行)引用文案 |
| `docs/zh/reference/frontmatter-config.md` | 第 19 行 `{expr}` 引用文案 |
| `docs/zh/guide/markdown.md` | 第 11 行索引文案(「`{expr}` 表达式」表述更新) |
| `docs/zh/guide/what-is-vitepress.md` | 第 31 行 bullet(「组件标签或 `{expr}` 嵌入交互性」→「组件标签或 `<>{expr}</>`」) |
| `docs/zh/guide/md-scoped-demo.md` | 审查其中的 attrs `((…))`/scoped 示例与正文 `{expr}` 引用,同步新语法 |

### 6.2 实时示例自举迁移(重要)

`using-react.md`、`frontmatter.md`、`data-loading.md`、`routing.md` 等页内的**活体演示**(页面真实渲染的 script + 正文 `{expr}`)是 docs 站自身跑 V2 管线的回归样本——迁移时**同一 PR 内**把这些页面的活体演示一起改,否则 docs:build 后页面表现与文档不符。

### 6.3 en 文档

`docs/en/**` 目前基本是上游 Vue 语义原文(含 `{{ }}` 示例),非本 fork React 特化;V2 仅影响 React 特化文案。核对 `docs/en/guide/` 是否已有 React 特化页;没有则 en 侧不动(在 §6.1 zh 完成后另行决定是否补 en 镜像)。

### 6.4 实施时全仓扫描(核对清单)

```
grep 范围:docs/**, playground/**, template/**, __tests__/docs 等
模式:正文裸 {expr}(排除代码块/行内码)、\{ 转义教程、((…)) attrs 写法、{{…}} 双花括号教程
产出:逐处"改 / 不动(在 fence 内)"清单,作为迁移 PR 的 diff 依据
```

## 7. 边界与未决问题

1. **标题/大纲动态**:anchor id、aria-label、TOC 文本均在编译期由纯文本生成;`{expr}` 求值在运行期——**结构性不支持动态标题**。V2 明确:标题只放组件标签(现有行为),不承诺 `<>{expr}</>` 进标题(§2.2)。若确有需求,需另设计(如标题文本占位 + 客户端补丁),一期不做。
2. **表格单元格动态**:block 级表格 + 行内 Fragment 组合需实测(含 `|`/反斜杠转义)。不阻塞 V2 主体,列入实施期回归清单。
3. **attrs `{}` 与字面花括号**:段落/标题末尾字面 `{…}` 可能被 attrs 吞(上游同款)。V2 一期按上游行为接受,并在 docs 说明规避(空行/非结尾位置/`\` 转义按 attrs 自身规则)。
4. **AST 判定层:不需要**。接管区语义已收敛为"作者显式 `<`/`<>` JSX",合法性问题由 React/oxc 编译与运行时直接报错(接管区原文还原、零转换,§4.4);md 生成的 HTML 由序列化器机械适配。若日后要"更早/更友好的报错定位"或"作者 HTML 严格报错",再评估 JSX parser 或 token 级来源区分(§4.4 后述),**不作为 V2 承诺**。
5. **兼容开关:明确不提供**。包仍处于未发布版(2.0.0-alpha,无稳定用户群),删除性变更随主版本直接生效;不为旧 `{expr}` 求值语义保留 `legacyInlineExpr` 之类双语义开关。若未来出现迁移刚需,以 codemod/迁移脚本处理(§6.4 全仓扫描清单可作为其输入)。
6. **文档示例自举**:本仓库 docs 即 V2 首个真实站点,实施 PR 必须包含 §6.2 的活体示例迁移,并以 `pnpm docs:build` 通过为验收。

## 8. 实施路线与验收

- **Phase 0(本文)**:决策 + 清单评审(本 PR/分支);
- **Phase 1**:单测先翻新为新契约(红)→ 实现 §4.1 语义切换与 §4.2 Fragment 接管 → 全绿;`pnpm typecheck` + `prettier --check`;
- **Phase 2**:docs 内容与活体示例迁移(§6)→ `pnpm docs:build` 自举验收;
- **Phase 3(可选)**:行内/标题专项、表格单元格动态实测(§7.1/§7.2)。

> 验证说明:本次是**语义切换**,不复用重构期的 before/after 逐字节等价法;验收 = 新契约单测 + docs 自举构建 + e2e。
