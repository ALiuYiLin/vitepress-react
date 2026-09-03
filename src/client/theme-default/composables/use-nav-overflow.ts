import { createContext, useContext } from 'react'

/**
 * 顶栏溢出引擎(对应 Vue composables/nav-overflow.ts)。
 * 暂以"永不折叠"默认实现占位:所有簇恒可见、visibleItemCount 无限大。
 * 之后若需复刻溢出折叠,在 VPNavBar 内提供带测量逻辑的 Provider。
 */
export type NavOverflowState = {
  appearance: boolean
  translations: boolean
  socialLinks: boolean
  visibleItemCount: number
}

export type NavOverflowApi = {
  state: NavOverflowState
  setContainerEl: (el: HTMLElement | null) => void
  setMenuEl: (el: HTMLElement | null) => void
  setItemEl: (index: number, el: HTMLElement | null) => void
  setClusterEl: (key: keyof NavOverflowState, el: HTMLElement | null) => void
  setExtraEl: (el: HTMLElement | null) => void
}

const NOOP = () => {}

export const NavOverflowContext = createContext<NavOverflowApi>({
  state: { appearance: true, translations: true, socialLinks: true, visibleItemCount: Infinity },
  setContainerEl: NOOP,
  setMenuEl: NOOP,
  setItemEl: NOOP,
  setClusterEl: NOOP,
  setExtraEl: NOOP
})

export function useNavOverflow() {
  return useContext(NavOverflowContext)
}

/** 占位:与 Vue provideNavOverflow({ itemsKey }) 同签名,默认不折叠 */
export function provideNavOverflow(_options: { itemsKey: () => string }): NavOverflowApi {
  return useNavOverflow()
}
