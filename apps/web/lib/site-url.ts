// Public origin for redirects/callbacks. Netlify sets URL automatically, so
// NEXT_PUBLIC_SITE_URL is only needed to override it (custom domain, local dev).
export function siteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || 'http://localhost:3000';
  return raw.replace(/\/$/, '');
}
