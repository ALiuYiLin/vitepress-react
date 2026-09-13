# JSX 区域识别层重构:声明式规则表 + 职责分离

> 适用范围:vitepress-react 的 md → React 管线里「作者 JSX / `<script>` 区域」的识别、交接与还原。
> 面向人群:`src/node/markdown/` 的维护者。
> 相关文档:`design/markdownToReact.md`(整体管线;其 §3/§4/§5/§7/§9 已按本方案同步修订)。
> 状态:**已实施**(P1–P4 全部落地,`design/jsxRegions.md §14` 是实现记录)。
> 决策基调:旧机制(A/B/C/D 四份规则 + core 末段 collect + 类型降级)**整体废弃,不做兼容保留**。

---

## 1. 结论

把现在这套

> `jsxTokenRules.ts` 里 A/B/C/D 四个字母命名的规则 + `jsxLexer.ts` 的扫描器 + `core.ruler.push('vp_jsx_collect')` 的"最后一步魔法" + `text("@@VP_HTML_n@@")` 的类型降级

换成

> **一张声明式区域表**(识别)+ **一个交接层**(把区域原文交给 SFC 或 JSX store,并由 renderer 输出占位符)+ **原有序列化器**(消费占位符)。

一句话职责边界:

| 层 | 只回答 | 不回答 |
| --- | --- | --- |
| **识别层** `jsx/regions.ts` | 这是哪一类区域、从哪里到哪里结束 | 原文交给谁、怎么输出 |
| **交接层** `jsx/handoff.ts` | 这段原文交给谁(SFC / JSX store) | 是不是区域、到哪结束 |
| **消费层** `serializeHtmlToJsx.ts` | 占位符怎么变回 JSX | 原文从哪来 |

收益(均可验证,见 §4):

- A/B/C/D 命名与 4 份近乎重复的规则消失,`<></>` 只是表里的一行;
- **没有任何 core 阶段规则**,顺序依赖只剩 3 个 `before` 锚点;
- `literalInHeading`、`collectRule`、`tagDepth`、`VP_HTML_TOKEN_MARKER` 等**死代码全部删除**;
- 标题内组件塌成 `<>` / 自动锚点被污染两个缺陷自然消失(不再需要 heading 特判);
- 判定、闸门、交接目标都写在表里,一眼可见,扩展只需加一行。

---

## 2. 架构与目录

```
源文本
  │ ① jsx/regions.ts      唯一规则表 + 扫描原语 → 产出 token(content=原文, meta=区域信息)
  ▼
token 流
  │ ② jsx/handoff.ts      a) collect: 区域 → env.sfcBlocks / env.jsxStore(顺序=源码顺序)
  │                        b) emit   : renderer rules,区域 → 占位符(唯一出口)
  ▼
中间 HTML(元素哨兵:<span data-vp-jsx="<nonce>:n"></span> / <div data-vp-jsx="<nonce>:n"></div>)
  │ ③ serializeHtmlToJsx.ts(不变)
  ▼
页面 TSX
```

目标目录:

```
src/node/markdown/
  jsx/
    scan.ts         词法原语:readTag / scanFragment / scanElementSequence / skipQuoted / skipBrace / hasDynamicPart
    scriptTags.ts   <script> 判定规则的唯一定义(open/close/client/setup + toScriptBlock)
    regions.ts      区域规则表 REGION_RULES + registerRegionRules()
    handoff.ts      collectRegion()(→ sfcBlocks / jsxStore)+ emit renderer rules
    index.ts        applyJsxRegions(md, options) 对外唯一入口
  placeholders.ts 占位契约(保留,删掉死导出)
  serializeHtmlToJsx.ts  不变
```

**删除**:`src/node/markdown/jsxTokenRules.ts`(472 行)、`src/node/markdown/jsxLexer.ts`(291 行,内容并入 `jsx/scan.ts` 并删死函数)。

---

## 3. 识别层:区域规则表(唯一识别来源)

### 3.1 表结构

```ts
export type RegionKind = 'script' | 'element' | 'fragment' | 'raw'

/** 结束判定:正则(逐行)或配平(跨行,引号/花括号/注释感知) */
export type EndStrategy =
  | { type: 'regex'; re: RegExp }
  | { type: 'balanced'; open: string; close: string }

export interface RegionRule {
  id: string                                  // 'script' | 'element' | 'fragment' | 'raw'
  region: RegionKind
  placement: 'inline' | 'block'
  start: RegExp                               // 行首(block)或当前位置(inline)
  end: EndStrategy
  anchor: string                              // 注册锚点:before(anchor)
  gate?: (raw: string) => boolean             // 闸门:不满足则交回 md 语法
  excludeTag?: (name: string) => boolean      // 标签级排除(script/style,交给别的模块)
  option: keyof RegionOptions                 // 由哪个开关控制
  sink: 'jsx' | 'sfc'                         // 交接目标(handoff 据此分派)
}
```

