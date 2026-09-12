import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [vue()],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    server: {
      port: 8080,
      proxy: {
        '/api': {
          // Fresh clones stay local. Production access must be explicitly enabled
          // in an ignored .env.local file supplied to an authorized developer.
          target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3000',
          changeOrigin: true,
          rewrite: p => p.replace(/^\/api/, ''),
        },
      },
    },
  }
})
