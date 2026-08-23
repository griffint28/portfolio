import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { STOPS, CAREER, INTERN, HOME_BOUNDS, COFC, FIT, THEME, TAGS, type Stop } from '../data/stops';
import { route } from '../lib/route';
import { PROJECTS } from '../data/projects';

interface MapRefs {
  map: L.Map;
  lines: L.LayerGroup;
  careerCasing: L.Polyline;
  internCasing: L.Polyline;
  careerLine: L.Polyline;
  internLine: L.Polyline;
  markers: Record<string, L.Marker>;
}

/* Hard floor: no window shape may zoom out past this, no matter what fitBounds
   computes for a given aspect ratio (very tall/narrow windows can otherwise
   compute a much lower zoom, re-exposing the off-screen line runoff below). */
const HOME_MIN_ZOOM = 10;

function lockHome(map: L.Map) {
  map.setMinZoom(map.getZoom());
  map.setMaxBounds(L.latLngBounds(HOME_BOUNDS).pad(0.06));
}

function unlock(map: L.Map) {
  map.setMaxBounds(null as unknown as L.LatLngBounds);
  map.setMinZoom(HOME_MIN_ZOOM);
}

export default function TransitMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const refs = useRef<MapRefs | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const activeIdRef = useRef<string | null>(null);
  const contactOpenRef = useRef(false);
  const projectsOpenRef = useRef(false);
  activeIdRef.current = activeId;
  contactOpenRef.current = contactOpen;
  projectsOpenRef.current = projectsOpen;

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
      r.map.flyToBounds(L.latLngBounds(HOME_BOUNDS), { duration: 1.1, ...FIT });
      r.map.once('moveend', () => lockHome(r.map));
    }
    setActiveId(null);
  };

  useEffect(() => {
    if (!containerRef.current || refs.current) return;

    const map = L.map(containerRef.current, { zoomControl: false, zoomSnap: 0.25, minZoom: HOME_MIN_ZOOM, maxZoom: 17 });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', attribution: '© OpenStreetMap contributors © CARTO', maxZoom: 19, detectRetina: true,
      updateWhenZooming: false, keepBuffer: 4,
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    map.fitBounds(L.latLngBounds(HOME_BOUNDS), FIT);
    map.on('resize', () => {
      if (!activeIdRef.current) {
        unlock(map);
        map.fitBounds(L.latLngBounds(HOME_BOUNDS), FIT);
        lockHome(map);
      }
    });

    const careerC = route(CAREER);
    const internC = route(INTERN);
    const lines = L.layerGroup().addTo(map);
    const base = { opacity: 1, lineCap: 'round' as const, lineJoin: 'round' as const };
    const internCasing = L.polyline(internC, { ...base, color: '#f9f4ed', weight: THEME.weight + 5 }).addTo(lines);
    const careerCasing = L.polyline(careerC, { ...base, color: '#f9f4ed', weight: THEME.weight + 6 }).addTo(lines);
    const internLine = L.polyline(internC, { ...base, color: THEME.intern, weight: THEME.weight - 1 }).addTo(lines);
    const careerLine = L.polyline(careerC, { ...base, color: THEME.career, weight: THEME.weight }).addTo(lines);

    const markers: Record<string, L.Marker> = {};
    STOPS.forEach((s) => {
      const isX = s.kind === 'interchange';
      const ring = isX ? COFC.maroon : s.line === 'intern' ? THEME.intern : THEME.career;
      const size = isX ? 32 : s.kind === 'minor' ? 15 : 27;
      const bw = isX ? 8 : s.kind === 'minor' ? 4 : 7;
      const shadow = isX ? `box-shadow:0 0 0 4px ${COFC.gold},0 1px 4px rgba(32,30,29,.3);background:#fff;` : '';
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

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (contactOpenRef.current) setContactOpen(false);
      else if (projectsOpenRef.current) setProjectsOpen(false);
      else if (activeIdRef.current) resetView();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      map.remove();
      refs.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active: Stop | undefined = STOPS.find((x) => x.id === activeId);
  const swallow = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--color-bg)' }}>
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
            <span style={{ width: 12, height: 12, borderRadius: 999, flex: '0 0 auto', boxSizing: 'border-box', background: '#fff', border: '3px solid #660000', boxShadow: '0 0 0 2px #bfa87c' }} />
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
