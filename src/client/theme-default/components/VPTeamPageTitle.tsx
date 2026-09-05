import type { ReactNode } from 'react'

/** 团队页标题块(对应 Vue VPTeamPageTitle.vue) */
export function VPTeamPageTitle({
  title,
  lead
}: {
  title?: ReactNode
  lead?: ReactNode
}) {
  return (
    <div className="VPTeamPageTitle">
      {title ? <h1 className="title">{title}</h1> : null}
      {lead ? <p className="lead">{lead}</p> : null}
    </div>
  )
}
