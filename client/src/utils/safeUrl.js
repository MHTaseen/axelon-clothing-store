// Returns a URL that is safe to put in href/src, or a fallback.
// Blocks javascript:, data:, vbscript: and other dangerous schemes.
export function safeHref(url, fallback = '#') {
  const raw = String(url || '').trim();
  if (!raw) return fallback;
  if (raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\')) return raw;
  try {
    const u = new URL(raw, window.location.origin);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(u.protocol) ? u.href : fallback;
  } catch {
    return fallback;
  }
}

export function safeSrc(url, fallback = '') {
  const href = safeHref(url, '');
  return href && !href.startsWith('mailto:') && !href.startsWith('tel:') ? href : fallback;
}
