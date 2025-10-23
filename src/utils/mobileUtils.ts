/** Returns true if running on a mobile device (heuristic). */
export function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  const isTouch = (navigator as any).maxTouchPoints > 0;
  return /android|iphone|ipad|ipod|iemobile|opera mini/i.test(ua) || isTouch;
}

/** Detects Trust Wallet in-app browser or generic in-app webviews. */
export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = (navigator.userAgent || '').toLowerCase();
  // Trust Wallet heuristics + common webview tokens
  return (
    ua.includes('trust') ||
    ua.includes('trustwallet') ||
    ua.includes('wv') ||
    ua.includes('webview')
  );
}

/** Opens a WalletConnect deep link URI. */
export function openDeepLink(uri: string) {
  try {
    // Prefer assign to replace current context on iOS Safari
    window.location.assign(uri);
    // Fallback: try forcing same-tab navigation shortly after if not handled
    setTimeout(() => {
      try { window.open(uri, '_self') } catch {}
    }, 500);
  } catch {
    try { window.location.href = uri } catch { window.open(uri, '_self'); }
  }
}