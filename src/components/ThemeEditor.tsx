import { useEffect, useMemo, useState } from 'react';
import TransitMap from './TransitMap';
import {
  DEFAULT_THEME, applyLevels, basemapColorAt, setTheme,
  type Basemap, type MapTheme, type RampStop,
} from '../lib/theme';
import {
  AA_GRAPHIC, BASEMAP_FEATURES, chroma, contrastRatio, isHex, landTone, luminance, maxLuminanceFor,
} from '../lib/contrast';

/* Local dev tool for tuning the map palette against the real map, then
   exporting it in the exact shape src/lib/theme.ts expects. Visit with
   ?theme=1. Not part of the production visitor experience.

   The preview is the actual TransitMap, not a mock-up of one -- ramp, casing
   widths, label chips, the lot. A palette that reads fine on swatches in a
   panel routinely falls apart over real tiles, which is the whole reason this
   exists, so swatches alone would miss the problem being tuned for.

   Numbers, not eyeballs, for the part that matters: the readout works out what
   the ramp turns CARTO's land into and scores every element against it. */

const PANEL = 390;
const STORAGE_KEY = 'themeEditor:v4';

function loadInitial(): MapTheme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    /* Spread over the shipped theme rather than trusting the stored object
       whole: a palette saved before a field existed would otherwise come back
       with it undefined, and undefined paints as nothing. */
    if (raw) {
      const saved = JSON.parse(raw) as Partial<MapTheme>;
      return {
        ...DEFAULT_THEME, ...saved,
        basemap: { ...DEFAULT_THEME.basemap, ...(saved.basemap ?? {}) },
      };
    }
  } catch {
    /* ignore corrupt storage */
  }
  return DEFAULT_THEME;
}

/* Just the string-valued fields -- keeps `weight` and `basemap` out of the
   colour list by construction, rather than by a cast that would paint them
   as text. */
type ColorKey = { [K in keyof MapTheme]: MapTheme[K] extends string ? K : never }[keyof MapTheme];

const SWATCHES: Array<{ key: ColorKey; label: string; hint: string }> = [
  { key: 'career', label: 'Career line', hint: 'The spine. Heaviest stroke on the map.' },
  { key: 'intern', label: 'Internship line', hint: 'One weight lighter than the career line.' },
  { key: 'casing', label: 'Line casing', hint: 'Halo under both lines. Its job is to contrast the LINES, not the land.' },
  { key: 'stopCore', label: 'Station fill', hint: 'Inside of every dot, and the interchange core.' },
  { key: 'label', label: 'Label chip', hint: 'Permanent station labels. Desktop only.' },
  { key: 'labelText', label: 'Label text', hint: 'Set this with the chip — a dark chip needs light text.' },
  { key: 'water', label: 'Tile gap', hint: 'Shows between tiles mid-zoom. Match it to the water swatch above.' },
  { key: 'cofcRing', label: 'Interchange ring', hint: 'CofC maroon. Drawn just outside the white core.' },
  { key: 'cofcHalo', label: 'Interchange halo', hint: 'CofC gold. Low contrast on sand by nature — width and the edge carry it.' },
  { key: 'cofcEdge', label: 'Interchange edge', hint: 'Hairline outside the gold. This is what gives the badge a crisp outline.' },
];

