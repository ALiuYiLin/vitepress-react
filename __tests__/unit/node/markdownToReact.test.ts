import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, test } from 'vitest'

import { resolveConfig } from '../../../src/node/config'
import { disposeMdItInstance } from '../../../src/node/markdown/markdown'
import { createMarkdownToReactRenderFn } from '../../../src/node/markdownToReact'

// V2 契约:正文裸 {…} 一律字面文本;
// 动态内容必须显式写成 JSX(<>{expr}</> / 组件标签),由 md 内 token 级规则
// (jsxTokenRules)占位、序列化时原样还原。

async function renderReact(src: string, markdownOptions: object = {}) {
  const root = await mkdtemp(join(tmpdir(), 'vpr-mdr-'))
  try {
    const mdPath = join(root, 'page.md')
    await mkdir(join(root, '.vitepress-react'))
    await writeFile(
      join(root, '.vitepress-react', 'config.ts'),
      `export default { title: 'T', markdown: ${JSON.stringify(markdownOptions)} }`
    )
    await writeFile(mdPath, src)
    disposeMdItInstance()
    const siteConfig = await resolveConfig(root, 'build', 'production')
    const render = await createMarkdownToReactRenderFn(
      siteConfig.srcDir,
      siteConfig.markdown ?? {},
      '/',
      false,
      false,
      siteConfig
    )
    const result = await render(await readFile(mdPath, 'utf-8'), mdPath)
    return (result as any).reactSrc as string
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

const fm = (title = 't') => ['---', `title: ${title}`, '---', ''].join('\n')

describe('node/markdownToReact (V2 literal-braces contract)', () => {
  test('prose {…} / {{…}} / CSS-like braces are literal text', async () => {
    const code = await renderReact(
      [
        fm(),
        '普通文本中的 {x} 与 {{双花括号}} 都是字面文本',
        '',
        '样式写法如 .box { color: red } 所示,不需要转义'
      ].join('\n')
    )
    // 整段包成字符串字面量:花括号原样出现在 {"…"} 内,而不是被求值
    expect(code).toContain('"普通文本中的 {x} 与 {{双花括号}} 都是字面文本"')
    expect(code).toContain('"样式写法如 .box { color: red } 所示,不需要转义"')
    expect(code).not.toContain('@@VP_')
  })

  test('escaped \\{ and \\} are not needed; braces stay literal', async () => {
    const code = await renderReact(
      [fm(), '字面 \\{x\\} 仍按字面输出'].join('\n')
    )
    expect(code).toContain('"字面 {x} 仍按字面输出"')
    expect(code).not.toContain('\\{')
    expect(code).not.toContain('@@VP_')
  })

  test('math $…$ / $$…$$ keep LaTeX braces literal', async () => {
    const code = await renderReact(
      [
        fm('math'),
        'When $a \\ne 0$, two roots of $(ax^2 + bx + c = 0)$ are:',
        '',
        '$$ x = {-b \\pm \\sqrt{b^2-4ac} \\over 2a} $$'
      ].join('\n'),
      { math: true }
    )
    expect(code).toContain('mjx-container')
    expect(code).not.toContain('@@VP_')
  })

  test('unpaired $ (price-like) does not break following math', async () => {
    const code = await renderReact(
      [
        fm('t'),
        '',
        '| item | cost |',
        '| --- | --- |',
        '| col | $1600 |',
        '',
        '$$ x = {-b \\pm \\sqrt{b^2-4ac} \\over 2a} $$'
      ].join('\n'),
      { math: true }
    )
    expect(code).toContain('mjx-container')
    expect(code).not.toContain('@@VP_')
  })

  test('standalone <>{expr}</> line evaluates as JSX (fragment takeover)', async () => {
    const code = await renderReact([fm(), '<>{1 + 1}</>'].join('\n'))
    expect(code).toContain('<>')
    expect(code).toContain('</>')
    expect(code).toContain('{1 + 1}')
    expect(code).not.toContain('@@VP_')
  })

  test('inline <>{expr}</> inside a sentence evaluates', async () => {
    const code = await renderReact([fm(), '结果: <>{1 + 1}</> 对吧'].join('\n'))
    expect(code).toContain('{"结果: "}')
    expect(code).toContain('<>')
    expect(code).toContain('{1 + 1}')
    expect(code).toContain('{" 对吧"}')
    expect(code).not.toContain('@@VP_')
  })

  test('multiline <> fragment block is taken over verbatim', async () => {
    const code = await renderReact(
      [fm(), '<>', '  <p>{"hi"}</p>', '</>'].join('\n')
    )
    expect(code).toContain('</>')
    expect(code).toContain('{"hi"}')
    expect(code).not.toContain('@@VP_')
  })

  test('block fragment allows blank lines + multi-line expression (replaces ::: react)', async () => {
    const code = await renderReact(
      [
        fm(),
        '<>',
        '  {',
        '    // 多行 JSX 表达式',
        '',
        '    items.map((it) => <li key={it}>{it}</li>)',
        '  }',
        '</>'
      ].join('\n')
    )
    // 整段原文还原为 JSX(占位消失),跨空行内容不被拆散;
    // 关键:map 源码不在 {"…"} 字符串字面量里(否则就是没接管的 md 文本)
    expect(code).toContain('items.map((it) => <li key={it}>{it}</li>)')
    expect(code).not.toContain('"items.map')
    expect(code).toContain('{/* JSX md:')
    expect(code).not.toContain('@@VP_')
    expect(code).not.toContain('data-vp-jsx')
  })

  test('block fragment stops at balanced </>; following md still parses', async () => {
    const code = await renderReact(
      [
        fm(),
        '<>',
        '  {items.map(x => x)}',
        '</>',
        '',
        'after: <>{1 + 1}</>'
      ].join('\n')
    )
    expect(code).toContain('items.map(x => x)')
    expect(code).toContain('after:')
    expect(code).toContain('{1 + 1}')
    expect(code).not.toContain('@@VP_')
  })

  test('unclosed block fragment falls back to markdown (never swallows later text)', async () => {
    const code = await renderReact(
      [fm(), '<>', '{x}', '', '正文段落', '', 'closing </> alone'].join('\n')
    )
    // 没找到配平闭口 → 不接管:内容按普通 md 字面输出
    expect(code).not.toContain('@@VP_')
    expect(code).not.toContain('data-vp-jsx')
    expect(code).toContain('正文段落')
  })

  test('page-scope script + <>{count}</> share scope', async () => {
    const code = await renderReact(
      [
        fm(),
        '<script>',
        "import { useState } from 'react'",
        'const Counter = () => <button>{1 + 1}</button>',
        'export default { nope: true }',
        '</script>',
        '',
        '<Counter />',
        '',
        'count: <>{2 + 2}</>'
      ].join('\n')
    )
    expect(code).toContain('<Counter />')
    expect(code).toContain('{2 + 2}')
    // 用户 export default 被剥离为注释,页面 default 由本模块生成
    expect(code).not.toMatch(/^export default \{/m)
    expect(code).not.toContain('@@VP_')
  })

  test('attrs use {} delimiters again (V2)', async () => {
    const code = await renderReact(
      [fm(), '## 标题 {#custom-anchor}', '', '正文 {.cls}'].join('\n')
    )
    expect(code).toContain('id="custom-anchor"')
    expect(code).toContain('className="cls"')
    // attrs 标记已被消费,不会以字面文本泄漏进正文
    expect(code).not.toContain('{#custom-anchor}')
    expect(code).not.toContain('{.cls}')
  })

  test('fence & inline code keep {…} literal', async () => {
    const code = await renderReact(
      [
        fm(),
        '```js',
        "const a = { b: 1 }; const tag = '<Badge>x</Badge>'",
        '```',
        '',
        'inline `{not-expr}` and <>{1 + 1}</>'
      ].join('\n')
    )
    // inline code 花括号字面;fence 内容(经 shiki 拆 token)不透出表达式
    expect(code).toContain('"{not-expr}"')
    expect(code).not.toContain('@@VP_')
  })

  test('4-space indented code containing tags stays literal code', async () => {
    const code = await renderReact(
      [fm(), '    <Badge />', '    <>frag</>'].join('\n')
    )
    // token 层:fence/缩进代码(cod e_block)先于一切,内容不会进入接管判定
    expect(code).not.toContain('@@VP_')
    expect(code).not.toContain('data-vp-jsx')
    expect(code).toContain('Badge')
    expect(code).toContain('frag')
  })

  test('longer fence close is respected (3-backtick content line)', async () => {
    const code = await renderReact(
      [
        fm(),
        '````js',
        '```',
        "const s = '<Badge/>'",
        '````',
        '',
        'after: <>{1 + 1}</>'
      ].join('\n')
    )
    // 4 反引号开 fence 内 3 反引号行不算闭合;之后正文 Fragment 正常接管
    expect(code).not.toContain('@@VP_')
    expect(code).not.toContain('data-vp-jsx')
    expect(code).toContain('const s =')
    expect(code).toContain('{1 + 1}')
  })

  test('literal <> … </> prose without JSX interior is not taken over', async () => {
    const code = await renderReact(
      [fm(), '使用 <> 作为字面文字, 再用 </> 收尾'].join('\n')
    )
    // 无 { / < 内部 → 不接管,按 md 文本字面输出(不出现占位/求值)
    expect(code).not.toContain('@@VP_')
    expect(code).not.toContain('data-vp-jsx')
    expect(code).toContain('字面文字')
  })
})
