# HANDOFF: ROAD DESIGN FROM SCRATCH (evcity)

Language: English only. This is the ONLY md file for the road work. Do not create CHANGES_*.md files. When a step is done, update the status table in section 12 of this file.

---

## 0. Goal and current state

**Goal:** design every road of the 10 x 10 km map again, properly, like a road engineer would. The old roads were removed because they were not designed with engineering rules.

**CHANGE 2026-11-13 (user decision, read section 15 FIRST for anything about radials, the city centre node or J1):** the four radials are now **8-lane (M8)**, not 4-lane. They run from the four sides of the ring into the city and meet at ONE grade-separated junction called **J1** (4-level stack). J1 is NOT at the exact city centre: it is moved about 800 m to the north-east so big vehicles stay out of the centre and so it does not clash with the railway. The city centre gets a 4-lane link from J1. Wherever this file still says "4-lane radial" or "city centre node = roundabout for the four radials", section 15 wins.

**CHANGE 2026-11-13 (later, user decision, read 15.8 FIRST): J1 is NOT a stack any more.** J1 stays 8-lane x 8-lane in the city (roads from 4 sides) but at GROUND LEVEL: no flyover, no ramps, one big signalised "+" crossing. The four ring x radial junctions are 8 x 8 THREE-leg (T) interchanges (ring both ways + the radial), each a different design. So there are FIVE 8 x 8 junctions and FIVE different designs. The stack code in `src/interchange/m8/` is kept as a reference only (`Config.roads.interchangeJ1` stays OFF).

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

**Planned exception to X1 and to the M8 "fully controlled" rule (user decision 2026-11-13): J1.** J1 is the one place where two M8 roads cross at the same level, as a signalised "+" in the city. It is listed in the interchange schedule as type "at-grade signalised cross". Every other M8 x M8 meeting is a grade-separated interchange. The code check (`network-check.ts`) must accept J1 and nothing else.

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