function exportSource(t: MapTheme): string {
  const stops = t.basemap.stops
    .map((s) => `      { pos: ${s.pos}, color: '${s.color}' },`)
    .join('\n');
  return `/* --- paste over DEFAULT_THEME in src/lib/theme.ts --- */
export const DEFAULT_THEME: MapTheme = {
  career: '${t.career}',
  intern: '${t.intern}',
  casing: '${t.casing}',
  weight: ${t.weight},
  casingExtra: ${t.casingExtra},
  stopCore: '${t.stopCore}',
  label: '${t.label}',
  labelText: '${t.labelText}',
  water: '${t.water}',
  cofcRing: '${t.cofcRing}',
  cofcHalo: '${t.cofcHalo}',
  cofcHaloWidth: ${t.cofcHaloWidth},
  cofcEdge: '${t.cofcEdge}',
  basemap: {
    black: ${t.basemap.black},
    white: ${t.basemap.white},
    stops: [
${stops}
    ],
  },
};

/* --- mirror into the fallback block in src/index.css --- */
  --water: ${t.water};
  --label-bg: ${t.label};
  --label-text: ${t.labelText};
  --line-main: ${t.career};
  --line-intern: ${t.intern};
  --casing: ${t.casing};
  --stop-core: ${t.stopCore};
  --cofc-ring: ${t.cofcRing};
  --cofc-halo: ${t.cofcHalo};
  --cofc-halo-w: ${t.cofcHaloWidth}px;
  --cofc-edge: ${t.cofcEdge};`;
}

