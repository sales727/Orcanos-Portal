import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/orcanos-proxy': {
        target: 'https://app.orcanos.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/orcanos-proxy/, ''),
      },
    },
  },
})
