---
description: 使用 VitePress React 版内置的团队组件创建包含成员资料的团队页面。
---

<script>
import { VPTeamMembers } from '@10coding/vitepress-react/theme'

const members = [
  {
    avatar: 'https://github.com/yyx990803.png',
    name: 'Evan You',
    title: 'Creator',
    links: [
      { icon: 'github', link: 'https://github.com/yyx990803' },
      { icon: 'twitter', link: 'https://twitter.com/youyuxi' }
    ]
  },
  {
    avatar: 'https://github.com/kiaking.png',
    name: 'Kia King Ishii',
    title: 'Developer',
    links: [
      { icon: 'github', link: 'https://github.com/kiaking' },
      { icon: 'twitter', link: 'https://twitter.com/KiaKing85' }
    ]
  }
]
</script>

# 团队页 {#team-page}

如果你想介绍你的团队，你可以使用 Team components 来构建团队页面。有两种使用这些组件的方法。一种是将其嵌入文档页面，另一种是创建完整的团队页面。

::: tip Vue 版的插槽在这里是 props
React 版没有 `<template #slot>`:Vue 的具名插槽对应**同名 camelCase props**(`title` / `lead` / `members`),值直接写 JSX/字符串。参见[扩展默认主题](../guide/extending-default-theme)。
:::

## 在页面中显示团队成员 {#show-team-members-in-a-page}

你可以在任何页面上使用从 `@10coding/vitepress-react/theme` 暴露出的公共组件 `<VPTeamMembers>` 显示团队成员。

```md
<script>
import { VPTeamMembers } from '@10coding/vitepress-react/theme'

const members = [
  {
    avatar: 'https://www.github.com/yyx990803.png',
    name: 'Evan You',
    title: 'Creator',
    links: [
      { icon: 'github', link: 'https://github.com/yyx990803' },
      { icon: 'twitter', link: 'https://twitter.com/youyuxi' }
    ]
  },
  ...
]
</script>

# Our Team

Say hello to our awesome team.

<VPTeamMembers size="small" members={members} />
```

以上将在卡片外观元素中显示团队成员。它应该显示类似于下面的内容。

<VPTeamMembers size="small" members={members} />