export default function ThemeEditor() {
  const [theme, setLocal] = useState<MapTheme>(loadInitial);
  const [copied, setCopied] = useState(false);

  /* Reserve the panel's width before the map measures itself, then tell
     Leaflet the viewport moved -- it refits on window resize already, so the
     map lands correctly framed instead of half-hidden under the panel. */
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--map-inset-right', `${PANEL}px`);
    window.dispatchEvent(new Event('resize'));
    return () => {
      root.style.removeProperty('--map-inset-right');
    };
  }, []);

  useEffect(() => {
    setTheme(theme);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  }, [theme]);

  const bm = theme.basemap;
  const land = useMemo(() => landTone(bm), [bm]);

  /* Everything that has to hold its own against the land the ramp produces,
     plus the two line-on-casing pairs -- if the casing goes dark to beat the
     land it stops separating the lines from it, and that trade needs to be
     visible. */
  const checks = useMemo(() => [
    { label: 'Casing on land', a: theme.casing, b: land },
    { label: 'Station fill on land', a: theme.stopCore, b: land },
    { label: 'Label chip on land', a: theme.label, b: land },
    { label: 'Career line on land', a: theme.career, b: land },
    { label: 'Intern line on land', a: theme.intern, b: land },
    /* The checks that decide whether crossings read. A casing only separates
       the lines if it contrasts THEM -- a dark casing under dark lines scores
       near 1:1 and the line vanishes into its own halo. */
    { label: 'Career on casing', a: theme.career, b: theme.casing },
    { label: 'Intern on casing', a: theme.intern, b: theme.casing },
    { label: 'Label text on chip', a: theme.labelText, b: theme.label },
    { label: 'Interchange edge on land', a: theme.cofcEdge, b: land },
  ].map((c) => ({
    ...c,
    ratio: isHex(c.a) && isHex(c.b) ? contrastRatio(c.a, c.b) : null,
  })), [theme, land]);

  const failing = checks.filter((c) => c.ratio !== null && c.ratio < AA_GRAPHIC).length;

  /* A pale basemap puts a hard ceiling on anything near-white drawn over it.
     Say so, rather than let someone drag the casing picker expecting 3:1. */
  const landCeiling = maxLuminanceFor(land);

  const setColor = (key: ColorKey, value: string) =>
    setLocal((p) => ({ ...p, [key]: value }));
  const setBasemap = (patch: Partial<Basemap>) =>
    setLocal((p) => ({ ...p, basemap: { ...p.basemap, ...patch } }));
  const setStop = (i: number, patch: Partial<RampStop>) =>
    setBasemap({ stops: bm.stops.map((s, k) => (k === i ? { ...s, ...patch } : s)) });

  const addStop = () => {
    const sorted = [...bm.stops].sort((a, b) => a.pos - b.pos);
    /* Drop it in the widest gap, coloured as the ramp already renders there,
       so adding a handle never moves the map. */
    let gap = 0;
    let pos = 0.5;
    for (let i = 1; i < sorted.length; i++) {
      const d = sorted[i].pos - sorted[i - 1].pos;
      if (d > gap) {
        gap = d;
        pos = (sorted[i].pos + sorted[i - 1].pos) / 2;
      }
    }
    setBasemap({ stops: [...bm.stops, { pos: Number(pos.toFixed(3)), color: rampHexAtPos(bm, pos) }] });
  };

  const removeStop = (i: number) => {
    if (bm.stops.length <= 2) return;
    setBasemap({ stops: bm.stops.filter((_, k) => k !== i) });
  };

  const copy = async () => {
    await navigator.clipboard.writeText(exportSource(theme));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const ordered = [...bm.stops].sort((a, b) => a.pos - b.pos);
  const gradient = `linear-gradient(90deg, ${ordered
    .map((s) => `${s.color} ${(s.pos * 100).toFixed(1)}%`)
    .join(', ')})`;

  return (
    <>
      <TransitMap />

      <div style={panel}>
        <h2 style={{ font: '600 15px system-ui', margin: '0 0 4px' }}>Theme Editor</h2>
        <p style={{ opacity: 0.7, margin: '0 0 14px' }}>
          Dev-only, gated behind <code>?theme=1</code>. The map on the left is the real
          one and repaints as you drag. Kept in localStorage, so you can close the tab
          mid-tune — paste the export into <code>src/lib/theme.ts</code> when you're happy.
        </p>

        <Section title="Basemap ramp">
          <p style={{ opacity: 0.65, fontSize: 11, margin: '0 0 10px' }}>
            CARTO ships raster tiles, so there are no feature layers to restyle. Instead
            the tile's own colour is thrown away and its <em>lightness</em> looked up in
            this ramp — which is why water, parks and land can take separate colours even
            though one filter touches every pixel.
          </p>

          <div style={{ ...gradientBar, background: gradient }}>
            {BASEMAP_FEATURES.map((f) => (
              <span
                key={f.key}
                title={`${f.label} — source ${f.source}, lightness ${f.lum.toFixed(3)}`}
                style={{ ...tick, left: `${applyLevels(bm, f.lum) * 100}%` }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0 12px' }}>
            {BASEMAP_FEATURES.map((f) => (
              <span key={f.key} style={featurePill}>
                <span style={{ ...chip, width: 14, height: 14, background: basemapColorAt(bm, f.lum) }} />
                {f.label}
                <span style={{ opacity: 0.45 }}>{f.share}%</span>
              </span>
            ))}
          </div>
          <p style={{ opacity: 0.5, fontSize: 11, margin: '0 0 12px' }}>
            Ticks are where each feature falls on the ramp. Roads sit at 1.000 and land at
            0.980, so those two never pull far apart — that gap is real, not a limit of
            the control.
          </p>

          {ordered.map((s) => {
            const i = bm.stops.indexOf(s);
            return (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={row}>
                  <input
                    type="color"
                    value={isHex(s.color) ? s.color : '#000000'}
                    onChange={(e) => setStop(i, { color: e.target.value })}
                    style={colorInput}
                    aria-label={`Stop ${i + 1} colour`}
                  />
                  <input
                    value={s.color}
                    onChange={(e) => setStop(i, { color: e.target.value })}
                    style={hexInput}
                    spellCheck={false}
                  />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={s.pos}
                    onChange={(e) => setStop(i, { pos: Number(e.target.value) })}
                    style={{ flex: 1, minWidth: 0 }}
                    aria-label={`Stop ${i + 1} position`}
                  />
                  <code style={{ opacity: 0.7, width: 34, textAlign: 'right' }}>{s.pos.toFixed(2)}</code>
                  <button
                    onClick={() => removeStop(i)}
                    disabled={bm.stops.length <= 2}
                    style={{ ...btn, flex: '0 0 auto', padding: '2px 7px', opacity: bm.stops.length <= 2 ? 0.4 : 1 }}
                    aria-label={`Remove stop ${i + 1}`}
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
          <button onClick={addStop} style={{ ...btn, marginBottom: 12 }}>+ Add stop</button>

          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>Levels</div>
          <p style={{ opacity: 0.5, fontSize: 11, margin: '0 0 8px' }}>
            Positron packs every feature into lightness 0.85–1.00. These stretch the span
            you care about across the whole ramp, which is what makes the stops bite.
          </p>
          {([['black', 'Black point'], ['white', 'White point']] as const).map(([key, label]) => (
            <div key={key} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span>{label}</span>
                <code style={{ opacity: 0.8 }}>{bm[key].toFixed(3)}</code>
              </div>
              <input
                type="range"
                min={0.5}
                max={1}
                step={0.005}
                value={bm[key]}
                onChange={(e) => setBasemap({ [key]: Number(e.target.value) })}
                style={{ width: '100%' }}
              />
            </div>
          ))}
        </Section>

        <Section title="Contrast">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ ...chip, background: land }} />
            <span style={{ opacity: 0.8 }}>
              Land renders <code>{land}</code>
            </span>
          </div>
          <p style={{ opacity: 0.6, fontSize: 11, margin: '0 0 10px' }}>
            Scored against the ramp's output, not a raw swatch — that is the surface these
            actually sit on. {AA_GRAPHIC}:1 is the WCAG bar for graphics.
          </p>
          {checks.map((c) => {
            const ok = c.ratio === null || c.ratio >= AA_GRAPHIC;
            return (
              <div key={c.label} style={row}>
                <span style={{ ...chip, background: c.a, outline: `1px solid ${c.b}` }} />
                <span style={{ flex: 1 }}>{c.label}</span>
                <span style={{ fontWeight: 600, color: ok ? '#9bd17a' : '#ff9d8a' }}>
                  {c.ratio === null ? '—' : `${c.ratio.toFixed(2)}:1`}
                </span>
              </div>
            );
          })}
          {failing > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: '#ff9d8a' }}>
              {failing} of {checks.length} below {AA_GRAPHIC}:1.
            </div>
          )}
          {isHex(theme.cofcHalo) && (
            <div style={{ marginTop: 8, fontSize: 11, opacity: 0.7 }}>
              Gold halo is {contrastRatio(theme.cofcHalo, land).toFixed(2)}:1 on land — and no gold
              does much better, because gold is a sand colour. What separates them is saturation:
              chroma {chroma(theme.cofcHalo).toFixed(2)} against the land's {chroma(land).toFixed(2)}.
              Below about 0.2 apart the halo starts dissolving into the ground; the edge hairline
              is what keeps the badge legible either way.
            </div>
          )}
          {landCeiling <= 0 ? (
            <div style={{ marginTop: 8, fontSize: 11, opacity: 0.7 }}>
              At this land tone <strong>nothing</strong> clears {AA_GRAPHIC}:1 over it — not even
              black. Darken the land through the ramp above if you want the overlay to pass.
            </div>
          ) : (
            <div style={{ marginTop: 8, fontSize: 11, opacity: 0.7 }}>
              Over this land, anything above luminance {landCeiling.toFixed(3)} fails {AA_GRAPHIC}:1.
              Your casing is at {isHex(theme.casing) ? luminance(theme.casing).toFixed(3) : '—'}.
            </div>
          )}
        </Section>

        <Section title="Overlay colours">
          {SWATCHES.map(({ key, label, hint }) => (
            <div key={key} style={{ marginBottom: 10 }}>
              <div style={row}>
                <input
                  type="color"
                  value={isHex(theme[key]) ? theme[key] : '#000000'}
                  onChange={(e) => setColor(key, e.target.value)}
                  style={colorInput}
                  aria-label={label}
                />
                <span style={{ flex: 1 }}>{label}</span>
                <input
                  value={theme[key]}
                  onChange={(e) => setColor(key, e.target.value)}
                  style={hexInput}
                  spellCheck={false}
                />
              </div>
              <div style={{ opacity: 0.5, fontSize: 11, paddingLeft: 40 }}>{hint}</div>
            </div>
          ))}
        </Section>

        <Section title="Line geometry">
          {([
            ['weight', 'Career stroke', 4, 18, 'The intern line is 1px lighter.'],
            ['casingExtra', 'Casing width', 0, 12, `${(theme.casingExtra / 2).toFixed(1)}px of casing shows each side.`],
            ['cofcHaloWidth', 'Interchange halo', 0, 12, 'Width of the gold band on the CofC marker.'],
          ] as const).map(([key, label, min, max, hint]) => (
            <div key={key} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span>{label}</span>
                <code style={{ opacity: 0.8 }}>{theme[key]}px</code>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                step={1}
                value={theme[key]}
                onChange={(e) => setLocal((p) => ({ ...p, [key]: Number(e.target.value) }))}
                style={{ width: '100%' }}
              />
              <div style={{ opacity: 0.5, fontSize: 11 }}>{hint}</div>
            </div>
          ))}
        </Section>

        <div style={{ display: 'flex', gap: 6, margin: '4px 0 14px' }}>
          <button onClick={() => setLocal(DEFAULT_THEME)} style={btn}>Reset to shipped</button>
        </div>

        <Section title="Export">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ opacity: 0.7, fontSize: 11 }}>Both halves — object and CSS fallbacks.</span>
            <button onClick={copy} style={{ ...btn, flex: '0 0 auto', padding: '4px 10px' }}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <textarea readOnly value={exportSource(theme)} style={ta} />
        </Section>
      </div>
    </>
  );
}

/* Colour the ramp already shows at `pos`, for seeding a new stop. */
function rampHexAtPos(b: Basemap, pos: number): string {
  const span = b.white - b.black;
  return basemapColorAt(b, b.black + pos * span);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: '1px solid #3a352c', paddingTop: 12, marginBottom: 14 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

const panel: React.CSSProperties = {
  position: 'fixed', top: 0, right: 0, bottom: 0, width: PANEL, zIndex: 1000,
  background: '#1c1a17', color: '#f0ece2', padding: 16, overflowY: 'auto',
  fontSize: 13, lineHeight: 1.5, fontFamily: 'system-ui, sans-serif',
};

const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
};

const chip: React.CSSProperties = {
  width: 18, height: 18, borderRadius: 4, flex: '0 0 auto', boxSizing: 'border-box',
};

const gradientBar: React.CSSProperties = {
  position: 'relative', height: 30, borderRadius: 6, border: '1px solid #3a352c',
};

const tick: React.CSSProperties = {
  position: 'absolute', top: -3, bottom: -3, width: 2, marginLeft: -1,
  background: '#f0ece2', boxShadow: '0 0 0 1px #1c1a17',
};

const featurePill: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11,
  background: '#2a2620', borderRadius: 999, padding: '3px 9px 3px 4px',
};

const colorInput: React.CSSProperties = {
  width: 32, height: 24, padding: 0, border: 'none', background: 'none',
  cursor: 'pointer', flex: '0 0 auto',
};

const hexInput: React.CSSProperties = {
  width: 76, flex: '0 0 auto', background: '#111', color: '#c9c2b3',
  fontFamily: 'ui-monospace, monospace', fontSize: 11, borderRadius: 4,
  border: '1px solid #3a352c', padding: '4px 6px',
};

const btn: React.CSSProperties = {
  flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #3a352c',
  background: '#332e26', color: '#f0ece2', cursor: 'pointer', fontSize: 12,
};

const ta: React.CSSProperties = {
  width: '100%', height: 220, background: '#111', color: '#c9c2b3', fontFamily: 'ui-monospace, monospace',
  fontSize: 11, borderRadius: 6, border: '1px solid #3a352c', padding: 8, resize: 'vertical', boxSizing: 'border-box',
};
