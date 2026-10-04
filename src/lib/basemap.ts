/* Basemap tiles go through the Cloudflare Worker in worker/ rather than
   straight to basemaps.cartocdn.com, so the CARTO API key stays server-side
   instead of being baked into this bundle. The Worker rejects origins it
   doesn't recognise, so add any new one to ALLOWED_ORIGINS in its
   wrangler.toml before deploying there. */

// Printed by `wrangler deploy`. Public — this is a URL, not a credential.
const TILE_HOST = 'https://carto-tiles.griffint28.workers.dev';

type Style = 'light_nolabels' | 'light_all';

export const BASEMAP_ATTRIBUTION = '© OpenStreetMap contributors © CARTO';

export const basemapUrl = (style: Style) => `${TILE_HOST}/${style}/{z}/{x}/{y}{r}.png`;

/* crossOrigin makes the browser send an Origin header the Worker can check;
   referrerPolicy keeps a Referer on the request as a fallback for clients
   that send one but not the other. */
export const BASEMAP_OPTIONS = {
   attribution: BASEMAP_ATTRIBUTION,
   crossOrigin: 'anonymous',
   referrerPolicy: 'strict-origin-when-cross-origin',
   maxZoom: 19,
   detectRetina: true,
} as const;
