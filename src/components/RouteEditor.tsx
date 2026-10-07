import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { STOPS, CAREER, INTERN, type StopDir } from '../data/stops';
import { DEFAULT_THEME } from '../lib/theme';
import { route } from '../lib/route';
import { basemapUrl, BASEMAP_OPTIONS } from '../lib/basemap';

/* Local dev tool for hand-placing things on the real map, then exporting them in
   the exact format src/data/stops.ts expects. Two modes:
     Lines — drag/add/delete the transit line control points (CAREER / INTERN)
     Stops — drag the stations themselves and cycle their label direction
   Visit with ?edit=1. Not part of the production visitor experience. */

type LineKey = 'career' | 'intern';
type Mode = 'lines' | 'stops';

interface EditPt {
  lat: number;
  lng: number;
  sharp: boolean; // true = exact vertex, no rounding (matches the `1` flag in CAREER/INTERN)
}

interface EditStop {
  id: string;
  lat: number;
  lng: number;
  dir: StopDir;
}

const STORAGE_KEY = 'routeEditor:v1';
const STOPS_KEY = 'routeEditor:stops:v1';
const DIRS: StopDir[] = ['left', 'right', 'top', 'bottom'];

function fromTuples(pts: Array<[number, number, number?]>): EditPt[] {
  return pts.map(([lat, lng, s]) => ({ lat, lng, sharp: !!s }));
}

function shippedStops(): EditStop[] {
  return STOPS.map((s) => ({ id: s.id, lat: s.at[0], lng: s.at[1], dir: s.dir }));
}

function loadInitial(): Record<LineKey, EditPt[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore corrupt storage */
  }
  return { career: fromTuples(CAREER), intern: fromTuples(INTERN) };
}

function loadInitialStops(): EditStop[] {
  try {
    const raw = localStorage.getItem(STOPS_KEY);
    if (raw) {
      const saved: EditStop[] = JSON.parse(raw);
      // keep the shipped list authoritative so a removed/added stop still shows up
      return shippedStops().map((s) => saved.find((o) => o.id === s.id) ?? s);
    }
  } catch {
    /* ignore corrupt storage */
  }
  return shippedStops();
}

function formatArray(name: string, pts: EditPt[]): string {
  const lines = pts.map((p) => {
    const lat = p.lat.toFixed(4);
    const lng = p.lng.toFixed(4);
    return p.sharp ? `  [${lat}, ${lng}, 1],` : `  [${lat}, ${lng}],`;
  });
  return `export const ${name}: Array<[number, number, number?]> = [\n${lines.join('\n')}\n];`;
}

function formatStops(stops: EditStop[]): string {
  return stops
    .map((s) => `${s.id}: at: [${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}], dir: '${s.dir}',`)
    .join('\n');
}

const LINE_COLOR: Record<LineKey, string> = { career: DEFAULT_THEME.career, intern: DEFAULT_THEME.intern };

