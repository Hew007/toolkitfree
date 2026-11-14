/** Self-contained so the layout can inline it before rendering the page. */
export function installBrowserLanguage() {
  const key = 'toolkitfree-language';
  const read = (storage: 'localStorage' | 'sessionStorage') => {
    try {
      const value = window[storage].getItem(key);
      return value === 'zh' || value === 'en' ? value : null;
    } catch {
      return null;
    }
  };
  const save = (storage: 'localStorage' | 'sessionStorage', value: string) => {
    try {
      window[storage].setItem(key, value);
    } catch {
      // Browsing and explicit language links still work without storage.
    }
  };
  document.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a.language-switch') : null;
    if (!link) return;
    const choice = link.getAttribute('lang') === 'en' ? 'en' : 'zh';
    save('localStorage', choice);
    save('sessionStorage', choice);
  });
  const current = /^\/zh(?:\/|$)/.test(location.pathname) ? 'zh' : 'en';
  if (location.pathname !== '/') {
    save('sessionStorage', current);
    return;
  }
  let internal = false;
  try {
    internal = new URL(document.referrer).origin === location.origin;
  } catch {
    // A first visit generally has no referrer.
  }
  const preferred = read('localStorage') ?? read('sessionStorage');
  const language = navigator.languages?.[0] || navigator.language || '';
  const choice = preferred ?? (internal ? 'en' : /^zh(?:-|$)/i.test(language) ? 'zh' : 'en');
  save('sessionStorage', choice);
  if (choice === 'zh') location.replace(`/zh/${location.search}${location.hash}`);
}