### 3.2 规则表(本方案的全部识别规则)

| 规则 id | region | placement | `start` | `end` | `anchor` | 闸门 / 排除 | 开关 | sink |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `vp_script_block` | script | block | `^ {0,3}<script\b(?![^>]*\bclient\b)` | `regex /<\/script>\s*$/` | `html_block` | client 版交给机器 HTML | `script`(默认 on) | **sfc** |
| `vp_element_block` | element | block | `^<[A-Za-z]` | `balanced(标签名配对)` | `html_block` | 整行只允许元素序列 + 尾随空白;`excludeTag: script/style` | `authorTags`(默认 on) | jsx |
| `vp_element_inline` | element | inline | `<` + 字母 | `balanced(标签名配对)` | `text` | `excludeTag: script/style` | `authorTags` | jsx |
| `vp_fragment_block` | fragment | block | `^<>` | `balanced('<>', '</>')` | `paragraph` | `gate: hasDynamicPart`(内部含 `{` 或 `<`) | `fragment`(默认 on) | jsx |
| `vp_fragment_inline` | fragment | inline | `<>` | `balanced('<>', '</>')` | `text` | `gate: hasDynamicPart` | `fragment` | jsx |
| `vp_raw_block` | raw | block | `^:::+ *react\s*$` | `regex /^ {0,3}:::[ \t]*$/` | `paragraph` | — | `container`(默认 on) | jsx |

三条设计要点:

1. **`<></>` 不再是特例**:它和 `element` 共用 `balanced` 结束策略(深度计数 + `skipQuoted`/`skipBrace`/注释跳过),差别只在 `start`/`open`/`close` 与闸门。
2. **闸门与排除项写在表里**,不再埋在规则函数内部(现在 `hasJsxInterior`、`NON_JSX_TAGS`、`hasVueishAttr` 三处分居)。判据只保留与框架无关的两类:**内容是否含动态部分**、**是否 `script`/`style`**;**不做任何 Vue 特征识别**(见 §13.6)。
3. **`sink` 写在表里**:哪一行交给 SFC、哪一行交给 JSX store,一眼可见(现在 script 的 `env.sfcBlocks` 写入埋在 A 规则里)。

### 3.3 注册与处理器(一份代码服务全部规则)

```ts
export function registerRegionRules(md: MarkdownItAsync, options: RegionOptions) {
  for (const rule of REGION_RULES) {
    if (!options[rule.option]) continue
    if (rule.placement === 'block') {
      md.block.ruler.before(rule.anchor, rule.id, createBlockHandler(rule))
    } else {
      md.inline.ruler.before(rule.anchor, rule.id, createInlineHandler(rule))
    }
  }
}

function createBlockHandler(rule: RegionRule): RuleBlock {
  return (state, startLine, _endLine, silent) => {
    const first = lineAt(state, startLine)
    if (!rule.start.test(first)) return false
    const lastLine = resolveEndBlock(rule.end, state, startLine)  // 未配平 → null
    if (lastLine == null) return false                            // 交回 md 语法(不吞文档)
    const raw = sliceLines(state, startLine, lastLine)
    if (rule.gate && !rule.gate(raw)) return false
    if (silent) return true
    pushRegion(state, rule, raw, startLine + 1)                   // token + 交接
    state.line = lastLine + 1
    return true
  }
}
```

`resolveEndBlock` 只做两件事:`regex` → 逐行 `.test`;`balanced` → 调 `scan.ts` 的配平扫描。**识别层不碰 store、不碰占位符。**

### 3.4 行内规则的实现约定(silent 语义,必读)

行内规则靠"**推进 `state.pos` + 只产一个 token**"来跳过内部解析 —— markdown-it 没有 skip API:

- `ParserInline.tokenize`(`markdown-it/lib/parser_inline.mjs:138-175`)是 `while (state.pos < posMax)` 循环,每个位置**按顺序**试规则,第一个返回 `true` 的赢,然后从**新的 pos** 继续;
  区域内部因此永远不会再经过任何 inline 规则(区域里的 markdown 语法、行内 HTML、`[链接]`、`**强调**` 都不解析)。
- 成功时必须 `state.pos > prevPos`,否则 markdown-it 抛 `"inline rule didn't increment state.pos"`(`:158`)。
- `state.push()` 会先把累积的 `state.pending` 刷成 text token 再压入新 token(`rules_inline/state_inline.mjs:52-55`),
  所以"区域之前的纯文本"顺序天然正确,不需要手工 flush。

**`silent = true` 时也必须推进 `state.pos`,只是不 push token** —— 这是现有实现的真 bug:

`md.inline.skipToken`(`parser_inline.mjs:88-134`)被 `link` / `image` 用来**扫描链接标签内部**,
它对返回 `true` 的规则要求 `pos` 必须前进,否则抛错(`:113`)。现有 `jsxTokenRules.ts:147` 与 `:355`
写的是"先 `if (silent) return true`,再推进 pos",于是**实测直接崩**:

