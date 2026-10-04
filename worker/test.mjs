/* Exercises the Worker's routing, origin checks and caching against stubbed
   globals. No network, no key, no framework: `npm test`. */

const store = new Map();
globalThis.caches = {
  default: {
    async match(req) { const r = store.get(req.url); return r ? r.clone() : undefined; },
    async put(req, res) { store.set(req.url, res); },
  },
};
let upstreamCalls = [];
const realFetch = globalThis.fetch;
let upstreamHeaders = [];
globalThis.fetch = async (url, init) => {
  upstreamCalls.push(String(url));
  upstreamHeaders.push(new Headers(init?.headers || {}).get('referer'));
  return new Response(new Uint8Array([1, 2, 3]), {
    status: 200, headers: { 'content-type': 'image/png', 'set-cookie': 'x=1' },
  });
};

const w = (await import('./src/index.js')).default;
const env = { CARTO_KEY: 'SECRET123', ALLOWED_ORIGINS: 'https://griffint28.github.io,http://localhost:5173', CARTO_REFERER: 'https://griffint28.github.io/' };
const ctx = { waitUntil: (p) => p };
const H = 'https://carto-tiles.example.workers.dev';
const ok = 'https://griffint28.github.io';

const call = (path, headers = {}, method = 'GET') =>
  w.fetch(new Request(H + path, { method, headers }), env, ctx);

let fail = 0;
const t = async (name, expect, fn) => {
  const got = await fn();
  const pass = got === expect;
  if (!pass) fail++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  (got ${got}, want ${expect})`);
};

await t('allowed Origin + valid tile', 200, async () => (await call('/light_nolabels/12/1205/1539.png', { Origin: ok })).status);
await t('retina @2x tile', 200, async () => (await call('/light_all/12/1205/1539@2x.png', { Origin: ok })).status);
await t('allowed Referer, no Origin', 200, async () => (await call('/light_all/5/1/2.png', { Referer: ok + '/portfolio/' })).status);
await t('localhost allowed', 200, async () => (await call('/light_all/5/1/3.png', { Origin: 'http://localhost:5173' })).status);
await t('foreign Origin blocked', 403, async () => (await call('/light_all/5/1/4.png', { Origin: 'https://evil.test' })).status);
await t('no headers blocked', 403, async () => (await call('/light_all/5/1/5.png')).status);
await t('foreign Referer blocked', 403, async () => (await call('/light_all/5/1/6.png', { Referer: 'https://evil.test/x' })).status);
await t('prefix-spoof Origin blocked', 403, async () => (await call('/light_all/5/1/7.png', { Origin: 'https://griffint28.github.io.evil.test' })).status);
await t('unlisted style blocked', 404, async () => (await call('/dark_all/5/1/8.png', { Origin: ok })).status);
await t('path traversal blocked', 404, async () => (await call('/light_all/../../v1/secret.png', { Origin: ok })).status);
await t('non-tile path blocked', 404, async () => (await call('/', { Origin: ok })).status);
await t('POST blocked', 405, async () => (await call('/light_all/5/1/9.png', { Origin: ok }, 'POST')).status);

const r = await call('/light_nolabels/12/1205/1539.png', { Origin: ok });
await t('ACAO echoes origin', ok, async () => r.headers.get('access-control-allow-origin'));
await t('Vary: Origin set', 'Origin', async () => r.headers.get('vary'));
await t('Set-Cookie stripped', null, async () => r.headers.get('set-cookie'));
await t('body passes through', 3, async () => (await r.arrayBuffer()).byteLength);

console.log('\nupstream calls:');
upstreamCalls.forEach((u) => console.log('  ' + u));
const leaked = upstreamCalls.some((u) => !u.includes('key=SECRET123'));
console.log(leaked ? 'FAIL  key missing on some upstream call' : 'PASS  key attached to every upstream call');
const refs = upstreamHeaders.filter(Boolean);
console.log(`\nupstream Referer sent on ${refs.length}/${upstreamHeaders.length} calls: ${[...new Set(refs)].join(', ') || '<none>'}`);
const refOk = upstreamHeaders.length > 0 && upstreamHeaders.every((r) => r === 'https://griffint28.github.io/');
console.log(refOk ? 'PASS  CARTO referer sent on every upstream call' : 'FAIL  referer missing or wrong on some upstream call');
if (!refOk) fail++;

const cacheKeys = [...store.keys()];
console.log('\ncache keys:'); cacheKeys.forEach((k) => console.log('  ' + k));
const keyInCache = cacheKeys.some((k) => k.includes('SECRET'));
console.log(keyInCache ? 'FAIL  key leaked into cache key' : 'PASS  no key in cache keys');

// cache hit: repeat the very first tile, upstream count must not grow
const before = upstreamCalls.length;
await call('/light_nolabels/12/1205/1539.png', { Origin: ok });
console.log(upstreamCalls.length === before ? 'PASS  second request served from cache' : 'FAIL  cache miss on repeat');
process.exit(fail || leaked || keyInCache ? 1 : 0);
