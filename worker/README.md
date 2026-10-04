# carto-tiles

Cloudflare Worker that proxies CARTO basemap tiles for the portfolio map.

CARTO began requiring an API key on `basemaps.cartocdn.com` in 2026. The site
is static and served from GitHub Pages, so a key used directly from the browser
would be readable in the deployed bundle. This Worker holds the key instead and
attaches it to upstream requests, so it never reaches a client.

Deployed independently of the site — a Pages deploy does not touch it, and this
directory is ignored by the site's build.

## Deploying

From this directory:

```sh
npm install
npx wrangler login
npx wrangler secret put CARTO_KEY   # paste the key from carto.com/basemaps/apikey
npm run deploy
```

`wrangler deploy` prints the Worker's URL. Put it in `TILE_HOST` in
`src/lib/basemap.ts`, then deploy the site.

## Configuration

| Name | Where | What |
| --- | --- | --- |
| `CARTO_KEY` | secret | The CARTO basemaps API key. Never in this repo. |
| `ALLOWED_ORIGINS` | `wrangler.toml` | Comma-separated origins allowed to request tiles. |

An origin missing from `ALLOWED_ORIGINS` gets a 403, so a new deploy target
(custom domain, preview URL, a dev server on a different port) has to be added
there and the Worker redeployed before its map will render.

## What this does and does not protect

The key is genuinely hidden: it is only ever on Cloudflare's side.

Origin and Referer checks stop other websites from pointing their maps at this
Worker, because a browser will not let a page forge either header. They do not
stop someone who reads the Worker URL out of the site's source and calls it
with `curl -H 'Origin: https://griffint28.github.io'`. Guarding against that
needs real authentication, which a public static site has nowhere to keep.

So the remaining exposure is quota, not credentials — and CARTO's free
non-commercial tier is 5M requests/month, with a dashboard to watch it. Tiles
are cached at the edge for a day, so repeat views mostly do not reach CARTO at
all. If the count ever looks wrong, rotate `CARTO_KEY` and redeploy; nothing in
the site needs to change.

## Local development

`npm run dev` runs the Worker at `http://localhost:8787`. It needs the key in a
`.dev.vars` file (gitignored):

```
CARTO_KEY=your_key_here
```

Point `TILE_HOST` at `http://localhost:8787` to exercise it from the site.
