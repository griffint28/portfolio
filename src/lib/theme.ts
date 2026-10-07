/* The map's palette, in one place.

   It used to live in two: a THEME object in data/stops.ts that Leaflet read,
   and a block of custom properties in index.css that the CSS read. Three of
   THEME's five colour fields were never actually read by anything -- they were
   hand-copied notes about what index.css said, and nothing stopped them
   drifting from it. DEFAULT_THEME is authoritative now, and applyTheme()
   pushes it into the custom properties so the CSS follows the object.

   Tune it all live at ?theme=1 (see components/ThemeEditor) and paste the
   exported DEFAULT_THEME back over the one below. */

/* ---------------------------------------------------------------- basemap

   CARTO serves the basemap as raster PNGs, so there are no feature layers to
   style -- by the time a tile arrives, "water" and "land" are just pixels.
   Recolouring one therefore means recolouring all of them through the same
   transform, and that is what the five CSS filter functions this used to use
   (sepia/saturate/hue-rotate/brightness/contrast) do. They are colour
   matrices: every pixel gets the same treatment, so whatever distinction the
   tile drew between water and land survives only by luck. It did not survive.
   The old preset mapped water #d4dadc to #ead8ac and land #fafaf8 to #eae9d3
   -- a yellower, *lighter* ocean than the ground it cuts into.

   So instead: throw the tile's own colour away (feColorMatrix saturate=0,
   leaving luminance) and look the result up in a ramp we control. That works
   because Positron separates its features by lightness, which survives the
   desaturation -- water lands at 0.85, parks 0.95, land 0.98, roads 1.00 on
   the weighted-sRGB scale feColorMatrix uses. Give the ramp a stop near each
   and they come out whatever colours you choose, independently.

   The catch is that 0.85..1.00 is a narrow band to spread a ramp over, hence
   `black`/`white`: a levels control that stretches the span you care about
   across the whole ramp before the lookup. Roads at 1.000 and land at 0.980
   stay hard to separate -- that gap is genuinely small -- but water, parks and
   land pull apart cleanly. */

export interface RampStop {
  /* Position on the ramp, 0..1, after levels have been applied. */
  pos: number;
  color: string;
}

export interface Basemap {
  /* Input luminance mapped to ramp position 0. Everything darker clamps there. */
  black: number;
  /* Input luminance mapped to ramp position 1. */
  white: number;
  /* Sorted by pos. Interpolated linearly in sRGB between stops. */
  stops: RampStop[];
}

export interface MapTheme {
  /* The two transit lines. */
  career: string;
  intern: string;
  /* The halo drawn under both lines, the thing that makes them read as transit
     lines rather than roads. Worth knowing before you fight the contrast
     readout over it: a near-white casing cannot reach 3:1 against a light
     basemap, because nothing can -- at that point the choice is a darker
     basemap or a casing that is not white. */
  casing: string;
  /* Stroke width of the career line. The intern line is 1px lighter. */
  weight: number;
  /* How much wider the casing is than the line it sits under, so half of it
     shows each side. The intern line's casing is 1px tighter, matching its
     lighter stroke. Small values read as a drawn keyline, large ones as a fat
     halo -- past about 6 it starts to look like a mistake. */
  casingExtra: number;
  /* Fill of every station dot, and of the interchange's core. */
  stopCore: string;
  /* Permanent station label chips, and the text on them -- the text has to be
     a field of its own or a dark chip is unreadable. */
  label: string;
  labelText: string;
  /* .leaflet-container's background -- what shows through the gaps between
     tiles mid-zoom. It is NOT run through the ramp, so it wants to match the
     ramp's *output* for water, not the tile's input colour. The editor shows
     you that value. */
  water: string;
  /* College of Charleston brand, used for the interchange marker only.
     Drawn outward from the middle: stopCore, then a cofcRing border, then a
     cofcHaloWidth band of cofcHalo, then a hairline of cofcEdge.

     That outer hairline is there because gold cannot be made to contrast sand.
     Gold IS a sand-family colour -- the most a gold manages against this
     basemap is about 2.2:1, and only by going dark enough to stop looking
     gold. What separates them instead is chroma: the land sits near 0.18, a
     real gold near 0.65, and the eye reads that difference happily. But chroma
     alone leaves the marker's outline soft, so cofcEdge draws a boundary in
     something that does contrast the land (the maroon manages 7.4:1) and the
     whole badge gets a crisp edge over land, roads or parks alike. */
  cofcRing: string;
  cofcHalo: string;
  cofcHaloWidth: number;
  cofcEdge: string;
  basemap: Basemap;
}

