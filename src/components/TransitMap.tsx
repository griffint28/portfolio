import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { STOPS, CAREER, INTERN, HOME_BOUNDS, FIT, FIT_MOBILE, TAGS, type Stop } from '../data/stops';
import { route } from '../lib/route';
import { basemapUrl, BASEMAP_OPTIONS } from '../lib/basemap';
import { PROJECTS } from '../data/projects';
import { getTheme, subscribeTheme, type MapTheme } from '../lib/theme';

interface MapRefs {
  map: L.Map;
  lines: L.LayerGroup;
  careerCasing: L.Polyline;
  internCasing: L.Polyline;
  careerLine: L.Polyline;
  internLine: L.Polyline;
  markers: Record<string, L.Marker>;
}

/* Below this width the name card and map key collapse to compact/toggle
   chrome (see the isMobile branches in the JSX below) freeing up most of
   the padding fitBounds would otherwise have to reserve for them. */
const MOBILE_BQ = 640;

/* Hard floors: no window shape may zoom out past these, no matter what
   fitBounds computes for a given aspect ratio (a narrow/tall window can
   otherwise compute a much lower zoom, re-exposing the off-screen line
   runoff above Charlotte). Mobile gets its own, lower floor since a phone's
   width is the binding dimension for this wide a route and the desktop
   floor would crop Charlotte or Adaptive Bio off the initial view. */
const HOME_MIN_ZOOM = 10;
const HOME_MIN_ZOOM_MOBILE = 8.5;

function isMobileWidth() {
  return window.innerWidth <= MOBILE_BQ;
}

function responsiveFit() {
  return isMobileWidth()
    ? { fit: FIT_MOBILE, minZoom: HOME_MIN_ZOOM_MOBILE }
    : { fit: FIT, minZoom: HOME_MIN_ZOOM };
}

function lockHome(map: L.Map) {
  map.setMinZoom(map.getZoom());
  map.setMaxBounds(L.latLngBounds(HOME_BOUNDS).pad(0.06));
}

/* The four line layers, as derived from the palette. Casing sits under its
   line and wider, which is what reads as a transit line rather than a road;
   the career line is the heavier of the two because it is the spine. The
   intern line's casing is 1px tighter than the career line's, matching its
   1px-lighter stroke, so both show the same amount of casing each side. */
type LineLayer = 'careerLine' | 'internLine' | 'careerCasing' | 'internCasing';

function lineStyle(t: MapTheme, which: LineLayer): L.PathOptions {
  switch (which) {
    case 'careerLine': return { color: t.career, weight: t.weight };
    case 'internLine': return { color: t.intern, weight: t.weight - 1 };
    case 'careerCasing': return { color: t.casing, weight: t.weight + t.casingExtra };
    case 'internCasing': return { color: t.casing, weight: t.weight + t.casingExtra - 1 };
  }
}

function unlock(map: L.Map) {
  map.setMaxBounds(null as unknown as L.LatLngBounds);
  map.setMinZoom(responsiveFit().minZoom);
}

