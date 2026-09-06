// 枚举 docs/zh/**/*.mdx 中 <script>/::: react 块:fence 内(教学示例)与真实块分类
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const zhDir = path.join(root, 'docs', 'zh')
const fenceRe = /^ {0,3}(`{3,}|~{3,})/
const scriptOpenRe = /^ {0,3}<script/
const scriptCloseRe = /^ {0,3}<\/script>/
const reactOpenRe = /^ {0,3}::: react/
const containerRe = /^ {0,3}:::/

function walk(dir, acc) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, acc)
    else if (ent.name.endsWith('.mdx')) acc.push(p)
  }
  return acc
}

for (const file of walk(zhDir, [])) {
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  let fence = null // '```' 或 '~~~'
  const real = [] // 真实块(不在 fence)
  const shown = [] // fence 内(教学示例)
  const stack = { script: 0, react: 0 } // 深度

  const track = (i, kind, inFence, tag) => {
    ;(inFence ? shown : real).push(`L${i + 1} ${kind} ${tag}`)
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (fence === null) {
      const m = line.match(fenceRe)
      if (m) fence = m[1]
    } else {
      if (fenceRe.test(line)) {
        // fence 可能闭合(同长度或更长围栏)——近似处理
        fence = null
      }
      // fence 内脚本示例无需细辨
      if (scriptOpenRe.test(line)) stack.script++
      if (scriptCloseRe.test(line)) stack.script = Math.max(0, stack.script - 1)
      continue
    }
    // 非 fence 文本行:容器逻辑
    if (reactOpenRe.test(line)) {
      stack.react++
      track(i, 'react-open', false, line.trim())
      continue
    }
    if (containerRe.test(line)) {
      // 其它 ::: 可能闭合 react
      if (stack.react > 0 && line.trim().startsWith(':::')) {
        stack.react--
        track(i, 'react-close', false, line.trim())
      }
      continue
    }
    if (scriptOpenRe.test(line)) {
      stack.script++
      track(i, 'script-open', false, line.trim())
      continue
    }
    if (scriptCloseRe.test(line)) {
      stack.script = Math.max(0, stack.script - 1)
      track(i, 'script-close', false, line.trim())
    }
  }
  if (real.length || shown.length) {
    console.log(`\n== ${path.relative(zhDir, file).replaceAll('\\', '/')}`)
    if (real.length) console.log('  [真实块] ' + real.join(' | '))
    if (shown.length) console.log('  [fence 示例] ' + shown.join(' | '))
  }
}