```
[<>{a}</>](/x)          → THROW: inline rule didn't increment state.pos
[文字 <>{a}</>](/x)     → THROW
[<Badge />](/x)         → THROW
[文字 <Badge>x</Badge>](/x) → THROW
```

正确约定见 `html_inline`(`rules_inline/html_inline.mjs:41-49`):**两种模式都推进 `pos`,只把 `push` 包在 `if (!silent)` 里**。
按此写法则上述用例全部正常(已验证)。

```ts
function fragmentInlineRule(state: StateInline, silent: boolean): boolean {
  const { src, pos, posMax } = state
  if (src.charCodeAt(pos) !== 0x3c /* < */ || src[pos + 1] !== '>') return false
  const end = scanFragment(src, pos, posMax)          // posMax 为硬边界,未配平返回 -1
  if (end < 0) return false
  const raw = src.slice(pos, end)
  if (!hasDynamicPart(raw, 2, raw.length - 3)) return false  // 闸门:内部无 { 与真标签
  state.pos = end                                     // ★ silent 与正常模式都要推进
  if (silent) return true
  const token = state.push('vp_jsx_inline', '', 0)     // nesting=0,不进出强调/链接层级
  token.content = raw                                 // 原文留在 token 上(§4)
  token.meta = { region: 'fragment', placement: 'inline', line: 0, start: pos, end }
  collectRegion(state.env, token, token.meta, rule)
  return true
}
```

补充约定:

- `posMax` 是 inline 内容(一个段落/标题)的硬边界 → **段落里未闭合的 `<>` 不可能吞掉下一段**;跨段区域必须由块级规则 `vp_fragment_block` 承担。
- **块级规则的 `silent` 语义相反**:块规则的 `silent` 是纯谓词(不许改 `state`),因此 §3.3 草案里 `if (silent) return true` 放在 `state.line = …` **之前**是正确的;不要照抄行内的写法。
- 我们的 token `nesting = 0`,对 `ruler2` 的 `balance_pairs` / `emphasis.postProcess` / `fragments_join` 是惰性的(`fragments_join` 只合并相邻 `text`,不会跨过它);实测 `**<>{a}</>**` 正常。
- 代码段优先:`` ` <>{a}</> ` `` 不会被接管(`backticks` 规则在自己的位置上先赢) —— 实测保持字面。

---

## 4. token 契约(识别层产出)

```ts
// 类型只区分"放置"与"是否进正文",不区分区域细节
'vp_script'        // block,meta.region='script'  → sink=sfc
'vp_jsx_inline'    // inline,meta.region='element' | 'fragment'
'vp_jsx_block'     // block,meta.region='element' | 'fragment' | 'raw'

interface RegionMeta {
  region: RegionKind
  line: number       // 1-based,块级规则填 startLine+1(错误定位用)
  start: number      // 源码偏移
  end: number
}
```

两个刻意的选择:

- **原文放 `token.content`**(与 markdown-it 的 `html_block`/`html_inline` 同构):中间阶段、第三方插件、以及将来的"token→JSX 直接渲染"都能拿到原文,不需要认识 store;
- **索引放 `token.meta.jsxIndex`**:由交接层在 collect 时写入,renderer 只读它。

---

## 5. 交接层

### 5.1 collect:按 `sink` 分派

```ts
export function collectRegion(env: MarkdownEnv, token: Token) {
  const meta = token.meta as RegionMeta
  if (meta.region === 'script') {
    const sfc = (env.sfcBlocks ??= emptySfcBlocks())
    const block = toSfcBlock(token.content)              // 唯一一处 script 字段/ setup / client 判定
    sfc.scripts.push(block)
    if (isScriptSetup(block.tagOpen)) sfc.scriptSetup = block
    else sfc.script = block
    return
  }
  const store = (env.jsxStore ??= [])
  token.meta.jsxIndex = store.length
  store.push({ html: withLineComment(token.content, meta.line) })
}
```

- `<script>` 的**全部判定集中在这里**:开/闭标签、setup、client 排除。现在它们分散在
  `jsxTokenRules.ts:29-30`、`placeholders.ts:19`、`buildReactPageModule.ts:79`、plugin-sfc 内部共 4 处。
- `env.sfcBlocks` / `env.jsxStore` 都用 `??=` 兜底(现在 `jsxStore` 依赖 `markdownToReact.ts:120` 隐式提供)。

### 5.2 emit:唯一占位出口

```ts
export function registerRegionRenderer(md: MarkdownItAsync) {
  md.renderer.rules.vp_jsx_inline = (t, i) => jsxInlinePlaceholder(t[i].meta.jsxIndex)
  md.renderer.rules.vp_jsx_block = (t, i) => jsxBlockPlaceholder(t[i].meta.jsxIndex)
  md.renderer.rules.vp_script = () => ''
}
```

