import { ensureSeasons, seasons, requestScope } from '@/stores/seasons'
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',   // 先写死，部署时按需要改成你的后端地址或用 Nginx 反代
  timeout: 15000,
})

api.interceptors.request.use(async config => {
  await ensureSeasons()
  config.headers['X-Season-Id'] = seasons.selected
  config.seasonScope = requestScope()
  return config
})
api.interceptors.response.use(response => {
  if (response.config.seasonScope !== requestScope()) return Promise.reject(new Error('STALE_SEASON_RESPONSE'))
  return response
})

api.interceptors.response.use(
  (r) => r.data,
  (e) => Promise.reject(e)
)

export default api
