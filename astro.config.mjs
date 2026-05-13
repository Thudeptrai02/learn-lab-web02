import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel'; // <--- Kiểm tra dòng này
import remarkBtnLink from './remark-btn-link.mjs';

export default defineConfig({
  site: 'https://learnlab.vn',
  output: 'server', // <--- ĐỔI TỪ 'static' THÀNH 'server' (Hoặc 'hybrid')
  adapter: vercel(), // <--- Đảm bảo có dòng này
  vite: {
    plugins: [tailwindcss()]
  },
  integrations: [sitemap()],
  markdown: {
    remarkPlugins: [remarkBtnLink],
  },
});