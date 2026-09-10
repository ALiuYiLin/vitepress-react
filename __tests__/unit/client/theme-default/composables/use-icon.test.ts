import { createElement as h, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { SSRIconsContext } from 'client/app/ssr-icons'
import { useIcon } from 'client/theme-default/composables/use-icon'

// useIcon 有两种环境行为:
// - SSR(build):把图标名登记进 SSRIconsContext → build 生成 vp-icons.{hash}.css
// - dev:挂载后按需取 /_vpi/...svg(需要 DOM,见 tests-init 的浏览器断言)
// 这里覆盖 SSR 分支:漏登记会让产物一个图标规则都没有(图标只剩空 mask)。

function Probe({ icon }: { icon: string | { svg: string } }) {
  const { iconClass } = useIcon(icon)
  return h('span', { className: iconClass })
}

const withRegistry = (vpIcons: Set<string>, children: ReactNode) =>
  renderToString(h(SSRIconsContext.Provider, { value: vpIcons }, children))

describe('client/theme-default/composables/use-icon', () => {
  test('SSR 渲染时登记图标名并输出 vpi-<collection>-<name> 类', () => {
    const vpIcons = new Set<string>()
    const html = withRegistry(
      vpIcons,
      h(Probe, { icon: 'simple-icons:github' }) as unknown as ReactNode
    )
    expect([...vpIcons]).toEqual(['simple-icons:github'])
    expect(html).toContain('vpi-simple-icons-github')
  })

  test('没有收集器(客户端渲染/裸渲染)时不报错', () => {
    expect(() =>
      renderToString(h(Probe, { icon: 'simple-icons:github' }))
    ).not.toThrow()
  })

  test('字面类名按原样使用且不登记(避免 build 误报缺少 collection 前缀)', () => {
    const vpIcons = new Set<string>()
    const html = withRegistry(
      vpIcons,
      h(Probe, { icon: 'vpi-languages' }) as unknown as ReactNode
    )
    expect([...vpIcons]).toEqual([])
    expect(html).toContain('vpi-languages')
  })

  test('无法解析的名字不产生任何类名', () => {
    const html = renderToString(h(Probe, { icon: 'not an icon!' }))
    expect(html).not.toContain('vpi-')
  })

  test('对象形态({svg})不参与类名解析', () => {
    const vpIcons = new Set<string>()
    const html = withRegistry(
      vpIcons,
      h(Probe, { icon: { svg: '<svg/>' } }) as unknown as ReactNode
    )
    expect([...vpIcons]).toEqual([])
    expect(html).not.toContain('vpi-')
  })
})
