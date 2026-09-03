import type { ReactNode } from 'react'

/** 首页 markdown 内容区(对应 Vue VPHomeContent.vue) */
export function VPHomeContent({ children }: { children?: ReactNode }) {
  return <div className="VPHomeContent vp-doc container">{children}</div>
}
