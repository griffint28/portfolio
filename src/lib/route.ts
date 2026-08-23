/* Octolinear routing. Control points are authored as true 0°/45°/90° runs in a
   screen-square space (Y scaled by cos(lat) so a 45° leg really looks 45°), then
   every non-station corner is replaced by a fixed-radius arc — straight lines,
   defined corners, stations exactly on the line. A third element marks a station:
   those vertices are never moved or rounded. */
const KLAT = Math.cos((32.85 * Math.PI) / 180);
const toXY = (p: [number, number, number?]): [number, number] => [p[1], p[0] / KLAT];
const toLL = (q: [number, number]): [number, number] => [q[1] * KLAT, q[0]];
const CORNER_R = 0.02;

export function route(pts: Array<[number, number, number?]>, R = CORNER_R): Array<[number, number]> {
  const P = pts.map(toXY);
  const len = (a: [number, number], b: [number, number]) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const unit = (a: [number, number], b: [number, number]): [number, number] => {
    const d = len(a, b) || 1;
    return [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
  };
  const out: Array<[number, number]> = [P[0]];
  for (let i = 1; i < P.length - 1; i++) {
    if (pts[i][2]) {
      out.push(P[i]);
      continue;
    }
    const v = P[i];
    const din = unit(P[i - 1], v);
    const dout = unit(v, P[i + 1]);
    const r = Math.min(R, len(P[i - 1], v) * 0.5, len(v, P[i + 1]) * 0.5);
    const a: [number, number] = [v[0] - din[0] * r, v[1] - din[1] * r];
    const b: [number, number] = [v[0] + dout[0] * r, v[1] + dout[1] * r];
    out.push(a);
    for (let s = 1; s < 12; s++) {
      const t = s / 12;
      const u = 1 - t;
      out.push([u * u * a[0] + 2 * u * t * v[0] + t * t * b[0], u * u * a[1] + 2 * u * t * v[1] + t * t * b[1]]);
    }
    out.push(b);
  }
  out.push(P[P.length - 1]);
  return out.map(toLL);
}
