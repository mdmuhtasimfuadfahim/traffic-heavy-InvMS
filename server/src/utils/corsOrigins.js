/**
 * CLIENT_URL supports a comma-separated list so one deployment can allow
 * multiple valid frontend origins at once (e.g. your Vercel production
 * domain plus its git-branch preview domain), without anyone needing to
 * redeploy the backend every time a preview URL changes.
 *
 * Example: CLIENT_URL=https://invms.vercel.app,https://invms-git-main-you.vercel.app
 */
function parseAllowedOrigins(raw) {
  return (raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Builds an origin-checking function compatible with both the `cors`
 * middleware and Socket.io's `cors.origin` option (both accept
 * `(origin, callback)`).
 *
 * - Requests with no Origin header (curl, server-to-server, health checks)
 *   are always allowed - there's nothing to spoof there.
 * - If nothing is configured at all, we fall back to allowing everything
 *   rather than silently locking out a fresh deploy where CLIENT_URL hasn't
 *   been set yet; this is logged loudly so it's easy to notice and lock down.
 */
function buildOriginChecker(allowedOrigins) {
  if (allowedOrigins.length === 0) {
    console.warn(
      'WARNING: CLIENT_URL is not set - allowing all origins. Set CLIENT_URL in your environment to restrict this.'
    );
  }

  return (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`Origin "${origin}" is not allowed by CORS. Add it to CLIENT_URL.`));
  };
}

module.exports = { parseAllowedOrigins, buildOriginChecker };
