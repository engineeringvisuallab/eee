// STEP J1-e1 (headless): the ground-level J1 in the game. Terrain carve vs mesh height, cut / fill under the lane zones, EVLab yielding, railway unchanged.
// Run: npx tsx scripts/j1-game-check.ts
import { TerrainGenerator } from '../src/terrain/TerrainGenerator';
import { Config } from '../src/core/Config';
import { J1Terrain, J1_S_END } from '../src/roads/junction/GroundJ1Terrain';
import { buildJ1Mesh } from '../src/roads/junction/GroundJ1Mesh';
import { buildJ1Geometry } from '../src/roads/junction/GroundJ1Geometry';
import { EVLAB_PLOT } from '../src/evlab/EVLabSite';

let fails = 0;
const ok = (c: boolean, m: string): void => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const J = Config.roads.junctionJ1;
const gen = new TerrainGenerator(Config.world.seed);
const t = gen.roads.j1 as J1Terrain;
ok(!!t, 'J1 terrain exists in the road network (Config.roads.junctionJ1.enabled)');
const sc = { h: 0, water: NaN, fx: 0, fz: 0 };
const nat = (x: number, z: number): number => { gen.sampleNatural(x, z, sc); return sc.h; };

// 1. J1 centre ground = pad plane
const hC = gen.heightAt(J.x, J.z);
ok(Math.abs(hC - J.y) < 0.02, `centre ground ${hC.toFixed(2)} m = pad plane ${J.y.toFixed(2)} m (natural ${nat(J.x, J.z).toFixed(2)})`);

// 2. terrain (carved ground incl. EVLab) against the mesh level over the whole footprint
let maxD = 0, worst = '', n = 0, dev = 0;
for (let e = -330; e <= 330; e += 3) for (let nn = -330; nn <= 330; nn += 3) {
  const a = t.armOf(e, nn), r = Math.hypot(e, nn);
  const inPad = r <= J.rCore, inZone = a.s <= J1_S_END && a.o <= 24;
  if (!inPad && !inZone) continue;
  const [x, z] = t.toWorld(e, nn);
  const d = Math.abs(gen.heightAt(x, z) - t.levelAt(x, z));
  n++; dev += d;
  if (d > maxD) { maxD = d; worst = `e ${e} n ${nn} (arm ${a.arm} s ${a.s.toFixed(0)})`; }
}
ok(maxD < 0.06, `ground = finished level under pad + lane zones: max diff ${maxD.toFixed(3)} m at ${worst}, mean ${(dev / n).toFixed(4)} m (${n} points)`);

// 3. cut / fill under the lane zones (finished level - natural ground) along each arm axis and edges
for (const arm of ['N', 'E', 'S', 'W'] as const) {
  let cut = 0, fill = 0;
  for (let s = 60; s <= J1_S_END; s += 10) for (const o of [-24, 0, 24]) {
    const [e, nn] = arm === 'N' ? [o, s] : arm === 'S' ? [o, -s] : arm === 'E' ? [s, o] : [-s, o];
    const [x, z] = t.toWorld(e, nn);
    const d = t.levelAt(x, z) - nat(x, z);
    if (d > fill) fill = d; if (-d > cut) cut = -d;
  }
  console.log(`  arm ${arm}: lane zone s 60..270: max fill ${fill.toFixed(1)} m, max cut ${cut.toFixed(1)} m; level at s 270 = ${t.armLevel(arm, 270).toFixed(2)} m, natural on axis ${nat(...t.axisPoint(arm, 270)).toFixed(2)} m`);
}

// 4. what natural things are inside the footprint (EVLab plot, lake / river water)
let wet = 0, inPlot = 0, cnt = 0;
for (let e = -330; e <= 330; e += 6) for (let nn = -330; nn <= 330; nn += 6) {
  const a = t.armOf(e, nn); if (!(Math.hypot(e, nn) <= 80 || (a.s <= 280 && a.o <= 45))) continue;
  const [x, z] = t.toWorld(e, nn); cnt++;
  gen.sampleNatural(x, z, sc); if (!Number.isNaN(sc.water) && sc.h < sc.water) wet++;
  if (x > EVLAB_PLOT.x0 && x < EVLAB_PLOT.x1 && z > EVLAB_PLOT.z0 && z < EVLAB_PLOT.z1) inPlot++;
}
console.log(`  footprint samples ${cnt}: wet ${wet}, inside the EVLab plot ${inPlot} (${((100 * inPlot) / cnt).toFixed(0)} %)`);
ok(wet === 0, 'no water inside the J1 footprint');

// 5. mesh
const geo = buildJ1Geometry();
const m = buildJ1Mesh(t, geo);
console.log(`  mesh: ${m.stats.verts} vertices, ${m.stats.tris} triangles (islands ${m.stats.islandTris}, marks ${m.stats.markTris})`);
ok(m.stats.tris > 1000 && m.stats.tris < 60000, 'triangle count is sane');
let up = 0; for (let i = 0; i < m.indices.length; i += 3) { const a = m.indices[i] * 3, b = m.indices[i + 1] * 3, c = m.indices[i + 2] * 3; const ny = (m.positions[b + 2] - m.positions[a + 2]) * (m.positions[c] - m.positions[a]) - (m.positions[b] - m.positions[a]) * (m.positions[c + 2] - m.positions[a + 2]); if (ny !== 0) up++; }
ok(up > 0, 'faces have area');
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAIL`);
process.exit(fails ? 1 : 0);
