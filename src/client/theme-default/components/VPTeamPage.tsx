import type { ReactNode } from 'react'

/**
 * 全屏团队页容器(对应 Vue VPTeamPage.vue):根 .VPTeamPage,直接子元素
 * (Title/Section/Members)之间的间距由全局 theme-team.css 处理。
 */
export function VPTeamPage({ children }: { children?: ReactNode }) {
  return <div className="VPTeamPage">{children}</div>
}
