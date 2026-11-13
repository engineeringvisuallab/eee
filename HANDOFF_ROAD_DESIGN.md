# HANDOFF: ROAD DESIGN FROM SCRATCH (evcity)

Language: English only. This is the ONLY md file for the road work. Do not create CHANGES_*.md files. When a step is done, update the status table in section 12 of this file.

---

## 0. Goal and current state

**Goal:** design every road of the 10 x 10 km map again, properly, like a road engineer would. The old roads were removed because they were not designed with engineering rules.

**Order of work (fixed):**
1. Standards (numbers, formulas, checks) first.
2. The **centreline** of the first road: the **8-lane ring road** around the city (closed loop, all four sides).
3. Its profile, its full cross-section (centre to the outer edge of the right of way), terrain and structures.
4. The four 4-lane radial roads into the city centre, the city centre node, the outward 8 / 6 / 4 / 2-lane roads, and the interchanges.
5. All other road classes, hill roads, network, traffic, furniture.

**This work is done in small micro-steps (see section 5). After each micro-step the AI stops and the user checks it. The user will run this work in a NEW chat: section 14 has the starter prompt.**

**State of the code right now (after cleanup):**
- `Config.roads.activeTier = 0`: the road generator produces NO road. Island, J6 scenario, interchange list are all off.
- Removed: bridge visuals/physics, median/footpath views, U-turn signs, road numbers, roadside view, junction mirrors, road debug, road sign layer and its planners.
- Still in the project (old design, to be replaced or rewritten): `src/roads/RoadNetwork.ts`, `RoadPlan.ts`, `Junctions.ts`, `LocalRoads.ts`, `RoadSection.ts`, `MedianPlan.ts`, `UTurns.ts`, `RoadMesh.ts`, `RoadChunkBuilder.ts`, `RoadTypes.ts`, `src/interchange/*` (diamond, cloverleaf, parclo; `Standards.ts` has AASHTO-style formulas worth keeping).
- Still using the road network (they must keep compiling): `terrain/TerrainGenerator`, `terrain/TerrainMeshData`, `world/WorldManager`, `rail/*`, `port/PortFormation`, `traffic/RoadGraph` and the rest of `traffic`, `environment/StreetLights`, `vegetation/*`, `export/*`, `tour/*`.
- Do not delete `SignPhysics` / `SignSolids`: petrol and charging stations use them.

**World facts:** map 10 x 10 km, game x = east, z = south. Local grid for export: easting = x + 5000, northing = 5000 - z. Units are metres, heights are metres.

---

## 1. Working rules (conditions for the developer / AI)

