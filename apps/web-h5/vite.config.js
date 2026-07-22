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
        target: 'https://hiwebsun.top', // ⬅️ 远程域名（Nginx 会再转到 127.0.0.1:3000）
        changeOrigin: true,
        // 你证书是 Let's Encrypt，默认 secure:true 就够了；若是自签名才需要 secure:false
        // secure: false,
        rewrite: p => p.replace(/^\/api/, ''), // 去掉前缀
      },
    },
  },
})

