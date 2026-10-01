import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';
import { createApp } from './server/index.ts';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'news-api',
      configureServer(server) {
        const env = loadEnv(mode, process.cwd(), ['GUARDIAN_API_KEY', 'NYT_API_KEY', 'NEWSAPI_KEY']);
        const app = createApp({
          guardian: env.GUARDIAN_API_KEY,
          nyt: env.NYT_API_KEY,
          newsapi: env.NEWSAPI_KEY,
        });
        server.middlewares.use((req, res, next) => {
          const path = req.url?.split('?')[0];
          if (path === '/api' || path?.startsWith('/api/')) app(req, res);
          else next();
        });
      },
    },
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
}));
