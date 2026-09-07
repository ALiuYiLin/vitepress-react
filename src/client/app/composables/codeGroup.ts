// code-group 面板切换(markdown 容器 `::: code-group` 的运行时)。
//
// 服务端渲染只负责结构:每个具名代码块产出一个
// `<input type="radio"><label for=…>`(进 `.tabs`)与一个面板
// `<div class="language-*">`(进 `.blocks`),并给第一个面板写死 `active`。
// CSS 侧只有两条规则:高亮(`.tabs input:checked + label`)与
// “带 `.active` 的面板才显示”——没有任何规则能把面板和 radio 关联起来,
// 面板切换的运行时在 Vue→React 迁移时丢失(React 侧全程无 vp-code-group
// 组件/脚本)。这里按上游 Vue 主题等价行为补齐:
// radio change 时把 `.active` 从旧面板平移到同序位的新面板。
//
// 与 React 渲染无关:内容区每次导航由 React 重建,但事件在 document 层
// 委托注册一次即可(等价 copyCode.ts 的做法)。
export function setupCodeGroupTabs(): () => void {
  if (typeof document === 'undefined') return () => {}

  const onChange = (e: Event) => {
    const input = e.target as HTMLInputElement | null
    if (!input || input.type !== 'radio') return
    const group = input.closest('.vp-code-group') as HTMLElement | null
    if (!group) return

    const tabInputs = Array.from(
      group.querySelectorAll(':scope > .tabs input[type="radio"]')
    )
    const index = tabInputs.indexOf(input)
    if (index < 0) return

    const blocks =
      (group.querySelector(':scope > .blocks') as HTMLElement | null) ??
      (group.lastElementChild as HTMLElement | null)
    if (!blocks) return

    // tab 与面板按出现顺序一一对应:把 .active 切到第 index 个面板
    Array.from(blocks.children).forEach((panel, i) => {
      panel.classList.toggle('active', i === index)
    })
  }

  document.addEventListener('change', onChange)
  return () => document.removeEventListener('change', onChange)
}
