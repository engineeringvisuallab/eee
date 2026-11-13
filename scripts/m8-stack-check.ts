// STEP 9.2 J1 stack check: ramp radius, grade, and vertical clearance at every crossing. Writes docs/m8_stack_plan.json for the plan picture.
// Run: npx tsx scripts/m8-stack-check.ts
import { writeFileSync } from 'node:fs';
import { buildStack, clearanceConflicts, medianConflicts, DELTA_F, SHIFT_LEN, U_FULL, rampMaxGrade, rampMinRadius, rampRminLimit } from '../src/interchange/m8/StackGeometry';

const ramps = buildStack();
let fails = 0;
for (const r of ramps) {
  const R = rampMinRadius(r), g = rampMaxGrade(r), lim = rampRminLimit(r);
  const okR = R >= lim - 2, okG = g <= 0.05 + 1e-3;
  if (!okR || !okG) fails++;
  console.log(`  ${okR && okG ? 'PASS' : 'FAIL'}  ${r.id} ${r.shape.padEnd(5)} len ${r.length.toFixed(0).padStart(4)} m  Rmin ${R.toFixed(0)} (limit ${lim.toFixed(0)})  max grade ${(g * 100).toFixed(2)} %  y ${r.ys[0].toFixed(1)} -> ${r.ys[r.ys.length - 1].toFixed(1)}`);
}
const cf = clearanceConflicts(ramps);
for (const c of cf) console.log(`  CONFLICT ${c.a} x ${c.b} at (${c.u.toFixed(0)}, ${c.v.toFixed(0)}) heights ${c.ya.toFixed(1)} / ${c.yb.toFixed(1)}  gap ${c.gap.toFixed(1)} m < 6.9`);
console.log(`  clearance: ${cf.length} conflicts`);
const mc = medianConflicts(ramps);
for (const c of mc.slice(0, 12)) console.log(`  MEDIAN ${c.ramp} too close to ${c.road} at (${c.u.toFixed(0)}, ${c.v.toFixed(0)}) d ${c.d.toFixed(1)} m < 13.5`);
console.log(`  median opening: spread ${DELTA_F} m each carriageway, full to ${U_FULL} m, shift taper ${SHIFT_LEN.toFixed(0)} m; ${mc.length} ramp points too close to a pavement`);
if (mc.length) fails++;
writeFileSync('docs/m8_stack_plan.json', JSON.stringify(ramps.map((r) => ({ id: r.id, shape: r.shape, u: r.pts.map((p) => +p.u.toFixed(1)), v: r.pts.map((p) => +p.v.toFixed(1)), y: r.ys.map((y) => +y.toFixed(2)) }))));
console.log(fails || cf.length ? `FAILED radius/grade ${fails}, clearance ${cf.length}` : 'ALL PASS');
