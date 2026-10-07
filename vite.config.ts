import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/portfolio/',
  plugins: [react()],
  /* strictPort because the basemap is origin-gated. Tiles come from the
     Cloudflare Worker in worker/, which 403s any Origin not in its
     ALLOWED_ORIGINS — and that list names exact ports (5173 for dev, 4173 for
     preview). Let Vite fall back to 5174 when 5173 is busy and it serves a
     map with no tiles at all, just the --water background, which looks like a
     broken theme rather than a rejected request. Better to refuse to start. */
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
})
