import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
          secure: false,
          // target: 'https://trader.umla.fr',
          // changeOrigin: true,
          // ws: true, // the dashboard uses WebSocket
          // headers: {
          //   'CF-Access-Client-Id': env.CF_ACCESS_CLIENT_ID,
          //   'CF-Access-Client-Secret': env.CF_ACCESS_CLIENT_SECRET,
          // },
        }
      }
    }
  }
})
