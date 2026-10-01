import { createApp } from 'vue'
import { createPinia } from 'pinia'
// Element Plus components are registered on demand (see vite.config.ts).
// Base CSS variables, plus styles for the imperative ElMessage service,
// which the component resolver cannot see.
import 'element-plus/theme-chalk/base.css'
import 'element-plus/es/components/message/style/css'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