`placeholders.ts` 只被这一个文件 import。占位符是**带 nonce 的元素哨兵**:

| 占位 | 值 |
| --- | --- |
| 行内 | `<span data-vp-jsx="<nonce>:n"></span>` |
| 块级 | `<div data-vp-jsx="<nonce>:n"></div>`(markdown-it 视作 html_block,不进 `<p>`) |

两个设计点(见 `placeholders.ts` 顶部注释):

1. **用元素而不是文本 marker**:元素只在**已解析的 HTML 结构**上被识别,作者正文/代码块里写的同名字面量不会被误展开。旧的 `@@VP_HTML_n@@` 文本 marker 有碰撞漏洞(实测:代码块里写 `@@VP_HTML_0@@` 会被替换成真实区域的 JSX)。
2. **属性值带进程级 nonce**(`VP_JSX_NONCE`):序列化器只展开带本进程 nonce 的哨兵,于是作者手写的 `<span data-vp-jsx="0">`(raw HTML 路径)也不会被当成占位符。

---

## 6. 删除清单(垃圾代码,不保留兼容层)

| 位置 | 处置 | 依据 |
| --- | --- | --- |
| `jsxTokenRules.ts`(整文件,472 行) | **删除**;能力迁入 `jsx/` | A/B/C/D 四份规则 + collect 全部被表 + 交接层取代 |
| `jsxLexer.ts`(整文件,291 行) | **删除**;`readTag`/`scanElement`/`skipQuoted`/`skipBrace` 并入 `jsx/scan.ts` | 只服务于旧规则;`tagDepth`、`hasVueishAttr` 均不再需要 |
| `jsxLexer.ts:191-241` `tagDepth` | **删除** | 全仓库无调用点(仅 `design/markdownToReact.md:94,262` 提及) |
| `jsxLexer.ts:252-291` `hasVueishAttr` | **删除**(不保留、不重命名为 `isVueSyntax`) | 不做 Vue 特征识别:作者标签一律按 JSX 交给 oxc,Vue 写法由编译器报错(见 §13.6) |
| `placeholders.ts:25` `VP_HTML_TOKEN_MARKER` | **删除** | 全仓库无调用点 |
| `jsxTokenRules.ts:411-425` `collectRule` | **删除** | core 阶段中转被 renderer emit 取代 |
| `jsxTokenRules.ts:428-446` `convertFragmentChildren` | **删除** | 同上 |
| `jsxTokenRules.ts:422,437-440` `parentIsHeading` / `literalInHeading` | **删除** | 死代码:入口条件已排除标题 |
| `jsxTokenRules.ts:150,358` `token.map = state.env?.map ?? null` | **删除** | inline state 无 `map`,恒为 `null` |
| `jsxTokenRules.ts:147,355` 行内规则的 `if (silent) return true` 位置 | **修正**:改为先推进 `state.pos` 再返回(见 §3.4) | 现状会让 `[<>{a}</>](/x)`、`[<Badge />](/x)` 抛 `"inline rule didn't increment state.pos"` |
| `jsxTokenRules.ts:117-124` `hasJsxInterior`(朴素 `includes`) | **替换**为 `scan.ts` 的 `hasDynamicPart()`(引号/花括号/注释感知) | 现状会把字符串里的字面 `{` 当表达式 |
| `jsxTokenRules.ts:46-110` `fragmentEnd` | **替换**为 `scan.ts` 的 `scanFragment()`(补齐 `/* */`、`//` 注释跳过,stray 闭标签不再破坏深度) | 现状不识别 JS 注释,`<>{/* </> */ a}</>` 被截断 |
| `placeholders.ts:19` `SCRIPT_SETUP_TAG_OPEN_RE` | **迁入** `jsx/regions.ts`(与 client/close 同一处) | 与 plugin-sfc 的同名正则语义漂移风险 |
| `markdown.ts:597` `applyJsxTokenRules` | **替换**为 `applyJsxRegions` | — |
| `design/markdownToReact.md` §3/§4/§5/§7/§9 | 同步修订(该文描述的 `canTakeoverRaw` 在代码里已不存在) | 文档与实现漂移 |

**A/B/C/D 这套命名一并作废**:新代码里只出现 `region`(`script` / `element` / `fragment` / `raw`)与 `placement`(`inline` / `block`)。

---

## 7. 顺序约束(只剩 3 个锚点)

| 锚点 | 谁用 | 为什么 |
| --- | --- | --- |
| `before('text')` | `vp_element_inline`、`vp_fragment_inline` | 行内区域必须抢在 `text` / `html_inline` 之前 |
| `before('html_block')` | `vp_element_block`、`vp_script_block` | 作者块级区域不能被 markdown-it 的 `html_block` 抢走 |
| `before('paragraph')` | `vp_fragment_block`、`vp_raw_block` | 整块区域不能进 `<p>` |

