import vm from 'node:vm';
import { fmtDate } from './intl.mjs';

const text = (s) =>
  s.replace(/<[^>]+>/g, ' ').replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e])
    .replace(/\s+/g, ' ').trim();
const clip = (s, n = 160) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1)) + '…');

// ISO dates in the preview, formatted for one language
export const appDates = (raw, lang) =>
  Object.fromEntries([...new Set([...raw.matchAll(/"(\d{4}-\d{2}-\d{2})"/g)].map((m) => m[1]))].map((d) => [d, fmtDate(d, lang)]));

// Runs the preview's data and page renderers (everything above its motion block) so routes and
// per-route heads come from the app itself, not a second copy.
export function loadApp(raw) {
  const src = raw.slice(raw.lastIndexOf('<script>') + 8, raw.lastIndexOf('</script>'));
  const cut = src.indexOf('/* motion:');
  if (cut < 0) throw new Error('preview: "/* motion:" marker not found');
  const ctx = { DATES: {}, GA_ID: '', document: { documentElement: { lang: 'ka' }, getElementById: () => ({}) }, matchMedia: () => ({ matches: false }) };
  vm.runInNewContext(src.slice(0, cut) +
    ';globalThis.app={ROUTES,SPORTS,ADDR,PHONE,PHONE_RAW,page,set:(l,r)=>{lang=l;route=r},' +
    'stories:POSTS.map(p=>"story-"+p.id),sameAs:[...SOC.map(s=>s[0]),...(ok(TIKTOK[1])?[TIKTOK[0]]:[])]}', ctx);
  const { app } = ctx;
  const head = (lang, route) => {
    ctx.DATES = appDates(raw, lang);
    app.set(lang, route);
    const h = app.page(), rest = h.slice(h.indexOf('</h1>'));
    const story = route.startsWith('story-') && rest.match(/<div class="txt">([\s\S]*?)<\/div>/);
    const lead = rest.match(/<p class="(?:sub|lead)">([\s\S]*?)<\/p>/);
    const hero = app.SPORTS.includes(route) && h.slice(0, h.indexOf('</section>')).match(/<img src="([^"]+)"/);
    return { h1: text(h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1]), desc: clip(text((story || lead)[1])), img: hero ? hero[1] : '' };
  };
  return { ...app, routes: [...app.ROUTES, ...app.stories], head };
}
