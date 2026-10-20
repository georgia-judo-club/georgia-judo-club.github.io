import { defineConfig } from 'astro/config';

export default defineConfig({
  // unset Actions variables expand to '', so fall back on any falsy value
  site: process.env.SITE_URL || 'https://georgia-judo-club.github.io',
});