export default function TransitMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const refs = useRef<MapRefs | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => (typeof window === 'undefined' ? false : isMobileWidth()));
  const activeIdRef = useRef<string | null>(null);
  const contactOpenRef = useRef(false);
  const projectsOpenRef = useRef(false);
  const keyOpenRef = useRef(false);
  activeIdRef.current = activeId;
  contactOpenRef.current = contactOpen;
  projectsOpenRef.current = projectsOpen;
  keyOpenRef.current = keyOpen;

  useEffect(() => {
    const onResize = () => setIsMobile(isMobileWidth());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const select = (id: string) => {
    const r = refs.current;
    const s = STOPS.find((x) => x.id === id);
    if (!s || !r) return;
    unlock(r.map);
    r.map.removeLayer(r.lines);
    STOPS.forEach((o) => {
      if (o.id !== id) r.map.removeLayer(r.markers[o.id]);
    });
    r.map.flyTo(s.fly.center, s.fly.zoom, { duration: 1.1 });
    setActiveId(id);
  };

  const resetView = () => {
    const r = refs.current;
    if (r) {
      STOPS.forEach((o) => {
        if (!r.map.hasLayer(r.markers[o.id])) r.markers[o.id].addTo(r.map);
      });
      if (!r.map.hasLayer(r.lines)) r.lines.addTo(r.map);
      unlock(r.map);
      r.map.flyToBounds(L.latLngBounds(HOME_BOUNDS), { duration: 1.1, ...responsiveFit().fit });
      r.map.once('moveend', () => lockHome(r.map));
    }
    setActiveId(null);
  };

  useEffect(() => {
    if (!containerRef.current || refs.current) return;

    const { fit, minZoom } = responsiveFit();
    const map = L.map(containerRef.current, { zoomControl: false, zoomSnap: 0.25, minZoom, maxZoom: 17 });
    L.tileLayer(basemapUrl('light_nolabels'), {
      ...BASEMAP_OPTIONS, updateWhenZooming: false, keepBuffer: 4,
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    map.fitBounds(L.latLngBounds(HOME_BOUNDS), fit);
    /* animate:false matters. An animated fitBounds returns before the view has
       settled, so the lockHome() right after it read a mid-flight zoom for
       setMinZoom and let setMaxBounds pan the map while the zoom was still
       running -- which left the SVG overlay pane (the lines) offset from the
       marker pane (the stops) by a dozen-odd pixels until the next redraw.
       Resizing the window was enough to knock every stop off its own line. */
    map.on('resize', () => {
      if (activeIdRef.current) return;
      unlock(map);
      map.fitBounds(L.latLngBounds(HOME_BOUNDS), { ...responsiveFit().fit, animate: false });
      lockHome(map);
    });

    const careerC = route(CAREER);
    const internC = route(INTERN);
    const lines = L.layerGroup().addTo(map);
    const base = { opacity: 1, lineCap: 'round' as const, lineJoin: 'round' as const };
    const t0 = getTheme();
    const internCasing = L.polyline(internC, { ...base, ...lineStyle(t0, 'internCasing') }).addTo(lines);
    const careerCasing = L.polyline(careerC, { ...base, ...lineStyle(t0, 'careerCasing') }).addTo(lines);
    const internLine = L.polyline(internC, { ...base, ...lineStyle(t0, 'internLine') }).addTo(lines);
    const careerLine = L.polyline(careerC, { ...base, ...lineStyle(t0, 'careerLine') }).addTo(lines);

    const markers: Record<string, L.Marker> = {};
    STOPS.forEach((s) => {
      const isX = s.kind === 'interchange';
      /* Custom properties rather than the hex values behind them: everything
         CSS draws then follows a retheme on its own, and only the polylines
         below need restyling by hand. */
      const ring = isX ? 'var(--cofc-ring)' : s.line === 'intern' ? 'var(--line-intern)' : 'var(--line-main)';
      /* The interchange's box is SMALLER than a terminus's, not larger. What
         makes it the biggest stop on the map is everything drawn outside it --
         the gold band and its hairline add their width twice over, so growing
         the box as well put the badge at 51px against a terminus's 27px and it
         swamped the map. Shrinking the box buys that back and lets the gold
         band stay wide, which is the part that has to read. */
      const size = isX ? 25 : s.kind === 'minor' ? 15 : 27;
      const bw = isX ? 6 : s.kind === 'minor' ? 4 : 7;
      /* Widths come through custom properties too, not just colours, so the
         editor's halo slider retints and resizes the badge without the markers
         being torn down and rebuilt. calc() gives the outer hairline its
         offset from the same variable. */
      const shadow = isX
        ? 'box-shadow:0 0 0 var(--cofc-halo-w) var(--cofc-halo),'
          + '0 0 0 calc(var(--cofc-halo-w) + 1.5px) var(--cofc-edge),'
          + '0 1px 5px rgba(32,30,29,.35);background:var(--stop-core);'
        : '';
      const html = `<div class="stop${s.current ? ' current' : ''}" role="button" tabindex="0" aria-label="${s.name}" style="width:${size}px;height:${size}px;border:${bw}px solid ${ring};${shadow}"></div>`;
      const marker = L.marker(s.at, {
        icon: L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] }),
        keyboard: true, riseOnHover: true, zIndexOffset: s.current ? 500 : s.kind === 'minor' ? 200 : 300,
      }).addTo(map);
      const body = s.kind === 'minor'
        ? `<div class="sl-name">${s.name}</div>`
        : `<div class="sl-name">${s.name}</div><div class="sl-dates">${s.dates}</div><div class="sl-place">${s.place}</div>`;
      const auto: [number, number] = s.dir === 'left' ? [-size / 2 - 6, 0] : s.dir === 'right' ? [size / 2 + 6, 0]
        : s.dir === 'top' ? [0, -size / 2 - 6] : [0, size / 2 + 6];
      marker.bindTooltip(body, {
        permanent: true, direction: s.dir, opacity: 1,
        className: `stop-label ${s.line}${s.kind === 'minor' ? ' minor' : ''}`,
        offset: s.off || auto,
      });
      marker.on('click', () => select(s.id));
      marker.on('keypress', (e) => {
        const ke = (e as L.LeafletKeyboardEvent).originalEvent;
        if (ke.key === 'Enter' || ke.key === ' ') select(s.id);
      });
      markers[s.id] = marker;
    });

    refs.current = { map, lines, careerCasing, internCasing, careerLine, internLine, markers };
    lockHome(map);

    /* Leaflet writes polyline colour into an SVG stroke attribute when the
       layer is created, so unlike everything else on this map the lines do
       not follow a custom-property change. Restyle them by hand when the
       theme editor publishes one. In production this never fires. */
    const unsubTheme = subscribeTheme((t) => {
      careerCasing.setStyle(lineStyle(t, 'careerCasing'));
      internCasing.setStyle(lineStyle(t, 'internCasing'));
      careerLine.setStyle(lineStyle(t, 'careerLine'));
      internLine.setStyle(lineStyle(t, 'internLine'));
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (contactOpenRef.current) setContactOpen(false);
      else if (projectsOpenRef.current) setProjectsOpen(false);
      else if (keyOpenRef.current) setKeyOpen(false);
      else if (activeIdRef.current) resetView();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      unsubTheme();
      map.remove();
      refs.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active: Stop | undefined = STOPS.find((x) => x.id === activeId);
  const swallow = (e: React.MouseEvent) => e.stopPropagation();

  /* Phone replacement for the permanent map labels: the stations in journey
     order, as wrapped pills. Colour-coded by line so the strip still explains
     which branch a stop belongs to, and the active one inverts. */
  const stationStrip = (
    <div className="station-strip" role="group" aria-label="Stations">
      {[...STOPS].sort((a, b) => a.seq - b.seq).map((s) => {
        const on = s.id === activeId;
        const tint = s.kind === 'interchange' ? 'var(--cofc-ring)' : s.line === 'intern' ? 'var(--line-intern)' : 'var(--line-main)';
        return (
          <button
            key={s.id}
            className="station-pill"
            aria-pressed={on}
            onClick={() => (on ? resetView() : select(s.id))}
          >
            <span className="pip" style={{ color: on ? '#fff' : tint }} />
            {s.short}
          </button>
        );
      })}
    </div>
  );

  const legendRows = (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: '400 12px var(--font-body)', color: 'var(--color-neutral-800)' }}>
          <span style={{ width: 22, height: 5, borderRadius: 999, flex: '0 0 auto', background: 'var(--line-main)' }} />
          Career line
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: '400 12px var(--font-body)', color: 'var(--color-neutral-800)' }}>
          <span style={{ width: 22, height: 5, borderRadius: 999, flex: '0 0 auto', background: 'var(--line-intern)' }} />
          Internship line
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: '400 12px var(--font-body)', color: 'var(--color-neutral-800)' }}>
          <span style={{ width: 12, height: 12, borderRadius: 999, flex: '0 0 auto', boxSizing: 'border-box', background: 'var(--stop-core)', border: '3px solid var(--cofc-ring)', boxShadow: '0 0 0 2.5px var(--cofc-halo), 0 0 0 3.5px var(--cofc-edge)' }} />
          Interchange (CofC)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: '400 12px var(--font-body)', color: 'var(--color-neutral-800)' }}>
          <span style={{ width: 11, height: 11, borderRadius: 999, flex: '0 0 auto', background: 'var(--line-main)', boxShadow: '0 0 0 3px var(--color-accent-200)' }} />
          You are here
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--color-neutral-300)', margin: '10px 0 8px' }} />
      <div style={{ font: '500 11px/1.4 var(--font-body)', color: 'var(--color-neutral-600)', maxWidth: 152 }}>
        Tap a stop to fly the map to that part of the Lowcountry.
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 'var(--map-inset-right, 0px)', background: 'var(--color-bg)' }}>
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

        <div
          style={{
            position: 'absolute', top: 10, left: 10, right: 10, zIndex: 600, padding: '9px 13px 10px',
            background: 'var(--color-neutral-100)', border: '1px solid var(--color-neutral-300)',
            borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 4,
              background: 'linear-gradient(90deg,var(--line-main) 0 60%,var(--line-intern) 60% 100%)',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <h1 style={{ font: '400 18px/1.1 var(--font-heading)', margin: 0 }}>Thomas Griffin</h1>
            <span style={{ font: '600 11px var(--font-body)', color: 'var(--color-accent-700)' }}>Software Engineer</span>
          </div>
        </div>

        {keyOpen && (
          <div
            onClick={() => setKeyOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              background: 'color-mix(in srgb, var(--color-neutral-900) 16%, transparent)',
            }}
          >
            <div
              onClick={swallow}
              style={{
                width: '100%', position: 'relative', background: 'var(--color-neutral-100)',
                borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', boxShadow: 'var(--shadow-lg)',
                padding: '22px 22px 28px', animation: 'card-in .18s ease-out',
              }}
            >
              <div style={{ font: '600 9.5px/1 var(--font-body)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-neutral-600)', marginBottom: 12 }}>
                Map Key
              </div>
              {legendRows}
            </div>
          </div>
        )}

        {active && (
          <div
            style={{
              position: 'absolute', left: '50%', top: 78, transform: 'translateX(-50%)', zIndex: 900,
              display: 'flex', alignItems: 'center', gap: 10, background: 'var(--color-neutral-100)',
              border: '1px solid var(--color-neutral-300)', borderRadius: 999, padding: '7px 7px 7px 15px',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <span style={{ font: '400 14px var(--font-heading)', color: 'var(--color-neutral-900)', whiteSpace: 'nowrap' }}>
              {active.fly.label}
            </span>
            <button
              onClick={resetView}
              aria-label="Back to the full coast"
              style={{
                border: 'none', background: 'var(--color-neutral-200)', cursor: 'pointer', width: 28, height: 28,
                borderRadius: 999, display: 'grid', placeItems: 'center', fontSize: 14, color: 'var(--color-neutral-700)',
              }}
            >
              &times;
            </button>
          </div>
        )}

        <div
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 14, zIndex: 600,
            display: 'flex', flexDirection: 'column', gap: 9,
          }}
        >
          {stationStrip}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, padding: '0 14px' }}>
            <button
              onClick={() => setKeyOpen(true)}
              aria-label="Show map key"
              style={{
                font: '600 12px var(--font-body)', color: 'var(--color-neutral-800)', background: 'var(--color-neutral-100)',
                border: '1px solid var(--color-neutral-300)', borderRadius: 999, padding: '10px 15px', cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)', whiteSpace: 'nowrap',
              }}
            >
              Map Key
            </button>
            <button
              onClick={() => setProjectsOpen(true)}
              style={{
                font: '600 12px var(--font-body)', color: 'var(--color-neutral-800)', background: 'var(--color-neutral-200)',
                border: 'none', borderRadius: 999, padding: '10px 15px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
                whiteSpace: 'nowrap',
              }}
            >
              Projects
            </button>
            <button
              onClick={() => setContactOpen(true)}
              style={{
                font: '600 12px var(--font-body)', color: 'var(--color-bg)', background: 'var(--line-main)',
                border: 'none', borderRadius: 999, padding: '10px 15px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
                whiteSpace: 'nowrap',
              }}
            >
              Contact &rarr;
            </button>
          </div>
        </div>

        {active && (
          <div
            onClick={resetView}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              background: 'color-mix(in srgb, var(--color-neutral-900) 16%, transparent)',
            }}
          >
            <div
              onClick={swallow}
              style={{
                width: '100%', maxHeight: '78vh', overflow: 'auto', position: 'relative',
                background: 'var(--color-neutral-100)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
                boxShadow: 'var(--shadow-lg)', padding: '22px 22px 30px', animation: 'card-in .18s ease-out',
              }}
            >
              <button
                onClick={resetView}
                aria-label="Close"
                style={{
                  position: 'absolute', top: 14, right: 14, border: 'none', background: 'var(--color-neutral-200)',
                  cursor: 'pointer', width: 30, height: 30, borderRadius: 999, display: 'grid', placeItems: 'center',
                  fontSize: 15, color: 'var(--color-neutral-700)',
                }}
              >
                &times;
              </button>
              <div style={{ font: '600 9.5px/1 var(--font-body)', letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>
                {active.kicker}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, rowGap: 6, flexWrap: 'wrap', margin: '8px 0 0', paddingRight: 26 }}>
                <h3 style={{ font: '400 21px/1.25 var(--font-heading)', margin: 0 }}>{active.name}</h3>
                {active.current && (
                  <span
                    style={{
                      font: '600 9.5px var(--font-body)', letterSpacing: '.08em', textTransform: 'uppercase',
                      color: 'var(--color-bg)', background: 'var(--line-main)', borderRadius: 999, padding: '3px 9px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    You are here
                  </span>
                )}
              </div>
              <div style={{ font: '600 15px var(--font-body)', color: 'var(--color-accent-700)', margin: '10px 0 3px' }}>{active.dates}</div>
              <div style={{ font: '400 13.5px var(--font-body)', color: 'var(--color-neutral-700)', marginBottom: 14 }}>
                {active.role} · {active.place}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {active.tags.map((t) => (
                  <span key={t} style={{ font: '500 11px var(--font-body)', padding: '3px 10px', borderRadius: 999, background: TAGS[t].bg, color: TAGS[t].fg }}>
                    {TAGS[t].label}
                  </span>
                ))}
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--color-neutral-800)', font: '400 14px/1.6 var(--font-body)' }}>
                {active.highlights.map((h, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>{h}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {contactOpen && (
          <div
            onClick={() => setContactOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'color-mix(in srgb, var(--color-neutral-900) 16%, transparent)',
            }}
          >
            <div
              onClick={swallow}
              style={{
                width: 'min(430px, 90vw)', position: 'relative', background: 'var(--color-neutral-100)',
                borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: '24px 22px',
                animation: 'card-in .18s ease-out',
              }}
            >
              <button
                onClick={() => setContactOpen(false)}
                aria-label="Close"
                style={{
                  position: 'absolute', top: 14, right: 14, border: 'none', background: 'var(--color-neutral-200)',
                  cursor: 'pointer', width: 30, height: 30, borderRadius: 999, display: 'grid', placeItems: 'center',
                  fontSize: 15, color: 'var(--color-neutral-700)',
                }}
              >
                &times;
              </button>
              <div style={{ font: '600 9.5px/1 var(--font-body)', letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>
                Next Stop
              </div>
              <h2 style={{ font: '400 24px var(--font-heading)', margin: '8px 0 16px' }}>Contact</h2>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <a href="#" style={{ font: '600 12px var(--font-body)', color: 'var(--color-bg)', background: 'var(--line-main)', borderRadius: 999, padding: '10px 17px' }}>
                  Resume
                </a>
                <a href="mailto:ltgriffin01@gmail.com" style={{ font: '600 12px var(--font-body)', color: 'var(--color-neutral-800)', background: 'var(--color-neutral-200)', borderRadius: 999, padding: '10px 17px' }}>
                  Email
                </a>
                <a href="#" style={{ font: '600 12px var(--font-body)', color: 'var(--color-neutral-800)', background: 'var(--color-neutral-200)', borderRadius: 999, padding: '10px 17px' }}>
                  LinkedIn
                </a>
                <a href="#" style={{ font: '600 12px var(--font-body)', color: 'var(--color-neutral-800)', background: 'var(--color-neutral-200)', borderRadius: 999, padding: '10px 17px' }}>
                  GitHub
                </a>
              </div>
            </div>
          </div>
        )}

        {projectsOpen && (
          <div
            onClick={() => setProjectsOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'color-mix(in srgb, var(--color-neutral-900) 16%, transparent)',
            }}
          >
            <div
              onClick={swallow}
              style={{
                width: 'min(480px, 90vw)', maxHeight: '80vh', overflow: 'auto', position: 'relative',
                background: 'var(--color-neutral-100)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
                padding: '24px 22px', animation: 'card-in .18s ease-out',
              }}
            >
              <button
                onClick={() => setProjectsOpen(false)}
                aria-label="Close"
                style={{
                  position: 'absolute', top: 14, right: 14, border: 'none', background: 'var(--color-neutral-200)',
                  cursor: 'pointer', width: 30, height: 30, borderRadius: 999, display: 'grid', placeItems: 'center',
                  fontSize: 15, color: 'var(--color-neutral-700)',
                }}
              >
                &times;
              </button>
              <div style={{ font: '600 9.5px/1 var(--font-body)', letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>
                Next Stop
              </div>
              <h2 style={{ font: '400 24px var(--font-heading)', margin: '8px 0 18px' }}>Side Projects</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {PROJECTS.map((p) => (
                  <div key={p.id} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
                    <h3 style={{ font: '400 17px var(--font-heading)', margin: '0 0 6px' }}>{p.name}</h3>
                    <p style={{ font: '400 13.5px/1.5 var(--font-body)', color: 'var(--color-neutral-700)', margin: '0 0 10px' }}>
                      {p.description}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {p.tags.map((t) => (
                        <span key={t} style={{ font: '500 11px var(--font-body)', padding: '3px 10px', borderRadius: 999, background: TAGS[t].bg, color: TAGS[t].fg }}>
                          {TAGS[t].label}
                        </span>
                      ))}
                      {p.url && (
                        <a href={p.url} style={{ font: '600 11px var(--font-body)', color: 'var(--color-accent-700)', marginLeft: 'auto' }}>
                          View &rarr;
                        </a>
                      )}
                      {!p.url && p.repoUrl && (
                        <a href={p.repoUrl} style={{ font: '600 11px var(--font-body)', color: 'var(--color-accent-700)', marginLeft: 'auto' }}>
                          Repo &rarr;
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 'var(--map-inset-right, 0px)', background: 'var(--color-bg)' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      <div
        style={{
          position: 'absolute', top: 24, right: 24, zIndex: 600, maxWidth: 300, padding: '16px 18px',
          background: 'var(--color-neutral-100)', border: '1px solid var(--color-neutral-300)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 5,
            background: 'linear-gradient(90deg,var(--line-main) 0 60%,var(--line-intern) 60% 100%)',
          }}
        />
        <div style={{ font: '600 9.5px/1 var(--font-body)', letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>
          Lowcountry Transit Authority
        </div>
        <h1 style={{ font: '400 26px/1.1 var(--font-heading)', margin: '8px 0 5px' }}>Thomas Griffin</h1>
        <div style={{ font: '600 13px/1.3 var(--font-body)', color: 'var(--color-accent-700)', marginBottom: 6 }}>Software Engineer</div>
        <p style={{ font: '400 12px/1.45 var(--font-body)', color: 'var(--color-neutral-700)', margin: 0, textWrap: 'pretty' as const }}>
          Two lines across the real Lowcountry, interchanging at the College of Charleston.
        </p>
      </div>

      <div
        style={{
          position: 'absolute', bottom: 24, left: 24, zIndex: 600, padding: '12px 15px',
          background: 'var(--color-neutral-100)', border: '1px solid var(--color-neutral-300)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ font: '600 9.5px/1 var(--font-body)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-neutral-600)', marginBottom: 9 }}>
          Map Key
        </div>
        {legendRows}
      </div>

      {active && (
        <div
          style={{
            position: 'absolute', left: '50%', top: 22, transform: 'translateX(-50%)', zIndex: 900,
            display: 'flex', alignItems: 'center', gap: 10, background: 'var(--color-neutral-100)',
            border: '1px solid var(--color-neutral-300)', borderRadius: 999, padding: '7px 7px 7px 15px',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <span style={{ font: '600 9.5px/1 var(--font-body)', letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>
            Zoomed to
          </span>
          <span style={{ font: '400 15px var(--font-heading)', color: 'var(--color-neutral-900)', whiteSpace: 'nowrap' }}>
            {active.fly.label}
          </span>
          <button
            onClick={resetView}
            aria-label="Back to the full coast"
            style={{
              border: 'none', background: 'var(--color-neutral-200)', cursor: 'pointer', width: 30, height: 30,
              borderRadius: 999, display: 'grid', placeItems: 'center', fontSize: 15, color: 'var(--color-neutral-700)',
            }}
          >
            &times;
          </button>
        </div>
      )}

      <div
        style={{
          position: 'absolute', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 600,
          display: 'flex', gap: 10,
        }}
      >
        <button
          onClick={() => setProjectsOpen(true)}
          style={{
            font: '600 12px var(--font-body)', color: 'var(--color-neutral-800)', background: 'var(--color-neutral-200)',
            border: 'none', borderRadius: 999, padding: '10px 17px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
          }}
        >
          Side Projects
        </button>
        <button
          onClick={() => setContactOpen(true)}
          style={{
            font: '600 12px var(--font-body)', color: 'var(--color-bg)', background: 'var(--line-main)',
            border: 'none', borderRadius: 999, padding: '10px 17px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
          }}
        >
          Next Stop: Contact &rarr;
        </button>
      </div>

      {active && (
        <div
          onClick={resetView}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center',
            justifyContent: 'flex-end', paddingRight: 'min(6vw, 72px)',
            background: 'color-mix(in srgb, var(--color-neutral-900) 16%, transparent)',
          }}
        >
          <div
            onClick={swallow}
            style={{
              width: 'min(450px, 86vw)', maxHeight: '76vh', overflow: 'auto', position: 'relative',
              background: 'var(--color-neutral-100)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
              padding: '26px 28px', animation: 'card-in .18s ease-out',
            }}
          >
            <button
              onClick={resetView}
              aria-label="Close"
              style={{
                position: 'absolute', top: 16, right: 16, border: 'none', background: 'var(--color-neutral-200)',
                cursor: 'pointer', width: 30, height: 30, borderRadius: 999, display: 'grid', placeItems: 'center',
                fontSize: 15, color: 'var(--color-neutral-700)',
              }}
            >
              &times;
            </button>
            <div style={{ font: '600 9.5px/1 var(--font-body)', letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>
              {active.kicker}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, rowGap: 6, flexWrap: 'wrap', margin: '8px 0 0', paddingRight: 26 }}>
              <h3 style={{ font: '400 23px/1.25 var(--font-heading)', margin: 0 }}>{active.name}</h3>
              {active.current && (
                <span
                  style={{
                    font: '600 9.5px var(--font-body)', letterSpacing: '.08em', textTransform: 'uppercase',
                    color: 'var(--color-bg)', background: 'var(--line-main)', borderRadius: 999, padding: '3px 9px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  You are here
                </span>
              )}
            </div>
            <div style={{ font: '600 15px var(--font-body)', color: 'var(--color-accent-700)', margin: '10px 0 3px' }}>{active.dates}</div>
            <div style={{ font: '400 13.5px var(--font-body)', color: 'var(--color-neutral-700)', marginBottom: 14 }}>
              {active.role} · {active.place}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {active.tags.map((t) => (
                <span key={t} style={{ font: '500 11px var(--font-body)', padding: '3px 10px', borderRadius: 999, background: TAGS[t].bg, color: TAGS[t].fg }}>
                  {TAGS[t].label}
                </span>
              ))}
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--color-neutral-800)', font: '400 14px/1.6 var(--font-body)' }}>
              {active.highlights.map((h, i) => (
                <li key={i} style={{ marginBottom: 6 }}>{h}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {contactOpen && (
        <div
          onClick={() => setContactOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'color-mix(in srgb, var(--color-neutral-900) 16%, transparent)',
          }}
        >
          <div
            onClick={swallow}
            style={{
              width: 'min(430px, 86vw)', position: 'relative', background: 'var(--color-neutral-100)',
              borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: '26px 28px',
              animation: 'card-in .18s ease-out',
            }}
          >
            <button
              onClick={() => setContactOpen(false)}
              aria-label="Close"
              style={{
                position: 'absolute', top: 16, right: 16, border: 'none', background: 'var(--color-neutral-200)',
                cursor: 'pointer', width: 30, height: 30, borderRadius: 999, display: 'grid', placeItems: 'center',
                fontSize: 15, color: 'var(--color-neutral-700)',
              }}
            >
              &times;
            </button>
            <div style={{ font: '600 9.5px/1 var(--font-body)', letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>
              Next Stop
            </div>
            <h2 style={{ font: '400 26px var(--font-heading)', margin: '8px 0 16px' }}>Contact</h2>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a href="#" style={{ font: '600 12px var(--font-body)', color: 'var(--color-bg)', background: 'var(--line-main)', borderRadius: 999, padding: '10px 17px' }}>
                Resume
              </a>
              <a href="mailto:ltgriffin01@gmail.com" style={{ font: '600 12px var(--font-body)', color: 'var(--color-neutral-800)', background: 'var(--color-neutral-200)', borderRadius: 999, padding: '10px 17px' }}>
                Email
              </a>
              <a href="#" style={{ font: '600 12px var(--font-body)', color: 'var(--color-neutral-800)', background: 'var(--color-neutral-200)', borderRadius: 999, padding: '10px 17px' }}>
                LinkedIn
              </a>
              <a href="#" style={{ font: '600 12px var(--font-body)', color: 'var(--color-neutral-800)', background: 'var(--color-neutral-200)', borderRadius: 999, padding: '10px 17px' }}>
                GitHub
              </a>
            </div>
          </div>
        </div>
      )}

      {projectsOpen && (
        <div
          onClick={() => setProjectsOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'color-mix(in srgb, var(--color-neutral-900) 16%, transparent)',
          }}
        >
          <div
            onClick={swallow}
            style={{
              width: 'min(480px, 86vw)', maxHeight: '76vh', overflow: 'auto', position: 'relative',
              background: 'var(--color-neutral-100)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
              padding: '26px 28px', animation: 'card-in .18s ease-out',
            }}
          >
            <button
              onClick={() => setProjectsOpen(false)}
              aria-label="Close"
              style={{
                position: 'absolute', top: 16, right: 16, border: 'none', background: 'var(--color-neutral-200)',
                cursor: 'pointer', width: 30, height: 30, borderRadius: 999, display: 'grid', placeItems: 'center',
                fontSize: 15, color: 'var(--color-neutral-700)',
              }}
            >
              &times;
            </button>
            <div style={{ font: '600 9.5px/1 var(--font-body)', letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>
              Next Stop
            </div>
            <h2 style={{ font: '400 26px var(--font-heading)', margin: '8px 0 18px' }}>Side Projects</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {PROJECTS.map((p) => (
                <div
                  key={p.id}
                  style={{
                    background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', padding: '16px 18px',
                  }}
                >
                  <h3 style={{ font: '400 18px var(--font-heading)', margin: '0 0 6px' }}>{p.name}</h3>
                  <p style={{ font: '400 13.5px/1.5 var(--font-body)', color: 'var(--color-neutral-700)', margin: '0 0 10px' }}>
                    {p.description}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {p.tags.map((t) => (
                      <span key={t} style={{ font: '500 11px var(--font-body)', padding: '3px 10px', borderRadius: 999, background: TAGS[t].bg, color: TAGS[t].fg }}>
                        {TAGS[t].label}
                      </span>
                    ))}
                    {p.url && (
                      <a href={p.url} style={{ font: '600 11px var(--font-body)', color: 'var(--color-accent-700)', marginLeft: 'auto' }}>
                        View &rarr;
                      </a>
                    )}
                    {!p.url && p.repoUrl && (
                      <a href={p.repoUrl} style={{ font: '600 11px var(--font-body)', color: 'var(--color-accent-700)', marginLeft: 'auto' }}>
                        Repo &rarr;
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
