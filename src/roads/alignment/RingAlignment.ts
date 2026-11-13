// STEP 2.2  RING ALIGNMENT DATA (M8, 8 lane): the PI table of the closed ring, fitted to the shape of Roads.zip F3 (tools/ring-fit.py).
// Game coordinates (x east, z south, metres). Design speed V100, R >= 1.5 x Rmin = 591 m, spiral Ls 100 m (needed: 70 m). Travel order = table order.
// This is DATA: change a row only through a new CP; Checks and the sampled centreline are built from it (PiAlignment.ts).
import type { Pi } from './PiAlignment';

export const RING_DESIGN_SPEED = 100;
export const RING_PIS: readonly Pi[] = [
  { x: -4.70, z: 2384.16, R: 9260, Ls: 100 },
  { x: -2099.10, z: 2396.16, R: 696, Ls: 100 },
  { x: -2648.25, z: 830.19, R: 2354, Ls: 100 },
  { x: -2992.28, z: -3212.06, R: 650, Ls: 100 },
  { x: -1651.74, z: -3518.17, R: 1864, Ls: 100 },
  { x: 636.72, z: -3796.60, R: 914, Ls: 100 },
  { x: 2677.74, z: -3456.98, R: 1258, Ls: 100 },
  { x: 2706.59, z: 2204.04, R: 820, Ls: 100 },
];
