// STEP 9.2 / J1: STACK (4 level) ramp centrelines + vertical profile + clearance check. Pure math, local frame (u along road A, v = left of u, LEFT-hand traffic).
// Road A stays on the ground (level 1). Road B is level 4 (20.7 m) over the crossing and falls to the ground at 4 %. 8 ramps = 2 shapes (left slip, right flyover) x 4 rotations.
import { DEG, Turtle, minRadius as pathMinR, pathLength, resample, rot90, crossings, type P2 } from '../Geometry2D';
import { DESIGN } from '../../roads/standards/Criteria';
import { minRadius } from '../../roads/standards/Checks';
import { LEVEL_RISE } from './M8Designs';

export const LANE_OFF = 12; // centre of a carriageway from the road axis (outer lane), m
export const B_TOP = 3 * LEVEL_RISE; // road B over the crossing
export const B_FLAT = 110; // road B stays at full height this far each side of the centre (the ramps pass under it)
export const yB = (v: number): number => Math.max(0, B_TOP - DESIGN.maxGrade.motorway * Math.max(0, Math.abs(v) - B_FLAT));

export interface StackRamp {
  id: string;
  shape: 'left' | 'right';
  k: number;
  V: number;
  pts: P2[];
  ys: number[];
  cum: number[];
  length: number;
  source: 'A' | 'B';
  target: 'A' | 'B';
}

const roadY = (road: 'A' | 'B', p: P2): number => (road === 'A' ? 0 : yB(Math.abs(road === 'B' ? p.v : p.u)));

export function buildStack(P = { Rleft: 175, Rright: 175, run: 100, tail: 300, plateauRight: 2 * LEVEL_RISE }): StackRamp[] {
  const out: StackRamp[] = [];
  for (let k = 0; k < 4; k++) {
    for (const shape of ['left', 'right'] as const) {
      const R = shape === 'left' ? P.Rleft : P.Rright;
      const V = 60;
      // k = 0: starts on A going +u. left: leaves the OUTER side (v = +21) and turns left into B+ (u = -21, going +v). right: leaves the MEDIAN side (v = +6) and turns right into B- (u = +12, going -v).
      const endU = shape === 'left' ? -21 : LANE_OFF;
      const startV = shape === 'left' ? 21 : 6;
      const sign = shape === 'left' ? 1 : -1;
      const startU = endU - P.run - R; // a quarter arc moves u by +R for a left AND a right turn
      const t = new Turtle(startU - 0, startV, 0).straight(P.run).arc(R, sign * 90 * DEG).straight(P.tail);
      const base = resample(t.pts, 8);
      const pts = base.map((p) => rot90(p, k));
      const L = pathLength(pts);
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].u - pts[i - 1].u, pts[i].v - pts[i - 1].v));
      const source: 'A' | 'B' = k % 2 === 0 ? 'A' : 'B';
      const target: 'A' | 'B' = source === 'A' ? 'B' : 'A';
      const y0 = roadY(source, pts[0]);
      const y1 = roadY(target, pts[pts.length - 1]);
      const g = DESIGN.maxGrade.ramp;
      // the two right-turn families run on different levels so they can cross each other: A -> B on level 2, B -> A on level 3
      const yp = shape === 'right' ? (source === 'A' ? LEVEL_RISE : P.plateauRight) : undefined;
      const ys = cum.map((s) => {
        const up = Math.min(y0 + g * s, y1 + g * (L - s));
        const lo = Math.max(y0 - g * s, y1 - g * (L - s));
        const lin = y0 + ((y1 - y0) * s) / L;
        return yp === undefined ? lin : Math.max(lo, Math.min(up, yp));
      });
      out.push({ id: `${shape[0].toUpperCase()}${k}`, shape, k, V, pts, ys, cum, length: L, source, target });
    }
  }
  return out;
}

export interface Conflict { a: string; b: string; u: number; v: number; ya: number; yb: number; gap: number }

/** Linear interpolation of an array at a FRACTIONAL index (crossings() returns fractional indices). */
const lerpAt = (a: readonly number[], f: number): number => {
  const i = Math.min(a.length - 2, Math.max(0, Math.floor(f)));
  return a[i] + (a[i + 1] - a[i]) * Math.min(1, Math.max(0, f - i));
};
const yAt = (r: StackRamp, f: number): number => lerpAt(r.ys, f);

/** Every 2D crossing of two ramps, and of a ramp with the 4 carriageway centrelines; the height gap must be >= clearance + deck (LEVEL_RISE). */
export function clearanceConflicts(ramps: StackRamp[], L = 800): Conflict[] {
  const roads: { id: string; pts: P2[]; y: (p: P2) => number }[] = [];
  for (const [id, a, b] of [['A+', { u: -L, v: LANE_OFF }, { u: L, v: LANE_OFF }], ['A-', { u: -L, v: -LANE_OFF }, { u: L, v: -LANE_OFF }], ['B+', { u: -LANE_OFF, v: -L }, { u: -LANE_OFF, v: L }], ['B-', { u: LANE_OFF, v: -L }, { u: LANE_OFF, v: L }]] as const) {
    const pts: P2[] = [];
    for (let i = 0; i <= 200; i++) pts.push({ u: a.u + ((b.u - a.u) * i) / 200, v: a.v + ((b.v - a.v) * i) / 200 });
    roads.push({ id, pts, y: id[0] === 'A' ? () => 0 : (p) => yB(p.v) });
  }
  const out: Conflict[] = [];
  const need = LEVEL_RISE;
  // ramp x road (skip its own source / target road near the join: those are merges, not crossings)
  for (const r of ramps) {
    for (const rd of roads) {
      for (const c of crossings(r.pts, rd.pts)) {
        const yr = yAt(r, c.ia), yd = rd.y({ u: c.u, v: c.v });
        const ownRoad = rd.id[0] === r.source || rd.id[0] === r.target;
        const sAt = lerpAt(r.cum, c.ia);
        const nearEnd = sAt < 60 || r.length - sAt < 60;
        if (ownRoad && nearEnd) continue;
        const gap = Math.abs(yr - yd);
        if (gap < need - 1e-6) out.push({ a: r.id, b: rd.id, u: c.u, v: c.v, ya: yr, yb: yd, gap });
      }
    }
  }
  for (let i = 0; i < ramps.length; i++) for (let j = i + 1; j < ramps.length; j++) {
    for (const c of crossings(ramps[i].pts, ramps[j].pts)) {
      const ya = yAt(ramps[i], c.ia), yb = yAt(ramps[j], c.ib);
      const gap = Math.abs(ya - yb);
      if (gap < need - 1e-6) out.push({ a: ramps[i].id, b: ramps[j].id, u: c.u, v: c.v, ya, yb, gap });
    }
  }
  return out;
}

export const rampMinRadius = (r: StackRamp): number => pathMinR(r.pts);
export const rampMaxGrade = (r: StackRamp): number => Math.max(...r.ys.slice(1).map((y, i) => Math.abs(y - r.ys[i]) / (r.cum[i + 1] - r.cum[i])));
export const rampRminLimit = (r: StackRamp): number => DESIGN.radiusMargin * minRadius(r.V);
