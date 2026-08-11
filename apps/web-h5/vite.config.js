import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // 本地开发时转发到本地后端；部署时由 Nginx 处理 /api
        changeOrigin: true,
        // 你证书是 Let's Encrypt，默认 secure:true 就够了；若是自签名才需要 secure:false
        // secure: false,
        rewrite: p => p.replace(/^\/api/, ''), // 去掉前缀
      },
    },
  },
})
