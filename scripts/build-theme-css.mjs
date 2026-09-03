// 预编译默认主题的 Tailwind CSS(独立于 vitepress 构建链):
// 用与 playground/theme 相同且已验证可用的 Vite + @tailwindcss/vite 环境,
// 把 src/client/theme-default/index.css(@import "tailwindcss" + shadcn tokens)
// 编译成纯静态 CSS,输出到同目录 tailwind.css。vitepress 直接 import 该产物,
// 不再依赖站点构建链里跑 Tailwind。
//
// 触发:pnpm build:theme-css(或随 pnpm build 一起)。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'vite'
import tailwindcss from '@tailwindcss/vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cssIn = path.join(root, 'src/client/theme-default/index.css')
const cssOut = path.join(root, 'src/client/theme-default/tailwind.css')

const result = await build({
  configFile: false,
  root,
  logLevel: 'error',
  build: {
    write: false,
    minify: false,
    rollupOptions: {
      input: cssIn
    }
  },
  plugins: [tailwindcss()]
})

const cssAsset = result.output.find(
  (o) => o.type === 'asset' && o.fileName.endsWith('.css')
)
if (!cssAsset) {
  console.error('build-theme-css: no css emitted')
  process.exit(1)
}
fs.writeFileSync(cssOut, cssAsset.source)
console.log(`build-theme-css: wrote ${cssOut} (${cssAsset.source.length} bytes)`)
