import axios from 'axios'

const api = axios.create({
  baseURL: '/api',   // 先写死，部署时按需要改成你的后端地址或用 Nginx 反代
  timeout: 15000,
})

api.interceptors.response.use(
  (r) => r.data,
  (e) => Promise.reject(e)
)

export default api
