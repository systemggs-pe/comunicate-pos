import { useSyncExternalStore, type AnchorHTMLAttributes } from 'react';
function subscribe(callback: () => void) {
  window.addEventListener('popstate', callback); window.addEventListener('pos:navigate', callback);
  return () => { window.removeEventListener('popstate', callback); window.removeEventListener('pos:navigate', callback); };
}
export function usePathname() { return useSyncExternalStore(subscribe, () => window.location.pathname, () => '/'); }
export function navigate(path: string) { window.history.pushState(null, '', path); window.dispatchEvent(new Event('pos:navigate')); window.scrollTo({ top: 0 }); }
export function Link({ to, children, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return <a {...props} href={to} onClick={event => {
    onClick?.(event);
    if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && props.target !== '_blank') { event.preventDefault(); navigate(to); }
  }}>{children}</a>;
}
