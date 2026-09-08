// React fork 的 VPTeamMembers 数据形状(与 vp-team.tsx 的 VpTeamMember 对齐,
// 另含 Vue 时代上游示例仍保留的 orgLink/sponsor 扩展字段)
type TeamMember = {
  avatar?: string
  name?: string
  title?: string
  org?: string
  orgLink?: string
  desc?: string
  links?: { icon: string; link: string }[]
  sponsor?: string
}

export const members: TeamMember[] = [
  {
    // smaller than the rendered avatar, checks that it still fills the circle
    avatar: '/team-avatar-small.svg',
    name: 'Alice Example',
    title: 'Creator',
    org: 'Example Org',
    orgLink: 'https://example.com',
    desc: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    links: [
      { icon: 'github', link: 'https://example.com' },
      { icon: 'x', link: 'https://example.com' }
    ],
    sponsor: 'https://example.com'
  },
  {
    // non-square, checks object-fit (side stripes must stay cropped out)
    avatar: '/team-avatar-wide.svg',
    name: 'Bob Example',
    title: 'Maintainer',
    links: [{ icon: 'github', link: 'https://example.com' }]
  },
  {
    avatar: '/team-avatar-small.svg',
    name: 'Carol Example',
    title: 'Partner'
  }
]

export const partners: TeamMember[] = [
  {
    avatar: '/team-avatar-wide.svg',
    name: 'Dave Example',
    title: 'Partner',
    links: [{ icon: 'github', link: 'https://example.com' }]
  },
  {
    avatar: '/team-avatar-small.svg',
    name: 'Eve Example',
    title: 'Partner'
  },
  {
    avatar: '/team-avatar-wide.svg',
    name: 'Frank Example',
    title: 'Partner'
  }
]

interface Sponsor {
  name: string
  img: string
  url: string
}

const sponsor = (name: string): Sponsor => ({
  name,
  img: '/sponsor-logo.svg',
  url: 'https://example.com'
})

export const sponsors: {
  tier: string
  size?: 'medium' | 'big'
  items: Sponsor[]
}[] = [
  {
    tier: 'Platinum Sponsors',
    size: 'big',
    items: [sponsor('Sponsor One'), sponsor('Sponsor Two')]
  },
  {
    tier: 'Gold Sponsors',
    size: 'medium',
    items: [
      sponsor('Sponsor Three'),
      sponsor('Sponsor Four'),
      sponsor('Sponsor Five'),
      sponsor('Sponsor Six')
    ]
  }
]

export const friends: Sponsor[] = [
  sponsor('Friend One'),
  sponsor('Friend Two'),
  sponsor('Friend Three')
]
