import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// remark-attributes@0.4.4 的 micromark 扩展会触发上游 devlop 的 dev-only 断言
// (「expected last token to be open」),仅当依赖解析到 development 条件分支
// (vitest 强制,无法通过 mode/env 关闭;tsx/vite-node --mode=production 下正常)。
// 因此 attrs 正向语义用例放在 scripts/smoke-attrs.mjs(生产语义)验证,
// vitest 只保留不触发该断言的行为用例(裸 {#x} 报错、fence/行内码字面)。
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts']
  }
})
