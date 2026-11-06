// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';

// Custom domain serves at root, so no `base` path is needed.
export default defineConfig({
  site: 'https://arjun-giri.com.np',
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [mdx(), sitemap(), icon()],
  vite: {
    plugins: [tailwindcss()],
    // Keep scripts external so the CSP can stay script-src 'self'.
    build: { assetsInlineLimit: 0 },
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark-dimmed',
      wrap: true,
    },
  },
});
