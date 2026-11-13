// STEP 5.3c-6 check: the trimesh of every ring structure holds a falling ball on the deck (ball dropped 3 m above the road at mid-span must rest on the deck, not fall through).
// Run: npx tsx scripts/ring-bridge-physics-check.ts
import RAPIER from '@dimforge/rapier3d-compat';
import { TerrainGenerator } from '../src/terrain/TerrainGenerator';
import { Config } from '../src/core/Config';
import { buildStructure, ringStructures } from '../src/roads/ring/RingBridgeGeometry';

(async () => {
  await RAPIER.init();
  const net = new TerrainGenerator(Config.world.seed).roads;
  let fails = 0;
  ringStructures(net).forEach((b, k) => {
    const d = buildStructure(net, b, k);
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const base = d.positions.length / 3;
    world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(d.positions.concat(d.collider!.positions)), new Uint32Array(d.indices.concat(d.collider!.indices.map((i) => i + base)))));
    const r = net.roads[b.roadId];
    const kk = (b.i0 + b.i1) >> 1;
    // a point on the carriageway (offset 12 m from the axis, clear of median cables / pylon)
    const x = r.xs[kk] + r.nx[kk] * 12, z = r.zs[kk] + r.nz[kk] * 12, roadY = r.ys[kk];
    const ball = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, roadY + 3, z));
    world.createCollider(RAPIER.ColliderDesc.ball(0.4), ball);
    for (let i = 0; i < 240; i++) world.step();
    const y = ball.translation().y;
    const ok = Math.abs(y - (roadY + 0.4)) < 0.35;
    if (!ok) fails++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  S${k + 1} ball rests on the deck   road ${roadY.toFixed(2)}  ball centre ${y.toFixed(2)}`);
  });
  console.log(fails ? `FAILED ${fails}` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
