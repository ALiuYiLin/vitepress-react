import { createContext, useContext } from 'react'

/**
 * SSR 期间的图标名收集器(对应上游 Vue 的 `useSSRContext().vpIcons`)。
 *
 * 服务端渲染时 `useIcon()` 把用到的图标名登记进来;build 收尾时
 * `node/build/build.ts → emitIconsCSS` 据此生成 `vp-icons.{hash}.css`
 * (mask 规则),生产环境因此不需要运行时请求图标。
 *
 * 浏览器端为 `null`:dev 没有生成的样式表,由 `useIcon()` 挂载后按需取
 * `/_vpi/<collection>/<name>.svg`(dev 端点见 node/plugins/iconsPlugin.ts)。
 */
export const SSRIconsContext = createContext<Set<string> | null>(null)

/** 读取当前渲染的图标收集器(SSR 之外为 null) */
export function useSSRIconRegistry(): Set<string> | null {
  return useContext(SSRIconsContext)
}
