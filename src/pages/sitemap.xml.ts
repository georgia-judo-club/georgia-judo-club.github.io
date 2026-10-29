import type { APIRoute } from 'astro';
import { getRelativeLocaleUrl } from 'astro:i18n';
import raw from '../preview/index.html?raw';
import { LANGS } from '../i18n/ui';
import { loadApp } from '../lib/app.mjs';

export const GET: APIRoute = ({ site }) => {
  const abs = (p: string) => new URL(p, site).href;
  const urls = loadApp(raw).routes.flatMap((r) => {
    const path = r === 'home' ? '' : `${r}/`;
    const alts =
      LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${abs(getRelativeLocaleUrl(l, path))}"/>`).join('') +
      `<xhtml:link rel="alternate" hreflang="x-default" href="${abs(path ? getRelativeLocaleUrl('ka', path) : '/')}"/>`;
    return LANGS.map((l) => `<url><loc>${abs(getRelativeLocaleUrl(l, path))}</loc>${alts}</url>`);
  });
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`,
  );
};
