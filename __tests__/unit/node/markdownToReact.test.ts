import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resolveConfig } from 'node/config'
import { disposeMdItInstance } from 'node/markdown/markdown'
import { createMarkdownToReactRenderFn } from 'node/markdownToReact'

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

describe('node/markdownToReact', () => {
  test('math $…$ / $$…$$ keep LaTeX braces literal', async () => {
    const code = await renderReact(
      [
        '---',
        'title: math',
        '---',
        '',
        'When $a \\ne 0$, two roots of $(ax^2 + bx + c = 0)$ are:',
        '',
        '$$ x = {-b \\pm \\sqrt{b^2-4ac} \\over 2a} $$',
        '',
        '| equation | description |',
        '| --- | --- |',
        '| $\\nabla \\cdot \\vec{\\mathbf{B}} = 0$ | divergence of $\\vec{\\mathbf{B}}$ |'
      ].join('\n'),
      { math: true }
    )
    // LaTeX 的 {…} 不得被掩码成 JSX 表达式(mathjax 收到原文才能渲染)
    expect(code).not.toContain('VP_EXPR')
    expect(code).toContain('mjx-container')
  })

  test('unpaired $ (price-like) does not break later math or expressions', async () => {
    // 回归:正文表格里的 $1600 是"价格"(不成对 $),其后 $$ 数学仍须受保护,
    // 之后的正文 {expr} 依旧求值
    const code = await renderReact(
      [
        '---',
        'title: t',
        '---',
        '',
        '<script>',
        'const price = 2',
        '</script>',
        '',
        '| item | cost |',
        '| --- | --- |',
        '| col | $1600 |',
        '',
        '$$ x = {-b \\pm \\sqrt{b^2-4ac} \\over 2a} $$',
        '',
        'cost: {price}'
      ].join('\n'),
      { math: true }
    )
    expect(code).toContain('mjx-container')
    expect(code).not.toMatch(/VP_EXPR_\d+@@/)
    expect(code).toContain('{price}')
  })

  test('escaped \\{ stays literal, {{…}} double braces stay literal', async () => {
    const code = await renderReact(
      ['---', 'title: t', '---', '', '字面 \\{x\\} 与 {{双花括号}}', ''].join('\n')
    )
    expect(code).not.toContain('VP_EXPR')
    expect(code).toContain('{x}')
    expect(code).toContain('{{双花括号}}')
  })

  test('prose {expr} is always evaluated (JSX expression)', async () => {
    const code = await renderReact(
      ['---', 'title: t', '---', '', '1 + 1 = {1 + 1}', ''].join('\n')
    )
    expect(code).toContain('{1 + 1}')
    expect(code).not.toContain('VP_EXPR')
  })

  test('attrs use ((…)) delimiters, not braces', async () => {
    const code = await renderReact(
      ['---', 'title: t', '---', '', '## 标题 ((#custom-anchor))', '', '正文 ((.cls))', ''].join(
        '\n'
      )
    )
    expect(code).toContain('id="custom-anchor"')
    expect(code).toContain('className="cls"')
    expect(code).not.toContain('{#custom-anchor}')
  })
})
