import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig, loadEnv } from 'vite'

// API hedefi ortamdan: geliştirmede API_PROXY_TARGET (.env.local), e2e'de Playwright verir
function apiTarget(mode: string): string {
  const target = process.env.API_PROXY_TARGET ?? loadEnv(mode, process.cwd(), '').API_PROXY_TARGET
  if (!target) throw new Error('API_PROXY_TARGET tanımlı değil (bahcelab-frontend/.env); bkz. .env.example')
  return target
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: apiTarget(mode),
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/api/, ''),
      },
    },
  },
  preview: {
    // Production önizleme: yalnızca dist/ servis edilir, src/ veya node_modules yok.
    port: 4173,
    strictPort: false,
    proxy: {
      '/api': {
        target: apiTarget(mode),
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[hash].js',
        chunkFileNames: 'assets/[hash].js',
        assetFileNames: 'assets/[hash][extname]',
      },
    },
  },
}))
