import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 说明:本调试台是「独立」于 vitepress-react 主仓库的 Vite 应用(不在根 pnpm
// workspace 内),用于在接入真实框架前先行打磨 React 文档站布局。
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5199,
    host: '127.0.0.1',
    open: false
  }
})
