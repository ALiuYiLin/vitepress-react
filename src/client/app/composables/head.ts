// 客户端 head 同步(SPA 导航后更新 <title>/description/frontmatter head)。
//
// SSR 阶段页面 <head> 由 node 侧 renderPage 一次性注入;客户端每次路由/数据
// 变化时按当前页面数据把 head 收敛到目标状态:
//   - <title>        → document.title(data.title 已含 titleTemplate 处理)
//   - meta[description] → 原地更新 content(SSR 必有,不新建重复)
//   - frontmatter.head 里的 meta/link → 先在文档里按「身份键」(name/property/
//     http-equiv/itemprop/rel)匹配 SSR 已渲染的同款标签并原地更新(打上
//     data-vp-head 标记);没有则新建一个带标记的标签。每次同步先清掉带标记
//     的标签——这样「离开一个带 frontmatter head 的页面」时旧标签会被移除,
//     而 HTML 静态注入的首屏标签也一并纳入管理,不会残留重复。
//   - script/style 等 frontmatter head 标签 M2 暂不管理(SSR 首屏照常注入),
//     后续里程碑再补全。

import type { HeadConfig, VitePressData } from '../../shared'

const VP_HEAD_MARKER = 'data-vp-head'

/** frontmatter head 标签的身份键:命中即视为同一标签,原地更新而非新增 */
const IDENTITY_KEYS = ['name', 'property', 'http-equiv', 'itemprop', 'rel']

export function syncHead(data: VitePressData): void {
  if (typeof document === 'undefined') return

  const { title, description, frontmatter } = data

  if (title) {
    document.title = title
  }

  const descMeta = document.head.querySelector('meta[name="description"]')
  if (descMeta) {
    descMeta.setAttribute('content', description)
  }

  // 移除上一轮客户端接管/新建的 frontmatter head 标签
  document.head
    .querySelectorAll(`[${VP_HEAD_MARKER}]`)
    .forEach((el) => el.remove())

  const head = ((frontmatter as any).head ?? []) as HeadConfig[]
  for (const [tag, attrs = {}] of head) {
    if (tag !== 'meta' && tag !== 'link') {
      // M2:M3 起再支持 script/style 等标签的接管
      continue
    }
    const identityKey = IDENTITY_KEYS.find((k) => attrs[k] != null)
    let found: Element | undefined
    if (identityKey) {
      const keyVal = String(attrs[identityKey])
      for (const candidate of Array.from(document.head.querySelectorAll(tag))) {
        if (candidate.getAttribute(identityKey) === keyVal) {
          found = candidate
          break
        }
      }
    }
    // 接管(命中 SSR 标签则原地更新;否则新建)并标记,以便下次导航清理
    const el = found ?? document.createElement(tag)
    el.setAttribute(VP_HEAD_MARKER, '')
    if (!found) document.head.appendChild(el)
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) {
        el.removeAttribute(k)
      } else {
        el.setAttribute(k, v)
      }
    }
  }
}