**REVISED 2026-11-13 (user decision): the M8 x M8 rows above are replaced by FIVE junctions, see the table in 15.8** (J1 ground-level "+", and four different 3-leg interchanges on the ring). Left-hand traffic, so every ramp is mirrored (D1).

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
| 2.2 | Ring closed alignment | REFITTED 2026-11-13 (version 3, small south refit) | OK 2026-11-13 | Version 2 -> 3: ONLY PI 1 and PI 2 changed (PI 1 x -402.24 z 2329.53 R 601, was -459.03 2348.47 R 632; PI 2 x -2461.28 z 2251.29 R 786, was -2453.85 2389.45 R 929), so the south straight grows from 826 m to 1058 m (stations 705-1763). Search: local search of PI 1 and PI 2 only, same cost raster as tools/ring-route.py / ring-opt.py, with hard rules: no more water, no more steep ground in the 80 m ROW. 10 PIs (src/roads/alignment/RingAlignment.ts; version 1 in docs/RingAlignment.v1.ts, version 2 in docs/RingAlignment.v2.ts). Length 19.293 km (v2 19.330), V100, R 591-1816 m, Ls 100, closure gap 9e-12 m. Deviation from Roads.zip F3 shape: mean 335 m, max 1181 m. Open: is this deviation acceptable? NOTE: ALL STATION NUMBERS CHANGED a little (v2 -> v3, up to about 40 m) |
| 2.3 | Smoothness report | done for version 3 | OK 2026-11-13 | scripts/ring-alignment-check.ts: ALL CHECKS PASS (0 kinks, dk/ds ok, R >= 591, straights >= 6V / 2V; smallest straight 255 m). Output in docs/STEP2_CHECK_OUTPUT.txt |
| 2.4 | Samples and meeting points | done (option A + small south refit) | OK 2026-11-13 | docs/ring_samples_5m.csv (3859 rows), docs/STEP24_OUTPUT.txt, docs/ring_radial_joins.png. Radial meeting points (RING_RADIAL_JOINS), each on a straight with >= 500 m clear on both sides: N st 11549 (x 1711.5, z -3145.5, straight 11049-12512, 500/963 m clear, 1283 m from the old end, radial turns 20 deg, crossing 74 deg); E st 15309 (x 2967.4, z 190.1, straight 14809-15949, 500/640 m, 827 m, 16 deg, 87 deg); S st 1205 (x -1131.9, z 2301.8, straight 705-1763, 500/558 m, 1038 m, 24 deg, 66 deg); W st 5104 (x -2595.0, z -591.1, straight 3031-6014, 2073/910 m, 173 m, 1 deg, 74 deg). Spacing between junctions 4869, 5089, 4305, 5029 m (rule >= 1600). User chose option A; S needed the small refit because the nearest straight was only 826 m |
| 2.5 | Ground check | done for version 3 | OK 2026-11-13 | scripts/ring-ground-check.ts, docs/ring_ground_check.txt (new). Version 3: 5 river crossings on the centreline (st 837 delta river 85 m wide, 8172, 12327, 14009, 15416; wet length 210 m, v2 220 m), STEEP ground 340 m (1.8 %, v2 345 m), hilly 18.9 % (v2 18.6 %: +46 m), same 265 m of lake edge inside the ROW (st 4185-4444, was also in v2), airport fence 235 m away, no fenced area crossed, 7 rail crossings (st 6830, 7047, 8794, 11270, 12550, 17294, 18860: all must be flyovers, X5). The pictures docs/ring_ground_check.png, ring_v2_map.png, ring_alignment.png, ring_marks.png, ring_shape_check.png and ring_overlay.html still show version 2 (not redrawn) |
| 3.1-3.5 | Ring profile | done for version 3 | OK 2026-11-13 | User decision: if a hill must be cut, cut it. tools/ring-profile.py + scripts/ring-profile-export.ts; docs/ring_profile.png/.csv/ring_profile_report.txt. Grade line every 60 m, max grade 4 %, K 75, closed. Cut 1:2 (first 8 m) then 8 m tiers 1:1.5 + 2 m bench, fill 1:3, formation half width 24.2 m. TOTAL cut 7.85 million m3, fill 8.22 million m3 (v2: 7.91 / 7.97; v1: 27.8 / 19.1). Deep cuts: st 6310-6700 (55 m), 8280-8860 (53 m), 14570-15070 (47 m), 2900-3220 (31 m). Tall fills over 7 m at 17 places (v2: 16), worst st 15200-16200 (41.5 m) and 13960-14490 (26 m), and 6800-8060 now one stretch with max 20.7 m: viaduct or accept embankment. 5 bridges. Open: accept the 4 deep cuts and tall fills; fill is +0.25 million m3 against v2 |
| 4.1-4.5 | Ring cross-section | 4.1 done, waiting OK (4.2-4.5 not started) | | 4.1: scripts/ring-section-table.ts (prints the offset table and 9 checks, all PASS), docs/STEP41_OUTPUT.txt, docs/ring_section_m8.png. Offsets from the centreline, one side (mirrored on the other side): median 0-3.0, inner shoulder 3.0-4.5, 4 lanes 4.5-19.1 (3.65 m each), outer shoulder 19.1-22.1, barrier 22.1-22.7, verge + ditch 22.7-24.2 (1.5 wide, 0.5 deep), clear zone 24.2-32.0, ROW strip 32.0-40.0. One direction 19.1 m, pavement edge to pavement edge 44.2 m (median included), paved width 38.2 m, formation 48.4 m, ROW 80.0 m. Ring (19.293 km): ROW 154 ha, paved 74 ha. Cross falls: lanes 2 %, shoulders 4 % (fall of 0.472 m from the median edge to the pavement edge). Same numbers as SECTION_M8 (src/roads/standards/SectionTable.ts), nothing in the code changed |
| 5.1-5.5 | Ring in game | 5.1 done, 5.2a done (terrain cut), 5.2b done (shader section, waiting game check), 5.3a done, 5.3b done (structures registered + terrain rule, waiting OK), 5.3c (designs / meshes), 5.4, 5.5 not started | | 5.1: the ring is ONE closed tier-1 highway road `M8` in RoadNetwork (`layoutRing()`, Config.roads.ring.enabled, works with activeTier 0). roads/ring/RingRoad.ts (alignment sampled every ~8 m + SECTION_M8 fields), RingProfile.ts + RingProfileData.ts (grade line from docs/ring_profile.csv, regenerate with tools/ring-profile-to-ts.py), RawRoad.section override (the Config highway section would otherwise replace the M8 section). Heights are used exactly (fixedY). Checks: scripts/ring-profile-check.ts, ring-road-check.ts, ring-facade-check.ts, all PASS, output docs/STEP51_OUTPUT.txt. Max grade 4.009 % between neighbouring points (4 % limit, curve overshoot 0.009 %). 5.2a (terrain cut): RoadSpec.daylight; RoadNetwork.apply() cuts / fills the ground beside the ring along DAYLIGHT slopes: flat platform (halfWidth + shoulder = 22.7 m), then fill 1:3, cut 1:2, and where the hill is steeper than 1:2 a ROCK CUT up to 4:1 (76 deg) (user decision: if a hill must be cut, cut it). Face length is found from the real ground (daylightReach, up to 200 m each side), so no wall is left. About 16 % of the ring (stations 2800-3230, 6290-6720, 8250-8880, 14560-15150, 17400-17470, 17980-18490 and short ones) needs a cut steeper than 1:2. scripts/ring-cut-check.ts (every point, 2412) ALL PASS. 5.2b (shader section): the road shader finds a divided road's section by half width; 22.1 was not in its table, so the ring got no median and no lane lines. Now the ring has its own row (src/roads/section/ShaderSection.ts, read from SECTION_M8 + MARKING, nothing typed twice): median 0-3.0 m (flat concrete for now), inner shoulder 1.5, 4 lanes x 3.65, solid yellow edge line at 4.425 m, dashed white lane lines (3 m + 9 m) at 8.15 / 11.80 / 15.45 m, solid white edge line at 19.175 m, lines 0.15 m wide; no wheel-wear on the paved shoulders. RoadMaterial.ts: evcSection + new evcEdges(hw), cache key v17. Other roads keep their old lines. scripts/ring-shader-check.ts: 15 checks PASS (data + wiring only; the look is NOT checked yet, needs a game screenshot). Not done in 5.2b: the median is a flat strip (no kerb / planting / barrier), far-LOD terrain road colour has no lane lines, the dash pattern does not close exactly at the ring seam (one short dash possible). NOT yet: bridges / viaducts / culverts (5.3: the 58 m fill near station 15080 and the 41 m fill near 15540 must become viaducts), pads, physics check (5.4), build time of the faces (5.5). 5.3a (table only, no src/ change): docs/STEP53A_OUTPUT.txt. User decision: every bridge / viaduct is engineered and architectural, NOT the same, modern designs (proposal: B1 st 837 cable-stayed one pylon, B2 st 8172 steel network arch, B3 st 12327 extradosed, B4 st 14009 and B5 st 15416 long segmental box-girder viaducts with slender piers, types wait for OK). Findings: B3 deck only 3.55 m above water (low, needs OK); B4 (deck 18.7 m above water) and B5 (34.6 m) lie inside tall fills 13960-14490 and 15200-16200, so they are long viaducts, B5 = same valley as the old '41 m fill near 15540'; the HANDOFF '58 m fill near 15080' is a CUT in ring_profile.csv, re-check in game terrain. 5.3b (done, docs/STEP53B_OUTPUT.txt, scripts/ring-structures-check.ts 5 checks PASS): RoadNetwork.bridgeRing() makes the structures of the ring (data only: BridgeSpec + RoadSpec.bridgeOf, no mesh / physics yet). A stretch is a structure when the centreline is wet (every river crossing, no dam) or the fill is > 7.5 m beside a river (D4) or the fill is > 25 m anywhere (new constant RING_VIADUCT_TALL, from the user's note about the 41 m fill; 25 m is MY choice, change it if you want another number); 16 m approach slab at each end (STRUCT.approach in roads/ring/RingStructures.ts, also STRUCT.deckDepth 1.5, groundGap 0.3, protectReach 60). Result: 6 structures: S1 st 776-896 (river 837, 96 m wet, underside 2.8 m over water), S2 8135-8207 (river 8172), S3 12294-12358 (river 12327, underside only 1.9 m over water = low, grade line NOT changed, user decision pending), S4 13950-14038 (river 14009), S5 14230-14334 (tall fill 25.8 m, viaduct), S6 15237-16037 (800 m viaduct, includes the river 15416, fill 41.5 m). The '58 m fill near 15080' of the old note is a CUT in the data, nothing built there. Terrain rule in RoadNetwork.apply(): (1) the piece that joins the embankment to a structure is a daylight piece (sday), (2) under the INNER part of a structure (RoadNetwork.sbridge = 2) the ground is never raised by a neighbouring embankment, (3) the ground under the whole slab incl. the approach slabs is carved to 1.8 m (deckDepth + gap) below the road surface, the NEAREST slab piece decides, and nothing is carved beyond the two ends. Other checks changed: ring-cut-check skips points inside structures, ring-facade-check expects 6 structures. ring-row-check has 1 FAIL that was there BEFORE (eng-steel 10399-11109, eng-aerospace 11649-11919 inside the corridor; not from 5.3). NOT yet: the individual designs and meshes of the structures (5.3c: each one engineered / architectural and different, modern, see the user decision above; the ring road ribbon over the structures is still the normal one), culverts, physics (5.4), build time (5.5) |
| 6.1 | Four M8 radials into J1 | REVISED 2026-11-13: 8-lane, meet at J1, J1 is AT GROUND LEVEL (15.8). Split into 6.1a-6.1e below | | old plan was four 4-lane radials to (0,0) |
| 6.1a | J1 site check | done. J1 POINT CHOSEN 2026-11-13: C8 (0, -250), later MOVED in J1-a to C9 (-117, -277), common yaw 17.6 deg east of north (the user left the choice to the AI: "choose what you think best"), see 15.8.4 | | scripts/j1-site-check.ts (real ground, real rail plan, rivers, zones, SITE0 city plan), docs/STEP61A_OUTPUT.txt, docs/j1_site_check.png, tools/j1-site-plot.py. RESULT: the proposal (650, -500) of 15.3 FAILS (26.9 % slope, 43 m height range, rail inside the box). None of the 9 points passes with a +-300 m footprint. Best: C8 (0, -250) passes everything with a +-200 m footprint, C7 (-50, -300) with +-250 m. Details and the open decisions are in 15.8 |
| J1-a | J1 calculation sheet and layout (15.9) | done 2026-11-13 at C9 (-117, -277): 12 PASS, 0 FAIL, waiting OK | | scripts/j1-ground-calc.ts (J1X / J1Z env = another point), docs/STEPJ1A_OUTPUT.txt, docs/j1a.json, docs/j1a_layout.png, tools/j1a-plot.py. POINT MOVED (user: "do what is best"): at C8 (0, -250) the east approach had only 189 m from the stop line, 104 m short (rail north-1 crosses the east axis at 288 m, nearly 90 deg; yaw scan 10-28 deg does not help). Fine scan of J1 along its own axes: best = 120 m west + 10 m south = C9 (-117, -277), yaw 17.6 kept; clear N 340, E 340, S 340, W 350 m against need N 330, E 324, S 330, W 324 m (margin >= 10 m). Site check of C9 (j1-site-check.ts, candidate C9): flat dry box +-200 m (same as C8), rail 396 m from the centre, bends N 15.1, E -8.8, S 4.0, W -10.2 deg (limit 20), arms >= 2498 m, dense city plan under the +-300 box 36 % (C8 50 %), centre 289 m from Central Station edge. LAYOUT per approach: inbound 1 left slip + 4 through + 2 right pockets = 7 lanes (25.6 m), outbound 4 + 1 = 5 lanes, central island 3 m; box 54.1 m wide, crosswalk 4 m, stop line 31.1 m from the centre; slip corner R 25 m (Rmin of 25 km/h 12.5 m). FLOWS ASSUMED (pcu/h, until 6.4) L/T/R: N 350/1200/300, E 280/1000/250, S 320/1100/300, W 300/1000/250 (AADT-equivalent 25-31 thousand). SIGNAL 4 phases (N+S through, N+S right pockets, E+W through, E+W right pockets; left = free slip lane): yellow 3.73 s, all red 3.61 s, L 29.4 s, Y 0.49, Webster C0 95 s -> cycle 100 s, greens 24 / 14 / 20 / 12 s, x <= 0.69, all flows x 1.21 still pass. QUEUES (95th, 8 m per pcu): through lane 81-90 m, right pocket 54-59 m. POCKET = braking 56 + storage + taper 85 = 194-200 m; plus step-down 100 -> 60 km/h 99 m: need from the stop line 293-299 m, available 309-319 m: all four FIT. PEDESTRIANS: leg 46.8 m, single stage 54 s, two-stage 33 s per stage, concurrent green only 20-24 s: at grade NOT possible, grade-separated crossing (rule 3.14): proposal underpass (ramp 41 m each side) if the water table allows (J1-c), else footbridge (ramp 78 m). NOTE: the 50 m rail buffer stops the clear length of E and S at 340 m (rail 68 m from the axis, needs 72); the arm rail crossings (E north-1 at about 409 m, S west-nw at about 411 m) are for 6.1d |
| J1-b | J1 geometry data (pure math) | not started | | |
| J1-c | J1 profile and terrain | not started | | |
| J1-d | J1 signals and markings data | not started | | |
| J1-e | J1 mesh and game layer | not started | | |
| J1-f | Re-zoning under J1 (old 6.2b for J1 only) | not started | | |
| 6.1b | Radial axis A (N + S) centrelines | not started | | |
| 6.1c | Radial axis B (E + W) centrelines | not started | | |
| 6.1d | Radial rail crossing list | not started | | |
| 6.1e | Radial ground check | not started | | |
| 6.2 | City centre link (4-lane) and centre node | REVISED: J1 is not the centre node, see section 15 | | |
| 6.2b | Re-zoning and buffers under J1 and the radials | not started | | |
| 6.3 | Outward M8 / M6 roads | not started | | |
| 6.4 | Demand and lane ladder | not started | | |
| 6.5 | Lane reductions | not started | | |
| 6.6 | Crossing check | not started | | |
| 7 | All other classes (flat land) | not started | | |
| 7H | Hill and mountain roads | not started | | |
| 8 | At-grade junctions | not started | | |
| 9.1 | Interchange schedule, M8 x M8 (now FIVE: J1 at the city + four ring x radial) | proposal done, waiting OK; open: five junctions but four designs, see 15.7 | | REVISED (user decision 2026-11-13, later): FIVE 8 x 8 junctions, FIVE different designs: J1 = ground-level signalised "+" (15.8) and four 3-leg (T) interchanges on the ring at N, E, S, W (table in 15.8). The list below (stack, turbine, cloverleaf, hybrid; all 4-leg) is the EARLIER proposal, its sizing code stays as a base. EARLIER: User decision 2026-11-13: four junctions of 8 lane x 8 lane, each a DIFFERENT design. Proposed: J1 stack (4 level), J2 turbine (3 level), J3 full cloverleaf with collector-distributor roads (2 level), J4 hybrid (2 direct flyovers + 2 loops, 3 level). Sizing (pure math, assumed flows until 6.4): src/interchange/m8/M8Designs.ts, scripts/m8-interchange-sizing.ts ALL PASS (ramp R >= 1.5 x Rmin, lane capacity, lane balance). Locations NOT fixed: they need the outward M8 roads (6.3). Next 9.2: ramp centrelines + profile of J1, one type at a time |
| 9.2 | Interchange geometry per type | STACK CODE KEPT AS A REFERENCE, NOT USED FOR J1 ANY MORE (J1 is at ground level, 15.8); its ramp and lane-terminal math is reused for the four 3-leg ring interchanges; 9.2 restarts with those (not started). Old note: J1 stack centrelines + profile + median opening were done | | J1: src/interchange/m8/StackGeometry.ts, scripts/m8-stack-check.ts (8 ramps: radius >= 1.5 x Rmin(V60), grade <= 5 %, vertical clearance >= 6.9 m at every ramp x ramp / ramp x road crossing, and every ramp >= 12.5 m (7.3 + 4.2 + 1.0) from every pavement it is not a level away from: ALL PASS), picture docs/m8_stack_plan.png. Road A on the ground, road B level 4 (20.7 m, flat 110 m, 4 % down). MEDIAN OPENING: both carriageways of each road move apart by 9.5 m (full out to 400 m from the crossing, shift taper 589 m = lane-drop rule 0.62 W V per lane of shift), ramp centre in the median at 8.3 m. Left turns = slip ramps R175 on the outer side, right turns = directional ramps R175 in the opened median; right A->B on level 2 (6.9 m), right B->A on level 3 (13.8 m). Sizing table updated to V60 R175 for the stack right ramp. LANE-LEVEL TERMINALS (2026-11-13): exit run 200 m >= decel 99 + exit taper 91 = 190 m, entry tail 390 m >= accel 206 + entry taper 183 = 388 m (from Checks.ts, V100 -> V60), RUN_LEN / TAIL_LEN in StackGeometry.ts, checked by m8-stack-check.ts; the run now follows the carriageway offset beyond 400 m, ramps are 859 m long, picture tools/m8-stack-plot.py. ROAD B FLAT LENGTH (2026-11-13): sweep 0..110 m: 60-85 m fail (R1 / R3 level-3 ramps come within 12.5 m of the B pavement while less than 6.9 m under it), 90 m is the minimum, 110 m kept (20 m margin). GORE SPACING: same-side gores on one carriageway >= SSD (min 917 m, PASS); the entries of the median-side and outer-side ramp onto the same carriageway are only 39 m apart (opposite sides, no weave, but check lane balance in 9.2b). TAKE-OFF (structureTakeoff, fill > 7.5 m = viaduct, span 40 m, wall both sides of embankment): total viaduct 1686 m, embankment 4495 m (wall 8990 m), 40 piers (max 11.6 m), 4 abutments. LANE LEVEL (StackLanes.ts, 2026-11-13): median-side ramps now run as an aux lane overlapping the pavement by 2.5 m (AUX_LAT + spread, like the outer ones); gore nose = where the two pavements stop overlapping: exit run to the nose 233 m >= 190, entry run from the nose 417 m >= 388, lane balance (exit 5 lanes upstream, entry leaves 5, lane drop 226 m <= 311 m available): all PASS. The 39 m between the median-side and outer-side entries on one carriageway is OK (each ends its own aux lane). MESH (StackMesh.ts, scripts/m8-stack-mesh-check.ts ALL PASS, 26 720 triangles, preview docs/m8_stack_mesh.png via tools/m8-stack-mesh-plot.py): asphalt, edge lines + dashed dividers, exit / entry tapers (width 0 -> full / full -> 0), parapets, retaining walls on embankments, box girder + cap beams + piers (<= 40 m) on viaducts, abutments; road A and road B included. GAME (StackInterchangeLayer.ts, Config.roads.interchangeJ1 = { enabled: false, x, z, y, yaw }, hooked in Engine.ts with the ring structures + RingStructurePhysics solids; scripts/m8-stack-layer-test.ts ALL PASS, tsc --noEmit clean). OFF by default. OPEN: (a) place J1 (needs the outward M8 roads, step 6.3) and set the Config flag; (b) TERRAIN is not carved under J1 and RoadNetwork does not know the ramps (no traffic graph links); (c) not seen in a running game; pier / wall meshes are plain boxes, no haunches or bearings; the gore nose has lane paint only (no hatched gore wedge, no signs) |
| 9.3-9.4 | Flyovers, service roads | not started | | |
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
Read HANDOFF_ROAD_DESIGN.md completely, including section 15 (J1 plan). We are designing all roads of the evcity game from scratch, step by step.
Rules: work on ONE micro-step only (the first one that is not OK in section 12). Show the calculation sheet, the numbers and a picture/table I can check, then STOP and wait for my OK. Do not start the next micro-step before I say OK. Do not create new md files: update the status table in section 12 of HANDOFF_ROAD_DESIGN.md.
Reply in simple English (I may write in Bangla/Banglish).
Start with micro-step 0.1: ask me the questions of section 11 one by one.
```

**For the next micro-steps just write:** `OK, next micro-step` (or tell what to change).

**When the AI finishes a micro-step it must:** save its code in the project, update section 12, run the checks, and give a new zip of the project when the user asks for it.

**When the chat gets long:** ask the AI to update section 12 and the notes, then start a new chat with the same starter prompt. The status table is the memory of the work.

---

## 15. J1 PLAN: 8-lane radials into the city and J1 (decision 2026-11-13)

**J1 POINT IS NOW C9 (-117, -277), see 15.8.7 (it replaces C8 (0, -250) everywhere below).** **READ 15.8 FIRST. It overrides: 15.1 item 5 (J1 is no longer the stack), the stack numbers of 15.2 (arms of 1 km, footprint +-400 m, viaduct), 15.3 (site and footprint), 15.4 rule 1 (zone of +-1 km) and 15.7 item 2 (five junctions, five designs now).**

### 15.1 What the user decided (data, do not change without asking)
1. J1 sits INSIDE the city. From the four sides of the ring (north, south, east, west) four **8-lane (M8)** roads run into the city and meet at one junction. That junction is **J1**.
2. J1 should be a bit away from the exact city centre, because big vehicles going through the centre cause problems.
3. J1 and the radials must NOT clash with the railway.
4. The user left the site choice to the AI ("choose what is best as transportation engineering management"). The proposal below is waiting for the user's OK.
5. J1 is the 4-level stack already built in `src/interchange/m8/*` (OFF in `Config.roads.interchangeJ1`).

### 15.2 Facts found in the code (2026-11-13)
- Ring meeting points (`RING_RADIAL_JOINS`): N st 11549 (1711.5, -3145.5), E st 15309 (2967.4, 190.1), S st 1205 (-1131.9, 2301.8), W st 5104 (-2595.0, -591.1). Distances to (0,0): N 3581, E 2973, S 2565, W 2661 m. Old reference radials (`REF_NORTH` etc. in `src/roads/reference/RefShapes.ts`) all start at (0,0) and are curved: only their shape was to be used.
- Straight lines between opposite ring points: N-S and E-W cross at about 70 degrees. The stack needs 90 degrees (its local frame has one yaw only). So the arms must run PERPENDICULAR for the last stretch into J1, then curve to the ring points. With J1 at (0,0) the best common yaw is about 16 deg (bends N 12.5, S 10.1, E 12.4, W 3.3 deg).
- Stack size (`StackGeometry.ts`, `docs/m8_stack_plan.json`): ramps cover about +-400 m, road B is at level 4 (20.7 m, flat 110 m each side, then 4 % down, about 630 m each side), both roads have the opened median (9.5 m shift) full out to 400 m plus a shift taper of 589 m: the straight, perpendicular part of each arm must be at least about 1 km on both sides. Ramps are 859 m long, total viaduct 1686 m, embankment 4495 m with walls.
- Site 0 terrain (`TerrainGenerator.makeSites`): fully flat inside 600 m, blends back to natural ground at 1200 m from (0,0).
- City plan (`src/city/CityPlan.ts`, SITE0): dense core +-470 m (hub, CBD NE rect(100,-470,470,-100), civic, edu, flats, bazaar), suburb ring to 760 m, green to 950 m; the four arm strips are +-100 m wide with shops and petrol pumps. A stack at (0,0) would sit on the whole dense core.
- Railway (`src/rail/RailPlan.ts`): Central Station at (0, 300), radius 300, hub of five lines: south-1 (to 350,1450), north-1 (via 250,-1500), east-1 (via 1100,-50), west-nw (via -1100,-300 ...), west-sw (via -1000,800). A stack at (0,0) is only 300 m from it and the rail corridors run through the centre. Rail is generated at run time from these hints, so the real track can differ: ALWAYS check with the real rail data (6.1a).
- Rule X5: road and rail never cross at grade.

### 15.3 Proposal for J1 (waiting OK, check in 6.1a)
- **J1 about (650, -500)**, 820 m north-east of the centre. Why: about 530 m from the planned rail lines (stack half footprint is 400 m), about 1.1 km from Central Station, close to the freight flows (north hub, airport, east-works) so trucks use J1 and the ring and stay out of the centre, bends to the four ring points at most about 16 deg, footprint inside the flat core + blend ring.
- Numbers for the nearby test point (689, -579) were: yaw 16.3 deg, bends N 5.4, S 16.0, E 2.4, W -16.1 deg, arm lengths N 2763, E 2405, S 3408, W 3284 m. RECOMPUTE for the final point in 6.1a.
- Rejected: (0,0) (Central Station, dense core, 8 rail crossings); north-west (-500,-650): bends up to 21.6 deg, the west arm only 2096 m, sits on civic and education areas.
- Which road of J1 is on the ground (road A) and which is level 4 (road B) is decided in 6.1a / 9.2 from the rail and crossing list (the road that has the fewer rail crossings inside 1.5 km should be the one that stays low or high, whichever gives the shorter structure).
- The city centre gets a 4-lane divided arterial (A-D) from J1 (about 820 m), grade-separated from the rail, ending in the centre roundabout (D7 stays for the centre).

### 15.4 Rail rules for J1 and the radials (checked by code)
1. No rail crossing inside the +-1 km straight stack zone of any arm. Any rail crossing is placed at least 300 m outside that zone.
2. Every rail crossing is grade-separated: road over rail with 6.5 m rail clearance (or rail over road with the road clearance, decided per crossing). Each one goes into the crossing list (6.1d) with station, angle, clearance.
3. J1 footprint (ramps +-400 m, road B viaduct, embankments, walls) keeps at least 50 m from any track, station or rail depot, and the rail corridors keep their own clear width.
4. Rail and road meet only at crossings that are in the list. Any other meeting = FAIL, same as network-check X1-X5.

### 15.5 Micro-steps (one per session, wait for OK after each)
- **6.1a J1 site check.** New `scripts/j1-site-check.ts` (pure math plus the real data): (1) real rail tracks from the rail plan (needs node_modules; if the machine cannot run it, say so and use the straight lines of 15.2 as a warning only); (2) terrain flatness: sample ground in a +-500 m square, report max slope and height range; (3) overlap with city plan areas, with lakes and rivers, with the old rail and engineering zones; (4) for 3 to 5 candidate points (the proposal and its neighbours) compute yaw, bends, arm lengths, rail clearance. Picture of the map with footprint, rail, ring, ring points. User picks the point. Status table: update.
- **6.1b Radial axis A (N + S).** Two M8 centrelines from J1 to the ring points N and S. Each arm = straight of at least 1 km perpendicular to the other axis, then spiral - arc - spiral, R at least 591 m (1.5 x Rmin of V100), Ls 100 m, reverse curves straight at least 2V. Use `PiAlignment.ts` / `Clothoid.ts`. Smoothness report (3.12), samples every 5 m, the join to the ring point checked (crossing angle, straight on the ring side).
- **6.1c Radial axis B (E + W).** Same for E and W, perpendicular to axis A.
- **6.1d Radial rail crossings.** List every rail crossing of the four arms (and of the 4-lane centre link) with station and clearance. Check the 15.4 rules. If a rule fails, move the arm, not the rail, unless the user says otherwise.
- **6.1e Radial ground check.** Like 2.5 for the ring: water, steep ground, city sites, buildings, airport and engineering fences along each arm. Hard stops fix the alignment.
- **6.2 City centre link.** The 4-lane A-D arterial from J1 to the centre, the rail crossing, the centre roundabout (D7). Calculation sheet (demand, lanes by 3.13, roundabout diameter).
- **6.2b Re-zoning and buffers.** List the CityPlan areas under the J1 footprint and along the four arms (CBD east part, civic, arm strips). Change them in the city plan: no frontage access on M8, 30-50 m planted buffer, frontage roads where shops stay. Buildings and plantings read the section table (3.5), nothing inside the 80 m ROW.
- Then continue with 6.3 to 6.6 (outward roads, demand, lane ladder, crossing check) and with 9.2 (place J1: set `Config.roads.interchangeJ1 = { enabled, x, z, y, yaw }`, carve the terrain under the ramps, let `RoadNetwork` know the ramps).
- After 6.1b to 6.1c the lane ladder changes: the radials are M8 (4 + 4), so the ring x radial junctions are M8 x M8 too.

### 15.6 Acceptance for the J1 plan
- All arms perpendicular and straight for at least 1 km at J1, closure and smoothness checks PASS, every bend R at least 591 m.
- Zero rail crossings inside the stack zones; every other crossing is in the list with clearance.
- No building, lake, river or steep ground inside the J1 footprint and the 80 m ROWs, or a written re-zoning.
- `npm run build` green, check scripts added to `package.json`.

### 15.7 Open points for the user
1. OK of the J1 point (650, -500) or another point after 6.1a.
2. There are now FIVE M8 x M8 junctions (J1 plus four ring x radial) but only four designs (stack, turbine, cloverleaf with collector-distributor roads, hybrid). Decide in 9.1: a fifth design (for example a directional-T style or a second hybrid variant) or the same design twice.
3. How much of the CBD east part may be re-zoned or removed (6.2b).

### 15.8 DECISION OF 2026-11-13 (later): J1 at ground level, four 3-leg ring interchanges (overrides the stack plan)

**15.8.1 What the user decided (data)**
1. J1 stays **8 x 8 lane**, in the city, roads from **4 sides**, but at **GROUND LEVEL**: no flyover, no ramps, one **big "+" section**. (It is a planned exception to X1, see 3.11.)
2. On the ring there are **four** junctions (N, E, S, W): the 8-lane ring and the 8-lane radial, roads from **3 directions** (ring both ways + radial), grade-separated, **each a different design**, chosen by engineering view.
3. So there are **five 8 x 8 junctions** and **five different designs**. The earlier open point "five junctions, four designs" is closed.
4. The stack code (`src/interchange/m8/Stack*.ts`, `Config.roads.interchangeJ1`) stays in the project, OFF, as a reference. Nothing is deleted.

**15.8.2 Engineering notes for the ground-level 8 x 8 "+" (proposal, numbers are checked in 6.2)**
- Signalised, 4 phases. Capacity is far below the stack (the stack sizing assumed 3600 pcu/h per direction through), so the approach needs extra lanes and queue storage, and the approach speed steps down 100 -> 60 km/h (99 m, `decelLength(100, 60)`). M8 is fully controlled, so the step-down is a class change (M8 -> signalised arterial) inside the arm straight.
- Left-hand traffic: LEFT turn = channelised slip lane (corner radius up to 25 m), RIGHT turn crosses the opposing flow = turn pockets (2 per approach proposed) with their own signal phase.
- Paved width of one M8 is 44.2 m: pedestrians need a grade-separated or refuge crossing (3.14: footbridge or underpass on 4+ lane roads).
- The "+" must be near 90 degrees (rule 3.12.10: 70-110). The four arms are straight and perpendicular for `ARM_STRAIGHT` (proposal 500 m, the stack needed 1000 m) and then bend to the ring points (spiral - arc - spiral, R >= 591 m).
- Working footprint half size (`FOOT`, proposal): box 50 m (M8 pavement edge 22.1 + corner radius 25 + margin) + stop distance from 60 km/h 56 m + queue storage 100 m (ASSUMED, ~14 cars, replaced by the signal calculation of 6.2) + pocket taper 85 m (W V^2 / 155) = 290 -> **300 m**.

**15.8.3 Result of 6.1a (real data, `docs/STEP61A_OUTPUT.txt`, picture `docs/j1_site_check.png`)**
- The old proposal **(650, -500) FAILS**: steepest 50 m step 26.9 %, height range 43 m (14.7 .. 57.8 m, the north-east rises beyond the flat core of 600 m; 15.3 said "inside the flat core + blend ring" and that was wrong for this side), 1 wet point, and the rail line north-1 passes through the box. All other north-east points fail the same way.
- **(0, 0)** is flat (2.1 %), but north-1 is only 205 m from the centre, inside the box (largest clean box +-100 m), and 56 % of the box is dense city plan.
- A scan of the centre area (every 50 m, +-1000 m) for a flat (<= 3 %), dry box that keeps 50 m from every real track found only a pocket north of the centre. Largest clean box: **C7 (-50, -300): +-250 m**, **C8 (0, -250): +-200 m**. Nothing reaches +-300 m.
- Table (FOOT = 300 m): C0 (0,0) 1 fail; C1 (650,-500) 3; C2 (450,-350) 3; C3 (800,-700) 2; C4 (900,-250) 3; C5 (300,-600) 2; C6 (-500,-650) 2; C7 (-50,-300) 2; C8 (0,-250) 1 (only the rail check: north-1 is 285 m from the centre). With a +-200 m footprint C8 passes every check.
- Arms of C8: straight-line lengths N 3363, E 3000, S 2791, W 2617 m; common yaw 17.6 deg east of north; bends N 13.0, E -9.2, S 6.3, W -10.1 deg (limit 20).
- Rail: the five lines radiate from Central Station (0, 300). Every point inside the flat core therefore has arms whose straight lines cross rail near J1 (C8: the east arm crosses north-1 at 285 m, the south arm crosses west-nw at 448 m and west-sw at 858 m). Rule 15.4-1 (no crossing inside the zone, next crossing >= 300 m outside) cannot be kept in the core. The arms are curved in 6.1b, so these are WARNINGS now; they are decided in 6.1d.

**15.8.4 Open decisions for the user (after 6.1a)**
1. **J1 point: DECIDED 2026-11-13.** The user said "choose what you think best". The AI chose **C8 = (0, -250)**, common yaw **17.6 deg east of north** (arms N 13.0, E -9.2, S 6.3, W -10.1 deg of bend to the ring points). Why: the only point that passes every check (flat 2.7 %, dry, 50 m from every track, bends <= 20 deg, arms >= 2600 m) with a clean box of +-200 m; nearest to the centre; no rail moved. Price: about 50 % of the box is dense city plan (re-zoning, J1-f) and the east and south arms cross rail near J1 (6.1d). The working footprint is NOT a fixed +-300 m square any more: J1-a finds the real clear length of each of the four approaches along the rotated axes (ground, water, rail, city plan) and sizes the pockets and the queue storage per approach (the east approach is the shortest, north-1 is about 285 m from C8). Rejected: C7 (-50, -300, clean box +-250 m, but 13 % slope inside the +-300 box and about 55 m further from the centre); moving the rail line.
2. **Rail rule for the arms.** Proposal: no rail crossing inside the J1 footprint; every crossing is a road-over-rail structure (rail clearance 6.5 m + deck 1.5 m, grade <= 4 %, about 200 m of ramp each side) that starts outside the footprint.
3. How much of the city plan under J1 may be re-zoned (6.2b): C8 sits on s0-arm-n, s0-cbd, s0-edu, s0-civic and s0-hub.

**15.8.5 Revised plan for the junctions (proposal, wait for OK; 9.1 and 9.2 are done one at a time after the radials)**

| Junction | Legs | Level | Proposed design | Why, and the site facts (design profile `docs/ring_profile.csv`) |
|----------|------|-------|-----------------|------------------------------------------------------------------|
| J1 city | 4 | ground | signalised "+", slip lanes, turn pockets | user decision, 6.2 |
| Ring N st 11549 | 3 | 3 levels | directional T | highest freight flow (north hub): all movements direct. Cut 6.3 m, fills 7-10 m on both sides, rail crossing 279 m away (st 11270), river bridge S3 745 m away |
| Ring E st 15309 | 3 | 3 levels | turbine-T (spiral ramps) | **the point lies on a 35 m high fill, inside viaduct S6 (st 15237-16037): an interchange cannot be built there, the meeting point must move along the ring** |
| Ring S st 1205 | 3 | 2 levels | trumpet | flat (ring = ground, grade 0 %), but tight: river bridge S1 309 m away; one loop only, so the loop movement must be small (1 lane = 1500 pcu/h, `M8Designs.ts`) |
| Ring W st 5104 | 3 | 3 levels | hybrid T (one direct flyover + one loop) | most room: straight 3031-6014, 3-6 m fill |

The assignment follows the demand of step 6.4; this table is a proposal. Each interchange needs a straight of about 1 km of the ring on both sides (ramps, tapers, lane balance).

**15.8.6 Revised micro-steps (one per session, wait for OK)**
- **6.1a** J1 site check: DONE (15.8.3), waiting for the user's pick (15.8.4).
- **6.1a2** Ring meeting points as 3-leg sites: same kind of script for N, E, S, W (ground, structures, rail, a straight of about 1 km on both sides, crossing angle >= 70 deg). First job: find a new E meeting point (the old one is on a 35 m fill) and check N for its rail crossing and fills.
- **6.1b / 6.1c** Radial axis A (N + S) and axis B (E + W) centrelines from J1 to the ring points. Arm = straight 500 m (proposal) perpendicular to the other axis, then spiral - arc - spiral, R >= 591 m (1.5 x Rmin V100), Ls 100 m.
- **6.1d** Rail crossings of the arms (rule in 15.8.4 item 2), **6.1e** ground check of the arms.
- **6.2** J1 ground-level design: calculation sheet (demand, signal phases, lane layout, pockets, storage, corner radii, crossing for pedestrians), then 6.2b re-zoning.
- Then 6.3-6.6 and 9.2 for the four 3-leg interchanges, one design per session.

### 15.8.7 DECISION OF 2026-11-13 (J1-a): J1 moves from C8 to C9 (-117, -277)

- Reason (numbers in `docs/STEPJ1A_OUTPUT.txt`): at C8 the east approach has only 220 m clear (189 m from the stop line), the signal needs 293 m (braking 56 + queue / storage + taper 85 + step-down 99); rail north-1 crosses the east axis at 288 m. A change of yaw (10-28 deg) does not help (E clear stays 220-230 m).
- The user said "do what is best", so the AI moved J1 120 m west and 10 m south along its own axes: **C9 = (-117, -277)**, yaw 17.6 deg east of north (unchanged). Clear lengths N 340, E 340, S 340, W 350 m (need 330 / 324 / 330 / 324 m); flat dry box +-200 m, rail 396 m from the centre, bends N 15.1, E -8.8, S 4.0, W -10.2 deg, dense city plan 36 % of the +-300 box (C8: 50 %). Nothing else of 15.8 changes: still 8 x 8, ground level, signalised "+". The old numbers of 15.8.3 / 15.8.4 (C8) stay as history.
- Still to check in later steps: the arm rail crossings (E north-1 at about 409 m, S west-nw at about 411 m, 6.1d) and the re-zoning list at the new point (J1-f).

### 15.9 J1 BUILD PLAN (ground-level 8 x 8 "+" at C9 (-117, -277)), next chat

Scope: J1 itself only (the box, its four approaches up to the end of the 500 m arm straight, signals, markings, terrain, mesh, game layer). NOT in scope: the arm centrelines to the ring (6.1b, 6.1c), their rail crossings (6.1d), the ring interchanges (9.2). One micro-step per session, wait for the user's OK after each (rules of section 5).

- **J1-a Calculation sheet and layout (no mesh). DONE 2026-11-13, see section 12.** (1) Clear length of each approach along the four rotated axes from (-117, -277), yaw 17.6 deg: flat ground (<= 3 %), water, rail (50 m buffer), city plan. (2) Assumed design-hour flows per movement (write them down, mark ASSUMED, until step 6.4) and lanes from `lanesFromDemand`. (3) Layout per approach: 4 through lanes, 2 right-turn pockets (left-hand traffic: the right turn crosses), 1 left-turn slip lane with corner radius up to 25 m, median. (4) 4-phase signal: saturation flow, lost time, cycle length (Webster), green split, capacity per movement, degree of saturation, 95th percentile queue -> storage length. (5) Pocket length = stop distance from 60 km/h (56 m) + storage + taper (W V^2 / 155 = 85 m), cut to the clear length of that approach. (6) Speed step-down 100 -> 60 km/h (99 m, `decelLength`) inside the 500 m arm straight. (7) Pedestrians: M8 paved width 44.2 m, so footbridge or underpass or refuge (3.14), decision with the numbers. CP: sheet, picture of the layout on the map, PASS / FAIL list.
- **J1-b Geometry data (pure math, no three.js).** `src/roads/junction/GroundJ1Geometry.ts`: local frame (origin C8, yaw), approach carriageways and lanes, median opening, pocket lanes and tapers, slip-lane kerb arcs, islands, stop lines, crosswalk bars. `scripts/j1-ground-check.ts`: lane widths, radii, tapers, no overlap, sight triangles at the corners, every number from `CRITERIA` / `SECTION_M8`. Picture. CP.
- **J1-c Profile and terrain.** The box and the first 500 m of each arm: surface <= 2 %, crown / cross fall 2 %, drainage, grade of the arms <= 4 %, level of J1 against the natural ground (flat 2.7 % max there). Terrain cut / fill under the footprint with `daylight` like the ring, volumes. CP.
- **J1-d Signals and markings data.** Signal head positions, phases, stop lines, arrows, lane lines (same marking rules as `ShaderSection.ts`), crosswalks, pedestrian refuge or footbridge, street lights. Data only. CP.
- **J1-e Mesh and game layer.** `GroundJunctionLayer.ts` (like `StackInterchangeLayer.ts`), `Config.roads.junctionJ1 = { enabled: false, x: -117, z: -277, yaw: 17.6 }` (switch on after the OK), road surface and physics, build time against `PERFORMANCE_RULES.md`, `npm run build` green, screenshot. The stack layer stays OFF. CP.
- **J1-f Re-zoning under J1.** List the CityPlan areas under the box (about s0-arm-n, s0-cbd, s0-edu, s0-civic, s0-hub, s0-arm-w, s0-arm-e), 30-50 m planted buffer, no frontage access on M8, frontage roads where shops stay. Ask the user before changing the city plan. CP.

**Starter prompt for the J1 chat (paste it, upload the project zip and HANDOFF_ROAD_DESIGN.md):**

```
Read HANDOFF_ROAD_DESIGN.md completely: section 0, section 12 and section 15 (especially 15.8 and 15.9). We are designing all roads of the evcity game from scratch, step by step.
Decisions already made (do not change without asking me): J1 is 8 lane x 8 lane at GROUND LEVEL (no flyover, no ramps), one big signalised "+" in the city, at (-117, -277) (C9, moved from C8 in J1-a, see 15.8.7), common yaw 17.6 deg east of north. The four ring junctions are 3-leg interchanges, not part of this chat.
Task: build J1 only. J1-a is DONE (section 12); do micro-step J1-b (15.9) now. One micro-step per session: show the calculation sheet, the numbers and a picture or table I can check with a PASS / FAIL list, then STOP and wait for my OK. Do not start J1-c before I say OK. Do not create new md files: update section 12 of HANDOFF_ROAD_DESIGN.md. Run npm install first so the check scripts can run.
When I ask for files, give ONLY the changed files in a zip named with a version (for example EVCity_Road_J1b_v1.0.zip).
Reply in the language I write (Bangla / Banglish).
```