**没有 core 规则**,也没有 renderer 之间的顺序依赖(renderer 按 token 类型分发)。
交接发生在规则内(token 产出后立即),所以 store 的顺序天然等于源码顺序,不需要"最后一步"补救。

---

## 8. 行为变更(必须写 CHANGELOG)

| 场景 | 现状 | 重构后 |
| --- | --- | --- |
| `## Handle <Badge>x</Badge>` | 正文 `Handle <>`;slug `handle-badge-x-badge` | 正文原样 JSX;slug `handle-x` |
| `## <>{x}</>` | 字面文本 | 表达式(**语义变更**) |
| `## Handle <Badge>x</Badge> {#custom-id}` | `id="custom-id"` | 不变 |
| `env.headers[].title` | `Handle` | 不变(新类型不在 `resolveTitleFromToken` 白名单内) |
| `[<>{a}</>](/x)`(标签内含区域) | **抛错** `inline rule didn't increment state.pos` | 正常渲染为带片段的链接 |
| `<>c < d</>`(内部只有字面 `<`) | 接管(闸门只看子串) | 保持字面(闸门忽略引号/注释内的字面 `{`/`<`) |
| `<>{/* </> */ a}</>` | 被截断 | 完整接管 |
| local search 标题/正文 | 标题里的 `<>` 被 `/<[^>]*>/g` 顺带清掉 | 不变(哨兵是元素,去标签正则天然覆盖) |
| `<div :class="x">y</div>`(Vue 写法) | 静默降级:属性丢弃 + 告警,正文只留 `y` | **按 JSX 原样交给 oxc → 编译期报错**(有意为之,见 §13.6) |
| 正文/代码块里写 `@@VP_HTML_0@@` | 被当成占位符 → **内容被替换成真实区域的 JSX** | 字面保留(占位格式已换成元素哨兵 + nonce) |
| 作者 raw HTML 写 `<span data-vp-jsx="0">` | 会被当成块级占位符 | 普通 span(nonce 不符,不展开) |
| `<>` / `<></>` / `<>纯文字</>` / `a <> b` / `Array<>` | 字面 | 字面(闸门保证,不变) |
| 用户 `config()` 替换 `renderer.rules.text` | 会影响占位符输出 | 不影响区域(更稳) |
| 用户 `config()` 替换 `renderer.rules.vp_jsx_*` | 无此扩展点 | 新增(可定制占位策略) |

---

## 9. 联动改动

**必改**

| 文件 | 改动 |
| --- | --- |
| `markdown.ts:490-526` | anchor 的 `getTokensText` filter 增加 `vp_jsx_inline` / `vp_jsx_block` |
| `markdownToReact.ts:115-135` | 注释与 env 契约更新(`jsxStore` 语义不变,改为在 collect 层兜底创建) |

**必须联动(易漏)**

| 文件 | 问题 | 处理 |
| --- | --- | --- |
| `localSearchPlugin.ts:284-315` | 渲染后字符串消费者 | 无需特殊处理:占位符是元素哨兵,`/<[^>]*>/g` 已覆盖(一度加过 marker 清洗,换成哨兵后已移除) |

**建议顺手做**

- `buildReactPageModule.ts:79` `scriptClientRE`、`:129/:133` style 判定:统一引用 `jsx/regions.ts` 的单一定义;
- `eagerFrontmatterInterpolation.ts:29-36` 的 `htmlTagRE`/`scanRawHtml` 改用 `jsx/scan.ts`,不再维护第二套标签语义;
- `THEME_MD_TAGS`(`buildReactPageModule.ts:215-251`)目前扫两遍(HTML + store 原文):若将来把原文内联进 HTML 才可能降为一遍,本次不动。

**不动**:`@mdit-vue/plugin-sfc`、`@mdit-vue/plugin-component`(它只负责机器 HTML 那一侧)。

---

## 10. 测试计划

### 10.1 逐行规则用例(每行都要有正例 + 反例)

| 规则 | 正例 | 反例(必须保持字面/机器 HTML) |
| --- | --- | --- |
| `vp_script_block` | `<script>export const A = 1</script>` | `<script client>`(交机器 HTML → plugin-sfc) |
| `vp_element_block` | `<div class="a"><span>内层 <b>粗</b></span></div>` | `文字 <b>粗</b>`(行内不整块接管) |
| `vp_element_inline` | `前 <Comp a={n => n + 1} /> 后` | `<3 大于 2`、`a < b`、`<_x>`(语法上不是标签) |
| `vp_fragment_block` | `<>\n{x}\n</>` | `<>` 未闭合(回退,不吞文档) |
| `vp_fragment_inline` | `<>{count}</>`、`<>a<b/></>` | `<>`、`<></>`、`<>纯文字</>`、`Array<>`、`Map<string, Set<>>` |
| `vp_raw_block` | `::: react\n<Comp/>\n:::` | `::: tip`(容器插件负责) |

