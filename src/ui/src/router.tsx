// Minimal History-API router (no extra dependency). Moves focus to <h1> on navigation (WCAG 2.4.3).
import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react';

// VITE_ROUTER=hash → "#/mapa" URLs (static previews without server-side fallback).
const HASH = import.meta.env.VITE_ROUTER === 'hash';
export const toHref = (to: string) => (HASH ? `#${to}` : to);
function current() {
  if (!HASH) return { path: location.pathname, search: location.search };
  const h = location.hash.slice(1) || '/';
  const i = h.indexOf('?');
  return i < 0 ? { path: h, search: '' } : { path: h.slice(0, i), search: h.slice(i) };
}
export const currentPath = () => current().path;
export const currentSearch = () => current().search;

export function navigate(to: string, replace = false) {
  if (replace) history.replaceState({}, '', toHref(to));
  else history.pushState({}, '', toHref(to));
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function useLocation() {
  const [loc, setLoc] = useState(current);
  useEffect(() => {
    const on = () => setLoc(current());
    window.addEventListener('popstate', on);
    window.addEventListener('hashchange', on);
    return () => { window.removeEventListener('popstate', on); window.removeEventListener('hashchange', on); };
  }, []);
  return loc;
}

export function useQueryParam(name: string): string | null {
  const { search } = useLocation();
  return new URLSearchParams(search).get(name);
}

export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string };

export function Link({ to, onClick, ...rest }: LinkProps) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
  const isCurrent = currentPath() === to.split('?')[0];
  return <a href={toHref(to)} onClick={handle} aria-current={isCurrent ? 'page' : undefined} {...rest} />;
}

let lastPath: string | null = null;

/** Sets document title and focuses the page heading after in-app navigation (not on first load). */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} – AED w danych`;
    const here = currentPath();
    if (lastPath !== null && lastPath !== here) {
      const h1 = document.querySelector<HTMLElement>('main h1');
      if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus(); }
    }
    lastPath = here;
  }, [title]);
}
