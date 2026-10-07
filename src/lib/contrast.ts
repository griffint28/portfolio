/* Contrast maths for the theme editor.

   The hard part is that nothing on this map is drawn against a colour you can
   read out of the palette. The lines, the casing, the station dots and the
   label chips all sit on *basemap tiles put through the ramp* in theme.ts, so
   what they are really competing with is whatever that ramp turns CARTO's land
   into -- which changes the moment you drag a stop. landTone() answers that. */

import { basemapColorAt, type Basemap } from './theme';

export type RGB = [number, number, number];

/* The colours CARTO's light_nolabels tiles are actually made of, counted off a
   z11 tile over Charleston (harbour and peninsula, so a representative mix).
   47 palette entries in all; these are the ones with enough coverage to matter,
   and together they are 79% of the pixels.

   `lum` is the weighted-sRGB luminance feColorMatrix type="saturate" values="0"
   produces -- NOT the WCAG relative luminance below, which linearises first.
   The ramp is indexed by the former, so that is what has to be stored here. */
export interface BasemapFeature {
  key: string;
  label: string;
  source: string;
  lum: number;
  share: number;
}

export const BASEMAP_FEATURES: BasemapFeature[] = [
  { key: 'water', label: 'Water', source: '#d4dadc', lum: 0.8505, share: 35.5 },
  { key: 'parks', label: 'Parks', source: '#eff3ef', lum: 0.9485, share: 0.9 },
  { key: 'land', label: 'Land', source: '#fafaf8', lum: 0.9798, share: 40.1 },
  { key: 'roads', label: 'Roads', source: '#ffffff', lum: 1.0, share: 2.5 },
];

export const LAND = BASEMAP_FEATURES.find((f) => f.key === 'land')!;

/* What the land actually looks like once the ramp has had its way -- the real
   background for every contrast check on this map. */
export function landTone(b: Basemap): string {
  return basemapColorAt(b, LAND.lum);
}

/* The editor lets you type into the hex field, so values arrive mid-keystroke
   ("#9e4" on the way to "#9e4714"). Callers check before scoring rather than
   rendering a NaN ratio at you while you type. */
export function isHex(v: string): boolean {
  return /^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());
}

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as RGB;
}

function channel(v: number) {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/* WCAG relative luminance -- linearised, unlike BasemapFeature.lum. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* How far a colour sits from grey, 0..1. Worth having alongside the contrast
   ratios because some pairs on this map cannot be separated by lightness at
   all -- gold on sand is the standing example -- and are separated by
   saturation instead. A ratio of 1.3:1 looks alarming until you see that the
   two colours differ by 0.4 of chroma, at which point they read as obviously
   different things. */
export function chroma(hex: string): number {
  const c = hexToRgb(hex);
  return (Math.max(...c) - Math.min(...c)) / 255;
}

/* 3:1 is WCAG 1.4.11 Non-text Contrast -- the right bar for graphics like
   these, rather than the 4.5:1 that applies to body text. */
export const AA_GRAPHIC = 3;

/* The darkest a colour can be and still clear `ratio` against `bg`, as a WCAG
   luminance. Negative means no colour is dark enough -- which is the answer
   for a white casing on a pale basemap, and worth saying out loud rather than
   leaving someone to drag a slider that was never going to get there. */
export function maxLuminanceFor(bg: string, ratio = AA_GRAPHIC): number {
  return (luminance(bg) + 0.05) / ratio - 0.05;
}
