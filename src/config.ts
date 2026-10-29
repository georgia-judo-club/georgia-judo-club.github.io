// Analytics switches; empty means off. Set here or via PUBLIC_GA_ID / PUBLIC_GSC_TOKEN at build time.
export const GA_ID: string = import.meta.env.PUBLIC_GA_ID || '';
export const GSC_TOKEN: string = import.meta.env.PUBLIC_GSC_TOKEN || '';
// Launch switch: false keeps every page noindex.
export const INDEXABLE = false;
