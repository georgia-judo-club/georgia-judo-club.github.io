# Judo Club "Georgia"

Site for the club, built with Astro and served from GitHub Pages.

## Analytics

Google Analytics 4 and Search Console are off until their IDs are set in `src/config.ts`:

- `GA_ID` — GA4 measurement ID (`G-XXXXXXXXXX`). Empty means no consent banner and no request to Google.
- `GSC_TOKEN` — the `content` value of the Search Console HTML-tag verification. Empty means no meta tag.

Either edit the constants or pass `PUBLIC_GA_ID` / `PUBLIC_GSC_TOKEN` to `npm run build`.

With an ID set, visitors see a consent banner. gtag.js loads only after "Accept" (Consent Mode v2, everything denied by default). Events: `page_view` on load and on every route change (`page_path` like `/ru/trampoline`), and `join_click` on every WhatsApp/Viber/Messenger/phone link with `channel`, `sport` and `lang`. Set the GA4 data retention to 14 months or less, as the privacy page promises.