### 10.2 机制用例

| # | 用例 | 期望 |
| --- | --- | --- |
| 1 | 标题内元素 | slug 干净;正文原样 JSX |
| 2 | 标题内 Fragment | 表达式(行为变更已记录) |
| 3 | `{#id}` 与组件同标题 | `id` 生效 |
| 4 | `env.headers[].title` / `env.title` | 不含组件名、不含 marker |
| 5 | local search 索引 | 不含 marker / 哨兵 |
| 6 | 代码围栏 / 行内代码里的 `<>` 与标签 | 字面(不被接管) |
| 7 | 用户替换 `renderer.rules.text` | 区域不受影响 |
| 8 | 用户替换 `renderer.rules.vp_jsx_inline` | 生效(新扩展点) |
| 9 | `env.sfcBlocks` 在 `md.parse` 单独调用时 | 不抛错(`??=` 兜底) |
| 10 | `<script>` 与 `<style>` 混排 | script 进 sfcBlocks;style 由 plugin-sfc 处理;正文无残留 |
| 11 | Vue 写法 `<div :class="x">y</div>` | 接管为 JSX → oxc **编译失败**,报错指向源 md 行(不再静默降级) |
| 12 | 独立一行 `<Badge />` 且带 Vue 属性 `<Badge :type="x" />` | 同上:编译期报错,而非丢属性 |
| 13 | 区域出现在链接标签内:`[<>{a}</>](/x)`、`[文字 <Badge />](/x)` | 正常渲染(回归 §3.4 的 `skipToken` 崩溃) |
| 14 | 区域出现在强调内:`**<>{a}</>**` | 正常渲染 |
| 15 | 未闭合 `<>` 与后续段落 | 段落内不接管;下一段不受影响(`posMax` 边界) |

### 10.3 基线先行

先在 `__tests__/unit/node/authorTags.test.ts` 补一条**记录当前行为**的标题用例
(`## Handle <Badge>x</Badge>` → 现为 `<>` / slug 污染),重构后改成期望行为,便于对照回归。
现有覆盖:`authorTags.test.ts` 有段落/行内/属性/嵌套用例但**无标题用例**;`markdown/markdown.test.ts:31`
只覆盖了不带组件的 `## Title {#custom-id}`。

另外,**现有用例 `authorTags.test.ts:143-154`「Vue 写法不接管(仍走告警/丢弃路径)」必须删除或改写**
(改为「Vue 写法 → 编译期报错」);同文件 `:150-153` 的 `{{ msg }}` 断言同理 —— 新语义下
`<div>{{ msg }}</div>` 会被当作 JSX 表达式容器,不再有「字面回退」这条路径。

---

## 11. 分期

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| P1 骨架 | 建 `jsx/scan.ts`、`jsx/scriptTags.ts`、`jsx/regions.ts`、`jsx/handoff.ts`、`jsx/index.ts`;表驱动注册;行内规则按 §3.4 的 silent 约定实现;`<script>` 判定集中到交接层 | ✅ 已完成 |
| P2 清理 | 删除 `jsxTokenRules.ts`、`jsxLexer.ts`、`tagDepth`、`VP_HTML_TOKEN_MARKER`、`collectRule`、`literalInHeading`、`SCRIPT_SETUP_TAG_OPEN_RE`(迁 `scriptTags.ts`);更新 `design/markdownToReact.md` 与相关注释 | ✅ 已完成 |
| P3 修正 | `fragmentEnd` → `scanFragment`(注释感知)、`hasDynamicPart` 收紧;删除 `hasVueishAttr` 及其回退路径 | ✅ 已完成 |
| P4 收敛 | script 正则单一定义(`scriptTags.ts`)、`eagerFrontmatter` 复用 `scan.ts`、localSearch 清 marker | ✅ 已完成 |

---

## 12. 旧 → 新 迁移映射(评审对照用)

