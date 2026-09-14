import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { startActivityDeadlineSync } from './stores/activityDeadline'
import { request } from './utils/request'

const stopDeadlineSync = startActivityDeadlineSync(() => request('/submissions/meta', 'GET', null, { cacheBust: true }))
if (import.meta.hot) import.meta.hot.dispose(stopDeadlineSync)
createApp(App).use(router).mount('#app')
