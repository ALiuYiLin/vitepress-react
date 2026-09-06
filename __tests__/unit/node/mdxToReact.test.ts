import { describe, it, expect } from 'vitest'
import { transformWithOxc } from 'vite'
import { assembleMdxPage } from 'node/mdxToReact'
import type { PageData } from 'shared/shared'

const pageData = {
  title: '样例页',
  frontmatter: { title: '样例页' },
  headers: [{ level: 2, title: '小标题', slug: 'xiao-biao-ti', children: [] }],
  relativePath: 'sample.md',
  filePath: 'sample.md'
} as PageData

describe('assembleMdxPage', () => {
  const code = `import {jsx as _jsx} from "react/jsx-runtime";
export const frontmatter = {"title":"样例页"};
export default function MDXContent(props = {}) {
  return _jsx("p", { children: "正文" })
}
`

  it('把原 default 改名内部函数并追加 __pageData 与 default Page', () => {
    const out = assembleMdxPage(code, pageData)
    expect(out).not.toContain('export default function MDXContent')
    expect(out).toContain('function MDXContent')
    expect(out).toContain('export const __pageData = JSON.parse')
    expect(out).toContain('样例页')
    expect(out).toContain('export default function Page(props = {})')
    expect(out).toContain("className: 'vp-doc'")
    // 包装用独立别名,不与产物 _jsx 冲突
    expect(out).toContain("import { jsx as _vpJsx } from 'react/jsx-runtime'")
    expect(out).toContain('_vpJsx(MDXContent, props)')
  })

  it('产物可被 oxc 编译(与 plugin.ts 页面模块链路一致)', async () => {
    const out = assembleMdxPage(code, pageData)
    // plugin.ts 对 .md 页面模块走 transformWithOxc;产物能编译即证明语法有效
    const compiled = await transformWithOxc(out, 'page.md.tsx', {
      jsx: { runtime: 'automatic' }
    })
    expect(compiled.code).toContain('MDXContent')
    expect(compiled.code).toContain('__pageData')
  })
})