export const DEFAULT_THEME: MapTheme = {
  career: '#a54112',
  intern: '#2d3f21',
  casing: '#fdfaf0',
  weight: 11,
  casingExtra: 7,
  stopCore: '#ffffff',
  label: '#fdf8ec',
  labelText: '#2b2720',
  water: '#8a9ea4',
  cofcRing: '#660000',
  /* The actual College of Charleston gold, not a punched-up substitute. It is
     a muted tone that shares both the land's lightness (1.3:1) and nearly its
     chroma, so on its own it dissolves into the sand -- a more saturated gold
     reads better but is not the brand. What makes the real one work instead is
     width plus the cofcEdge hairline below: a band this wide registers as a
     band even at low contrast, and the maroon outside it keeps the badge's
     outline crisp over land, roads, parks or water. */
  cofcHalo: '#bfa87c',
  cofcHaloWidth: 5,
  cofcEdge: '#660000',
  /* "Deep sand": the shipped beige, pushed a step deeper, with the two
     conventions the earlier presets broke put back.

     Water is darker than land. That sounds like a nicety but it is the one
     thing a map reader reads without thinking -- pale means paper, dark means
     water -- and a preset that had the harbour lighter than the peninsula made
     the land look like a stain rather than ground.

     Land, parks and roads are three different tones. Collapsing them to one
     flat colour throws away every road and park on the tile, which is what
     turns a map into a silhouette. Roads only need to be a shade lighter than
     land to read as threads; Positron's own styling does exactly that. */
  basemap: {
    black: 0.8,
    white: 1,
    stops: [
      { pos: 0.25, color: '#8a9ea4' },
      { pos: 0.74, color: '#bfbd90' },
      { pos: 0.9, color: '#cdbf9e' },
      { pos: 1, color: '#ded2b2' },
    ],
  },
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return n.some(Number.isNaN) ? [0, 0, 0] : (n as [number, number, number]);
}

/* Where a source luminance sits on the ramp once levels have had their say. */
export function applyLevels(b: Basemap, lum: number): number {
  const span = b.white - b.black;
  return span <= 0 ? 0 : clamp01((lum - b.black) / span);
}

/* The ramp itself: linear interpolation between the bracketing stops. */
export function rampAt(stops: RampStop[], pos: number): [number, number, number] {
  if (stops.length === 0) return [0, 0, 0];
  const sorted = [...stops].sort((a, b) => a.pos - b.pos);
  const p = clamp01(pos);
  if (p <= sorted[0].pos) return parseHex(sorted[0].color);
  const last = sorted[sorted.length - 1];
  if (p >= last.pos) return parseHex(last.color);
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    if (p > b.pos) continue;
    const span = b.pos - a.pos;
    const t = span <= 0 ? 0 : (p - a.pos) / span;
    const ca = parseHex(a.color);
    const cb = parseHex(b.color);
    return [0, 1, 2].map((k) => ca[k] + (cb[k] - ca[k]) * t) as [number, number, number];
  }
  return parseHex(last.color);
}

/* What a given source luminance ends up rendering as. The editor uses this to
   preview each basemap feature and to score contrast against the real land. */
export function basemapColorAt(b: Basemap, lum: number): string {
  const rgb = rampAt(b.stops, applyLevels(b, lum));
  const h = (v: number) => Math.round(clamp01(v / 255) * 255).toString(16).padStart(2, '0');
  return `#${h(rgb[0])}${h(rgb[1])}${h(rgb[2])}`;
}