| 旧结构 | 新结构 |
| --- | --- |
| A 规则 `scriptRule`(`jsxTokenRules.ts:158-208`) | 表 `vp_script_block` 行 + `handoff.collectRegion(sink='sfc')` |
| B 行内 `fragmentRule`(`:138-153`) | 表 `vp_fragment_inline` 行 |
| B 块级 `fragmentBlockRule`(`:253-292`) | 表 `vp_fragment_block` 行 |
| C `collectRule` / `convertFragmentChildren`(`:411-446`) | **删除**;职责移到 `handoff.registerRegionRenderer` |
| D `elementRule` / `elementBlockRule`(`:348-403`) | 表 `vp_element_inline` / `vp_element_block` 行 |
| `::: react` `reactContainerRule`(`:213-242`) | 表 `vp_raw_block` 行 |
| `jsxLexer.readTag` / `scanElement` / `skipQuoted` / `skipBrace` | `jsx/scan.ts`(语义保留) |
| `jsxLexer.hasVueishAttr` | **删除**(不做 Vue 特征识别) |
| `jsxLexer.tagDepth` | **删除**(无调用) |
| `jsxTokenRules.hasJsxInterior` | `jsx/scan.ts` 的 `hasDynamicPart()`,成为 `fragment` 行的 `gate` |
| `jsxTokenRules.fragmentEnd` | `jsx/scan.ts` 的 `scanFragment()` |
| `jsxTokenRules.applyJsxTokenRules` | `jsx/index.ts` 的 `applyJsxRegions()` |
| `placeholders.SCRIPT_SETUP_TAG_OPEN_RE` | `jsx/regions.ts`(单一定义) |

---

## 13. 风险与说明

1. **内部 API 变更**:`vp_jsx` / `vp_jsx_block` token 类型名被 `vp_jsx_inline` / `vp_jsx_block` 取代。
   这两个类型是内部契约(无对外文档承诺),但需在 CHANGELOG 注明,便于站点侧自查自定义 `renderer.rules`。
2. **`<>` 支持不是新增能力**:行内/多行 Fragment 现状已支持;重构只是把它从"两条独立规则"变成"表里两行 + 共用配平扫描",并补齐注释感知。
3. **闸门不能省**:实测 `a <> b`、`Array<>`、`Map<string, Set<>>`、`<></>`、`<>纯文字</>` 全靠 `hasDynamicPart` 才保持字面;未配平时的 `return false` 是防止 `<>` 误写吞掉整篇文档的唯一保障。
4. **不做的事**(理由见旧方案讨论,此处固化):不 fork `@mdit-vue/plugin-component`;不把原文内联进 HTML 属性(多层编解码 + 模糊负载易被中间阶段破坏);不上「token → JSX 直接渲染」的渲染器(重构级,另立议题)。
5. **回滚**:P1 完成后旧文件仍在,可整体回退;P2 删除后靠 git 历史恢复。
6. **不做 Vue 特征识别(决策,必须遵守)**:
   - 作者写的标签一律按 JSX 处理:`class` / `style="…"` 就是作者写法,不做 `className` / 对象字面量转换(转换只发生在**机器 HTML** 那一侧);
   - **不再有"Vue 特征 → 静默降级到机器 HTML + 告警"这条路径**。`hasVueishAttr` 及其分支全部删除;
   - 报错行为(按语法事实,不额外承诺):
     | 写法 | 结果 |
     | --- | --- |
     | `:prop="x"` / `@click="x"` | JSX 属性名非法 → **oxc 编译期报错**,行号可回溯源 md |
     | `{{ msg }}` | 编译通过(被当表达式容器)→ 求值时 `msg is not defined`,SSR 阶段即失败 |
     | `v-if` / `v-pre` / `v-for` | 是合法 JSX 标识符 → 编译通过,被当普通属性透传(DOM 上可见 `v-if=""`) |
   - `::: v-pre` 容器不再作为"抑制接管"的条件:需要展示字面标签或 `<>…</>` 请用行内代码或代码围栏;
   - 影响面:站点正文若写了 Vue 语法,升级后会从"告警 + 降级"变成**构建/渲染报错**。这是有意为之,须写进 CHANGELOG。
   - 机器 HTML 一侧的告警仍然保留(`serializeHtmlToJsx` 丢弃 `:x`/`@x`/`v-*` 并告警):它现在只可能命中**插件产出的 HTML**,作者标签不再走那条路。

---

## 14. 实施记录(P1–P4)

落地文件:

| 文件 | 行数级 | 说明 |
| --- | --- | --- |
| `src/node/markdown/jsx/scan.ts` | 新增 | 词法原语:`readTag` / `skipQuoted` / `skipBrace` / `scanElement` / `scanElementSequence` / `scanFragment` / `hasDynamicPart` / `VOID_HTML_TAGS` |
| `src/node/markdown/jsx/scriptTags.ts` | 新增 | `SCRIPT_OPEN_RE` / `SCRIPT_CLOSE_RE` / `SCRIPT_CLIENT_RE` / `SCRIPT_SETUP_OPEN_RE` / `isScriptSetup` / `toScriptBlock`(**唯一定义**) |
| `src/node/markdown/jsx/regions.ts` | 新增 | `REGION_RULES`(6 行)+ `registerRegionRules` + 块级/行内处理器 |
| `src/node/markdown/jsx/handoff.ts` | 新增 | `collectRegion`(按 `sink` 分派)+ `registerRegionRenderer` |
| `src/node/markdown/jsx/index.ts` | 新增 | `applyJsxRegions` |
| `jsxTokenRules.ts` / `jsxLexer.ts` | **删除** | 472 + 291 行 |

