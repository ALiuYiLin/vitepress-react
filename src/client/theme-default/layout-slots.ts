// Layout 具名插槽(机制 A,对齐 Vue 默认主题的 Layout 插槽):
// Vue 侧写法是 <Layout><template #aside-outline-before>…</template></Layout>;
// React 侧提供等价的具名 props(统一 camelCase),支持两种值形态:
//   - ReactNode(静态节点,与 Vue 的模板内容等价)
//   - (ctx) => ReactNode(渲染函数;当前各挂载点无额外参数,
//     未来挂载点要透传数据时扩展 LayoutSlotContext 即可,调用处不变)
//
// 挂载点与 Vue 上游语义一一对应(命名差异仅为 kebab → camel):
//   layoutTop/layoutBottom             Layout 根首/末
//   navBarTitleBefore/After            VPNavBarTitle 标题链接前后
//   navBarContentBefore/After          VPNavBar content-body 前后
//   navScreenContentBefore/After       VPNavScreen 容器前后
//   sidebarNavBefore/After             VPSidebar <nav> 前后
//   docBefore/docAfter                 VPDoc .doc 根首/末
//   docTop/docBottom                   VPDoc 正文 .content-container 首/末
//   docFooterBefore                    VPDoc 页脚(<VPDocFooter/>)前
//   asideTop/asideBottom               VPDocAside 根首/末
//   asideOutlineBefore/After           VPDocAside 大纲前后
//   asideAdsBefore/After               VPDocAside 广告区前后
//
// Layout 消费:把 props(直接命名 prop 或 slots 表)归一成 LayoutSlots,
// 用 LayoutSlotsContext 提供给整棵子树;挂载点组件用 useLayoutSlot(name)
// 原地读取。无插槽时不建 Provider,默认渲染零变化。

import { createContext, useContext, type ReactNode } from 'react'

export const LAYOUT_SLOT_NAMES = [
  'layoutTop',
  'layoutBottom',
  'navBarTitleBefore',
  'navBarTitleAfter',
  'navBarContentBefore',
  'navBarContentAfter',
  'navScreenContentBefore',
  'navScreenContentAfter',
  'sidebarNavBefore',
  'sidebarNavAfter',
  'docBefore',
  'docAfter',
  'docTop',
  'docBottom',
  'docFooterBefore',
  'asideTop',
  'asideBottom',
  'asideOutlineBefore',
  'asideOutlineAfter',
  'asideAdsBefore',
  'asideAdsAfter'
] as const

export type LayoutSlotName = (typeof LAYOUT_SLOT_NAMES)[number]

/** 挂载点上下文:当前无站点级参数,按需扩展(消费方调用处不变) */
export interface LayoutSlotContext {}

export type LayoutSlotContent =
  ReactNode | ((ctx: LayoutSlotContext) => ReactNode)

export type LayoutSlots = Partial<Record<LayoutSlotName, LayoutSlotContent>>

/**
 * Layout 的 props:既接受 slots 表,也接受与 LayoutSlotName 同名的直传 prop
 * (直传优先于 slots 表中的同名项)。
 */
export type LayoutProps = {
  slots?: LayoutSlots
} & Partial<Record<LayoutSlotName, LayoutSlotContent>>

export const LayoutSlotsContext = createContext<LayoutSlots | null>(null)

/** 把插槽内容渲染成节点(函数形态以空上下文调用) */
export function renderLayoutSlot(
  content: LayoutSlotContent | undefined
): ReactNode {
  if (content == null) return null
  return typeof content === 'function' ? content({}) : content
}

/** 归一:slots 表 ∪ 直传 prop(直传优先) */
export function resolveLayoutSlots(props: LayoutProps): LayoutSlots {
  const merged: LayoutSlots = {}
  if (props.slots) Object.assign(merged, props.slots)
  for (const name of LAYOUT_SLOT_NAMES) {
    const direct = props[name]
    if (direct != null) merged[name] = direct
  }
  return merged
}

/** 挂载点读取:优先插槽,其次调用方自带的 fallback prop(兼容旧 prop 通道) */
export function useLayoutSlot(
  name: LayoutSlotName,
  fallback?: ReactNode
): ReactNode {
  const slots = useContext(LayoutSlotsContext)
  const content = slots?.[name]
  if (content != null) return renderLayoutSlot(content)
  return fallback ?? null
}
