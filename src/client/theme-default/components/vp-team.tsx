import s from './vp-team.module.css'

export type VpTeamMember = {
  avatar?: string
  name?: string
  title?: string
  org?: string
  desc?: string
  links?: { icon?: string; link?: string }[]
}

/** 团队成员项:头像 + 姓名/职位 + 描述 + 链接 */
export function VPTeamMembersItem({ member }: { member: VpTeamMember }) {
  return (
    <div className={s.member}>
      {member.avatar && (
        <img className={s.avatar} src={member.avatar} alt="" width={96} height={96} />
      )}
      <div className={s.memberBody}>
        <h3 className={s.name}>{member.name}</h3>
        {(member.title || member.org) && (
          <p className={s.role}>
            {member.title}
            {member.org ? ` @ ${member.org}` : ''}
          </p>
        )}
        {member.desc && <p className={s.desc}>{member.desc}</p>}
        {member.links?.length ? (
          <div className={s.links}>
            {member.links.map((l, i) => (
              <a key={i} className={s.link} href={l.link} target="_blank" rel="noreferrer">
                {l.icon ?? l.link}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** 团队成员网格 */
export function VPTeamMembers({
  members,
  size
}: {
  members?: VpTeamMember[]
  /** small | medium(默认 small 样式由模块类给出,保留参数以便与文档示例兼容) */
  size?: string
}) {
  const list = members ?? []
  if (!list.length) return null
  return (
    <div className={`VPTeamMembers${size ? ` ${size}` : ''}`}>
      <div className={s.grid}>
        {list.map((m, i) => (
          <VPTeamMembersItem key={i} member={m} />
        ))}
      </div>
    </div>
  )
}
