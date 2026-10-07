# Subway-map portfolio

A software-engineering portfolio drawn as a transit diagram over a real map of
the Lowcountry. React + TypeScript + Vite, Leaflet for the map, CARTO basemap
tiles proxied through the Cloudflare Worker in [`worker/`](worker/).

```bash
npm install
npm run dev      # http://localhost:5173/portfolio/
npm run build
npm run lint
```

## Editing the map

Everything the map draws lives in [`src/data/stops.ts`](src/data/stops.ts):

| What | Where |
| --- | --- |
| Stations (position, label side, copy, tags) | `STOPS` |
| Career line control points | `CAREER` |
| Internship line control points | `INTERN` |
| Initial framing | `HOME_BOUNDS`, `FIT`, `FIT_MOBILE` |
| Line colours, weights, tile filter | `THEME` |

### Route Editor — `?edit=1`

**Start the dev server and open <http://localhost:5173/portfolio/?edit=1>.**
That swaps the portfolio for a dev-only editor (see
[`src/components/RouteEditor.tsx`](src/components/RouteEditor.tsx)) with two
modes:

- **Lines** — click the map to append a control point to the active line, click a
  point to select it (toggle sharp/rounded corner, reorder, delete), drag to move.
- **Stops** — drag the stations themselves, and cycle which side each label sits on.

Edits are held in `localStorage`, so the tab survives a reload. When it looks
right, hit **Copy** in the Export panel and paste the result back into
`src/data/stops.ts` — the editor emits the exact tuple/field format that file
expects. **Nothing is written to disk for you.**

### Geometry rules

Control points are authored as true 0°/45°/90° runs in a screen-square space
(latitude divided by `cos(32.85°)`, so a 45° leg really looks like 45°), and
[`src/lib/route.ts`](src/lib/route.ts) rounds every non-station corner to a fixed
radius. A third element of `1` in a tuple marks a vertex that must not be moved
or rounded — stations, and corners that need to stay crisp. The two lines meet
only at the College of Charleston interchange; nothing else crosses.