同步改动:

| 文件 | 改动 |
| --- | --- |
| `markdown.ts` | `applyJsxTokenRules` → `applyJsxRegions`;anchor `getTokensText` 的 filter 增加 `vp_jsx_inline` / `vp_jsx_block` |
| `placeholders.ts` | 占位符改为**带 nonce 的元素哨兵**(行内 `<span data-vp-jsx>`、块级 `<div data-vp-jsx>`);删除死导出 `VP_HTML_TOKEN_MARKER`、`SCRIPT_SETUP_TAG_OPEN_RE`(后者迁 `scriptTags.ts`)、`htmlToken`/`VP_HTML_TOKEN_GLOBAL_RE` |
| `serializeHtmlToJsx.ts` | `VOID_HTML_TAGS` 改从 `./jsx/scan` 引入;删除文本 marker 分支(文本一律字符串字面量),哨兵展开泛化为"任意带 `data-vp-jsx` 且 nonce 匹配的元素" |
| `buildReactPageModule.ts` | `scriptClientRE` → 引用 `SCRIPT_CLIENT_RE`(单一来源) |
| `plugins/eagerFrontmatterInterpolation.ts` | 删除自备的 `htmlTagRE` / `htmlCommentRE` / `rawTextElementRE` / `voidTagRE`,改用 `readTag` + `VOID_HTML_TAGS` |
| `plugins/localSearchPlugin.ts` | 一度为行内 marker 加过清洗;换成元素哨兵后**已移除**(普通去标签正则覆盖) |
| `design/markdownToReact.md` | §2/§3/§4/§5/§7/§9 按新架构重写 |

验证:

- `vitest run -r __tests__/unit`:**25 个测试文件 / 344 个用例全部通过**;
- `pnpm typecheck`(shared + client + node)与 `tsc -p __tests__/unit` 均无错误;
- 新增用例:标题内元素(slug 干净)、标题内元素 + `{#id}`、链接标签内区域(`skipToken` 崩溃回归)、`<>c < d</>` 字面、Vue 写法按 JSX 透传(改写原"静默降级"用例)、字面 `@@VP_HTML_0@@` 不被展开(正文 + 代码块)、伪造 `data-vp-jsx` 哨兵不被展开、哨兵展开(行内/块级)单测。

### 14.1 占位符格式:文本 marker → 带 nonce 的元素哨兵

起因(P1 之后的实测):`@@VP_HTML_n@@` 是**文本级**占位,序列化器在 `decodeEntities` 之后对文本做正则替换,于是作者写的同名字面量会被当成占位符 —— 代码块里写 `@@VP_HTML_0@@` 会被替换成真实区域的 JSX(示例代码被篡改,且同一段 JSX 出现两次);正文同理。

改成元素哨兵后:

| | 旧文本 marker | 新元素哨兵 |
| --- | --- | --- |
| 识别时机 | `decodeEntities` 之后对文本正则匹配 | 只在**已解析的 HTML 结构**上识别 |
| 代码块里的同名字面量 | 被替换 ❌ | 保持字面 ✅(HTML 里是 `&lt;span…`,只当字符串) |
| 作者 raw HTML 伪造 | 不适用 | nonce 不符 → 不当占位符 ✅ |
| HTML 级消费者(搜索去标签等) | 需要显式清 marker | 普通去标签正则即可 ✅ |
| 序列化器分支 | 文本分支 + 块级哨兵分支 | **一条**哨兵分支(行内/块级共用) |

残余取舍:中间 HTML 不再逐字节可复现(nonce 每次进程随机),只在本进程内被序列化器消费,不影响编译缓存(缓存键是内容 hash + 站点时间戳,`reactSrc` 里不含 nonce)。

与方案的偏差(均是实现期决策,理由已记):

1. **多了一个 `scriptTags.ts`**(方案里 4 个文件):把 `<script>` 判定集中到独立模块,避免 `regions ↔ handoff` 循环依赖,同时满足 P4 的"script 正则单一定义"。
2. **P3 的"v-pre 感知"取消**:按 §13.6 的决策,`::: v-pre` 不再作为抑制接管的条件。
3. **`vp_raw_block`(`::: react`)保留"不打断段落"**(`terminatesParagraph: false`),与旧实现逐字一致;这是否应该改由容器语义决定,留待单独确认。
4. **块级区域现在会写 `token.map`**(旧实现没有),便于诊断;不影响渲染。
5. **`scanFragment` 比旧的 `fragmentEnd` 更严格**:stray 闭标签(`<>a</b></>`)不再错误地提前结束;`hasDynamicPart` 忽略引号/注释内的字面 `{`/`<`,于是 `<>c < d</>` 现在保持字面(旧实现会接管)。
6. `SerializedHtmlToJsx` 一侧的 Vue 属性告警保留,但**只可能命中机器 HTML**(作者标签不再经过该路径)。
