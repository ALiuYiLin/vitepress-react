import { createContext, useContext } from 'react'

/**
 * 屏幕导航注入(对应 Vue composables/nav.ts 的 navInjectionKey):
 * VPNav 提供 closeScreen,屏幕菜单链接点击后关闭全屏导航。
 */
export const NavContext = createContext<{ closeScreen: () => void }>({
  closeScreen: () => {}
})

export function useNavContext() {
  return useContext(NavContext)
}
