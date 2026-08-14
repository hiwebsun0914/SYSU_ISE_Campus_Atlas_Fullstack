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
        // 本地开发默认代理到线上后端；如需连本地后端，设置 VITE_API_PROXY_TARGET=http://127.0.0.1:3000
        target: process.env.VITE_API_PROXY_TARGET || 'https://hiwebsun.top',
        changeOrigin: true,
        // 你证书是 Let's Encrypt，默认 secure:true 就够了；若是自签名才需要 secure:false
        // secure: false,
        rewrite: p => p.replace(/^\/api/, ''), // 去掉前缀
      },
    },
  },
})

