import { defineConfig } from 'astro/config';

export default defineConfig({
  // unset Actions variables expand to '', so fall back on any falsy value
  site: process.env.SITE_URL || 'https://georgia-judo-club.github.io',
  trailingSlash: 'always',
  compressHTML: true,
  i18n: {
    locales: ['ka', 'ru', 'en'],
    defaultLocale: 'ka',
    routing: { prefixDefaultLocale: true, redirectToDefaultLocale: false },
  },
});
