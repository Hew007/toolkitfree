export type Locale = 'en' | 'zh';

export function getLocale(pathname: string): Locale {
  return /^\/zh(?:\/|$)/.test(pathname) ? 'zh' : 'en';
}

export function stripLocale(pathname: string): string {
  return pathname.replace(/^\/zh(?=\/|$)/, '') || '/';
}

export function localizePath(pathname: string, locale: Locale): string {
  if (!pathname.startsWith('/') || pathname.startsWith('//')) return pathname;
  const bare = stripLocale(pathname);
  return locale === 'zh' ? `/zh${bare === '/' ? '/' : bare}` : bare;
}
