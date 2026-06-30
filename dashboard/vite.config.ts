import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Minimal Vite config. The dashboard talks to the Pulse metrics WS server
// directly (ws://127.0.0.1:4002 by default), so no dev proxy is needed.
export default defineConfig({
  plugins: [react()],
  server: { port: 5180, host: '127.0.0.1' },
})
