import { createContext, useContext, useMemo, type ComponentType } from 'react';
import type { Locale } from './locale';

export const LocaleContext = createContext<Locale>('en');

export function useI18n() {
  const locale = useContext(LocaleContext);
  return useMemo(
    () => ({ locale, t: (en: string, zh: string): string => (locale === 'zh' ? zh : en) }),
    [locale]
  );
}

export function withLocale<P extends object>(Component: ComponentType<P>) {
  function LocalizedComponent({ locale = 'en', ...props }: P & { locale?: Locale }) {
    return (
      <LocaleContext.Provider value={locale}>
        <Component {...(props as P)} />
      </LocaleContext.Provider>
    );
  }
  return LocalizedComponent;
}
