import { useSyncExternalStore, type AnchorHTMLAttributes } from 'react';
let currentIndex = Number(window.history.state?.posIndex ?? 0), restoring = false, currentUrl = window.location.href;
window.history.replaceState({ ...window.history.state, posIndex: currentIndex }, '', window.location.href);
// Registrar antes de los suscriptores React: cancelar Atrás/Adelante preserva el formulario.
window.addEventListener('popstate', event => {
  if (restoring) { restoring = false; event.stopImmediatePropagation(); return; }
  const nextIndex = Number(event.state?.posIndex ?? 0);
  if (!window.dispatchEvent(new Event('pos:before-navigate', { cancelable: true }))) {
    event.stopImmediatePropagation(); if(currentIndex === nextIndex) window.history.replaceState({posIndex:currentIndex},'',currentUrl); else {restoring = true; window.history.go(currentIndex - nextIndex);}
  } else {currentIndex = nextIndex; currentUrl = window.location.href;}
});
function subscribe(callback: () => void) {
  window.addEventListener('popstate', callback); window.addEventListener('pos:navigate', callback);
  return () => { window.removeEventListener('popstate', callback); window.removeEventListener('pos:navigate', callback); };
}
export function usePathname() { return useSyncExternalStore(subscribe, () => window.location.pathname, () => '/'); }
export function navigate(path: string) { if(!window.dispatchEvent(new Event('pos:before-navigate',{cancelable:true})))return; window.history.pushState({ posIndex: ++currentIndex }, '', path); currentUrl = window.location.href; window.dispatchEvent(new Event('pos:navigate')); window.scrollTo({ top: 0 }); }
export function Link({ to, children, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return <a {...props} href={to} onClick={event => {
    onClick?.(event);
    if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && props.target !== '_blank') { event.preventDefault(); navigate(to); }
  }}>{children}</a>;
}
