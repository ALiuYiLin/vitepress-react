// 容器自研件测试(不触发 remark-attributes 上游断言缺陷,可走 vitest):
// 覆盖:默认标题/自定义标题/行内 code 标题/no-title/details/嵌套/无空行/fence 内字面/自定义容器名
import { describe, it, expect } from 'vitest'
import { compileDocument } from '../src/index'

function codeOf(md: string, opts?: Parameters<typeof compileDocument>[1]) {
  return compileDocument(md, opts).then((r) => r.code)
}

describe('containers: 基本结构', () => {
  it('::: tip 无标题 → 默认标题 TIP + custom-block', async () => {
    const code = await codeOf('::: tip\n内容\n:::\n')
    expect(code).toContain('"tip custom-block"')
    expect(code).toContain('TIP')
    expect(code).toContain('custom-block-title')
    expect(code).toContain('custom-block-title-default')
    expect(code).toContain('内容')
  })

  it('::: tip 自定义标题 → 无 default class,标题前置', async () => {
    const code = await codeOf('::: tip 我的标题\n内容\n:::\n')
    expect(code).toContain('我的标题')
    expect(code).not.toContain('custom-block-title-default')
    expect(code).toContain('内容')
  })

  it('行内 code 标题(标题行含行内 md 语法)', async () => {
    const code = await codeOf('::: details Netlify 示例 `_headers` 文件\n\n正文\n:::\n')
    expect(code).toContain('summary')
    expect(code).toContain('Netlify 示例')
    expect(code).toContain('_headers')
    expect(code).not.toContain('```')
  })
})

describe('containers: 标题控制与 details', () => {
  it('((no-title)) → 无标题 p', async () => {
    const code = await codeOf('::: warning ((no-title))\n内容\n:::\n')
    expect(code).toContain('"warning custom-block"')
    expect(code).not.toContain('custom-block-title')
    expect(code).toContain('内容')
  })

  it('{no-title}(remark-attributes 消费后) → 无标题', async () => {
    const code = await codeOf('::: tip {no-title}\n内容\n:::\n')
    expect(code).not.toContain('custom-block-title')
  })

  it('details → summary + 默认 Details', async () => {
    const code = await codeOf('::: details\n折叠内容\n:::\n')
    expect(code).toContain('"details"')
    expect(code).toContain('"summary"')
    expect(code).toContain('Details')
    expect(code).toContain('折叠内容')
  })

  it('details ((open)) → open 属性', async () => {
    const code = await codeOf('::: details ((open)) 标题\n内容\n:::\n')
    expect(code).toContain('open')
    expect(code).toContain('"summary"')
  })
})

describe('containers: 结构与保护', () => {
  it('内容与闭行无空行(紧贴)也能解析', async () => {
    const code = await codeOf('::: tip 标题\n内容行\n:::\n后续段落')
    expect(code).toContain('custom-block')
    expect(code).toContain('内容行')
    expect(code).toContain('后续段落')
  })

  it('fence 内的 ::: 是字面代码', async () => {
    const code = await codeOf('```\n::: tip\nnot a container\n:::\n```\n')
    expect(code).toContain('::: tip')
    expect(code).not.toContain('"tip custom-block"')
  })

  it('嵌套容器', async () => {
    const code = await codeOf('::: tip 外层\n内容\n\n::: warning 内层\n深\n:::\n:::\n')
    expect(code).toContain('"tip custom-block"')
    expect(code).toContain('"warning custom-block"')
    expect(code).toContain('外层')
    expect(code).toContain('内层')
  })

  it('自定义容器名 + 缺省标题缺省时无标题', async () => {
    const code = await codeOf('::: custombox 自定义标题\n内容\n:::\n')
    expect(code).toContain('"custombox custom-block"')
    expect(code).toContain('自定义标题')
  })

  it('容器行尾 ((.lead #x)) → class/id 注入容器元素', async () => {
    const code = await codeOf('::: tip ((.lead #box))\n内容\n:::\n')
    expect(code).toContain('"tip custom-block lead"')
    expect(code).toContain('id: "box"')
  })

  it('未闭合容器按字面处理,不吞内容', async () => {
    const code = await codeOf('::: tip 没闭合\n内容还在\n')
    expect(code).toContain('::: tip 没闭合')
    expect(code).toContain('内容还在')
  })
})