1. **One step per session.** Do not start step N+1 until step N passes its acceptance tests.
2. **Pure math first.** Alignment, profile, section and interchange geometry live in modules with no three.js and no DOM, so they run headless (`scripts/*-check.ts`, run with the project's script runner).
3. **Deterministic.** Same seed gives the same roads in the main thread and in every worker.
4. **Data, not meshes.** A road is a centreline + station + profile + cross-section class. Meshes are built from data only in the chunk builder.
5. **Everything is checked by code.** Every design number has a check function that returns pass/fail with the reason. A road that fails a check is not accepted, it is redesigned.
6. **Performance:** follow `PERFORMANCE_RULES.md`. Road meshes are built per chunk, in workers where the project already does so. No per-frame allocation.
7. **Each step ends with:** code, a headless check script, a debug overlay (line/outline only), and a status update in section 12.
8. **No hidden coupling.** If a step changes the data shape that terrain, rail, traffic or export read, fix those readers in the same step and run the type check.
9. **Build must stay green:** `npm run build` (`tsc --noEmit && vite build`) passes at the end of every step.

---

## 2. Decisions to make BEFORE Step 1 (ask the user if unknown)

| # | Decision | Recommendation |
|---|----------|----------------|
| D1 | Drive side | Bangladesh drives on the LEFT. Check how the old `RoadGraph.laneCentre` and vehicles did it and keep the game consistent. All ramp and interchange geometry is mirrored for left-hand traffic. |
| D2 | Design standard | AASHTO-style formulas (already in `interchange/Standards.ts`). Keep one `CRITERIA` object for the whole project. |
| D3 | Where the first 8-lane road runs | Ask the user for control points (which city sites it connects). If not given, connect the two largest city sites by the flattest corridor and show it for approval. |
| D5 | Hill areas | Ask the user (or read the terrain) which hills and rocky areas should get HP / HS / HG / HT roads and which peaks or passes must be connected. |
| D6 | City centre point and ring size | Ask the user for the city centre (or use the centre of the main city site). Ring radius from the city extent plus 600-800 m clearance; first version circle or rounded square, radius 1.5-2.5 km. |
| D7 | City centre node | Recommended: multi-level roundabout (through traffic of the two axes in tunnels or on a flyover, the four radials end at the circle). Alternative: 4-level stack. Never a plain (+). |
| D8 | Important areas | List the places that get a 6-lane or 4-lane link (airport, port, industrial/engineering zones, EV lab, tech park, mall, dam, power plant, hospital, university). |
| D4 | Max cut/fill and viaduct rule | Default: fill above 7 m beside a river valley becomes a viaduct (same idea as the old `VIADUCT_FILL`). |

---

## 3. Engineering design rules (the conditions)

All formulas use V in km/h, R in m, e in m/m, f = side friction.

### 3.1 Road classes and design speed

| Class | Lanes | Design speed | Access | Median |
|-------|-------|--------------|--------|--------|
| M8 motorway | 4 + 4 | 100-120 | fully controlled, interchanges only | yes, 6 m |
| M6 motorway | 3 + 3 | 100-120 | fully controlled | yes, 6 m |
| M4 motorway | 2 + 2 | 100 | fully controlled | yes, 4 m |
| A-D arterial divided | 2 + 2 or 3 + 3 | 70-80 | signals / interchanges | yes |
| A-U arterial undivided | 1 + 1 (+ turn lane) | 60 | at-grade | painted |
| C collector | 1 + 1 | 50 | at-grade | no |
| L local street | 1 + 1 or shared | 30-40 | at-grade | no |
| S service / frontage | 1 + 1 | 30-40 | to adjacent land | no |
| R ramp | 1 or 2 | 30-80 by ramp type | one-way | no |
| EX expressway | 2 + 2 | 80-100 | mostly controlled, few at-grade | yes, 3-6 m |
| I industrial / heavy-vehicle road | 1 + 1 or 2 + 2 | 50-60 | at-grade, wide radii | optional |
| E earth / village track | 1 | 20-25 | free | no |
| RB roundabout | 1-2 circulating | 30 | yield | splitter islands |
| HP hill primary road | 1 + 1 (+ climbing lane) | 40-60 | at-grade, few | no |
| HS hill secondary road | 1 + 1 | 30-40 | at-grade | no |
| HG ghat road (hairpins, mountain pass) | 1 + 1 | 20-30 | at-grade | no |
| HT hill / mountain track (single lane + passing bays, rock or earth) | 1 | 15-25 | free | no |
| T tunnel road | 1 + 1 or 2 + 2 | 40-80 | controlled | wall / barrier |
| CW causeway / river-embankment / dam-crest road | 1 + 1 | 40-50 | at-grade | no |

### 3.2 Horizontal alignment (the centreline rules)

- Minimum radius from `R = V^2 / (127 (e + f))`, e max = 0.08. Check values: V120 -> about 665 m, V100 -> about 395 m, V80 -> about 230 m, V60 -> about 113 m, V50 -> about 73 m, V40 -> about 41 m, V30 -> about 20 m (use the `f` table in `Standards.ts`).
- Alignment is built from **straight - clothoid (spiral) - arc - clothoid - straight**, never from a smoothed spline.
- Spiral length: `Ls >= 0.0214 V^3 / (R C)` with comfort rate C = 0.5-0.8 m/s^3, and also not shorter than the superelevation runoff length.
- Deflection angle at each point of intersection (PI): tangent length `Ts = (R + p) tan(delta/2) + k` (p, k are the spiral shift terms).
- Straight between two curves (V in km/h, result in metres): same-direction curves >= 6 V (V100 -> 600 m), reverse curves >= 2 V (V100 -> 200 m). In every case the two spirals must not overlap.
- No curve below the minimum radius, no spiral overlap, no sharp bend inside an interchange area or a bridge.
- Sample the final centreline every 4-8 m with: station (chainage), x, z, heading, curvature, `kind` (straight / spiral / arc).

### 3.3 Vertical alignment

- Maximum grade: motorway 4 % (desirable 3 %), divided arterial 5-6 %, collector 8 %, local 10 %, ramp 5 % (as in `rampMaxGrade`), earth 12 %. Minimum 0.3 % where drainage needs it.
- Vertical curves are parabolas. Minimum length from stopping sight distance. Check values for K = L/A: crest about 52 (V100) and 95 (V120), sag about 45 (V100) and 63 (V120). Always check with the real SSD formula (below), do not trust the table blindly.
- Stopping sight distance: `SSD = V t/3.6 + V^2 / (254 (a/9.81 + G))` with t = 2.5 s and a = 3.4 m/s^2 (the values already in `CRITERIA`).
- Grade change smaller than 0.5 % may skip the vertical curve, otherwise always use a curve.
- Never put a crest or sag curve start inside a ramp gore or a bridge expansion joint.

### 3.4 Superelevation and cross slope

- Normal crown / cross fall 2 % (each carriageway slopes away from the median or one way across).
- In a curve: superelevation by radius and speed up to 8 %. Runoff happens along the spiral. Divided carriageways rotate about the median edge.
- Shoulder slope 4 %, side slope see below.

### 3.5 Cross-section of the M8 (8-lane main road), distances from the centreline, one side

| From | To | Element | Width |
|------|----|---------|-------|
| 0.0 | 3.0 | median (6.0 m total, kerb or concrete barrier + planting or paved) | 3.0 |
| 3.0 | 4.5 | inner paved shoulder | 1.5 |
| 4.5 | 19.1 | 4 travel lanes x 3.65 m | 14.6 |
| 19.1 | 22.1 | outer paved shoulder (breakdown) | 3.0 |
| 22.1 | 22.7 | guardrail / barrier offset | 0.6 |
| 22.7 | 24.2 | verge + drainage ditch (ditch 1.5 m wide, 0.5 m deep) | 1.5 |
| 24.2 | 32 | clear zone (no trees, no poles), side slope 1:4 flat, 1:3 max, 1:2 only with barrier | about 8 |
| 32 | 40 | right-of-way strip: fence, planting, service road if used | 8 |

So: pavement edge at 22.1 m, right-of-way edge at about 40 m from the centreline (80 m ROW). Put these numbers in ONE table (`RoadSection` rewrite) and let every consumer read from it: mesh, terrain cut, buildings clearance, rail, traffic, export.

Other classes get their own table in the same format (see step 7).

### 3.6 Structures

- Vertical clearance under a bridge: 5.5 m minimum for roads, plus deck depth (0.8-1.5 m).
- Bridge when the road crosses water wider than 1 m (no embankment dam across a river), culvert for small streams and drains.
- Viaduct when fill beside a river valley is above the viaduct limit (D4).
- Bridge deck follows the road profile, abutments are outside the clear zone, piers not inside the median of the road below.
- Road over rail: rail clearance 6.5 m. Rail over road: use the clearance of the road below.

### 3.7 Terrain

- Terrain is cut/filled to the formation level with a side-slope daylight line. Cut slope 1:2, fill slope 1:3.
- Cut and fill depth limits: cut <= 12 m, fill <= 7 m, else tunnel or viaduct or change the alignment.
- Rivers, lakes and sea are avoided by the alignment unless a bridge is intended.
- The corridor (the full ROW width) is protected: no buildings, no trees, no grass placement inside it. Buildings and plantings read the section table.

### 3.8 Junction and interchange spacing

- Interchange spacing on a motorway: >= 2 km in rural areas, >= 1.6 km in urban areas.
- Weaving length between an entrance and the next exit on the same carriageway: >= 150 m absolute, 300 m desirable (`weaveMin`, `weaveDesirable`).
- Deceleration lane (exit) and acceleration lane (entry) lengths are derived from speeds with `aDecel` = 2.5 and `aAccel` = 1.2 m/s^2, plus the taper (about 1:25 exit taper, 1:50 entry taper).
- Gore area, ramp nose and ramp terminals must meet SSD and decision sight distance.
- At-grade junctions: collector to local only, never a local street straight onto a motorway or a divided arterial (use a frontage road).

### 3.9 Hierarchy (what may connect to what)

| From \ To | M | A | C | L | S |
|-----------|---|---|---|---|---|
| M | interchange | interchange | no | no | no |
| A | interchange | T / roundabout / interchange | T or roundabout | no (via C) | no |
| C | no | T or roundabout | T or roundabout | T or roundabout | T or roundabout |
| L | no | no | T or roundabout | T or roundabout | T or roundabout |

At-grade meetings are T junctions or roundabouts only (rule X1). Hill roads: HP connects to A or C (at-grade), HS to C or L, HG and HT to HS or L. A hill road never joins a motorway directly.

### 3.10 Hill and mountain road rules (rocky terrain, slopes, passes)

Hill and mountain roads are NOT left out. They use the same standards module (step 1) with their own rows. Terrain class is taken from the ground cross slope across the alignment: flat < 10 %, rolling 10-25 %, hilly 25-60 %, steep > 60 %. Use the lower design speeds of table 3.1 in hilly and steep terrain.

**Horizontal**
- Minimum radius from the same formula (3.2) with the hill design speed. Check values: V60 -> 113 m, V40 -> 41 m, V30 -> 20 m, V20 -> about 9 m.
- **Hairpin bend (switchback):** inner radius >= 14-15 m on the ghat road, never two hairpins closer than 60 m (straight or easy curve between them), hairpin is placed on the flattest, most stable ground (spur or bench), never in a gully.
- **Extra widening on curves:** mechanical widening `Wm = n l^2 / (2 R)` (n lanes, l = 6 m design vehicle wheelbase to the front overhang) plus psychological widening `Wps = V / (9.5 sqrt(R))`. Widen on the inside of the curve, run it out along the transition.
- Superelevation in hills up to 7 %, never more than 10 % (ice is not a concern here, but slow trucks and slipping on wet rock are).
- Alignment follows the ground: prefer the ridge line, then the spur, avoid valley floors and unstable slopes, never cut the toe of a landslide area.

**Vertical**
- Ruling grade 6 %, limiting grade 7 %, exceptional (short, <= 100 m) 8-10 % on mountain track only. Hairpin grade <= 4 % (<= 2.5 % desirable).
- **Grade compensation on curves:** reduce the grade on a curve with radius R below 50 m by `(30 + R) / R` percent, but never more than `75 / R` percent.
- **Long climbs:** climbing lane when the grade is > 3 % for > 500 m with heavy trucks. **Long descents:** a **runaway truck escape ramp** (upgrade 10-20 %, gravel bed 100-150 m) when the descent is > 6 % for > 3 km.
- Tunnel when a cut would be deeper than 12 m, or when a ridge crossing saves more than about 1 km of alignment (tunnel grade <= 4 %, > 0.3 %).

**Section in hills (single or two lane)**

| Item | HP primary | HS secondary | HG ghat | HT track |
|------|------------|--------------|---------|----------|
| Carriageway | 7.0 m (2 x 3.5) | 5.5-6.0 m | 5.5 m, widen on curves | 3.5 m single lane |
| Shoulder (paved / earth) | 1.5 + 0.5 | 0.75 | 0.5-0.75 | none or 0.3 |
| Valley-side crash barrier | always | always when drop > 3 m | always, plus parapet wall | rock/earth kerb, markers |
| Hill-side drain | 0.6 m lined catch/side drain | 0.5 m | 0.5 m | open earth drain |
| Passing bay / lay-by | every 1 km | every 500 m | every 300 m | every 150-300 m, intervisible |
| Surface | asphalt | asphalt / concrete | concrete on > 8 % | gravel, stone or earth |

**Cut, fill and retaining**
- Rock cut slope 1:0.25-1:1 by rock quality, soil cut 1:1.5, high cuts with a 2 m bench every 8-10 m of height. Fill slope 1:2 max; when the valley side is steeper than 1:2, use a **retaining wall** (valley side) or a **breast wall** (hill side) instead of fill. Wall heights above 8 m need a viaduct or a bench design instead.
- Half-cut / half-fill is the normal section on a hill side, balance cut and fill along the road to cut haul.
- Rockfall protection (catch ditch, barrier, net) under steep or jointed rock. Landslide zone: avoid, else drain and retain.

**Drainage (hill roads fail first from water)**
- Top (catch) drain above every cut, side drain on the hill side, cross-drain culvert at least every 100-200 m and at every gully, scuppers in the parapet, drop structures and energy dissipation on steep drains. Water never runs down the carriageway for more than 100 m.

**Structures:** bridges over gullies / streams (jhora, nala), culverts, Irish bridge / causeway where flood flow is short, retaining walls, tunnels with portals, parapets. All with the clearance and loading of 3.6.

**Safety furniture:** chevron boards on curves, delineators, convex mirrors at blind curves, hairpin numbering, hill-side cat's eyes, edge line.

### 3.11 City network pattern and the NO-CROSSING rules

**The pattern (fixed by the user):**

```
                    N radial (4 lane)
                          |
         +----------------+----------------+
         |        8-lane RING ROAD         |
W radial |      (closed, all four sides)   | E radial
(4 lane) +----------- CITY CENTRE ---------+ (4 lane)
         |                                  |
         +----------------+----------------+
                          |
                    S radial (4 lane)
   Outward from the ring: 8-lane roads, 6-lane branches to important
   areas, then 4-lane and 2-lane roads further out.
```

1. **Ring:** one closed 8-lane (4 + 4) ring road (M8) around the city, on all four sides.
2. **Radials:** four 4-lane (2 + 2) roads, one from each direction (north, east, south, west). Each runs from the ring to the **city centre**. Each meets the ring at one interchange.
3. **City centre node:** the four radials meet at the centre. Nobody crosses straight through at the same level (decision D7, see Step 6.2).
4. **Outward roads:** from the ring, 8-lane roads (M8) go to other city sites. **6-lane roads (M6)** leave the 8-lane roads towards **important areas** (airport, port, industrial and engineering zones, EV lab, tech park, dam, mall, power plant, hospital...; the user gives the list, D8).
5. **Lane ladder:** 8 -> 6 -> 4 -> 2. A road may reduce by one step at a time. From an 8-lane road you may also go down to 4 or 2 where demand is small, but only at a node (interchange or branch), see 3.13.

**NO-CROSSING rules (checked by code):**

| # | Rule |
|---|------|
| X1 | No two roads cross each other at the same level. Four-leg crossings (+) do not exist at grade. Roads meet at grade only as a **T junction** (one road ends on the other) or in a **roundabout** (everyone joins the circle, nobody goes straight across). A (+) is replaced by a roundabout, or by two T junctions set apart by 60 m or more (staggered). |
| X2 | A smaller road never crosses a bigger road. It **ends** at the bigger road (T), or joins through a ramp / interchange, or turns onto a parallel service road. A collector or a local street never crosses an arterial or a motorway, at any level. |
| X3 | The only crossing of two roads allowed is a planned **grade-separated crossing** (interchange, flyover, underpass, bridge) that is listed in the interchange schedule (step 9). |
| X4 | Motorways cross each other only inside an interchange (directional T, turbine, stack, cloverleaf). |
| X5 | Rail and road never cross at grade (see 3.6): road over rail or rail over road. |

**Code check (`scripts/network-check.ts`):** intersect every pair of road centrelines (segment test). Every intersection must be a node of the schedule with a type (T, roundabout, interchange, flyover, underpass). Any intersection that is not listed = FAIL. Also report every pair that passes within 15 m of each other without a node (near-miss, probably an error).

### 3.12 Smoothness rules: NO sudden or awkward bends

A road may only change direction by a designed curve. All of these are tested in code and shown to the user as a table and a curvature plot.

1. Only **straight - spiral - arc - spiral - straight**. No polyline corners, no spline wobble.
2. **No kink:** the heading jump between two neighbouring samples must be below 0.1 degree (real corners are forbidden, not smoothed away).
3. **Curvature is continuous** (spirals at every straight-to-arc joint). Rate of change of curvature `dk/ds <= 1 / (R_arc * Ls)`.
4. **Radius margin:** a motorway curve uses R >= 1.5 x the minimum radius of its design speed. The minimum is the exception, not the design.
5. **Compound curves** (two arcs in the same direction without a straight): the ratio of the large to the small radius is <= 1.5 (use a spiral between them).
6. **Broken-back curves** (two curves in the same direction with a short straight): straight >= 6 V metres (V in km/h), else merge into one curve.
7. **Reverse curves** (S-bend): straight or spiral-to-spiral >= 2 V metres.
8. **No curve on a bridge approach, inside an interchange gore, on the crest of a vertical curve or at a tunnel portal.** Put curves before them.
9. **Visual check:** curvature plot has no spike, heading plot has no step, the sight distance along the road never falls below the SSD of the design speed.
10. Turning angles at nodes (junction angle): 70-110 degrees for T and cross meetings, ramps leave the main road at 3-5 degrees (1:12-1:20 taper).

### 3.13 Sizing the lanes by demand, and how lanes reduce (8 -> 6 -> 4 -> 2)

An urban planner sizes every road from demand, not by guess.

**Lane count from traffic:**
`lanes per direction = ceil( AADT x K x D / c )`
K = design-hour factor (0.10), D = directional split (0.60), c = capacity per lane for the class (pcu/h/lane): motorway 1 800, expressway 1 600, divided arterial 900-1 000, undivided arterial 800, collector 600, local 300.

| Road | AADT | AADT x K x D | c | Lanes per direction | Class |
|------|------|--------------|---|---------------------|-------|
| Ring | 120 000 | 7 200 | 1 800 | 4.0 -> 4 | M8 |
| Branch to important area | 80 000 | 4 800 | 1 800 | 2.7 -> 3 | M6 |
| Outer link | 40 000 | 2 400 | 1 800 | 1.3 -> 2 | M4 |
| Radial into the city | 40 000 | 2 400 | 900 | 2.7 -> 3 (use 2 + turn pockets, or 3 if demand is confirmed) | A-D |

Demand source: give every zone (city centre, districts, airport, port, factory zones, tech park...) a weight (population or jobs), assign trips between zones on the shortest path of the planned network, sum the flow on every link (simple all-or-nothing assignment is enough in the first version). Then size the lanes with the formula. Rule: neighbouring links differ by at most one step (8, 6, 4, 2).

**How a lane reduction is built (never abruptly):**
1. A reduction happens only at a **node** where traffic leaves (an exit, a branch, an interchange), never in the middle of a road.
2. Prefer **lane drop by exit**: the dropped lane becomes the exit lane and leaves the road (no merge needed).
3. **Lane balance rule** at a diverge: `N_before = N_continuing + N_exit - 1` (per direction). Example: ring with 4 lanes continuing and a 2-lane exit to a branch needs 4 + 2 - 1 = 5 lanes just before the exit, so an auxiliary lane is added upstream and dropped at the exit.
4. If a lane must be dropped without an exit (flows really fall), use a **lane-drop taper**: `L = 0.62 W V` (m, W lane width in m, V km/h) for V >= 70 km/h, and `L = W V^2 / 155` for V <= 60 km/h. Example: W = 3.65, V = 100 -> L = 226 m; V = 60 -> L = 85 m. Design with L x 1.5 where space allows. Put the taper on a straight, with full sight distance, never in a curve or on a bridge.
5. Add a lane (gain) at an entry with an acceleration lane, or by a full lane added on the main line beyond a merge (lane gain), not by an unmarked widening.
6. Signs and markings (later step) announce a reduction at least 1 km ahead (motorway) or 300 m (arterial).

### 3.14 Urban planning rules (so it is a designed city, not random roads)

- **Hierarchy gives land use:** ring and outward M8 = logistics, industry, airport/port links, no frontage access. Radials = commercial and mixed-use corridors with controlled access. Collectors = neighbourhood spines. Local streets = residential. Frontage roads separate shops from fast traffic.
- **Right of way (ROW) is reserved first.** Buildings, trees and utilities stay outside the ROW (table 3.5 for M8, section tables for others).
- **Setbacks and buffers:** M8 and M6 keep 30-50 m planted buffer from houses (noise, safety). Arterials 6-10 m building line. Local streets 3-5 m.
- **Block size:** local street grid 80-120 m blocks in the city, 200-300 m on collectors, access points on arterials at least 200 m apart (400 m in the city centre ring zone).
- **Gradual change:** lanes, speed and road width step down toward the neighbourhoods (8 -> 6 -> 4 -> 2), speed 100 -> 80 -> 60 -> 40 -> 30.
- **Important places** (hospital, EV lab, airport, port, tech park, mall) get a direct link from the 6-lane or 4-lane network, with the interchange or junction placed so queues do not back up onto the ring.
- **Pedestrians and cycles:** separate tracks on all arterials and below; grade-separated crossings on 4+ lane roads (footbridge or underpass), controlled crossings elsewhere.

---

## 4. Module layout (proposal)

```
src/roads/standards/   Criteria.ts, SectionTable.ts, Checks.ts          (pure)
src/roads/alignment/   Clothoid.ts, PiAlignment.ts, Centreline.ts       (pure)
src/roads/profile/     Grade.ts, VerticalCurve.ts, Profile.ts           (pure)
src/roads/section/     CrossSection.ts, Superelevation.ts, Offsets.ts   (pure)
src/roads/hill/        ContourWalk.ts, Hairpin.ts, Widening.ts, Walls.ts (pure)
src/roads/network/     NetworkPlan.ts, Hierarchy.ts, Junctions.ts       (pure)
src/roads/build/       RoadChunkBuilder.ts, RoadMesh.ts, Markings.ts    (three.js)
src/interchange/       reuse Standards.ts, Validate.ts, Geometry2D.ts; new patterns
```

Keep `RoadNetwork` as the facade the rest of the game already reads (`roads`, `bridges`, `pads`, `surfaceAt`, `stats`). Replace its internals step by step, keep its outside shape so terrain, rail, traffic and export keep compiling.

---

## 5. STEP PLAN

### How every step is run (micro-steps and checkpoints)

- Every step is split into **micro-steps** (0.1, 0.2, ... 2.1, 2.2 ...). One micro-step is small, about one working session.
- After each micro-step the AI **STOPS** and shows the user a **CHECKPOINT (CP)**:
  1. what was built or decided,
  2. the **calculation sheet** with inputs, formulas and results (template and worked examples in section 13),
  3. a picture, plot or table the user can check (debug line, curvature plot, section drawing, station table),
  4. a PASS / FAIL list of the checks.
- The user answers OK or gives corrections. **The AI never starts the next micro-step before OK**, and never changes an approved number without asking.
- Every road comes with its engineering explanation: why this speed, this radius, this lane count, this width, with the numbers.
- Every micro-step ends with `npm run build` green (the old test scripts that need three.js may be skipped when the machine has no node_modules, but say so).

### Step 0: Setup and decisions
- 0.1 Record D1-D8 (section 2) in section 12. CP0.1: the user confirms every decision.
- 0.2 New `Config.roads` schema and empty module files that compile, `activeTier` still 0, game still runs with no roads. CP0.2.

### Step 1: Standards module (pure, no three.js)
- 1.1 `Criteria` (design speeds, e max, friction table, reaction time, braking, accel/decel, grade limits, capacity per lane). Script prints all of it. CP1.1.
- 1.2 Road class table (section 3.1 and 3.10) as data. CP1.2.
- 1.3 Cross-section tables: M8 first (section 3.5), then M6, M4, arterial, collector, local. Script prints offsets from the centreline. CP1.3.
- 1.4 Check functions: `minRadius`, `spiralLength`, `superelevation`, `ssd`, `minVerticalK`, `maxGrade`, `laneDropTaper`, `decelLength`, `accelLength`, `lanesFromDemand`, `smoothness`. Each prints the worked example of section 13 and the values match within 2 %. CP1.4.

### Step 2: CENTRELINE of the first road, the 8-lane RING ROAD (M8)
Only the line. No mesh, no profile.
- 2.1 **City centre and ring size (D6).** Calculation: ring radius, circumference, design speed, check `R >= 1.5 x Rmin`. Show 2-3 alternatives (radius, length, what it crosses: water, hills, rail, city sites). User picks. CP2.1.
- 2.2 **Ring alignment as a closed loop.** Build it from arcs (and spirals if the shape is not a circle). Closure test: position gap, heading gap and curvature gap at the join are all below the tolerance (1 cm, 0.01 degree). CP2.2.
- 2.3 **Smoothness report** (section 3.12): curvature plot, kink test, compound ratio, minimum radius margin. All PASS. CP2.3.
- 2.4 **Samples and overlay.** Sample the line every 5 m (station, x, z, heading, curvature, element kind). Debug line overlay with marks every 100 m, and four marked points where the N, E, S, W radials will meet the ring (the station numbers are printed). CP2.4.
- 2.5 **Ground check.** List every place the ring meets water, rail, steep ground, city sites, with station ranges, for step 3 (structures). Fix the ring alignment only if a hard stop is found. CP2.5.

### Step 3: Vertical profile of the ring
- 3.1 Sample the natural ground along the ring (station, height). CP3.1.
- 3.2 Grade line (PVIs), balance cut and fill, grade <= limit. CP3.2.
- 3.3 Vertical curves with K from SSD (section 13 example). CP3.3.
- 3.4 Structure list: bridges (water > 1 m), culverts, viaducts (fill > limit), rail crossings with clearances. CP3.4.
- 3.5 Cut and fill volumes and the daylight line summary. CP3.5.

### Step 4: Full cross-section of the ring, from the centre to the outer edge
- 4.1 Offset table printed for the ring (3.5), widths and total ROW. CP4.1.
- 4.2 Superelevation diagram (on R = 2 000 m at V100 the road keeps its normal crown, see section 13). CP4.2.
- 4.3 Ribbons of every element (carriageways, shoulders, median, barrier, ditch, slope). Continuity and self-intersection check. CP4.3.
- 4.4 ROW boundary, clear zone, fence line. CP4.4.
- 4.5 Markings data (lane lines, edge lines, median edge line, gore markings placeholders). CP4.5.

### Step 5: The ring in the game
- 5.1 Feed the `RoadNetwork` facade (`roads`, `bridges`, `pads`, `surfaceAt`, `stats`). CP5.1.
- 5.2 Road mesh and terrain cut for the ring. CP5.2.
- 5.3 Bridges, viaducts, culverts (new modules, the old ones were deleted). CP5.3.
- 5.4 Physics: the player can drive the whole ring. CP5.4.
- 5.5 Performance against `PERFORMANCE_RULES.md`. CP5.5.

### Step 6: Radials, city centre, outward roads, lane ladder
- 6.1 **Four 4-lane radials** (N, E, S, W): centreline from each ring point to the city centre. Straight or very gentle curves, same alignment code and smoothness rules. CP6.1.
- 6.2 **City centre node (D7).** The four radials end at one grade-separated node. Calculation sheet: through demand per axis, circle diameter or flyover geometry, entry/exit radii. CP6.2.
- 6.3 **Outward roads:** M8 links to other city sites, M6 branches to the important areas (D8), the island bridge. Each with its own centreline (same recipe as step 2). CP6.3.
- 6.4 **Demand and lane ladder:** zone weights, assigned flows, lane counts by 3.13 for every link. Table of link, AADT, lanes, class. CP6.4.
- 6.5 **Lane reductions designed** (8 -> 6 -> 4 -> 2): where, by exit or by taper, lane balance, taper length, with the calculations. CP6.5.
- 6.6 **Network crossing check** (X1-X5, section 3.11). Every intersection must belong to the interchange schedule. CP6.6.

### Step 7: All other road classes (flat and low land)
Micro-steps: 7.1 one class at a time (section row, alignment rules, check row), 7.2 its markings, 7.3 a sample stretch in game. CP after each class.
For each class create: section table row (offsets from the centreline, like 3.5), alignment rules, profile rules, markings, terrain cut, check-script row. All values are metres.

| Class | Carriageway | Lane | Shoulder / kerb | Sidewalk / cycle | Median | Design speed | Max grade | Min radius (V, e 6 %) | Surface | Notes |
|-------|-------------|------|-----------------|------------------|--------|--------------|-----------|-----------------------|---------|-------|
| M6 motorway | 2 x 3 lanes | 3.65 | 1.5 in + 3.0 out | none | 6.0 | 100-120 | 4 % | 395-665 | asphalt | same recipe as M8, ROW half 36 |
| M4 motorway | 2 x 2 lanes | 3.65 | 1.5 + 3.0 | none | 4.0 | 100 | 4 % | 395 | asphalt | ROW half 32 |
| EX expressway | 2 x 2 lanes | 3.5 | 1.0 + 2.5 | none | 3-6 | 80-100 | 5 % | 230-395 | asphalt | few at-grade right-in/right-out access (left-in/left-out on LHT) |
| A-D divided arterial | 2 x 2 or 2 x 3 | 3.5 | kerb, 0.5 shy | 2.5 both sides | 3-6 | 70-80 | 6 % | 175-230 | asphalt | signals, roundabout or interchange, bus bays |
| A-U undivided arterial | 1 + 1 (+ turn pocket 3.0) | 3.5 | kerb | 2.0 both sides | painted 1.0 | 60 | 6 % | 113 | asphalt | turn pockets at junctions |
| Sub-arterial | 1 + 1 | 3.3-3.5 | kerb | 2.0 | none | 50-60 | 7 % | 73-113 | asphalt | links arterial to collector |
| C collector | 1 + 1 | 3.3 | kerb, parking 2.0 optional | 1.8-2.0 | none | 50 | 8 % | 73 | asphalt | |
| L local street | 5.5-7.0 total | 2.75-3.5 | kerb | 1.5-2.0 | none | 30-40 | 10 % | 20-41 | asphalt / paver | speed humps allowed |
| Cul-de-sac / court | 5.0-5.5 | 2.5-2.75 | kerb | 1.5 | none | 20-30 | 10 % | turning circle R 9-12 | asphalt | max length 150 m |
| S service / frontage road | 1 + 1 or 1 one-way | 3.0-3.3 | kerb | 1.5-2.0 | none | 30-40 | 8 % | 20-41 | asphalt | 12-20 m outside the ROW of the main road |
| I industrial / heavy road | 2 x 1 or 2 x 2 | 3.65 | 1.5 paved | 1.5 one side | optional | 50-60 | 6 % | 73-113 (turning R >= 15 at gates) | asphalt / concrete | heavy trucks, wide corner radii 15-25 |
| Port / airport / depot access | 2 x 1 or 2 x 2 | 3.65 | 1.5 | 1.5 | optional | 40-60 | 5 % | 41-113 | concrete / asphalt | truck queue lane |
| Bus lane / BRT | 3.5 per direction | 3.5 | kerb | platform 3.0 | n/a | 40-60 | 6 % | 73-113 | concrete | stops with level boarding |
| Cycle track | 2.0 one-way / 3.0 two-way | n/a | 0.5 buffer | n/a | n/a | 20-30 | 5 % | 9-20 | asphalt (red/green) | separated by kerb or verge |
| Footpath / pedestrian street | 2.0-6.0 | n/a | kerb | n/a | n/a | 5 | 8 % (ramp 1:12) | free | paver | emergency vehicle access 3.5 |
| Rural paved road | 1 + 1 | 3.0 | 0.75 earth | none | none | 40-50 | 8 % | 41-73 | asphalt | village link |
| E earth / village / farm track | 3.0-4.0 | single | none | none | none | 20-25 | 12 % | 9-20 | dirt / gravel | no markings, no pad, no traffic |
| Forest / farm service track | 3.0 | single | none | none | none | 15-20 | 12 % | 9 | dirt | passing bay every 300 m |
| CW causeway / river-embankment / dam-crest road | 1 + 1 | 3.3 | 1.0 + parapet | optional 1.5 | none | 40-50 | 4 % | 41-73 | asphalt | rock-protected slope, culverts every 100 m |
| Coastal / lakeside road | 1 + 1 | 3.3-3.5 | 1.5 | 2.0 promenade | none | 40-60 | 6 % | 41-113 | asphalt | seawall / revetment, drainage to the water |
| Bridge / viaduct deck | same as the road | same | parapet 0.6 | 1.5 | same | same | same | same | asphalt on deck | |
| Island / sea bridge | 2 x 2 or 1 + 1 | 3.5 | 1.5 | optional | barrier | 80 | 4 % | 230 | asphalt | long viaduct, rises for ship clearance |
| Tunnel road | 1 + 1 or 2 x 2 | 3.5 | 0.5-1.0 | 0.6 service walk | wall / barrier | 40-80 | 4 % | 41-230 | concrete / asphalt | height 5.5 + 0.5 |
| Parking aisle / lot road | 5.5-6.0 | 2.75-3.0 | none | 1.5 | none | 10-15 | 5 % | R 6-9 | asphalt | 90 degree bays 2.5 x 5.0 |
| Private driveway | 3.0-3.5 | single | none | none | none | 10 | 12 % | R 6 | asphalt / paver | |
| Emergency / maintenance access | 3.5-4.0 | single | 0.5 | none | none | 20 | 10 % | 9-20 | gravel / concrete | gated |

Other items per class (do after the main classes work):
- **Roundabout (RB):** single lane (inscribed diameter 30-45 m), two lane (50-70 m), splitter islands, entry deflection, exit radius, pedestrian crossing set back 6-8 m.
- **One-way pairs, slip lanes (channelised turns), bus bays, U-turn openings, pedestrian crossings, median openings.**
- Acceptance for this step: every row above has its section row in the standards table, a check-script row, and a visible sample in game (one stretch per class, driven or walked).

### Step 7H: HILL AND MOUNTAIN ROADS (pahari / pathure road)
Micro-steps: 7H.1 terrain class map and hill road corridors (D5), 7H.2 contour walk and grade budget, 7H.3 hairpins, 7H.4 widening and grade compensation, 7H.5 profile, cut, walls, tunnel test, 7H.6 drainage and safety, 7H.7 in game and drive test. CP after each.
Do this as its own step. It needs the hill rules of section 3.10 and a different alignment method.

- Deliverable: HP, HS, HG and HT roads over the hills and rocky areas of the map, with hairpins, retaining walls, rock cuts, drains, bridges over gullies, tunnels where rules say so, passing bays, climbing lanes, runaway truck ramps.
- How (alignment, "contour walking"):
  1. Pick the start and end points and the hill class (HP / HS / HG / HT).
  2. Compute the grade budget: `L = deltaH / g` (g = chosen design grade, 5-6 % for HP, 6-7 % for HG). If the straight distance is shorter than L, the road needs extra length: use a **gradient-line walk** (walk along the ground at a fixed grade, following the contour) and, where the slope is too steep, a **switchback pair** (hairpin on a spur or bench).
  3. Place hairpins by the rules of 3.10 (inner radius >= 14-15 m, 60 m between hairpins, grade <= 4 % on the bend).
  4. Join the walk segments with spirals and arcs (the same alignment code as step 2, with hill design speed). Add curve widening and the grade compensation of 3.10.
  5. Profile: follow the ground with half-cut / half-fill; where cut > 12 m, a ridge crossing, or valley fill > 8 m, test a **tunnel** or a **viaduct / bridge** and take the shorter, cheaper, safer one.
  6. Cross-section: hill-side catch drain, side drain, valley-side barrier or parapet, retaining / breast wall by wall rules, benches on high cut slopes.
  7. Drainage plan: cross-drain culverts at least every 100-200 m, at every gully, scuppers, outlets to a natural channel.
  8. Safety plan: passing bays, chevrons, delineators, mirrors, climbing lane and runaway ramp checks.
  9. Terrain integration: cut/fill with rock slope, wall meshes, rocky material for the cut face (stone look), rockfall barrier.
- Acceptance: grade, hairpin spacing, radius and widening checks pass; every gully has a culvert or bridge; every valley-side drop > 3 m has a barrier; no road on the steepest or unstable cells; hairpins on spurs not in gullies; the player and AI can drive the whole hill road up and down; truck AI uses the climbing lane / escape ramp; `scripts/hill-check.ts` passes.

### Step 8: At-grade junctions (T junctions and roundabouts only, rule X1)
Micro-steps: 8.1 T junction, 8.2 roundabout single lane, 8.3 roundabout two lane, 8.4 staggered T pair (replaces a +), 8.5 slip lanes and turn pockets. CP after each.
- Types: T junction, cross junction, skewed junction (angle >= 70 degrees, else realign), signalised junction with turn pockets, roundabout, mini-roundabout for local streets.
- How: build a junction "pad" from the corner radii (kerb radius 8-15 m on collectors, up to 25 m with a slip lane on arterials), taper the incoming sections, set the pad plane height from the profiles of the roads that meet.
- Acceptance: no overlap of kerbs, corner radius checks pass, the pad height blends with all arms within the grade limit.

### Step 9: GRADE-SEPARATED INTERCHANGES (various designs)
Micro-steps: 9.1 interchange schedule (table below, user approves the list), 9.2 one interchange type at a time: local frame, ramp centrelines, profile, structures, validation, lane connectivity, terrain (each type is its own CP), 9.3 flyovers and underpasses, 9.4 service roads to the interchanges.
Choose the type by the road pair and demand (low / medium / high). Every type must be mirrored for the drive side (D1).

| Type | Legs | Use when | Main features |
|------|------|----------|---------------|
| Trumpet | 3 | motorway end / branch onto a road | one loop ramp, two direct ramps, one structure |
| Standard diamond | 4 | motorway x arterial, low-medium demand | 4 ramps, two signalised or stop terminals on the cross road |
| Tight / compressed diamond | 4 | urban, little land | short ramps, terminals close to the bridge |
| SPUI (single point urban interchange) | 4 | urban, high turning volume, little land | one signal for all ramp movements under the bridge |
| Diverging diamond (DDI) | 4 | arterial crossing, high left-turn volume | cross road traffic switches side between terminals |
| Partial cloverleaf (parclo A, B, AB) | 4 | one quadrant limited (river, rail, building) | 2-3 loops, rest diamond style ramps |
| Full cloverleaf | 4 | two motorways, medium demand | 4 loops, use collector-distributor roads to avoid weaving |
| Directional T | 3 | motorway to motorway | direct flyover ramps, no loops |
| Stack (4-level) | 4 | two motorways, very high demand | all movements direct, two ramp levels, long viaduct |
| Turbine / whirl | 4 | two motorways, high demand | spiral directional ramps, fewer levels |
| Roundabout interchange (dumbbell) | 4 | rural, low demand | two roundabouts on the cross road |
| Flyover / underpass only | 2 | arterial over arterial, rail over road | no ramps |

How to build any type (same recipe):
1. Local frame: origin at the crossing point, yaw of the main road; the code in `Geometry2D.ts` already does this.
2. Choose which road goes over (`upper`).
3. Lay out the ramp centrelines: straight - spiral - arc - spiral - straight, with the design speed of the ramp type (loop 30-40, semi-direct 50-60, direct 60-80). Check minimum radius with section 3.2.
4. Exit and entry lanes: taper + parallel lane lengths from section 3.8, gore nose offset, ramp separation.
5. Profile: bridge deck at clearance + deck depth, ramp grade <= 5 %, check K and SSD, check that all ramp heights close at the joins.
6. Structures: bridge abutments outside the clear zone of the road below, pier positions not in the median or the ramp gore.
7. Validate with `Validate.ts` (weave, gore spacing, sight distance, spacing to the next interchange).
8. Build lane-level connectivity (which lane leads to which ramp) for the traffic graph (step 10).
9. Terrain: cut/fill for ramps, embankments in loops, drainage.

- Acceptance: at least one interchange of each type that fits the map is built and driven through; every check of `Validate.ts` passes; all movements (including U-turn where the type allows) are possible in the traffic graph.


**Interchange schedule (fill in step 9.1; the user approves it). Variety is intended: do not use the same type everywhere.**

| Location | Road pair | Suggested type | Why |
|----------|-----------|----------------|-----|
| Ring x N radial | M8 x A-D (4 lane) | partial cloverleaf (parclo AB) | land free on one side, medium demand |
| Ring x E radial | M8 x A-D | SPUI | little land, high turning volume |
| Ring x S radial | M8 x A-D | diverging diamond (DDI) | high left-turn volume on the radial (right on RHT) |
| Ring x W radial | M8 x A-D | tight diamond or standard diamond | low-medium demand |
| Ring x outward M8 | M8 x M8 | stack (4-level) or turbine | highest demand, all movements direct |
| Ring x M6 branch to important area | M8 x M6 | directional T or trumpet | 3-leg, direct ramps |
| M8 x M6 / M4 further out | M x M | full cloverleaf with collector-distributor roads | medium demand, space available |
| Airport, port, industrial entries | M6 x A | trumpet or diamond | single entry, clear queue storage |
| City centre | 4 radials | multi-level roundabout (D7) | no straight crossing |
| Arterial over arterial, over rail | A x A, A x rail | flyover / underpass only | no ramps, rule X3 |
| Rural link to the island or small site | M4 x A | roundabout interchange (dumbbell) | low demand |

### Step 10: Network assembly and hierarchy
- Deliverable: complete network following the hierarchy table of 3.9: motorways between all city sites, arterials inside and between districts, collectors, local streets, service roads, earth tracks.
- How: plan top-down (M, then EX, A, C, L, S, I, E, then the hill roads HP, HS, HG, HT, which are planned on the hill ground cells). Each lower class is planned after the higher classes are final, so it attaches to finished roads. Local streets are generated per city area (reuse the idea of `LocalRoads.ts`, rewrite to the new section tables). Enforce junction spacing and angles. No road inside a building plot, lake or the railway corridor unless a crossing is designed.
- Acceptance: network is connected, no dead-end except cul-de-sacs, no illegal connection (a local street onto a motorway), stats printed (km per class, number of bridges, interchanges, junctions).

### Step 11: Traffic graph and gameplay
- Deliverable: `RoadGraph` rebuilt from the new data with lanes, speed limits, turn movements (including ramps and roundabouts), U-turns, signals, bus stops.
- Things that depended on roads and must be reconnected: AI cars, highway traffic (cargo trucks, oil tankers, higher highway speed), AI petrol/charging station detours, police, missions and the green mission cylinders, player and vehicle spawn points, taxi and bus routes.
- Acceptance: AI cars drive every road class without getting stuck, they use ramps and roundabouts correctly, no car spawns off-road.

### Step 12: Furniture, markings and signs
- Lane markings, arrows, crossings, stop lines, street lights (`StreetLights` reads the new data), guardrails, median planting, footpaths, bus stops.
- Road signs: add the bilingual Bangla/English signs again (overhead gantries on motorways and arterials, side boards elsewhere). They need a new road distance planner on the new network.
- Acceptance: every road class has its markings and furniture, signs show the right destination and distance.

### Step 13: Rail, performance, QA
- Rail crossings (road over rail, rail over road, level crossing) with the new clearances, check the rail viaduct pillars still match.
- Check chunk build time, memory, draw calls, worker messages.
- Run all check scripts, `npm run build`, drive every road class, fly over the full map.
- Acceptance: no hitch above the budget in `PERFORMANCE_RULES.md`, no visual gap, no error in the console.

---

## 6. Definition of done for any road

A road is done only when all of these are true:
1. Horizontal, vertical, section and structure checks pass.
2. Terrain follows it, no gap, no z-fighting.
3. Player and AI can drive it.
4. Markings and furniture exist for its class.
5. It is listed in the status table (section 12) with its checks.

---

## 7. Known risks

- Terrain, rail, port, traffic, street lights and vegetation all read `RoadNetwork`. Changing its data shape breaks them: keep the facade stable.
- The old `RoadSection` numbers were used by buildings and the city plan (`planHalfWidth`). When the new section table is wider, move buildings and plantings out of the ROW instead of squeezing the road.
- Interchanges are big: a full stack needs a long, high viaduct. Reserve land (about 600 x 600 m) before the city plan puts buildings there.
- Left-hand traffic: all ramp topology is mirrored. Decide D1 first, not later.

---

## 8. Test scripts to create

`scripts/standards-check.ts`, `alignment-check.ts`, `profile-check.ts`, `section-check.ts`, `interchange-check.ts`, `hill-check.ts`, `network-check.ts`. Each prints a table and exits non-zero on failure. Add them to `package.json` scripts.

---

## 9. What the old code can still give

- `src/interchange/Standards.ts`: friction table, SSD, weave limits, ramp grade (keep as `CRITERIA`).
- `src/interchange/Geometry2D.ts`, `Validate.ts`, `Patterns.ts`: ramp math and checks (verify each formula, rewrite what does not follow section 3).
- `src/roads/RoadTypes.ts`: the `RoadSpec` shape (splines with `xs, zs, ys, nx, nz, cum`) is fine as the facade data.

---

## 10. Out of scope for now

Road signs, traffic lights logic changes, new vehicle types, weather effects on roads. They come back in steps 11-12.

---

## 11. Questions the user must answer (the AI asks them in micro-step 0.1)

1. Which point is the city centre, and which city site(s) are inside the ring (D6)?
2. Left-hand or right-hand traffic (D1)?
3. Which hills and rocky areas must get roads, which peaks or passes must be connected (D5)?
4. Which are the "important areas" that get 6-lane or 4-lane links (D8)?
5. City centre node: multi-level roundabout or 4-level stack (D7)?
6. Confirm the reading of the user's wish: "4 lane roads come into the city centre from the four sides (north, east, south, west)" means four 2 + 2 radials. Change it if you meant something else.
7. Maximum length of the first version of the M8 (how many km), or build the whole ring first?

---

## 12. STATUS TABLE (update here, no new md files)

| Step | Name | Status | User OK | Notes |
|------|------|--------|---------|-------|
| 0.1 | Decisions D1-D8 | proposed, waiting OK | | D1 left-hand; D2 AASHTO-style, one CRITERIA; D6 city centre = map centre (0,0) = easting/northing 5000,5000; D7 multi-level roundabout; D4 fill > 7 m beside a river valley = viaduct; D5, D8 later (Step 7H, Step 6); ring design speed V100. SHAPE of all roads comes from Roads.zip (ring = F3, radials F4 N, F5 S, F6 W, F7 E), numbers are new |
| 0.2 | Config schema, empty modules | not started | | |
| 1.1 | Criteria | done, waiting OK | | src/roads/standards/Criteria.ts (re-exports interchange CRITERIA + DESIGN) |
| 1.2 | Road class table | done, waiting OK | | RoadClasses.ts, 19 classes |
| 1.3 | Cross-section tables | done, waiting OK | | SectionTable.ts: M8 (table 3.5), M6 and M4 derived (proposal). A, C, L tables in Step 7 |
| 1.4 | Check functions and worked examples | done, waiting OK | | Checks.ts; scripts/standards-check.ts: all section 13 examples PASS within 2 %. Open points: entry lane uses full V (241 m, as example 5); kink test = change of heading step > 0.1 deg; closure curvature tolerance 1e-6 (proposal) |
| 2.1 | City centre and ring size | done, waiting OK | | Ring size is given by the Roads.zip F3 shape: 21.39 km, 5710 x 6195 m, not centred on (0,0) (about 700 m north). On V100 it has 5 places below Rmin 394 m (765 m) and 11 below 591 m (2305 m): Step 2.2 refits it with straight-spiral-arc |
| 2.2 | Ring closed alignment | REFITTED 2026-11-13 (version 2), waiting OK | | User chose option C: go round the mountains, airport and rail. 10 PIs (src/roads/alignment/RingAlignment.ts; version 1 kept in docs/RingAlignment.v1.ts). Method: tools/ring-route.py (least-cost corridor on a 25 m raster from scripts/ring-raster-export.ts), tools/ring-fit.py, tools/ring-opt.py (local search on slope / water / fenced areas / rail / stations cost). Length 19.33 km, V100, R 591-1816 m, Ls 100, closure gap 6e-12 m. Deviation from Roads.zip F3 shape: mean 332 m, max 1181 m (the mountains force it). Open: is this deviation acceptable? |
| 2.3 | Smoothness report | done for version 2, waiting OK | | scripts/ring-alignment-check.ts: ALL CHECKS PASS (0 kinks, dk/ds ok, R >= 591, straights >= 6V / 2V) |
| 2.4 | Samples and overlay | samples redone, RADIAL POINTS NOT FINAL | | docs/ring_samples_5m.csv (3867 rows, new ring). Radial meeting points must be redone: N (st 10238) and E (st 14541) fall inside curves, S (st 240) has only 99 m straight on one side, W (st 5154) is on a 2.9 km straight (good). Ring has no 1 km straight near N, E, S: user decides (move the radial ends, or add a straight) |
| 2.5 | Ground check | done for version 2, waiting OK | | scripts/ring-ground-check.ts, docs/ring_ground_check.txt/.png, docs/ring_v2_map.png. Version 2: 5 water crossings (st 830 delta river 95 m wide, 8200, 12360, 14050, 15460), STEEP ground 345 m (1.8 %, was 1795 m), hilly 18.6 %, airport fence 235 m away (was ON the ring), no fenced area crossed (eng-steel, eng-aerospace edges touch the ROW edge), 7 rail crossings (st 6876, 7093, 8840, 11316, 12596, 17340, 18909: all must be flyovers, X5) |
| 3.1-3.5 | Ring profile | done for version 2, waiting OK | | User decision: if a hill must be cut, cut it. tools/ring-profile.py + scripts/ring-profile-export.ts; docs/ring_profile.png/.csv/ring_profile_report.txt. Grade line every 60 m, max grade 4 %, K 75, closed. Cut 1:2 (first 8 m) then 8 m tiers 1:1.5 + 2 m bench, fill 1:3, formation half width 24.2 m. TOTAL cut 7.9 million m3, fill 8.0 million m3 (version 1: 27.8 / 19.1). Deep cuts: st 6350-6760 (58 m), 8320-8900 (53 m), 14620-15110 (47 m), 2970-3260 (30 m). Tall fills over 7 m at 16 places, worst st 15250-16240 (41 m) and 14000-14540 (27 m): viaduct or accept embankment. 5 bridges. Open: accept the 4 deep cuts and tall fills |
| 4.1-4.5 | Ring cross-section | not started | | |
| 5.1-5.5 | Ring in game | not started | | |
| 6.1 | Four radials | not started | | |
| 6.2 | City centre node | not started | | |
| 6.3 | Outward M8 / M6 roads | not started | | |
| 6.4 | Demand and lane ladder | not started | | |
| 6.5 | Lane reductions | not started | | |
| 6.6 | Crossing check | not started | | |
| 7 | All other classes (flat land) | not started | | |
| 7H | Hill and mountain roads | not started | | |
| 8 | At-grade junctions | not started | | |
| 9 | Interchanges and flyovers | not started | | |
| 10 | Network and hierarchy | not started | | |
| 11 | Traffic graph | not started | | |
| 12 | Furniture and signs | not started | | |
| 13 | Rail, performance, QA | not started | | |

---

## 13. Calculation sheet: template and worked examples

For every road and every structure the AI shows a sheet like this: **Input -> Formula -> Result -> Check**. The numbers below are worked examples (check values for the scripts). Replace the inputs with the chosen values.

**Example 1: ring radius and superelevation (V = 100 km/h, R = 2 000 m)**
- Minimum radius: `Rmin = V^2 / (127 (e + f))` with e = 0.08, f = 0.12 -> 10 000 / (127 x 0.20) = **394 m**.
- Margin: R / Rmin = 2 000 / 394 = **5.1** (needs >= 1.5) -> PASS.
- Needed e + f: 10 000 / (127 x 2 000) = 0.0394. This is below the friction f = 0.12, so no superelevation is needed: the carriageway keeps its **normal 2 % crown/cross fall**.
- Heading change per 100 m: 100 / 2 000 rad = **2.9 degrees**, smooth.
- Ring length (circle R = 2 000 m): 2 pi R = **12.57 km**.

**Example 2: spiral on a connecting curve (V = 120, R = 1 500 m, C = 0.6 m/s^3)**
- `Ls = 0.0214 V^3 / (R C)` = 0.0214 x 1 728 000 / (1 500 x 0.6) = **41 m**.
- Two-second rule: 120 / 3.6 x 2 = **67 m**. Use the larger, rounded up -> **Ls = 70 m**.

**Example 3: stopping sight distance (t = 2.5 s, a = 3.4 m/s^2, level)**
- `SSD = V t / 3.6 + V^2 / (254 (a/9.81 + G))`
- V = 120: 83.3 + 14 400 / (254 x 0.3466) = 83.3 + 163.6 = **247 m**
- V = 100: 69.4 + 113.6 = **183 m**
- V = 80: 55.6 + 72.7 = **128 m**

**Example 4: vertical curves from SSD (V = 100, S = 183 m)**
- Crest: `K = S^2 / 658` = 33 489 / 658 = **51** (h1 = 1.08 m eye, h2 = 0.60 m object). Grade change A = 3 % -> `L = K A` = **153 m**.
- Sag (headlight): `K = S^2 / (120 + 3.5 S)` = 33 489 / 760.5 = **44**.
- V = 120, S = 247: crest K = **93**.

**Example 5: exit and entry lanes (ring V = 100 to ramp V = 50)**
- Exit deceleration: v1 = 27.78 m/s, v2 = 13.89 m/s, a = 2.5 -> `d = (v1^2 - v2^2) / (2 a)` = (771.6 - 192.9) / 5 = **116 m** of parallel lane, plus a taper (1:25 over 3.65 m, about 90 m).
- Entry acceleration: a = 1.2 -> 578.7 / 2.4 = **241 m**, plus a taper (1:50, about 183 m).

**Example 6: ramp radii**
- Loop ramp, V = 40: 1 600 / (127 x (0.08 + 0.23)) = **41 m**.
- Semi-direct ramp, V = 60: 3 600 / (127 x (0.08 + 0.17)) = **113 m**.

**Example 7: lane-drop taper (W = 3.65 m)**
- V = 100: `L = 0.62 W V` = **226 m**.
- V = 60: `L = W V^2 / 155` = **85 m**.

**Example 8: lane balance at an exit**
- Ring 4 lanes continuing, 2-lane exit to a branch: `N_before = 4 + 2 - 1` = **5 lanes** upstream (one auxiliary lane, dropped at the exit).

**Example 9: lanes from demand (see table in 3.13)**
- AADT 120 000, K = 0.10, D = 0.60 -> 7 200 veh/h in the busy direction / 1 800 = **4 lanes** per direction -> 8-lane M8.

**Example 10: hill (V = 30, R = 20 m, one hairpin)**
- Rmin = 900 / (127 x (0.08 + 0.28)) = **19.7 m** -> R = 20 m just passes, use 25 m for comfort.
- Grade compensation on R = 25 m: `(30 + R) / R` = 2.2 % but never more than `75 / R` = 3 % -> take **2.2 %**, so a 6 % climb becomes **3.8 %** on the bend (and the bend itself stays <= 4 %).
- Widening: `Wm = n l^2 / (2 R)` with n = 2, l = 6 m -> 72 / 50 = 1.44 m, `Wps = V / (9.5 sqrt R)` = 30 / 47.5 = 0.63 m -> **2.1 m extra** carriageway on the bend.

Every number above is a check value for `standards-check.ts`. The AI states the standard it uses, and says "verify with the project engineer" for any value that is a local rule.

---

## 14. How to start in a NEW chat

**Upload:** the latest project zip (`evcity_noroads.zip`) and this file (`HANDOFF_ROAD_DESIGN.md`).

**Paste this first message:**

```
Read HANDOFF_ROAD_DESIGN.md completely. We are designing all roads of the evcity game from scratch, step by step.
Rules: work on ONE micro-step only (the first one that is not OK in section 12). Show the calculation sheet, the numbers and a picture/table I can check, then STOP and wait for my OK. Do not start the next micro-step before I say OK. Do not create new md files: update the status table in section 12 of HANDOFF_ROAD_DESIGN.md.
Reply in simple English (I may write in Bangla/Banglish).
Start with micro-step 0.1: ask me the questions of section 11 one by one.
```

**For the next micro-steps just write:** `OK, next micro-step` (or tell what to change).

**When the AI finishes a micro-step it must:** save its code in the project, update section 12, run the checks, and give a new zip of the project when the user asks for it.

**When the chat gets long:** ask the AI to update section 12 and the notes, then start a new chat with the same starter prompt. The status table is the memory of the work.
