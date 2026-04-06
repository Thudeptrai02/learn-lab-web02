// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  // <--- SẾP THÊM ĐÚNG DÒNG NÀY VÀO ĐÂY NHÉ
  site: 'https://learnlab.vn',

  output: 'static',

  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [sitemap()],
  adapter: vercel()
});