export default function RouteEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const [lines, setLines] = useState<Record<LineKey, EditPt[]>>(loadInitial);
  const [stops, setStops] = useState<EditStop[]>(loadInitialStops);
  const [mode, setMode] = useState<Mode>('lines');
  const [active, setActive] = useState<LineKey>('career');
  const [selected, setSelected] = useState<number | null>(null);
  const [selStop, setSelStop] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ lat: number; lng: number } | null>(null);
  const linesRef = useRef(lines);
  const activeRef = useRef(active);
  const selectedRef = useRef(selected);
  const modeRef = useRef(mode);
  linesRef.current = lines;
  activeRef.current = active;
  selectedRef.current = selected;
  modeRef.current = mode;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines]);

  useEffect(() => {
    localStorage.setItem(STOPS_KEY, JSON.stringify(stops));
  }, [stops]);

  const updateActive = (updater: (pts: EditPt[]) => EditPt[]) => {
    setLines((prev) => ({ ...prev, [activeRef.current]: updater(prev[activeRef.current]) }));
  };

  // one-time map setup
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { minZoom: 3, maxZoom: 19 });
    mapRef.current = map;
    map.setView([32.85, -79.95], 12);

    L.tileLayer(basemapUrl('light_all'), BASEMAP_OPTIONS).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);

    const layer = L.layerGroup().addTo(map);
    layerRef.current = layer;

    map.on('mousemove', (e) => setCursor({ lat: e.latlng.lat, lng: e.latlng.lng }));

    map.on('click', (e) => {
      // appending points is a lines-mode gesture; in stops mode a stray map click
      // should just clear the selection rather than grow the route
      if (modeRef.current === 'stops') {
        setSelStop(null);
        return;
      }
      updateActive((pts) => [...pts, { lat: e.latlng.lat, lng: e.latlng.lng, sharp: false }]);
      setSelected(null);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // redraw editable layers whenever data/selection/mode changes
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    (['career', 'intern'] as LineKey[]).forEach((key) => {
      const pts = lines[key];
      const isActive = mode === 'lines' && key === active;
      const color = LINE_COLOR[key];

      if (pts.length >= 2) {
        const routed = route(pts.map((p): [number, number, number?] => [p.lat, p.lng, p.sharp ? 1 : undefined]));
        L.polyline(routed, { color, weight: isActive ? 5 : 3, opacity: isActive ? 0.9 : 0.35 }).addTo(layer);
      }

      pts.forEach((p, i) => {
        if (!isActive) {
          L.circleMarker([p.lat, p.lng], { radius: 3, color, weight: 1, fillColor: color, fillOpacity: 0.4 }).addTo(layer);
          return;
        }
        const isSel = i === selectedRef.current;
        const marker = L.marker([p.lat, p.lng], {
          draggable: true,
          icon: L.divIcon({
            className: '',
            iconSize: [18, 18],
            iconAnchor: [9, 9],
            html: `<div style="width:18px;height:18px;border-radius:${p.sharp ? '4px' : '999px'};
              background:${color};border:3px solid ${isSel ? '#fff' : '#20180f'};
              box-shadow:0 0 0 ${isSel ? 3 : 1}px ${isSel ? color : 'rgba(0,0,0,.4)'};"></div>`,
          }),
        }).addTo(layer);
        marker.on('dragend', () => {
          const ll = marker.getLatLng();
          updateActive((cur) => cur.map((pt, idx) => (idx === i ? { ...pt, lat: ll.lat, lng: ll.lng } : pt)));
        });
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          setSelected(i);
        });
      });
    });

    // the stations: draggable in stops mode, plain reference dots otherwise
    stops.forEach((s) => {
      const meta = STOPS.find((o) => o.id === s.id);
      const tint = meta?.kind === 'interchange' ? DEFAULT_THEME.cofcRing : meta?.line === 'intern' ? DEFAULT_THEME.intern : DEFAULT_THEME.career;
      if (mode !== 'stops') {
        L.circleMarker([s.lat, s.lng], { radius: 4, color: '#333', weight: 1, fillColor: '#fff', fillOpacity: 1 })
          .bindTooltip(meta?.name ?? s.id, { direction: 'top' })
          .addTo(layer);
        return;
      }
      const isSel = s.id === selStop;
      const marker = L.marker([s.lat, s.lng], {
        draggable: true,
        zIndexOffset: 400,
        icon: L.divIcon({
          className: '',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
          html: `<div style="width:22px;height:22px;border-radius:999px;background:#fff;
            border:6px solid ${tint};box-shadow:0 0 0 ${isSel ? 3 : 1}px ${isSel ? '#fff' : 'rgba(0,0,0,.45)'};"></div>`,
        }),
      }).addTo(layer);
      marker.bindTooltip(meta?.name ?? s.id, { direction: s.dir, permanent: true, opacity: 0.95 });
      marker.on('dragend', () => {
        const ll = marker.getLatLng();
        setStops((cur) => cur.map((o) => (o.id === s.id ? { ...o, lat: ll.lat, lng: ll.lng } : o)));
      });
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setSelStop(s.id);
      });
    });
  }, [lines, active, selected, stops, mode, selStop]);

  const activePts = lines[active];
  const sel = selected !== null ? activePts[selected] : null;
  const stop = stops.find((s) => s.id === selStop) ?? null;

  const move = (dir: -1 | 1) => {
    if (selected === null) return;
    const j = selected + dir;
    if (j < 0 || j >= activePts.length) return;
    updateActive((pts) => {
      const copy = [...pts];
      [copy[selected], copy[j]] = [copy[j], copy[selected]];
      return copy;
    });
    setSelected(j);
  };

  const toggleSharp = () => {
    if (selected === null) return;
    updateActive((pts) => pts.map((p, i) => (i === selected ? { ...p, sharp: !p.sharp } : p)));
  };

  const remove = () => {
    if (selected === null) return;
    updateActive((pts) => pts.filter((_, i) => i !== selected));
    setSelected(null);
  };

  const cycleDir = () => {
    if (!stop) return;
    setStops((cur) => cur.map((o) => (o.id === stop.id ? { ...o, dir: DIRS[(DIRS.indexOf(o.dir) + 1) % DIRS.length] } : o)));
  };

  const resetActive = () => {
    setLines((prev) => ({ ...prev, [active]: fromTuples(active === 'career' ? CAREER : INTERN) }));
    setSelected(null);
  };

  const clearActive = () => {
    setLines((prev) => ({ ...prev, [active]: [] }));
    setSelected(null);
  };

  const resetStops = () => {
    setStops(shippedStops());
    setSelStop(null);
  };

  const [copied, setCopied] = useState<string | null>(null);
  const copyText = async (tag: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(tag);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, fontFamily: 'system-ui, sans-serif', display: 'flex' }}>
      <div ref={containerRef} style={{ flex: 1, position: 'relative' }} />

      <div style={{ width: 380, background: '#1c1a17', color: '#f0ece2', padding: 16, overflowY: 'auto', fontSize: 13, lineHeight: 1.5 }}>
        <h2 style={{ font: '600 15px system-ui', margin: '0 0 4px' }}>Route Editor</h2>
        <p style={{ opacity: 0.7, margin: '0 0 14px' }}>
          Dev-only, gated behind <code>?edit=1</code>. Everything here is kept in localStorage, so
          you can close the tab mid-edit — paste the export back into{' '}
          <code>src/data/stops.ts</code> when you're happy.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['lines', 'stops'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setSelected(null); setSelStop(null); }}
              style={{
                flex: 1, padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                border: mode === m ? '2px solid #f0ece2' : '2px solid transparent',
                background: mode === m ? '#3a352c' : '#2a2620', color: '#f0ece2', fontWeight: 600, textTransform: 'capitalize',
              }}
            >
              {m}
            </button>
          ))}
        </div>

        {mode === 'lines' ? (
          <>
            <p style={{ opacity: 0.7, margin: '0 0 12px' }}>
              Click the map to append a point to the active line. Click a point to select it (toggle
              sharp/rounded, reorder, delete). Drag points to move them.
            </p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {(['career', 'intern'] as LineKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => { setActive(key); setSelected(null); }}
                  style={{
                    flex: 1, padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                    border: active === key ? `2px solid ${LINE_COLOR[key]}` : '2px solid transparent',
                    background: '#2a2620', color: LINE_COLOR[key], fontWeight: 600, textTransform: 'capitalize',
                  }}
                >
                  {key} ({lines[key].length})
                </button>
              ))}
            </div>

            {sel && (
              <div style={{ background: '#2a2620', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Point #{selected}</div>
                <div style={{ opacity: 0.8, marginBottom: 8 }}>
                  {sel.lat.toFixed(4)}, {sel.lng.toFixed(4)}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={sel.sharp} onChange={toggleSharp} />
                  Sharp vertex (no rounding)
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => move(-1)} style={btnStyle}>↑ Move earlier</button>
                  <button onClick={() => move(1)} style={btnStyle}>↓ Move later</button>
                  <button onClick={remove} style={{ ...btnStyle, background: '#5a2a22', color: '#ffb3a3' }}>Delete</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              <button onClick={resetActive} style={btnStyle}>Reset to shipped</button>
              <button onClick={clearActive} style={btnStyle}>Clear all</button>
            </div>
          </>
        ) : (
          <>
            <p style={{ opacity: 0.7, margin: '0 0 12px' }}>
              Drag a station to reposition it. Click one to select it, then cycle which side its
              label sits on. The lines stay visible (dimmed) so you can keep stations on them.
            </p>

            {stop && (
              <div style={{ background: '#2a2620', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  {STOPS.find((o) => o.id === stop.id)?.name ?? stop.id}
                </div>
                <div style={{ opacity: 0.8, marginBottom: 8 }}>
                  {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)} · label: {stop.dir}
                </div>
                <button onClick={cycleDir} style={btnStyle}>Cycle label side →</button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              <button onClick={resetStops} style={btnStyle}>Reset to shipped</button>
            </div>
          </>
        )}

        {cursor && (
          <div style={{ opacity: 0.6, marginBottom: 16 }}>
            Cursor: {cursor.lat.toFixed(4)}, {cursor.lng.toFixed(4)}
          </div>
        )}

        <div style={{ borderTop: '1px solid #3a352c', paddingTop: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Export</div>

          {mode === 'stops' ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>Stops</span>
                <button onClick={() => copyText('stops', formatStops(stops))} style={{ ...btnStyle, padding: '4px 10px' }}>
                  {copied === 'stops' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <textarea readOnly value={formatStops(stops)} style={taStyle} />
              <div style={{ opacity: 0.6, fontSize: 11 }}>
                Paste each <code>at</code> / <code>dir</code> onto the matching stop in <code>STOPS</code>.
              </div>
            </div>
          ) : (
            (['career', 'intern'] as LineKey[]).map((key) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ textTransform: 'capitalize', color: LINE_COLOR[key], fontWeight: 600 }}>{key}</span>
                  <button onClick={() => copyText(key, formatArray(key.toUpperCase(), lines[key]))} style={{ ...btnStyle, padding: '4px 10px' }}>
                    {copied === key ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <textarea readOnly value={formatArray(key.toUpperCase(), lines[key])} style={taStyle} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #3a352c',
  background: '#332e26', color: '#f0ece2', cursor: 'pointer', fontSize: 12,
};

const taStyle: React.CSSProperties = {
  width: '100%', height: 130, background: '#111', color: '#c9c2b3', fontFamily: 'ui-monospace, monospace',
  fontSize: 11, borderRadius: 6, border: '1px solid #3a352c', padding: 8, resize: 'vertical', boxSizing: 'border-box',
};
