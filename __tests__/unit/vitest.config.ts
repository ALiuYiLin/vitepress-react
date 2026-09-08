import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const dir = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      { find: '@siteData', replacement: resolve(dir, './shims.ts') },
      { find: 'client', replacement: resolve(dir, '../../src/client') },
      { find: 'node', replacement: resolve(dir, '../../src/node') },
      { find: 'shared', replacement: resolve(dir, '../../src/shared') },
      {
        find: /^@10coding\/vitepress-react$/,
        replacement: resolve(dir, '../../src/client/index.ts')
      },
      {
        find: /^@10coding\/vitepress-react\/theme$/,
        replacement: resolve(dir, '../../src/client/theme-default/index.ts')
      }
    ]
  },
  test: {
    globals: true
  }
})