/* feFuncR/G/B tableValues. Index i stands for an input luminance of
   i/(N-1), so the table is just the ramp sampled evenly -- levels and all.
   64 samples is well past the point where the steps are visible. */
const RAMP_SAMPLES = 64;

export function rampTables(b: Basemap): [string, string, string] {
  const cols: number[][] = [[], [], []];
  for (let i = 0; i < RAMP_SAMPLES; i++) {
    const rgb = rampAt(b.stops, applyLevels(b, i / (RAMP_SAMPLES - 1)));
    for (let k = 0; k < 3; k++) cols[k].push(Number((rgb[k] / 255).toFixed(4)));
  }
  return cols.map((c) => c.join(' ')) as [string, string, string];
}

const FILTER_ID = 'basemap-ramp';
const HOST_ID = 'basemap-filter-host';

/* The filter lives in an inline SVG rather than in CSS because no CSS filter
   function can express a lookup table. index.css points the tile pane at it
   through --tilefx, so the stylesheet does not need to know the difference. */
function ensureFilterHost(): SVGFilterElement | null {
  if (typeof document === 'undefined') return null;
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    /* Built from markup so the HTML parser applies the SVG namespace; the
       same elements created with createElement would not render. */
    host.innerHTML = `<svg><filter id="${FILTER_ID}" color-interpolation-filters="sRGB">`
      + '<feColorMatrix type="saturate" values="0"/>'
      + '<feComponentTransfer>'
      + '<feFuncR type="table" tableValues="0 1"/>'
      + '<feFuncG type="table" tableValues="0 1"/>'
      + '<feFuncB type="table" tableValues="0 1"/>'
      + '</feComponentTransfer></filter></svg>';
    (document.body ?? document.documentElement).appendChild(host);
  }
  return host.querySelector('filter');
}

/* Custom-property names are the ones index.css already used, so the stylesheet
   did not have to change to pick this up. */
export function applyTheme(t: MapTheme, el: HTMLElement = document.documentElement) {
  el.style.setProperty('--line-main', t.career);
  el.style.setProperty('--line-intern', t.intern);
  el.style.setProperty('--casing', t.casing);
  el.style.setProperty('--stop-core', t.stopCore);
  el.style.setProperty('--label-bg', t.label);
  el.style.setProperty('--label-text', t.labelText);
  el.style.setProperty('--water', t.water);
  el.style.setProperty('--cofc-ring', t.cofcRing);
  el.style.setProperty('--cofc-halo', t.cofcHalo);
  el.style.setProperty('--cofc-halo-w', `${t.cofcHaloWidth}px`);
  el.style.setProperty('--cofc-edge', t.cofcEdge);

  const filter = ensureFilterHost();
  if (filter) {
    const [r, g, b] = rampTables(t.basemap);
    const set = (sel: string, v: string) => filter.querySelector(sel)?.setAttribute('tableValues', v);
    set('feFuncR', r);
    set('feFuncG', g);
    set('feFuncB', b);
    el.style.setProperty('--tilefx', `url(#${FILTER_ID})`);
  }
}

/* Live retheming. The custom properties above cover everything CSS draws --
   label chips, station dots, legend swatches -- but Leaflet bakes polyline
   colour into an SVG stroke attribute at creation, so the four line layers
   have to be restyled by hand. TransitMap subscribes; the editor publishes. */
type Listener = (t: MapTheme) => void;
const listeners = new Set<Listener>();
let current: MapTheme = DEFAULT_THEME;

export function getTheme(): MapTheme {
  return current;
}

export function setTheme(t: MapTheme) {
  current = t;
  applyTheme(t);
  listeners.forEach((fn) => fn(t));
}

export function subscribeTheme(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* At import time, so the ramp filter exists and the custom properties hold the
   shipped palette before Leaflet creates its first tile. Guarded so the ramp
   maths above stays importable without a DOM. */
if (typeof document !== 'undefined') applyTheme(DEFAULT_THEME);
