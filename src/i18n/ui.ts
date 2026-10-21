export const LANGS = ['ka', 'ru', 'en'] as const;
export type Lang = (typeof LANGS)[number];

export const NAMES: Record<Lang, string> = { ka: 'ქართული', ru: 'Русский', en: 'English' };
export const OG_LOCALE: Record<Lang, string> = { ka: 'ka_GE', ru: 'ru_RU', en: 'en_GB' };
export const CITY: Record<Lang, string> = { ka: 'თბილისი', ru: 'Тбилиси', en: 'Tbilisi' };

// verbatim from the preview's T.<lang>.brand and T.<lang>.lead
export const BRAND: Record<Lang, string> = {
  ka: 'ძიუდოს კლუბი „ჯორჯია“',
  ru: 'Клуб дзюдо «Джорджия»',
  en: 'Judo Club “Georgia”',
};
export const TITLE = Object.fromEntries(LANGS.map((l) => [l, `${BRAND[l]} · ${CITY[l]}`])) as Record<Lang, string>;
export const DESC: Record<Lang, string> = {
  ka: 'ძიუდო ბავშვებისთვის 4–5 წლიდან: დისციპლინა, პატივისცემა და ძლიერი ხასიათი. ტატამზე 2008 წლიდან.',
  ru: 'Дзюдо для детей с 4–5 лет: дисциплина, уважение и сильный характер. На татами с 2008 года.',
  en: 'Judo for children from age 4–5: discipline, respect and a strong character. On the tatami since 2008.',
};

// new ka/ru copy, pending native review (Phase 14)
export const NOT_FOUND: Record<Lang, { title: string; text: string; home: string }> = {
  ka: { title: 'გვერდი ვერ მოიძებნა', text: 'ასეთი გვერდი არ არსებობს ან გადატანილია.', home: 'მთავარ გვერდზე' },
  ru: { title: 'Страница не найдена', text: 'Такой страницы нет или она перемещена.', home: 'На главную' },
  en: { title: 'Page not found', text: 'This page does not exist or has moved.', home: 'Go to the home page' },
};
export const PICK: Record<Lang, string> = { ka: 'აირჩიეთ ენა', ru: 'Выберите язык', en: 'Choose a language' };
