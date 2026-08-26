import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { devApi } from './api/_lib/devServer.js'

export default defineConfig({
  // devApi only applies to `vite dev`; in production Vercel serves api/db
  // itself and this plugin is not part of the build.
  plugins: [react(), tailwindcss(), devApi()],
})