import type { ReactNode } from 'react'

/** 团队页分区(对应 Vue VPTeamPageSection.vue) */
export function VPTeamPageSection({
  title,
  lead,
  members
}: {
  title?: ReactNode
  lead?: ReactNode
  members?: ReactNode
}) {
  return (
    <section className="VPTeamPageSection">
      {title || lead ? (
        <div className="title">
          <div className="title-line" />
          {title ? <h2 className="title-text">{title}</h2> : null}
        </div>
      ) : null}
      {lead ? <p className="lead">{lead}</p> : null}
      {members ? <div className="members">{members}</div> : null}
    </section>
  )
}
