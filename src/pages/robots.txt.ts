import type { APIRoute } from 'astro';

// Allow stays so crawlers can see each page's noindex
export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap.xml', site).href}\n`);
