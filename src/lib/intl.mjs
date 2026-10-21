// Run at build time: some Chromium builds ship without Georgian ICU data.
export const LOCALE = { ka: 'ka-GE', ru: 'ru-RU', en: 'en-GB' };
const TZ = 'Asia/Tbilisi';

// noon Tbilisi time so the calendar day never shifts with the host zone
export const fmtDate = (iso, lang) =>
  new Intl.DateTimeFormat(LOCALE[lang], { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ })
    .format(new Date(`${iso}T12:00:00+04:00`));

export const fmtTime = (date, lang) =>
  new Intl.DateTimeFormat(LOCALE[lang], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ })
    .format(date);

export const fmtNumber = (n, lang, opts) => new Intl.NumberFormat(LOCALE[lang], opts).format(n);
