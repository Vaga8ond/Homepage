import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://spike.dev',
  build: { inlineStylesheets: 'auto' },
  devToolbar: { enabled: false },
});
