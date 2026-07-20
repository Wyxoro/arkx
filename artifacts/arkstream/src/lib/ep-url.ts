/**
 * URL-safe base64 helpers for episode ID obfuscation.
 * Encodes episode IDs before placing them in the URL bar,
 * decodes them back before API calls.
 *
 * Validates decoded output against known ID structures to reject
 * garbage binary that happens to pass base64 decoding.
 */

const VALID_PREFIXES = ['jikan-', 'ap1-', 'ap2-', 'sx-', 'se-'];

// Internal alias map — translate any legacy prefix that may appear in
// cached/bookmarked URLs to the current canonical set.
const LEGACY_MAP: Record<string, string> = {
  'megaplay-':  'ap1-',
  'anikoto-':   'ap2-',
  'synthetic-': 'sx-',
};

function normPrefix(id: string): string {
  for (const [old, neo] of Object.entries(LEGACY_MAP)) {
    if (id.startsWith(old)) return neo + id.slice(old.length);
  }
  return id;
}

export function encodeEpId(id: string): string {
  return btoa(id).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function decodeEpId(encoded: string): string {
  // Already a known-format ID (old URLs / direct navigation)
  const norm = normPrefix(encoded);
  if (VALID_PREFIXES.some(p => norm.startsWith(p))) return encoded;

  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    const decoded = atob(pad ? b64 + '='.repeat(4 - pad) : b64);
    if (VALID_PREFIXES.some(p => decoded.startsWith(p)) ||
        Object.keys(LEGACY_MAP).some(p => decoded.startsWith(p))) {
      return decoded;
    }
  } catch { /* fall through */ }

  // Unknown format — pass through raw (backwards compat with old bookmarks)
  return encoded;
}
