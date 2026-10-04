/* Tile proxy for CARTO basemaps.
 *
 * CARTO started requiring an API key on basemaps.cartocdn.com in 2026. This
 * Worker holds that key as a secret and attaches it to upstream requests, so
 * it never reaches the browser and never lands in the Pages bundle.
 *
 * Deployed separately from the site — see README.md in this directory.
 */

const UPSTREAM = 'https://basemaps.cartocdn.com';

// Only the styles the site actually uses. Without this the Worker would be an
// open proxy for every path under the upstream host.
const STYLES = new Set(['light_nolabels', 'light_all']);

const TILE_PATH = /^\/([a-z_]+)\/(\d{1,2})\/(\d{1,7})\/(\d{1,7})(@2x)?\.png$/;

const DAY = 86400;

/* Returns the allowed origin this request came from, or null.
 *
 * Tiles are requested as crossOrigin images, so the browser sends Origin and
 * a referrer policy cannot strip it. Referer is the fallback for clients that
 * send one but not the other. Neither header is forgeable by a browser on
 * another site, which is the whole threat here; curl can set both, so this
 * stops hotlinking, not a determined scraper. The quota ceiling is CARTO's. */
function resolveOrigin(request, env) {
  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const origin = request.headers.get('Origin');
  if (origin) return allowed.includes(origin) ? origin : null;

  const referer = request.headers.get('Referer');
  if (!referer) return null;
  try {
    const refOrigin = new URL(referer).origin;
    return allowed.includes(refOrigin) ? refOrigin : null;
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }

    const origin = resolveOrigin(request, env);
    if (!origin) return new Response('Forbidden', { status: 403 });

    const match = new URL(request.url).pathname.match(TILE_PATH);
    if (!match) return new Response('Not found', { status: 404 });

    const [, style, z, x, y, retina = ''] = match;
    if (!STYLES.has(style)) return new Response('Not found', { status: 404 });

    const tile = `${UPSTREAM}/${style}/${z}/${x}/${y}${retina}.png`;

    /* Cache on the keyless URL so one cached copy serves every allowed origin
       and the key never appears in a cache key. */
    const cache = caches.default;
    const cacheKey = new Request(tile);
    let cached = await cache.match(cacheKey);

    if (!cached) {
      /* The key is restricted to the site's host in CARTO's dashboard, and a
         server-side fetch carries no browser Referer, so send one explicitly
         or CARTO rejects us the same way it rejects curl. */
      const upstream = await fetch(`${tile}?key=${env.CARTO_KEY}`, {
        headers: env.CARTO_REFERER ? { Referer: env.CARTO_REFERER } : {},
        cf: { cacheTtl: DAY, cacheEverything: true },
      });
      if (!upstream.ok) {
        return new Response('Upstream error', { status: 502 });
      }
      cached = new Response(upstream.body, upstream);
      cached.headers.set('Cache-Control', `public, max-age=${DAY}, s-maxage=${DAY * 7}`);
      cached.headers.delete('Set-Cookie');
      ctx.waitUntil(cache.put(cacheKey, cached.clone()));
    }

    const response = new Response(cached.body, cached);
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Vary', 'Origin');
    return response;
  },
};
