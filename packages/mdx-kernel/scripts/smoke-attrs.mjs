// attrs 正向语义 smoke(生产语义;跑法见 package.json scripts.smoke):
// remark-attributes@0.4.4 在 vitest(development 条件分支)下触发上游
// micromark dev 断言缺陷,生产语义(默认分支)正常 —— 故用 vite-node --mode=production
// 验证 attrs 注入与 headers/title 联动。断言失败以非零退出码结束。
import { compileDocument } from '../src/index'

function assert(cond, msg) {
  if (!cond) {
    console.error('[smoke FAIL] ' + msg)
    process.exitCode = 1
    throw new Error(msg)
  }
}

const heading = await compileDocument(
  '# 标题 \\{#t1\\}\n\n## 小节 \\{#sec\\}\n\n### 更深 \\{#deep\\}\n'
)
assert(/id: "t1"/.test(heading.code), 'h1 {#t1} 应注入 id="t1"')
assert(/id: "sec"/.test(heading.code), 'h2 {#sec} 应注入 id="sec"')
assert(heading.data.title === '标题', 'title 应回退到首个 h1')
assert(heading.data.headers[0]?.title === '小节', 'headers[0] 应为 h2 小节')
assert(
  heading.data.headers[0]?.children?.[0]?.title === '更深' &&
    heading.data.headers[0]?.children?.[0]?.slug === 'deep',
  'h3 应为 h2 的 children 且 slug 用显式 id'
)

const block = await compileDocument(
  '段落 \\{.lead\\}\n\n[文档](https://a.com)\\{target=_blank rel=noopener\\}\n'
)
assert(/className: "lead"/.test(block.code), '段落 {.lead} 应注入 className="lead"')
assert(/target: "_blank"/.test(block.code), '链接 attrs target/_blank 应注入')
assert(/rel: "noopener"/.test(block.code), '链接 attrs rel=noopener 应注入')

const listBlock = await compileDocument('- item\n\n\\{.custom\\}\n')
assert(/className: "custom"/.test(listBlock.code), '块级独立行 {.custom} 应作用于列表')

console.log('[smoke ok] attrs 转义语法:标题 id/块 class/链接属性/块级均正常注入')
