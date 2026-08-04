import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'https://hiwebsun.top'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    port: 8080,
    proxy: {
      '/api': {
        target: apiProxyTarget, // 默认远程服务；本地联调可通过 VITE_API_PROXY_TARGET 覆盖
        changeOrigin: true,
        // 你证书是 Let's Encrypt，默认 secure:true 就够了；若是自签名才需要 secure:false
        // secure: false,
        rewrite: p => p.replace(/^\/api/, ''), // 去掉前缀
      },
    },
  },
})