`<VPTeamMembers>` 组件有 2 种不同的尺寸，`small` 和 `medium`。虽然它取决于你的偏好，但通常尺寸在文档页面中使用时 `small` 应该更适合。此外，你可以为每个成员添加更多属性，例如添加“描述”或“赞助”按钮。在 [`<VPTeamMembers>`](#vpteammembers) 中了解更多信息。

在文档页面中嵌入团队成员对于小型团队来说非常有用，某种情况下，完整的贡献团队可能太大了，可以引入部分成员作为文档上下文的参考。

如果你有大量成员，或者只是想有更多空间来展示团队成员，请考虑[创建一个完整的团队页面](#create-a-full-team-page)。

## 创建一个完整的团队页面 {#create-a-full-team-page}

除了将团队成员添加到 doc 页面，你还可以创建一个完整的团队页面，类似于创建自定义[默认主题：主页](./default-theme-home-page)的方式。

要创建团队页面，首先，创建一个新的 md 文件。文件名无所谓，这里我们就叫它 `team.md` 吧。在这个文件中，在 frontmatter 设置 `layout: page`，然后你可以使用 `TeamPage` 组件来组成页面结构。

```md
---
layout: page
---
<script>
import {
  VPTeamPage,
  VPTeamPageTitle,
  VPTeamMembers
} from '@10coding/vitepress-react/theme'

const members = [
  {
    avatar: 'https://www.github.com/yyx990803.png',
    name: 'Evan You',
    title: 'Creator',
    links: [
      { icon: 'github', link: 'https://github.com/yyx990803' },
      { icon: 'twitter', link: 'https://twitter.com/youyuxi' }
    ]
  },
  ...
]
</script>

<VPTeamPage>
  <VPTeamPageTitle
    title="Our Team"
    lead="The development of VitePress is guided by an international team, some of whom have chosen to be featured below."
  />
  <VPTeamMembers members={members} />
</VPTeamPage>
```

创建完整的团队页面时，请记住用 `<VPTeamPage>` 组件包装所有团队相关组件，以获得正确的布局结构，如间距。

`<VPTeamPageTitle>` 组件添加页面标题部分。标题是 `<h1>` 标题。使用 `title` 与 `lead` 两个 props 来填写标题与引言。

`<VPTeamMembers>` 和在 doc 页面中使用时一样。它将显示成员列表。

### 添加 section 以划分团队成员 {#add-sections-to-divide-team-members}

你可以将“section”添加到团队页面。例如，你可能有不同类型的团队成员，例如核心团队成员和社区合作伙伴。你可以将这些成员分成几个部分，以更好地解释每组的角色。

为此，将 `<VPTeamPageSection>` 组件添加到我们之前创建的 `team.md` 文件中。

```md
---
layout: page
---
<script>
import {
  VPTeamPage,
  VPTeamPageTitle,
  VPTeamMembers,
  VPTeamPageSection
} from '@10coding/vitepress-react/theme'

const coreMembers = [...]
const partners = [...]
</script>

<VPTeamPage>
  <VPTeamPageTitle title="Our Team" lead="..." />
  <VPTeamMembers size="medium" members={coreMembers} />
  <VPTeamPageSection
    title="Partners"
    lead="..."
    members={<VPTeamMembers size="small" members={partners} />}
  />
</VPTeamPage>
```

`<VPTeamPageSection>` 组件可以有类似于 `VPTeamPageTitle` 组件的 `title` 和 `lead` props，还有用于显示团队成员的 `members` prop。

请记住把 `<VPTeamMembers>` 组件传给 `members` prop（而不是像 Vue 版那样放进 `#members` 插槽）。

## `<VPTeamMembers>`

`<VPTeamMembers>` 组件显示给定的成员列表。

```md
<VPTeamMembers
  size="medium"
  members={[
    { avatar: '...', name: '...' },
    { avatar: '...', name: '...' }
  ]}
/>
```

```ts
interface Props {
  // 每个成员的大小，默认为 `medium`
  size?: 'small' | 'medium'

  // 显示的成员列表（为空时组件不渲染）
  members?: VpTeamMember[]
}

interface VpTeamMember {
  // 成员的头像图像
  avatar?: string

  // 成员的名称
  name?: string

  // 成员姓名下方的标题
  // 例如：Developer, Software Engineer, etc.
  title?: string

  // 成员所属的组织
  org?: string

  // 成员的描述
  desc?: string

  // 社交媒体链接，例如 GitHub、Twitter 等，可以在此处传入 Social Links 对象
  // 参见: https://vitepress.dev/reference/default-theme-config.html#sociallinks
  links?: { icon?: string; link?: string }[]
}
```

::: warning 与 Vue 版的差异
React 版的 `VpTeamMember` 目前实现 `avatar` / `name` / `title` / `org` / `desc` / `links`;
Vue 版的 `orgLink`、`sponsor`(赞助按钮)与 `actionText` 尚未实现。链接项直接渲染 `icon`(缺省时渲染 `link`),没有图标组件映射。
:::

## `<VPTeamPage>`

创建完整团队页面时的根组件。它只接受 `children`。它将设置所有传入的团队相关组件的样式。

## `<VPTeamPageTitle>`

添加页面的标题。最好在一开始就在 `<VPTeamPage>` 下使用。它接受 `title` 和 `lead` props。

```md
<VPTeamPage>
  <VPTeamPageTitle
    title="Our Team"
    lead="The development of VitePress is guided by an international team, some of whom have chosen to be featured below."
  />
</VPTeamPage>
```

## `<VPTeamPageSection>`

在团队页面中创建一个“section”。它接受 `title`、`lead` 和 `members` props。你可以在 `<VPTeamPage>` 中添加任意数量的 section。

```md
<VPTeamPage>
  ...
  <VPTeamPageSection
    title="Partners"
    lead="Lorem ipsum..."
    members={<VPTeamMembers members={data} />}
  />
</VPTeamPage>
```
