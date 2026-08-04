import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

const useLocalApi = process.env.VITE_API_PROXY_REWRITE === 'strip'
const apiProxyTarget = useLocalApi
  ? (process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3100')
  : (process.env.VITE_API_PROXY_TARGET?.startsWith('http') && !process.env.VITE_API_PROXY_TARGET.includes('127.0.0.1') && !process.env.VITE_API_PROXY_TARGET.includes('localhost')
      ? process.env.VITE_API_PROXY_TARGET
      : 'https://hiwebsun.top')
const keepApiPrefix = !useLocalApi

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
        // 远程 Nginx 通过 /api/* 转发到 Node；本地直连 Node 时再显式去掉前缀。
        rewrite: p => keepApiPrefix ? p : p.replace(/^\/api/, ''),
      },
    },
  },
})

