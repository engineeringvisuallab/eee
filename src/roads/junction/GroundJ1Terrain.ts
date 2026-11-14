// STEP J1-e1: the finished ground level of J1 (pure math, no three.js). One source of truth for BOTH the terrain carve (RoadNetwork.apply) and the mesh (GroundJ1Mesh).
//  - pad plane (J1-c1) inside r <= 60 m of the centre,
//  - on each arm the lane zone (s = 0..270 m, half width 27 m): pad plane to s 60, then the arm profile (PVI table, J1-c4c / c5c / c7c), the cross-fall of the plane fades out by s 200,
//  - an embankment skirt of EMB metres around both, smoothstep back to the natural ground.
// The S arm has no full profile yet (J1-c6): pad plane to s 60, then a 8.9 m curve into -0.30 % (docs/j1c_S.json).
import { J1_ARM_PVI, type Pvi } from './J1ArmProfiles';

export type J1Arm = 'N' | 'E' | 'S' | 'W';
export interface J1TerrainCfg { x: number; z: number; yawDeg: number; y: number; a: number; b: number; rCore: number; emb: number }

export const J1_S_END = 270;      // end of the lane zone (m from the centre); the arm roads (J1-e2) continue from here
export const J1_HALF_W = 27;      // half width of the lane zone incl. slip lane (23.4 m) and a shoulder
const smooth = (a: number, b: number, x: number): number => { const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a); return t * t * (3 - 2 * t); };

/** Level of a PVI table at s (tangent lines + parabolic vertical curves). */
export function pviLevel(p: ReadonlyArray<Pvi>, s: number): number {
  for (let i = 0; i < p.length; i++) {
    const v = p[i];
    if (v.Lc > 0 && Math.abs(s - v.s) <= v.Lc / 2) { const s0 = v.s - v.Lc / 2; return v.y + v.g1 * (s - v.s) + ((v.g2 - v.g1) / (2 * v.Lc)) * (s - s0) * (s - s0); }
  }
  // outside every curve: the tangent line of the nearest PVI on the correct side
  let k = 0;
  while (k + 1 < p.length && s > p[k + 1].s - p[k + 1].Lc / 2) k++;
  const v = p[k];
  const g = s >= v.s ? v.g2 : v.g1;
  return v.y + g * (s - v.s);
}

export class J1Terrain {
  readonly cfg: J1TerrainCfg;
  private readonly cy: number; private readonly sy: number;
  private readonly delta: Record<J1Arm, number> = { N: 0, E: 0, S: 0, W: 0 };
  private readonly sPvi: Pvi[];

  constructor(cfg: J1TerrainCfg) {
    this.cfg = cfg;
    const y = (cfg.yawDeg * Math.PI) / 180;
    this.cy = Math.cos(y); this.sy = Math.sin(y);
    const s60 = (arm: J1Arm): number => this.plane(...this.axisPoint(arm, 60));
    // S: pad -> S stretch grade after the plane (curve 8.9 m, then -0.30 %)
    const y60 = s60('S'), y0 = this.plane(cfg.x, cfg.z);
    const gp = (y60 - y0) / 60;
    this.sPvi = [{ s: 0, y: y0, g1: 0, g2: gp, Lc: 0 }, { s: 60, y: y60, g1: gp, g2: -0.003, Lc: 8.88 }];
    for (const arm of ['N', 'E', 'W'] as const) this.delta[arm] = s60(arm) - pviLevel(J1_ARM_PVI[arm], 60);
    this.delta.S = 0;
  }

  /** Local (e east, n north of the J1 axes) -> world, and back. */
  toWorld(e: number, n: number): [number, number] { return [this.cfg.x + e * this.cy + n * this.sy, this.cfg.z + e * this.sy - n * this.cy]; }
  toLocal(x: number, z: number): [number, number] { const dx = x - this.cfg.x, dz = z - this.cfg.z; return [dx * this.cy + dz * this.sy, dx * this.sy - dz * this.cy]; }
  /** World point on the axis of an arm, s metres from the centre. */
  axisPoint(arm: J1Arm, s: number): [number, number] {
    const [e, n] = arm === 'N' ? [0, s] : arm === 'S' ? [0, -s] : arm === 'E' ? [s, 0] : [-s, 0];
    return this.toWorld(e, n);
  }
  plane(x: number, z: number): number { const c = this.cfg; return c.y + c.a * (x - c.x) + c.b * (z - c.z); }

  /** Finished level on the axis of an arm at s. */
  armLevel(arm: J1Arm, s: number): number {
    if (s <= 60) return this.plane(...this.axisPoint(arm, Math.max(0, s)));
    if (arm === 'S') return pviLevel(this.sPvi, s);
    return pviLevel(J1_ARM_PVI[arm], s) + this.delta[arm] * (1 - smooth(60, 200, s));
  }

  /** Which arm a local point belongs to, and its distance s along / o across the axis. */
  armOf(e: number, n: number): { arm: J1Arm; s: number; o: number } {
    if (Math.abs(n) >= Math.abs(e)) return n >= 0 ? { arm: 'N', s: n, o: Math.abs(e) } : { arm: 'S', s: -n, o: Math.abs(e) };
    return e >= 0 ? { arm: 'E', s: e, o: Math.abs(n) } : { arm: 'W', s: -e, o: Math.abs(n) };
  }

  /** Finished road level at a world point inside the J1 footprint (what the mesh uses). Valid where the point belongs to the pad or a lane zone. */
  levelAt(x: number, z: number): number {
    const [e, n] = this.toLocal(x, z);
    const r = Math.hypot(e, n);
    const a = this.armOf(e, n);
    if (r <= this.cfg.rCore || a.s <= 60) return this.plane(x, z);
    const [ax, az] = this.axisPoint(a.arm, a.s);
    return this.armLevel(a.arm, a.s) + (this.plane(x, z) - this.plane(ax, az)) * (1 - smooth(60, 200, a.s));
  }

  /** Terrain carve: weight w (1 = the ground IS the finished level) and the level y. Returns false far away. */
  sample(x: number, z: number, out: { w: number; y: number }): boolean {
    const c = this.cfg;
    const [e, n] = this.toLocal(x, z);
    const r = Math.hypot(e, n);
    out.w = 0; out.y = 0;
    if (r > J1_S_END + J1_HALF_W + c.emb + 4) return false;
    // pad
    if (r < c.rCore + c.emb) { out.w = 1 - smooth(c.rCore, c.rCore + c.emb, r); out.y = this.plane(x, z); }
    // lane zones
    const a = this.armOf(e, n);
    const o1 = Math.max(0, a.o - J1_HALF_W), ds = Math.max(0, a.s - J1_S_END);
    const d = Math.hypot(o1, ds);
    const w = a.s < 0 ? 0 : 1 - smooth(0, c.emb, d);
    if (w > out.w) { out.w = w; out.y = this.levelAt(x, z); }
    return out.w > 0;
  }

  /** Circles (x, z, radius) that cover everything this terrain can touch, for the road cell grid. */
  cover(): Array<[number, number, number]> {
    const c = this.cfg, out: Array<[number, number, number]> = [[c.x, c.z, c.rCore + c.emb + 4]];
    for (const arm of ['N', 'E', 'S', 'W'] as const) for (let s = 40; s <= J1_S_END + 12; s += 24) { const [x, z] = this.axisPoint(arm, s); out.push([x, z, J1_HALF_W + c.emb + 12]); }
    return out;
  }
}
