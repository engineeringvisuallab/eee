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
| J1-a2 | J1 rotation (yaw scan + shift) | done 2026-11-14: J1 = C10 (-87, -277), yaw 37.5, 12 PASS 0 FAIL, waiting OK | OK on yaw about 37 and bend limit 35 deg | Why: N arm hill cut (36 m) rejected by the user, bypass impossible, user asked to rotate. scripts/j1-ground-calc.ts (env J1YAW, J1X, J1Z), scripts/j1-n-hybrid.ts (env J1X J1Z J1YAW HMIN HMAX), tools/j1-n-hybrid-plot.py (env J1X J1Z J1YAW), docs/STEPJ1A2_OUTPUT.txt, docs/STEPJ1A2_SCAN.txt, docs/j1c4_hybrid.json, docs/j1c4a_yaw375.png. N arm: max cut 9-10 m, 3149 m, T at the ring (~90 deg). See 15.8.8. NEXT: redo J1-b, c1, c2 (S), c3 (E) for C10, then c4b/c4c (N arm smoothing + profile), c5 (W arm around the hill) |
| J1-a2b | J1-b, J1-c1, S arm, E arm redone for C10 (-87, -277), yaw 37.5 | done 2026-11-14: J1-b 32 PASS 0 FAIL; c1 3 PASS; S 4 PASS; E 4 PASS, waiting OK | | src/roads/junction/GroundJ1Geometry.ts (J1_SITE, J1_APPROACH_INPUTS), scripts/j1-ground-check.ts, docs/j1a.json, j1b.json, j1b_layout.png, STEPJ1B_OUTPUT.txt, j1c1.json, STEPJ1C1_OUTPUT.txt, j1c_S.json, j1c_E.json, STEPJ1C_S_OUTPUT.txt, STEPJ1C_E_OUTPUT.txt. Pad y 18.19 m, grade 0.63 %; S edge cut 1.02 m / fill 0.42 m; E edge cut 0.12 m / fill 1.94 m. See 15.8.8. NEXT: c4b (N arm smoothing to straight-spiral-arc, move off the tech-park buffer), c4c (N profile), c5 (W arm around the hill), 6.1d |
| J1-c4b | N arm as a real alignment (straight-spiral-arc-spiral-straight, 3 PIs), T on the ring N straight | done 2026-11-14: 11 PASS, 0 FAIL, waiting OK | USER 2026-11-14: grade up to 4 % ALLOWED on the hill stretch (first 1000 m from S), 3 % elsewhere; roads first, RAILWAY CANNOT CHANGE, parks / zones / buildings may be crossed and are re-placed to the roads later | src/roads/alignment/OpenAlignment.ts (new), scripts/j1-n-align.ts (GHILL=0.04 npx tsx scripts/j1-n-align.ts docs 3 12000 3; env GHILL, HILLEND, ZONES=0), tools/j1-field-plot.py, tools/j1-n-profile-plot.py, docs/j1c4b_align.json, docs/STEPJ1C4B_OUTPUT.txt, docs/j1_field.png, docs/j1_n_profile.png. BUG FIXED: the old DP rounded the level step down, so the real grade limit was about 2 % (not 3 %) and the cut looked like 15-16 m; with the fix and true 3 % the cut is still 12.3-14.6 m, with 4 % on the hill it is 8.8 m. RESULT (3 PIs, seed 3): S (120.0, -546.7) heading -52.5 deg, E (2100.2, -2762.5) at ring st 12094 (1045 m from the west end, 418 m from the east end), T 90.0 deg, length 3213 m (straight line 2972 m). PI0 (371.7, -874.7) R 606 delta -33.7; PI1 (440.5, -1916.2) R 768 delta +69.4; PI2 (1616.1, -2271.3) R 1538 delta -28.6; all Ls 100; straights 180/228/204/247 m. Tech-park 47 m (>= 45 OK), 1 rail crossing at s 1234 (road over rail), wet 45 m (bridge). VERTICAL PREVIEW: max cut 8.8 m (cut > 12 m: 0 m), max fill 15.9 m, fill > 7 m (viaduct) 382 m, grade 3.98 % on the hill stretch and 2.99 % elsewhere, cut about 0.17 million m3. NEXT: c4c N profile (real vertical curves, K values for the 4 % stretch), c5 W arm, 6.1d |
| J1-c4c | N arm real vertical profile: PVI table + parabolic vertical curves (V100, K crest 50.9, sag 44.1), s = 0 at the J1 centre | done 2026-11-14: 10 PASS, 0 FAIL, waiting OK. USER ANSWER 2026-11-14: KEEP 3.5 % on pad -> S stretch (s 60..340). (question was: pad -> S stretch (s 60..340) was run at 3.5 % (user said 3 % there, 4 % only on the hill from S); at strict 3 % the centre cut is 12.4 m (0.4 m over the 12 m limit), at 3.5 % 11.9 m, at 4 % 11.2 m) | grade 4 % on the first 1000 m from S, 3 % beyond; motorway max is 4 % (3.3) | scripts/j1-n-profile.ts (PADG=0.035 npx tsx scripts/j1-n-profile.ts docs; env PADG = grade limit s 60..340, default 0.03), tools/j1-n-profile-plot.py, docs/j1c4c_profile.json (PVIs, curves, rows [s, ground, road] every 5 m from S), docs/STEPJ1C4C_OUTPUT.txt, docs/j1_n_profile.png. METHOD: c4b DP level -> Douglas-Peucker vertices -> annealing of the PVI stations and levels with cost = cut/fill + penalties (grade, curve overlap, rail clearance, river clearance); first tangent = pad plane (grade -0.56 %), first curve starts at s 62. RESULT: PVIs (s, level): 0 (18.19), 150 (17.36), 381 (25.31), 991 (49.35), 1344 (38.07), 1604 (45.71), 2213 (36.90), 2460 (29.63), 2762 (38.06), 3021 (30.45), 3262 (33.81), 3553 (25.24 = ring level at st 12094); 9 vertical curves 76-363 m at K = minimum, smallest straight between curves 13 m. Grades: 3.44 % pad -> S, 3.94 % hill stretch, <= 2.94 % beyond, last grade into the ring -2.94 %. Max centre cut 11.9 m (edges +-25 m: cut 14.8 m, fill 17.7 m). Viaduct (fill > 7 m): s 385-435, 1185-1474 (max 15.8 m), 2374-2474 (max 17.6 m), 3019-3094 (11.1 m), 535 m in total. Rail north-1 at s 1573: road OVER rail, road 44.15 m, rail top 36.46 m, gap 7.68 m (needs 7.4 m, RAIL_DESIGN.overRoadRise). River 55 m wet: road 12.3 m above the water (bridge, deck depth not included). The railway is NOT changed. NEXT: user answer on the pad stretch grade, then c5 W arm (around the hill), then 6.1d structures list (rail bridge, river bridge, 4 viaducts) |
| J1-c5 | W arm around the hill: heading-aware search on the W sector | done (route search) 2026-11-14: tight first bend R 125 m (80 deg, 175 m) then gentle, max centre cut 9.9 m, waiting OK | USER 2026-11-14: 'as your engineering choose' (my choice; R 125 m is FAR BELOW the V100 minimum 394 m, advisory about 55 km/h) | scripts/j1-w-raster.ts, scripts/j1-w-hybrid.ts (env STEP GMAX RST0 RST1 J1YAW J1X J1Z RT), tools/j1-w-plot.py, docs/j1c5_raster.json, docs/j1c5_hybrid.json, docs/j1c5_route.png, docs/STEPJ1C5_OUTPUT.txt. WHY: the hill spur (up to 190 m) lies straight ahead of the W arm, the low land is 440 m to the side; with R >= 344 m every run cuts 85-95 m. J1 yaw scan: W needs yaw <= -2.5, N needs yaw about 37: conflict. J1 move: works at (113,223) for N and W but rails are < 72 m from the axes there, only C10 passes the site check. First bend (arc included in stats): R 150 cut 17.0 m (too much), R 130 12.4, R 125 9.9, R 110 6.1. RESULT (R 125 first bend, then R >= 688): 2552 m, cut 9.9 m, fill 10.7 m, viaduct 71 m, 1 rail crossing, wet 0, zone 0. NEXT: c5b smoothing to a real alignment (check the 44 m pavement on R 125: inner kerb, widening, sight, truck swept path), c5c W profile, then 6.1d structures |
| J1-c5b | W arm as a real alignment: PI 0 = tight first bend, PI 1 = the sweep to the ring, T on the ring W straight | done 2026-11-14: 12 PASS, 0 FAIL, waiting OK | USER delegated the choice; R 126 m first bend is FAR BELOW the V100 minimum 394 m (advisory about 55 km/h) | scripts/j1-w-align.ts (npx tsx scripts/j1-w-align.ts docs 2 16000 1; env GHILL RTMIN SEEDREF ZONES), tools/j1-w-align-plot.py, docs/j1c5b_align.json, docs/STEPJ1C5B_OUTPUT.txt, docs/j1c5b_align.png. METHOD: same as c4b (annealing of the PIs, radii and join point, cost = level DP with cut / fill) but PI 0 may have R >= 125 m with Ls from V55 (spiralLength), PIs 1.. R >= 591 m, Ls 100 m; seeded from the corners of the grid route (4 PIs did not fit: the legs are too short for the tangent lengths, 2 PIs fit best). RESULT: S (-356.7, -484.0) heading -142.5 deg (the J1 W axis), E (-2555.6, 246.5) at ring st 4265 (1065 m from the west end and 1635 m from the east end of the straight), T 90.0 deg, length 2541 m (straight line 2317 m). PI 0 (-497.1, -591.7) R 126 Ls 50 delta -100.3 deg arc 171 m, straight before 0 m (starts at S) and 222 m after; PI 1 (-887.1, 168.1) R 700 Ls 100 delta +60.1 deg arc 635 m, straight after 1215 m. Nearest engineering zone eng-biomed 101 m (>= 45 OK), wet 5 m (bridge), 2 rail crossings at s 574 and 2447 from S (6.1d, road over rail has to be checked). VERTICAL PREVIEW (grade <= 3 %): max centre cut 10.7 m, cut > 12 m: 0 m, max fill 10.6 m, viaduct (fill > 7 m) 120 m. NEXT: c5c W profile (real vertical curves, K crest 50.9 / sag 44.1, adapt scripts/j1-n-profile.ts), then 6.1d structures list (N + W) |
| J1-c5c | W arm real vertical profile: PVI table + parabolic vertical curves (V100, K crest 50.9, sag 44.1, curve length >= 60 m), s = 0 at the J1 centre | done 2026-11-14: 11 PASS, 0 FAIL, OK by the user 2026-11-14 | USER OK 2026-11-14 on: same grades as the N arm (3.5 % pad -> S stretch s 60..340, 4 % on the first 1000 m from S, 3 % beyond), because at strict 3 % the centre cut is 13.7 m (limit 12 m) and at 3 % pad + 4 % hill it is 12.2 m | scripts/j1-w-profile.ts (copy of j1-n-profile.ts; run: GHILL=0.04 PADG=0.035 npx tsx scripts/j1-w-profile.ts docs; env PADG, GHILL, HILLEND; NEW vs N: every curve is at least 0.6 V = 60 m long), tools/j1-w-profile-plot.py, docs/j1c5c_profile.json (PVIs, curves, rows [s, ground, road] every 5 m), docs/STEPJ1C5C_OUTPUT.txt, docs/j1_w_profile.png. RESULT (PVI s, level): 0 (18.19), 150 (17.36), 376 (25.11), 679 (37.06), 1001 (31.07), 1197 (34.13), 1415 (34.50), 1534 (32.71), 1688 (34.61), 1783 (32.46, no curve), 1911 (28.91), 2136 (32.82), 2437 (23.97), 2603 (27.11), 2730 (27.38), 2881 (22.92 = ring level at st 4265); 13 vertical curves 60-295 m, smallest straight between curves 4 m. Grades: 3.44 % pad -> S, 3.94 % on the hill, <= 2.94 % beyond, last grade into the ring -2.94 %. Max centre cut 11.7 m (hill at s 450-700, edges +-25 m: cut 19.7 m, fill 14.1 m), max centre fill 13.5 m. Viaduct (fill > 7 m): s 1848-1918 (13.5 m) and s 2677-2847 (8.9 m), 240 m in total. Rail west-nw at s 912: road OVER rail, road 32.73 m, rail top 24.76 m, gap 7.97 m; rail ring-west at s 2783: road OVER rail, road 25.74 m, rail top 18.10 m, gap 7.64 m (both need 7.4 m). River 30 m wet at about s 1900: road 10.5 m above the water (bridge, deck depth not included). The railway is NOT changed. NOT checked here: the R 126 first bend (s 340-610 from the J1 centre) has no superelevation / widening / grade compensation yet (6.1e or c5d), vertical curves there are designed with V100 K values. NEXT: 6.1d structures list for the N and W arms (2 rail bridges on W, 1 on N, the river bridges, the viaducts) |
| J1-c6c | S arm real vertical profile: PVI table + parabolic vertical curves (V100, K crest 50.9, sag 44.1, curve length >= 60 m), s = 0 at the J1 centre | done 2026-11-14: 12 PASS, 0 FAIL, waiting OK | USER 2026-11-14: 'kaj koro' (go on after c6b); grade <= 3 % everywhere (no hill on S) | scripts/j1-s-profile.ts (npx tsx scripts/j1-s-profile.ts docs), tools/j1-s-profile-plot.py, docs/j1c6c_profile.json (PVIs, curves, rows [s, ground, road] every 5 m), docs/STEPJ1C6C_OUTPUT.txt, docs/j1_s_profile.png. Copy of j1-e-profile.ts with the pad level on the S AXIS (x = J1.x - s sin yaw, z = J1.z + s cos yaw) and the 'grade after the pad curve' rule changed to |g| >= 0.3 % (up or down). RESULT (PVI s, level): 0 (18.19), 114 (18.83), 388 (26.82), 767 (20.88), 1159 (32.40), 1317 (27.78, no curve), 1531 (21.50, no curve), 1734 (15.55), 2031 (24.27), 2398 (13.56), 2598 (16.18, no curve), 2826 (19.68 = ring level at st 1205); 7 vertical curves 104-299 m, smallest straight between curves 8 m. Grades: 0.56 % pad, 2.92 % pad -> S stretch (<= 3 %), <= 2.94 % beyond, last grade into the ring +1.54 %. Max centre cut 0.7 m, edges +-25 m: cut 0.7 m, fill 16.6 m. VIADUCT (fill > 7 m): s 345-500 (7.9 m), 989-1139 (9.7 m), 1199-1313 (16.1 m), 1388-1523 (9.1 m), 1957-2112 (7.9 m): 735 m in total, 30 % of the arm; the plan preview (c6b) said 0 m, the viaducts come from the 3 rail crossings (the road must be 7.4 m over the rail, so it climbs onto the rail embankments) and the river. Rail (all road OVER rail): west-nw at s 415 road 25.65 / rail top 17.98 / gap 7.67 m; west-sw at s 1239 road 29.59 / rail 21.97 / gap 7.62 m (on the 16.1 m fill, right next to the river dip); ring-south at s 2065 road 21.98 / rail 14.30 / gap 7.68 m (needs 7.4 m). River 40 m wet, road 12.7 m above the water (bridge, deck depth not included). The railway is NOT changed. NOT checked here: the pad stub of the game (S: pad -> -0.30 %) is still the old one, it is replaced when the arm roads go into the game (J1-e e2). NEXT: 6.1d structures list for the S arm (3 rail bridges, 1 river bridge, 5 viaduct runs; the west-sw crossing and the river are 100 m apart, decide one long structure), then 6.1e ground check, then J1-e e2 (arm roads in game) |
| J1-c6b | S arm as a real alignment (3 PIs, T on the ring S straight at st 1205) | done 2026-11-14: 11 PASS, 0 FAIL, waiting OK | USER 2026-11-14 (J1 seen in the game, looks good): any building / structure / zone in the middle may be crossed, they are re-placed to the roads later, ONLY THE RAILWAY IS FIXED. So zones are ignored (env ZONES=1 turns the 45 m rule back on) and the EVLab plot move (J1-e e2, scripts/evlab-move-search.ts) is NOT needed now | scripts/j1-s-raster.ts (npx tsx scripts/j1-s-raster.ts docs), scripts/j1-s-align.ts (npx tsx scripts/j1-s-align.ts docs 3 9000 1; env STLO STHI ZONES FIRSTSTR RAILPEN GHILL), tools/j1-s-align-plot.py, docs/j1c6_raster.json, docs/j1c6b_align.json, docs/STEPJ1C6B_OUTPUT.txt, docs/j1c6b_align.png. Copy of c7b with: S axis (math heading = yaw + 90), join window st 1205..1263 (500 m of ring straight on both sides, the point agreed in 2.4), new cost terms: 150 per rail crossing (rail cannot move), 600 for a station area + 60 m, first straight >= 150 m (the first rail crossing is only 75 m after S, rule 3.12.8). RESULT: S (-294.0, -7.3) heading 127.5 deg (math), E (-1133.3, 2301.7) at ring st 1205 (500 m of straight on the west side, 558 m on the east side), T 90.0 deg, length 2486 m (straight line S-E 2457 m). PI 0 (-505.8, 268.8) R 962 Ls 100 delta -17.5 deg; PI 1 (-732.5, 890.2) R 5685 delta +1.2 deg (practically straight); PI 2 (-1117.3, 1879.0) R 1617 delta -19.1 deg; straights 150 / 353 / 629 / 101 m; all R >= 591, smoothness PASS. Ground: nearest zone eng-biomed 475 m, Central Station area edge 120 m, wet 20 m (one river, bridge), 3 rail crossings at s 75, 904, 1727 from S (s = 0 at S, the J1 centre is 340 m before it): all road over rail (6.1d), the middle one is on a rail embankment next to a river dip (s 800-1000), check it in c6c. VERTICAL PREVIEW (grade <= 3 %): max centre cut 2.1 m, max fill 5.5 m, fill > 7 m (viaduct) 0 m, max grade 2.99 %: the flattest arm, NO hill. Other tries: 2 PIs fail the 6 V straight by 0.4 m, 4 PIs give a 20 m viaduct and cut 3.2 m. NEXT: DONE as J1-c6c (row above). Then 6.1d structures for the S arm, then 6.1e |
| J1-c7b | E arm as a real alignment (2 PIs, T on the ring E straight) | done 2026-11-14: 12 PASS, 0 FAIL, waiting OK | Join kept inside the agreed zone st 15309..15449 (500 m clear on the west) | scripts/j1-e-raster.ts, scripts/j1-e-align.ts (npx tsx scripts/j1-e-align.ts docs 2 24000 1; env STLO STHI ZONES GHILL), docs/j1c7_raster.json, docs/j1c7b_align.json, docs/STEPJ1C7B_OUTPUT.txt. Copy of c5b with: E axis (math heading = yaw), all PIs R >= 591 / Ls 100 (no tight bend), DP level range widened to 110 m (ring is 79 m here). RESULT: S (182.7, -70.0) heading 37.5, E (2967.0, 193.6) at ring st 15313 (4 m beyond the 500 m clear point, 636 m from the east end), T 90.0 deg, length 2841 m (straight line 2797 m). PI 0 (475.1, 154.3) R 883 Ls 100 delta -39.2 arc 504 m; PI 1 (2200.3, 102.1) R 686 delta +8.5 arc 2 m (practically one bend); straights 4 / 1260 / 671. Zone clearance eng-mech-works 75 m, wet 150 m (bridge), 3 rail crossings at s 85, 1009, 2312 from S. 4 seeds gave the same plan. FINDING: the join does NOT remove the high fill: the plain is 25-35 m, the ring E straight crosses a ridge at 79 m. Pinned joins (best plan each): st 15100 fill 51 m / cut 6.7 / viaduct 1180 m; 15200 fill 47 / 3.1 / 1328; 15309 fill 51 / 3.1 / 1261; 15700 fill 37 / 7.4 / 1126 but touches eng-automation (0 m). So about 1.2 km of approach viaduct (35-51 m high) is needed on any join; 4 % would not change it (the ground stays low until the last 150 m) |
| J1-c7c | E arm real vertical profile (V100, K crest 50.9 / sag 44.1, curves >= 60 m), s = 0 at J1 centre | done 2026-11-14: 12 PASS, 0 FAIL, waiting OK | 3 % everywhere (no hill stretch), pad grade 0.30 % to s 60 | scripts/j1-e-profile.ts (npx tsx scripts/j1-e-profile.ts docs), tools/j1-e-profile-plot.py, docs/j1c7c_profile.json, docs/STEPJ1C7C_OUTPUT.txt, docs/j1_e_profile.png. RESULT (PVI s, level): 0 (18.19), 124 (18.56), 251 (22.29), 407 (26.88), 746 (22.75), 849 (22.60), 1319 (36.43), 1563 (31.32), 3181 (78.89 = ring level at st 15313); 6 curves 60-256 m. Max centre cut 2.3 m (edges 2.4 m), max grade 2.94 %, last grade into the ring 2.94 %. VIADUCT (fill > 7 m): s 395-555 (8.0 m), 799-884 (15.4 m), 1354-1743 (11.2 m), 1773-1823 (8.8 m), s 2033-3181 (1148 m, max 53 m, edge fill 54 m): 1860 m in total, 58 % of the arm. Rail: north-1 at s 423 road OVER, gap 7.66 m; east-1 at s 1346 gap 7.67 m; east-2 at s 2648 gap 37 m (already high on the viaduct). River: 130 m wet, lowest clearance 7.8 m. NOTE: pad level now uses the true E axis (j1-w-profile.ts and the S copy use the N axis in padH: pad grade W -0.56 % instead of -0.30 %, S -0.56 % instead of +0.56 %, check before relying on s 0..60 of W and S). NEXT: 6.1d structures for S and E (E needs the 1148 m approach viaduct, decide type), 6.1e ground check |
| 6.1d-E | Structures list of the E arm (rail bridges, river bridges, viaducts) | done 2026-11-14: 8 PASS, 0 FAIL, waiting OK. S arm: see row 6.1d-S | Same rules as N / W (5.3b); NEW: spans 75 m where the deck is > 35 m high; the viaduct at the T is justified by the ring height | scripts/j1-structures-e.ts (npx tsx scripts/j1-structures-e.ts docs), docs/j1_structures_E.json, docs/STEP61D_E_OUTPUT.txt. E ARM (4 structures, 2035 m = 71.6 % of the 2841 m arm): E1 rail bridge north-1 + viaduct s 376-573 (197 m, max 8.0 m, crossing 68 deg, span 30 m, gap 7.66 m); E2 river bridge + viaduct s 781-903 (122 m, 75 m wet, main span about 105 m, 7.8 m above the water, 15.4 m above the ground); E3 rail bridge east-1 + viaduct s 1293-1842 (549 m, max 11.2 m, crossing only 16 deg so the rail span is 75 m, gap 7.67 m: WATCH, nearly parallel to the rail); E4 approach viaduct s 2014-3184 (1169 m, max 53.1 m, 15 piers of 75 m spans, spans rail east-2 at 80 deg (gap 37 m) and a 60 m wet river crossing (main span about 90 m, 45 m above the water), ends at the ring T, becomes part of the E ring interchange 9.2). PROPOSED TYPES (wait for OK): E1 / E3 segmental concrete box (E3 variant 2), E2 haunched steel box girder with V piers, E4 balanced-cantilever segmental box girder with tall hollow rectangular piers. NEXT: 6.1d for the S arm (send c6b / c6c files), then 6.1e |
| 6.1d-S | Structures list of the S arm (rail bridges, river bridge, viaducts) | done 2026-11-14: 8 PASS, 0 FAIL, waiting OK | OK 2026-11-14 (user: "ok"; types and the three-structure default accepted as proposed) | Same rules as N / W / E (5.3b); user: 'Road Handoff onujai next step koro' | scripts/j1-structures-s.ts (npx tsx scripts/j1-structures-s.ts docs; needs docs/j1c6b_align.json + j1c6c_profile.json), docs/j1_structures_S.json, docs/STEP61D_S_OUTPUT.txt. S ARM (5 structures, 894 m = 36.0 % of the 2486 m arm; 695 m of free embankment before the ring T, so NOTHING is part of the S ring interchange): S1 rail bridge west-nw + viaduct s 327-518 (192 m, max 7.9 m, crossing 83 deg, span 25 m, gap 7.67 m; starts 14 m before the arm start s 340 because of its 16 m approach slab, lane zone ends at s 269 so 58 m remain); S2 viaduct s 970-1157 (187 m, max 9.7 m); S3 rail bridge west-sw + river bridge + viaduct s 1180-1332 (152 m, max 16.1 m, rail crossing only 34 deg so rail span 45 m, 45 m wet, river main span about 75 m, 12.7 m above the water, gap 7.62 m); S4 viaduct s 1370-1542 (172 m, max 9.1 m); S5 rail bridge ring-south + viaduct s 1939-2131 (192 m, max 7.9 m, 65 deg, span 30 m, gap 7.68 m). The check 'start after the J1 lane zone' uses s >= 269 (J1-b lane zone end), not 340 (arm start, the E script used 340 because its first structure starts at 376). DECISION FOR THE USER: S2, S3 and S4 are only 23 m and 38 m of embankment apart (c6c asked 'decide one long structure'): one 571 m structure s 970-1542 or three. Default kept = three (merge gap rule is 15 m). PROPOSED TYPES (wait for OK): S1 / S5 segmental concrete box viaduct (S5 variant 2), S2 / S4 precast viaduct with twin-blade piers (S4 variant 2), S3 haunched steel box girder with V piers. Spans are a PROPOSAL. No src/ change. Checked with tsx only (no node_modules in this chat, so no npm run build). NEXT: 6.1e ground check of the four arms (water, steep ground, zones, fences, like 2.5), then J1-e e2 (arm roads in the game) |
| J1-b | J1 geometry data (pure math) | done 2026-11-13 at C9 (-117, -277): 32 PASS, 0 FAIL, waiting OK | | src/roads/junction/GroundJ1Geometry.ts, scripts/j1-ground-check.ts (run: tsx scripts/j1-ground-check.ts docs), docs/STEPJ1B_OUTPUT.txt, docs/j1b.json, docs/j1b_layout.png, tools/j1b-plot.py. RESULT: real box half B = 19.75 m (J1-a assumed 27.05 m, so the J1-a signal numbers stay valid, conservative); stop line 23.75 m from the centre (J1-a 31.05 m). Cross-section per arm (o from the axis): 4 outbound lanes -19.75..-5.15, median island 3.0 m, 2 right pockets (R2 inner, R1 outer) -2.15..5.15, 4 inbound through lanes 5.15..19.75, left slip lane 19.75..23.4. Through lanes of opposite arms line up exactly (no lateral shift). POCKETS from the stop line: R1 N/S 116 + 85, E/W 110 + 85 m; R2 is 30 m shorter at both ends (ASSUMED stagger, tapers W V^2 / 155 = 84.8 m). SLIP LANE: taper-in 84.8 m, full width 45.9 m, kerb arc R 25 m (arc centre (48.4, 48.4)), receiving lane = acceleration 95.6 m + merge taper 84.8 m, ends at s 228.8. MEDIAN shifts back to the M8 section (0.65 m in 40.3 m) after all tapers: lane zone ends at s = 269 m on every arm (clear 340 / 340 / 340 / 350 m). Corner island nose 1.0 m (ASSUMED), slip zebra at 45 deg of the arc (ASSUMED), all 4 corners identical. Footprint for J1-f: box 39.5 x 39.5 m, corner kerbs reach 53.8 m, inside the M8 ROW (40 m each side of the axes). Sight: SSD at 25 km/h 24.5 m, kerb and island side sight lines clear of the building line |
| J1-g1 | NEW open ground interchange ("open star") design sheet, C10 (-87, -277) yaw 37.5 | done 2026-11-14: 13 PASS 0 FAIL, OK by user 2026-11-14 (incl. slip 40 km/h) | | scripts/j1-g1-sheet.ts (headless, changes nothing in src/), docs/j1g1.json, docs/STEPJ1G1_OUTPUT.txt, section 15.8.9. Next: J1-g2 (geometry data + picture + check script) after OK |
| J1-g2 | Open star GEOMETRY data (pure math) + picture + check script | done 2026-11-14: 23 PASS 0 FAIL, waiting OK | | src/roads/junction/OpenJ1Geometry.ts (new; the old GroundJ1Geometry stays until g4), scripts/j1-g2-check.ts, tools/j1g2-plot.py, docs/j1g2.json, docs/j1g2_layout.png, docs/j1g2_star.png, docs/STEPJ1G2_OUTPUT.txt, section 15.8.10. Next: J1-g3 (terrain pad + arm join) after OK |
| J1-c | J1 profile and terrain (SMALL STEPS, user order: J1 first, then arms; each step small so the chat limit is not hit) | in progress | | c1 = J1 pad plane on the ground (DONE 2026-11-13, 3 PASS: grade 0.51 %, max cut/fill 0.33 m, pad y 18.25 m, world a -0.00342 b 0.00384, rCore 60 m, emb 20 m; scripts/j1-pad-fit.ts, docs/j1c1.json, docs/STEPJ1C1_OUTPUT.txt). ORDER CHANGED (hill on N and W): c2 = arm S DONE 2026-11-13 (4 PASS: pad plane to s 60 m, then grade -0.30 %, curve 8 m, edge cut 0.53 m / fill 0.54 m; docs/j1c_S.json, STEPJ1C_S_OUTPUT.txt); c3 = arm E DONE 2026-11-13 (4 PASS: grade +0.30 %, curve 9 m, edge cut 0.36 m / fill 1.08 m; docs/j1c_E.json, STEPJ1C_E_OUTPUT.txt). Both made by scripts/j1-arm-profile.ts (tsx scripts/j1-arm-profile.ts <N|E|S|W> docs 500). c4a = N arm PLAN ROUTE search DONE 2026-11-14 (waiting OK): scripts/j1-n-raster.ts, scripts/j1-n-route.ts, tools/j1-n-plot.py, docs/j1c4_raster.json, docs/j1c4_route.json, docs/STEPJ1C4A_OUTPUT.txt, docs/j1c4a_route.png. Search = least cost on (20 m cell, road height 0.5 m), grade <= 3 %, edge cut <= 3 m, edge fill <= 10 m, zones + 45 m and wet cells penalised, no earthwork limit in the last 150 m before the ring N point (ring cut 6 m there). Start = s 340 m on the axis (end of the lane zone; the 500 m straight is dropped on N because the ground climbs 20 -> 59 m between s 400 and 600), target = ring N st 11549 (1711.5, -3145.5) level 36.9 m. RESULT: the hill (up to 368 m) and a ridge at x 300 block the direct way, the low land (20 m) north of z -2200 is too low for a 36.9 m ring level. Options: A cut<=3 / fill<=10, zones kept = 6158 m (max edge cut 2.98, fill 9.88, 0 zone cells, 0 rail crossings, max grade 2.5 %); B zones ignored = 5428 m; C fill<=7 = 7904 m. Straight line is 3074 m. Cell grid route is jagged: smoothing to straight-spiral-arc is c4b, profile is c4c. USER 2026-11-14 on c4a: the 6.2 km winding route A is REJECTED (an 8-lane road must be nearly straight, only gentle bends, like the ring). c4a2 = GENTLE-BEND route DONE (waiting OK): scripts/j1-n-hybrid.ts (heading-aware search, cell 30 m, heading 5 deg, 90 m moves with max 5 deg turn = R >= 1031 m, grade <= 3 %), tools/j1-n-hybrid-plot.py, docs/j1c4_hybrid.json, docs/j1c4a_gentle.png. RESULT: 3170 m from J1 (straight line 2995 m from s 340), 14 turning steps of 5 deg only (heading -72.5 -> -62.5 deg), ends at the east end of the ring N straight (about st 12010, x 2025, z -2795) at the ring level 27 m... COST: ONE deep cut through the hill spur at route s 140-820 (max centre cut about 34-38 m, cut > 20 m for 390 m, about 1.3 million m3), fill > 3 m on 570 m (max 18 m, viaduct parts), river bridge at s 1660 (40 m wet), rail north-1 crossed at s 740 (road over rail), touches the eng-tech-park buffer at its NW corner (shift needed), eng-aerospace 57 m away. No cut <= 12 m route exists with R >= 1031 m. NEXT: user picks (straight with the deep cut / more bend / other), then c4b smoothing to straight-spiral-arc, c4c profile. c5 = W arm. GROUND PROBE of the straight axes (every 100 m to 2500 m): S max 22 m, E max 33 m (easy); N rises 18 -> 132 m at s 900 then 20 m at 2500; W rises 18 -> 190 m at s 900 (3 % cannot climb it). USER DECISION 2026-11-13: go around the hill, only SMALL cuttings (an 8-lane deep cutting is bad), NO tunnel; the "1 km straight perpendicular" rule may be relaxed after the straight part. User wants each reply small (chat limit), CHANGED FILES ONLY in the zip, and THIS file (HANDOFF_ROAD_DESIGN.md) is the main handoff, updated every step; HANDOFF.md is not used for road work (one arm per step: vertical curves, grade <= 3 %, side-slope earthwork), c6 = PadSpec + terrain carve in game. Probe: ground rises steeply on N and W beyond s 400 m (N 18 -> 34 m at s 500) |
| J1-d | J1 signals and markings data | not started | | |
| J1-e | J1 mesh and game layer | e1 DONE 2026-11-14 (J1 + lane zones s 0..270 in the game, 5 PASS); e2 DONE 2026-11-14 (arm roads in the game, see row J1-e2); EVLab move not needed | USER 2026-11-14: place J1 FIRST, then move whatever conflicts; ONLY THE RAILWAY IS FIXED | e1: Config.roads.junctionJ1 (enabled, x -87, z -277, yawDeg 37.5, pad plane of j1c1.json), src/roads/junction/GroundJ1Terrain.ts (pad plane + lane-zone levels, ONE function for terrain and mesh), J1ArmProfiles.ts (PVI tables N, W, E; S = pad -> -0.30 % stub), GroundJ1Mesh.ts (asphalt, islands with kerbs, lane lines, stop lines, zebra, 7774 triangles), GroundJ1Layer.ts, hooks in RoadNetwork.ts (j1 plateau in apply() and maskAt(), NOT in roads.pads, so rail / traffic graph are untouched) and Engine.ts; scripts/j1-game-check.ts, docs/STEPJ1E1_OUTPUT.txt. RESULT: ground = finished level (max diff 0.000 m), centre 18.19 m; lane zone s 60..270 fill N 3.6 / E 4.3 / S 0.4 / W 3.4 m, cut <= 0.7 m; no water; railway plan identical with J1 on / off. CONFLICT: 59 % of the J1 footprint lies inside EVLAB_PLOT (x -520..-40, z -470..-30; the campus is centred (-280, -250), BUILDING_Z -260): the EVLab pad yields to J1 (mask) but campus, lake ring, parking and fence still stand there. USER 2026-11-14 (J1 seen in the game, good): structures / buildings in the way may stay in the middle and are re-placed later, so the EVLab move is NOT needed now (scripts/evlab-move-search.ts + docs/STEPJ1E2A_OUTPUT.txt are a side search, no src change). NEXT e2: the arm roads beyond s 270 in the game, after every arm has its profile (S: c6c) |
| J1-e2 | The four M8 arms in the game (J1-N / J1-E / J1-S / J1-W, s 270 m to the T on the ring, with their 17 structures) | done 2026-11-14: scripts/j1-arms-game-check.ts ALL PASS, waiting for the game look (screenshot) | USER 2026-11-14: 'game a dekhi' (see it in the game) | NEW src/roads/junction/J1ArmData.ts (GENERATED by tools/j1-arm-data.py from the c4b/c7b/c6b/c5b + c4c/c7c/c6c/c5c + structures json: points every 10 m, finished heights, structure ranges), CHANGED: src/core/Config.ts (roads.junctionJ1Arms { enabled: true }), src/roads/RoadNetwork.ts (addJ1Arms() / layoutJ1Arms() / bridgeArm(); bridgeRing split into bridgeRing + registerStructures), src/terrain/TerrainGenerator.ts (calls roads.addJ1Arms() right AFTER the railway is planned), src/roads/ring/RingBridgeGeometry.ts (ringStructures() = ring 6 + arms 17, designs after the ring are 'plain' girders until the types are OK'd), src/roads/junction/J1ArmProfiles.ts (+ S table from c6c) and GroundJ1Terrain.ts (S arm uses it, the old -0.30 % stub is gone), scripts/ring-facade-check.ts + ring-cut-check.ts (arms switched off: they test the ring alone). KEY FINDING: the railway router moves its line away from roads, so adding the arms at the start moved the railway (north-1 up to 237 m, east-2 up to 1.8 km). Railway CANNOT change, so the arms are added AFTER the railway is planned (RoadNetwork.addJ1Arms): railway plan is now identical with the arms on / off (12 edges, checked). RESULT of the check: all four arms start on the J1 axis at s 270 (offset 0.02 m, level diff 0.00 m), max grade 4.01 % (N 4.00, W 4.01, E / S 3.01), ground = road level on every centreline point outside structures, structures N 5 / E 4 / S 5 / W 3 with lengths within 5 m of 6.1d, every arm ends 0.7-3.1 m from the ring centreline (T), 23 structure meshes build (20 098 triangles, 22 ms). Ring checks (facade, cut, shader, road) still ALL PASS with the arms off; ring-structures-check ALL PASS. NOT done / NOT seen: the look in the game (needs a screenshot), the T zones on the ring (no ramps, no interchange: the arm just ends on the ring ribbon; ring-cut-check was NOT run with the arms on because the arm earthworks change the ring ground near the T, that zone is the ring interchange 9.2), the traffic graph (the arms are roads of the network: AI cars may or may not use them, not tested), road signs / street lights, the R 126 m bend of the W arm (no superelevation / widening), structure designs (all 17 are plain girders until the 6.1d types are OK'd), npm run build (no node_modules in this chat; tsc could not run, a type check of the touched files with a temporary tsconfig shows only missing-module errors for three / node types). Output docs/STEPJ1E2_OUTPUT.txt |
| RAIL-A+C2 | Railway long section knows the J1 arms (option A) and Central is raised to 34 m (option C2); railway PLAN, road design and 8-lane roads NOT changed | done 2026-11-14 (code + checks); STEP 5 run 2026-11-14 (v1.1); npm install, npm run build, station-structures-test and game look still open, waiting OK | USER 2026-11-14: 'A+C2' | CHANGED: src/rail/RailNetwork.ts (joinLateRoads(): plan made without the arms, then addJ1Arms(), context / road index / crossings rebuilt, elevateStations uses STATION_LEVELS; pier search gets the rail height), src/rail/RailContext.ts (pierFree(..., railY): a rail pier may stand under the main span of a J1 arm only where the rail is >= 5 m below the deck, margin beside an arm deck 1 m instead of 9 m), src/rail/RailPlan.ts (STATION_LEVELS = { central: 34 }), src/roads/RoadNetwork.ts (addJ1Arms runs once), scripts/rail-plan-test.ts (pier check passes deckY), scripts/j1-arms-game-check.ts (plan identical = x, z only; height may differ), NEW scripts/rail-city-profile-check.ts + docs/rail_old_profile.json (old game ground / bridge reference). RESULT: plan difference 0.0 m with arms on / off; 190 road probes FAIL -> 0; spans east-1 225 m and west-sw 130 m fixed (longest steel span 106 m <= 120); bridge 5.64 -> 9.94 km (old 17.72); metro core (800 m of Central) 90 % viaduct (old 98 %), 88 % same kind as old; max grade 2.49 %, no grade exception; 9 arm x rail crossings OK (rail over arm 4: underside 5.3 m over the road, arm over rail 5: 7.8 m over the rail top); rail-city-profile-check ALL PASS; j1-arms-game-check, ring-facade, ring-cut, ring-structures, j1-game-check, j1-structures-s PASS. STILL FAIL (same as before this step, not caused by it): rail-plan-test 2 station links (3.7 m, 3.2 m off ground), rail-mesh-test Central diamond nose, rail-link-test collider count, people-rail-test ground probes (579 -> 247; 13 are under the J1-S bridge decks, max 0.26 m). STEP 5 (v1.1, 2026-11-14, no network, no real three / vite / rapier in the sandbox): npm install FAILED (registry not reachable, node_modules empty); tsc 6.0.3 (global, project wants 7) with vite/client types switched off in a temporary config: 0 errors in the 4 changed src files except the missing-'three' kind (TS2307) and its follow-ups; this is NOT a real tsc pass because three types are missing; npm run build NOT RUN (needs vite + three). Check scripts run with global tsx: PASS rail-city-profile-check, j1-arms-game-check, ring-facade-check, ring-cut-check, ring-structures-check, j1-game-check, j1-structures-s (8 PASS 0 FAIL); station-structures-test NOT RUN (Cannot find package three). OLD FAILS, not from this step, NOT fixed, waiting for the user: rail-plan-test 2 station links (south-interchange south-1~south-2 3.7 m, east-works east-2~ring-northeast 3.2 m off the natural ground); rail-mesh-test Central diamond nose (central:north-1~west-sw|east-1~west-nw:RL, crossing nose 1 missing in the mesh); rail-link-test collider count (expected 137, found 197; real Rapier layer skipped, no three); people-rail-test ground probes (247 probes changed by the railway, max 16.179 m; 13 under the J1-S bridge decks, max 0.26 m). ARM STRUCTURES E1, S1, S3, W1: rail-over-arm crossings are at E1 (250, -20), S1 (-339, 52), S3 (-695, 789), W1 (-717, -167); the 6.1d list (road over rail, rail bridge spans 25-45 m) was made before the rail was raised, now the rail viaduct goes OVER the arm (clearance under the rail 5.3 m, needs 5.2 m: checked, PASS). In the game these four arm structures are still plain decks with no piers (types not OK'd yet) and are still built as before; rail piers stand 3.3-3.8 m (plan) from the arm deck edge (E1 3.6, S1 3.7, S3 3.3, W1 3.8). OPEN DECISION for the user: keep E1 / S1 / S3 / W1 as they are or redo them as road UNDER rail (no rail span needed). RULE for 6.1d types (when OK'd): arm piers must keep clear of rail piers (RailNetwork.piers): at least 3 m in plan between a pier of an arm structure and any rail pier / rail deck edge, and no arm pier under the rail viaduct slab; the span of E1 / S1 / S3 / W1 must jump over the rail pier row instead of standing in it; run scripts/rail-city-profile-check.ts after any change. SEE IN GAME (x, z): Central (0, 300); rail over arm (250, -20), (-339, 52), (-695, 789), (-717, -167); rail under arm (1137, 134); J1-N crossing (491, -1690). NOTE: the 4 arm structures E1, S1, S3, W1 were designed as road over rail, the rail now passes over them; when the 6.1d types are OK'd the arm piers must keep clear of the rail piers (RailNetwork.piers). |
| RAIL-B | Road / rail height fixes from the user's 10 screenshot points (STEP 1 = survey only, no code changed); plan (x, z), river and road design NOT changed | STEP 1 + STEP 2 + STEP 3 + STEP 4 done 2026-11-14; STEP 5 half done (points 8, 9 done, point 6 waiting for the user's choice); how to continue: section 16 | USER 2026-11-14: road down at 1-3, road stays on bridge at 4, road up at 5 and 10, rail up at 6, 8, 9, junction at 7 on the ground, river stays, simple road-rail buffer setting, rail height change = rail goes to ground at that point and the road gets a bridge | STEP 1: no file changed. STEP 2 (user said 'next' = OK for the proposed buffer): CHANGED src/core/Config.ts (Config.roads.roadRailBuffer = { railOverRoad 7.0, roadOverRail 9.0, pierToDeckEdge 3.0, armPierToRailPier 3.0 }, NOT read by the design code yet), NEW scripts/road-rail-buffer-check.ts (measure only; npx tsx scripts/road-rail-buffer-check.ts). Road and rail NOT changed. RESULT (baseline, run 2026-11-14): 16 crossings, 2 tunnel skipped, 14 measured: PASS 2 (J1-E x east-2 36.9 m, M8 x west-nw 15.3 m), FAIL 12 = the 7 'rail over road' places short by 1.7-1.8 m (J1-E x north-1, J1-S x west-nw, J1-W x west-nw, J1-S x west-sw, M8 x east-2, M8 x ring-northeast, M8 x airport-branch: gap 5.2-5.4 m, need 7.0 m) and the 5 'road over rail' places short by 0.4-1.2 m (M8 x south-2 8.6, J1-N x north-1 8.1, J1-E x east-1 7.8, J1-S x ring-south 7.8, J1-W x ring-west 8.1; need 9.0 m). Rail piers: 308, 0 beside a road bridge deck closer than 3 m (closest 3.0 m, J1-S / rail west-sw pier -658.0, 761.7), 10 stand under a road deck (allowed, height is the crossing check). Arm pier to rail pier: NOT CHECKED (arm structures have no piers yet). tsc / npm run build NOT RUN (no real three in the sandbox). UPDATE 2026-11-14 (later, user): points 7 and 10 DROPPED (user sees nothing to change there, ignore their OPEN QUESTION / confirm notes below); NEW point 11 = J1-W x ring-west (-2457, 242), screenshot camera (-2453, 22, 301): road bridge too low over the rail (gap 8.1 m, need 9.0 m), road UP. STEP 4 = points 4, 5, 11; STEP 6 has no work. Section 16 has the final list. SURVEY (camera point -> game data): 1 E1 J1-E x north-1 (250,-20) rail over road: road 25.9, ground 18.2, rail 33.8, road bridge 200 m, gap under rail 5.3 m. 2 S1 J1-S x west-nw (-339,52): road 25.6, ground 17.7, rail 33.7, bridge 192 m, gap 5.4 m. 3 W1 J1-W x west-nw (-717,-167): road 32.8, ground 28.2, rail 40.6, bridge 56 m, gap 5.2 m. 4 S3 J1-S x west-sw (-695,789) with river: road 29.6, ground 14.7, rail 37.5, bridge 152 m, gap 5.2 m. 5 J1-S x ring-south (-993,1559) road over rail: road 22.0, rail 14.2, gap 7.8 m. 6 M8 x east-2 (1925,1649) rail over road: rail 41.1, road 33.2, gap 5.3 m. 7 J1-E end / ring T (2967,194): arm and ring both on bridge, y 78.9, ground 44 (screenshot X is 2948, not 2448); OPEN QUESTION: keep E4 viaduct or move the T to ring ground level. 8 M8 x ring-northeast (2432,-2435): rail 38.8, road 30.8, gap 5.3 m. 9 M8 x airport-branch (1558,-3297): rail 42.0, road 34.1, gap 5.2 m. 10 screenshot X unreadable; best match J1-N x north-1 (491,-1690) road over rail: road 44.1, rail 36.1 (rail cut and cover), gap 8.1 m, road bridge 96 m; user must confirm. PROPOSED BUFFER (wait for OK; today's limits: rail over road underside >= 5.2 m, road over rail >= 7.0 m, pier to deck edge 3 m by rule): rail over road >= 7.0 m, road over rail >= 9.0 m, pier to deck edge in plan >= 3 m, arm pier to rail pier >= 3 m; one place in Config, no hardcode. Raising rail about 1.8 m at 2.5 % max grade needs about 70 m of ramp each side, where this does not fit the rule 'rail to ground + road bridge' is used. NEXT: STEP 3 points 1-3, STEP 4 points 4, 5, 10, STEP 5 points 6, 8, 9, STEP 6 point 7, STEP 7 all checks + zip. STEP 3 (points 1, 2, 3 = E1, S1, W1, done 2026-11-14, heights only, plan / rail plan / river NOT changed): J1-E, J1-S, J1-W roads lowered at the rail crossing, road bridges E1, S1, W1 removed. NEW scripts/j1-rail-b3-profile.ts (npx tsx scripts/j1-rail-b3-profile.ts docs; WRITE=1 writes), docs/STEPRAILB3_OUTPUT.txt. CHANGED: docs/j1c7c|c6c|c5c_profile.json (new PVIs, rows, crossing entry of E1/S1/W1 only), docs/j1_structures_E|S|NW.json (E1, S1, W1 removed; S list renumbered S1-S4 by j1-structures-s), src/roads/junction/J1ArmProfiles.ts (E, S, W tables), J1ArmData.ts (regenerated by tools/j1-arm-data.py), src/rail/RailPlan.ts (RAIL_OVER_ROAD_FLOOR) + RailNetwork.ts (zone floor: the rail keeps its old height at the 3 crossings, otherwise it followed the road down and the metro core check failed 84 % < 85 %), scripts/j1-arms-game-check.ts (counts E 3, S 4, W 2, ring 6 + 14), j1-arms-ground-check.ts (X5: rail over road >= 7.0 m also OK), j1-structures-s.ts (rail over road is not a road structure). RESULT: E1 road 25.90 -> 19.39 (ground 18.16), gap under the rail 5.3 -> 11.8 m; S1 road 25.65 -> 18.24 (ground 17.74), gap 5.4 -> 12.9 m; W1 road 32.73 -> 30.41 (ground 28.23, only 2.2 m down: arm grade limit 4 % and hill cut 11.7 m), gap 5.2 -> 7.5 m (need 7.0). Max grade E 2.94 %, S 2.94 %, W 3.93 %; no new viaduct. RUN (2026-11-14): tsc --noEmit no error; road-rail-buffer-check E1 / S1 / W1 PASS (other 9 FAIL are STEP 4 / 5 points, unchanged); rail-city-profile-check 15 PASS 0 FAIL (same as before: 9.94 km bridge, metro core 90 % / 88 %); j1-arms-game-check 34 PASS 0 FAIL; j1-arms-ground-check 38 PASS 0 FAIL; j1-game-check 7 PASS; ring-facade 10, ring-cut 5, ring-structures 6 PASS; j1-structures-s 9 PASS 0 FAIL. NOT RUN: npm run build (vite), game look, j1-structures-e.ts and j1-structures.ts NOT updated (rerunning them would bring E1 / W1 back: change them like j1-structures-s.ts first), old known FAIL tests (rail-plan-test, rail-mesh-test, rail-link-test, people-rail-test) ran, same kinds of FAIL as listed in section 16, not compared number by number. Screenshot (x, z): 1 (250, -20), 2 (-339, 52), 3 (-717, -167). STEP 4 (points 4, 5, 11, done 2026-11-14, heights only, plan / river NOT changed; points 7 and 10 dropped): NEW scripts/j1-rail-b4-profile.ts (S arm only; npx tsx scripts/j1-rail-b4-profile.ts docs; WRITE=1 writes; then python3 tools/j1-arm-data.py and npx tsx scripts/j1-structures-s.ts docs), docs/STEPRAILB4_OUTPUT.txt. POINT 4 (J1-S x west-sw): road 29.59 -> 20.98 (ground 14.72; the road follows the ground, the long viaduct is gone), gap under the rail 5.2 -> 13.7 m; the rail keeps its old height through RAIL_OVER_ROAD_FLOOR 'J1-S|west-sw' 37.4 (without it the rail followed the road down and rail-city-profile-check failed 83 % < 85 %). POINT 5 (J1-S x ring-south): road 21.98 -> 23.74, gap over the rail 7.8 -> 9.4 m. S arm max grade 2.94 %, max centre cut 2.6 m, river clearance 4.1 m; S structures now S1 (river bridge + viaduct, s 1215..1292) and S2 (rail bridge + viaduct, s 1904..2240). POINT 11 (J1-W x ring-west): the ROAD CANNOT GO UP (the crossing is 98 m before the ring T at 22.92 m, going up 0.9 m would need about 4.5 % grade, limit 3 %), so the RAIL goes down at that crossing instead: NEW RAIL_UNDER_BRIDGE_DROP in src/rail/RailPlan.ts ('J1-W|ring-west': 9.3 = least distance road surface to rail top) used by RailNetwork.ts (zone.bridgeDrop, under-bridge rule only; no other crossing changes). Gap 8.1 -> 9.2 m, road unchanged 25.74. This is the one place where the rail height was changed in STEP 4 (user to confirm). CHANGED: docs/j1c6c_profile.json, docs/j1_structures_S.json, docs/j1_arms_ground.json, docs/STEP61D_S_OUTPUT.txt, docs/STEP61E_OUTPUT.txt, src/roads/junction/J1ArmProfiles.ts (S table), J1ArmData.ts (regenerated), src/rail/RailPlan.ts, src/rail/RailNetwork.ts. RESULT (run 2026-11-14): road-rail-buffer-check points 4, 5, 11 PASS, 6 FAIL left (M8 x south-2, J1-N x north-1, M8 x airport-branch, J1-E x east-1, M8 x east-2, M8 x ring-northeast); rail-city-profile-check ALL PASS; j1-arms-game-check ALL PASS; j1-arms-ground-check 38 PASS 0 FAIL; j1-game-check ALL PASS; ring-facade, ring-cut, ring-structures ALL PASS; j1-structures-s 9 PASS 0 FAIL; rail-plan-test same 2 FAIL as before (south-interchange 3.7 m, east-works 3.2 m). NOT RUN: tsc (no vite/client types in the sandbox, user to run), npm run build, game look, rail-mesh-test, rail-link-test, people-rail-test. Screenshot (x, z): 4 (-695, 789), 5 (-993, 1559), 11 (-2457, 242). STEP 5 (points 6, 8, 9; 2026-11-14, rail heights only, rail plan (x, z) NOT changed): NEW RAIL_OVER_ROAD_RISE in src/rail/RailPlan.ts ('M8|ring-northeast': 10.0, 'M8|airport-branch': 10.0 = distance road surface to rail top) used by RailNetwork.ts (zone.rise, 'over' rule only). POINT 8 (M8 x ring-northeast): gap 5.3 -> 7.4 m PASS. POINT 9 (M8 x airport-branch): gap 5.2 -> 7.3 m PASS. POINT 6 (M8 x east-2, rail 41.1, road 33.2, gap 5.3 m): NOT DONE. With any rise from 9.8 to 10.0 the rail solver gave up the 'over' crossing and put the rail UNDER the road (road over rail gap 7.5 m, worse), so the entry was removed again (gap back to 5.3 m). Rule of this section: rail to the ground + road bridge at that point, list shown to the user BEFORE changing; waiting for the user's choice. RESULT (run 2026-11-14): road-rail-buffer-check 4 FAIL left (M8 x south-2 8.6 m, M8 x east-2 5.3 m, J1-N x north-1 8.1 m, J1-E x east-1 7.8 m; the last three are outside the user's list); 316 rail piers, 0 beside a deck; rail-city-profile-check, j1-arms-game-check, j1-arms-ground-check (38), j1-game-check, ring-facade, ring-cut, ring-structures, j1-structures-s all PASS; rail-plan-test same 2 FAIL as before. NOT RUN: tsc, npm run build, game look, rail-mesh-test, rail-link-test, people-rail-test. Screenshot (x, z): 8 (2432, -2435), 9 (1558, -3297). POINT 7 DECIDED 2026-11-14: user chose OPTION B (junction on the ground; 'ami to 2 option kewi bolci' = what the user already said in the first survey: 'junction at 7 on the ground'). PLAN CHANGE of the E arm, step 1 of 5 DONE (alignment only, nothing else changed, the game still uses the OLD E arm until the later steps): scripts/j1-e-raster.ts (env RZ1 = south edge, run with RZ1=2400, raster now 180 x 170) and scripts/j1-e-align.ts (env STREF = reference station on the ring straight) take the new ring straight; search STLO=16788 STHI=17403 STREF=16900, 4 PI, seed 2 (seeds 3 also 12 PASS; seed 1 and 4 had 1 FAIL on the straights): docs/j1c7b_align.json + STEPJ1C7B_OUTPUT.txt replaced (old file is in git). RESULT: new T on the ring at st 17328, point (1896, 1664), arrival heading 63.7 deg (ring 153.7), arm length 2472 m (old about 3180 m), smallest R 767 m, 12 PASS 0 FAIL; vertical preview: max centre cut 4.3 m, max fill 12.1 m, viaduct (fill > 7 m) only 60 m (old E4 was 1170 m long and 53 m high), wet length 70 m (one river bridge), max grade 2.99 %; ring there is at ground level (design 33 m, ground 34 m). STEP 2 of 5 DONE 2026-11-14 (user OK): NEW scripts/j1-e-profile2.ts (annealing of all PVIs like j1-rail-b4-profile.ts; the old j1-e-profile.ts gave grade 3.13 % and first curve at s 43, 4 FAIL, do not use) writes docs/j1c7c_profile.json (NEW route, WRITE=1) + docs/STEPJ1C7C_OUTPUT.txt, docs/STEPRAILB7_E_PROFILE_OUTPUT.txt. RESULT 9 PASS 0 FAIL: 8 vertical curves (K ok, no overlap, first curve at s 278), max grade 2.94 %, max centre cut 7.1 m, end level = ring 33.42 m, river clearance 17.6 m; north-1 (s 424) rail over road: road 21.17 m, gap under the rail 10.0 m (need 7.0); east-1 (s 919) road over rail: road 34.41 m, gap 9.56 m (need 9.0). Viaduct runs (fill > 7 m): s 555..680, 760..969 (25.8 m high, the valley at east-1), 994..1184, 1683..1708 = about 550 m in all (old E4 1170 m). CHECKS after this step: j1-arms-game-check, j1-game-check, rail-city-profile-check ALL PASS (the game still uses the OLD E arm: J1ArmData / J1ArmProfiles NOT regenerated yet); j1-arms-ground-check has 1 FAIL on purpose (E: rail crossing east-1 must be inside a road structure, the E structures list is still the old one) = fixed by step 3. STEP 3 of 5 DONE 2026-11-14 (user OK): scripts/j1-structures-e.ts changed like j1-structures-s.ts (rail over road = no road structure, only checked >= 7.0 m; the old 'approach viaduct at the T' check is replaced by 'T at ring ground level, no structure within 150 m of the T'), run: docs/j1_structures_E.json + docs/STEP61D_E_OUTPUT.txt. RESULT 9 PASS 0 FAIL: E1 viaduct s 536..698 (162 m, 8.9 m high), E2 rail bridge (east-1, 49 deg, span 35 m) + river bridge (main span about 110 m) + viaduct s 741..1202 (461 m, 25.8 m high), E3 viaduct s 1665..1727 (62 m, 7.7 m high); about 685 m of viaduct type in all; last structure ends 1085 m before the ring. CHECKS: j1-arms-ground-check 38 PASS 0 FAIL, j1-arms-game-check, j1-game-check, rail-city-profile-check, ring-structures-check all PASS (the game still uses the OLD E arm until step 4). STILL TO DO (one step per session, wait for the user's OK): 2 and 3 done, see above; 2 = E arm vertical profile (scripts/j1-e-profile.ts, c7c), 3 = E structures list (j1-structures-e.ts must be changed like j1-structures-s.ts), 4 = regenerate J1ArmData (tools/j1-arm-data.py), ring join + RING_RADIAL_JOINS for the E arm, game checks counts, 5 = rail crossings of the new E arm (rail knows the arms, rerun road-rail-buffer-check, rail-city-profile-check). POINT 7 (survey text) : POINT 7 BACK ON THE LIST 2026-11-14 (user: 'ata maybe 7', screenshot of the J1-E / ring T, camera X about 2789, Y 198): NOT CHANGED, survey only. Facts: at the T (ring st 15313, (2967, 194)) the ring deck is 78.9 m high, ground about 44 m, so the ring is a 35 m high viaduct there (ring profile: 4 % descent from 80 m at st 15200 to ground level only at st about 16280; valley water st 15410..15430, clearance 34 m). The J1-E arm climbs 36 m -> 78.9 m over its last 1600 m (E4 viaduct s 2014..3184, 53 m high, 1170 m long). A ground-level T at this place is NOT possible by height changes only (ring already at the 4 % limit, lowering it 35 m needs a new ring profile over about 1.5 km). Options for the user: A keep as is; B move the T along the ring to about st 16250..16500 where the ring is at ground level (PLAN change of the E arm alignment c7b, needs OK); C raise nothing, only change the E4 viaduct type / look. Waiting for the user's choice. POINT 7 STEP 4 of 5 DONE 2026-11-14 (new E arm in the game, plan / profile / structures of steps 1-3 now used by the game): tools/j1-arm-data.py rerun -> src/roads/junction/J1ArmData.ts (E: 3 structures [536.2,698.1] [741,1202.4] [1664.8,1726.8], T at the ring (1896.1, 1663.7)); src/roads/junction/J1ArmProfiles.ts E table replaced from docs/j1c7c_profile.json (14 PVI, 8 curves, last level 33.42 m = ring); src/roads/alignment/RingAlignment.ts RING_RADIAL_JOINS E = st 17328 (1896.1, 1663.7) (was st 15309 (2967.4, 190.5)); scripts/j1-arms-game-check.ts counts fixed (E 3, S 2 [stale 4 since RAIL-B step 4], ringStructures 6 + 12 = 18); scripts/rail-city-profile-check.ts crossing count 9 -> 8 (E lost east-2). RESULT: j1-arms-game-check ALL PASS, j1-arms-ground-check 38 PASS 0 FAIL, j1-game-check ALL PASS, rail-city-profile-check ALL PASS, j1-structures-s 9 PASS, ring-facade / ring-cut / ring-structures ALL PASS, road-rail-buffer-check: J1-E x north-1 gap 10.1 m PASS, J1-E x east-1 gap 9.6 m PASS (3 FAIL left, none on E: M8 x south-2 8.6, J1-N x north-1 8.1, M8 x east-2 5.3). NOTE: scripts/ring-superelevation.ts radial points: N / S already FAIL before this step (same numbers), E at st 17328 gives free 648 m before / only 178 m after (the straight 16635-17551 ends at st 17506 where PI 9 bend starts); the old st 15309 also FAILED there (455 / 595), so this is not new, but E now has less room after the T: decide with the user if the ring join gets a ramp / interchange design (9.2). NOT done: ring-ground-check / ring-markings-check with the new join not rerun, npm run build, game look. STEP 5 left = rail crossings of the new E arm (rail-buffer + rail-city-profile already show north-1 and east-1 OK; do the detailed check + pier check). POINT 7 STEP 5 of 5 DONE 2026-11-14 (check only, no src change): rail crossings of the new E arm = north-1 at s 424 (rail OVER the road, gap 10.1 m, need 7.0) and east-1 at s 919 (road OVER the rail, gap 9.6 m, need 9.0); east-2 is no longer crossed. road-rail-buffer-check: both E crossings PASS, rail piers 303, 0 closer than 3 m beside a road deck (closest 3.6 m); 3 FAIL left, none on E (M8 x south-2 8.6, J1-N x north-1 8.1, M8 x east-2 5.3). rail-city-profile-check ALL PASS (8 arm crossings, rail over arm 7.6 m, arm over rail 8.1 m, 810 probes changed 0, metro core 90 % / 88 %), j1-arms-game-check ALL PASS, railway plan identical with arms on / off. Output docs/STEPRAILB7_E_STEP5_OUTPUT.txt. Old rail-plan-test FAIL unchanged (south-interchange 3.7 m, east-works 3.2 m). Point 7 option B is COMPLETE (steps 1-5). Still not run: npm run build, game look (see E arm near (653, 267) and the T at (1896, 1664)), ring-ground-check / ring-markings-check were run but only skimmed. Arm piers vs rail piers (3 m rule) cannot be checked until the arm structure types are OK'd (arms have no piers yet). POINT 7 REDONE 2026-11-14 (USER: the T at ring st 17328 was too close to the rail (35 m from the east-2 crossing); 'if we build an interchange here the railway will make trouble, move it a bit away'): this SUPERSEDES the st 17328 numbers of steps 1-5 above. Ring distance to the nearest rail by station (docs/j1c7_raster.json rail vs ring_samples_5m.csv): st 16688 417 m, 16800 341, 16900 265, 17018 190, 17128 115, 17238 39, 17293 = 0 (ring crosses east-2). The ring straight is 16635-17551; west of 16635 is the bend. NEW T = ring st 16813, (2354.5, 1436.9), arrival heading 63.7, rail about 340 m away: RING_RADIAL_JOINS E = st 16813. Steps redone: (1) j1-e-align.ts STLO=16700 STHI=16900 STREF=16800, 4 PI, seed 2, 12 PASS: length 2697 m, R >= 662, max cut 8.0 m, wet 210 m. (2) scripts/j1-e-profile2.ts changed (start table stretched to the new length, end level = ring DESIGN level at the T from docs/ring_profile.csv = 28.41 m, every extra rail crossing becomes a target automatically, last 175 m before the T kept free of viaduct): 10 PASS, 8 curves, max grade 2.94 %, max cut 8.1 m. (3) j1-structures-e.ts: E1 viaduct s 561-688, E2 rail bridge east-1 + river + viaduct 746-1158, E3 river bridge + viaduct 1260-1422, E4 rail bridge east-2 + river + viaduct 2344-2646, E5 viaduct 2769-2880 (ends 156 m before the T): 9 PASS, 5 structures, 1114 m = 41 % of the arm. NEW FACT: the new route crosses east-2 at s 2615 (66 deg, road OVER rail, gap 9.5 m, road 39.0 m, rail 29.45 m) = 3 rail crossings now (north-1, east-1, east-2). (4) J1ArmData regenerated, J1ArmProfiles E table replaced, game checks: E 5 structures, ringStructures 6 + 14 = 20, rail-city-profile-check 9 crossings. (5) RAIL FIX: with the new arm the rail solver flipped east-1 to rail OVER the road (rail 42.3 m, gap 5.2 m, because the rail corridor is wet near it); NEW RAIL_UNDER_BRIDGE_FORCE in src/rail/RailPlan.ts ('J1-E|east-1') used in RailNetwork.ts (window kind): rail stays UNDER the arm (rail 24.8 m, road over rail gap 9.6 m). NEW in src/rail/RailContext.ts: a rail pier beside a J1 arm deck keeps Config.roads.roadRailBuffer.pierToDeckEdge + 0.2 m (was 1 m; the rail east-2 pier was 2.9 m from the new E4 deck, now 3.8 m closest). RESULT: j1-arms-game-check, j1-game-check, rail-city-profile-check (metro core 93 % / 90 %), ring-facade, ring-cut, ring-structures ALL PASS, j1-arms-ground-check 38 PASS, j1-structures-s 9, j1-structures-e 9 PASS; road-rail-buffer-check: all J1-E crossings PASS, rail piers 0 closer than 3 m; 3 FAIL left, none on E (M8 x south-2 8.6 m, J1-N x north-1 8.1 m, M8 x east-2 (1925, 1649) 5.3 m = the user's point 6, rail over the ring, still open, now 340 m away from the T); rail-plan-test same 2 old FAIL. Output docs/STEPRAILB7_E_STEP5_OUTPUT.txt. OPEN: ring-superelevation 'free straight' for E: 133 m before / 693 m after (needs 500 each side, the straight 16635-17551 has only 826 m free, and 17293 is the rail crossing): a full 3-leg interchange at this T does not fit by that rule, user to decide (accept a compact interchange, or move the rail crossing / ring). Not run: npm run build, game look. |
| J1-f | Re-zoning under J1 (old 6.2b for J1 only) | not started | | |
| 6.1b | Radial axis A (N + S) centrelines | not started | | |
| 6.1c | Radial axis B (E + W) centrelines | not started | | |
| 6.1d | Structures list of the N and W arms (rail bridges, river bridges, viaducts) | done for N and W 2026-11-14: 16 PASS, 0 FAIL, waiting OK (W join decided by the AI, see DECISION below) | | scripts/j1-structures.ts (npx tsx scripts/j1-structures.ts docs), tools/j1-structures-plot.py, docs/STEP61D_OUTPUT.txt, docs/j1_structures_NW.json, docs/j1_structures_NW.png. Rules as the ring (5.3b): wet = bridge, road > 7 m above ground = viaduct (D4), rail crossing = road OVER rail with the whole corridor spanned (24 m / sin angle, ASSUMED), 16 m approach slab each end, merge gap <= 15 m, spans a PROPOSAL (rail corridor / sin angle, river wet length + 2 x 15 m, standard 40 m, 50 m above 15 m height). N ARM (5 structures, 755 m = 23.5 % of the arm): N1 viaduct s 367-453 (87 m, max 7.6 m high); N2 viaduct s 1166-1493 (327 m, max 15.8 m, 6 x 50 m spans); N3 rail bridge north-1 s 1527-1619 (92 m, crossing 25 deg so span 60 m, gap 7.69 m; road is nearly at ground level there, ground is carved under the slab up to 6.7 m); N4 river bridge + viaduct s 2355-2492 (137 m, 55 m wet, main span about 85 m, road 12.3 m above the water, 17.6 m above the ground); N5 viaduct s 3000-3112 (112 m, max 11.1 m). Only 34 m of embankment between N2 and N3 (merge them if you prefer). W ARM (3 structures, 371 m = 14.6 %): W1 rail bridge west-nw s 884-941 (57 m, 89 deg, span 25 m, gap 7.97 m); W2 river bridge + viaduct s 1829-1936 (107 m, 35 m wet, main span 65 m, 10.5 m above the water, 13.5 m above the ground); W3 rail bridge ring-west + viaduct s 2658-2865 (207 m, 86 deg, span 25 m, gap 7.64 m, max 8.9 m high). PROPOSED TYPES (wait for OK, the ring already has S1 cable-stayed, S2 arch, S3 extradosed, S4 bowstring, S5 / S6 box-girder viaducts): viaducts = precast concrete with slender twin-blade piers; rail bridges N3 / W1 = skewed steel box girder with integral abutments, W3 = segmental concrete box; river bridges N4 / W2 = haunched steel box girder with slender V piers. The 'variant' names in the output are placeholders: the real designs must be made different in 5.3c-style steps. DECISION 2026-11-14 (user: 'engineering hisebe tumi jeta valo mone koro seta koro'): KEEP the W join at ring st 4265, W3 becomes PART OF THE W RING INTERCHANGE (9.2). Problem found: the rail line ring-west runs parallel to the ring W straight, 83-240 m inside it, so every join has the rail inside the interchange footprint (rail cannot change). I checked moving the join (the earlier proposal (a)) with the real data and it does NOT help: rail distance from the ring (m) / ring grade (%) / ring cut (+) fill (-): st 3200 222 / -3.1 / +14.7; 3400 195 / -4.0 / -7.5 (steep, deep cut of 31 m within 500 m); 3600 165 / -2.8; 3800 139 / -0.1 / -0.3; 4000 118 / +1.9; 4265 about 98 / about 0 / about 0 (flattest, relief +-4 m within 500 m); 4700 84 (closest); 5500 124 / +3.2; 5900 185 / +4.0 (relief 49 m). Rail >= 195 m away only where the ring is at its 4 % limit with a 31 m cut next to it. So the flat ring site is kept and the rail is crossed inside the interchange. CHECK added in j1-structures.ts: every ramp that crosses the rail must be >= 7.4 m above the rail top (25.5 m) and then come down to the ring level 22.92 m at <= 5 %: needs 54 m, available 64 m (rail axis 98 m before the ring - corridor half 12 - ring edge 22.1): PASS with 10 m margin. 9.2 for the W interchange must therefore be designed ON W3 (every arm / ramp line crossing the rail is a bridge, ramps leave the arm only after the rail or on the structure). If you later prefer another join, redo c5b / c5c with env ST range |

| 6.1e | Radial ground check (N, E, S, W arms, s >= 340) | done 2026-11-14: 38 PASS, 0 FAIL, waiting OK | | scripts/j1-arms-ground-check.ts (npx tsx scripts/j1-arms-ground-check.ts docs; needs the c4b/c7b/c6b/c5b align + c4c/c7c/c6c/c5c profile + j1_structures_NW/E/S json), docs/STEP61E_OUTPUT.txt, docs/j1_arms_ground.json. Natural ground over the ROW +-40 m every 5 m. Rule: ONLY THE RAILWAY IS FIXED, zones / buildings are LISTED not failed. RESULT, hard checks all PASS on every arm: every wet point, river crossing and rail crossing lies inside a structure; no fill > 7 m outside a structure; centre cut <= 12 m (N 11.9, W 11.7, E 2.3, S 0.7); no facility fence or sea in the ROW (nearest: airport 744 m on N, army 2478 m on W, airport-sea 1086 m on S, seaport 2385 m on E); map edge >= 2033 m; the four ROWs are far apart (smallest 429 m, S x W, centrelines at s >= 600); no rail runs parallel closer than 60 m away from a crossing. Rivers: N 1 (53 m channel), E 3 (76 / 21 / 22 m), S 1 (33 m), W 1 (27 m). Rail crossings 1 / 3 / 3 / 2 = 9 in total, same as the profile lists. Terrain class flat / rolling / hilly (steep 0 % everywhere): N 36 / 57 / 8 %, E 45 / 48 / 8 %, S 88 / 9 / 4 %, W 29 / 46 / 25 %. WATCH (not a fail): edge cut at +-24.2 m over 12 m on N s 645-690 (14.8 m) and 860-910 (14.3 m) and on W s 465-645 (19.5 m, the hill), these are rock cut / steep side slopes (user decision 5.2a), centre cut is within 12 m. E max fill at the edge 54 m (the approach viaduct). CITY PLAN AREAS under the centrelines (re-zoning list for J1-f / 6.2b): N s0-suburb 220 m + s0-green 190 m; E s0-arm-e 335 m + s0-suburb 285 m + s0-green 190 m; S s0-arm-w 140 m + s0-homes 160 m + s0-suburb 280 m + s0-green 215 m; W s0-suburb 639 m + s0-green 275 m. World zones: all four start in metro-core (770-870 m), then N civic / wetland / farmland / forest, E park / residential / logistics, S residential / utility, W residential. NOT checked: the J1 lane zone s 0..340 (done in J1-c1 / J1-e1), the 25 m side slopes beyond the formation edge (daylight reach is computed in the game, RoadNetwork.apply()), the R 126 m first bend of the W arm (no superelevation / widening yet, open since c5c). NEXT: J1-e e2 (arm roads in the game, beyond s 270), or J1-f re-zoning list, or the 6.1d type OK for N / W / E / S structures: user picks |
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

**J1 IS NOW C10 (-87, -277), YAW 37.5 deg east of north, see 15.8.8 (J1-a2, 2026-11-14; it replaces C9 (-117, -277), yaw 17.6, and C8 everywhere below).** **READ 15.8 FIRST. It overrides: 15.1 item 5 (J1 is no longer the stack), the stack numbers of 15.2 (arms of 1 km, footprint +-400 m, viaduct), 15.3 (site and footprint), 15.4 rule 1 (zone of +-1 km) and 15.7 item 2 (five junctions, five designs now).**

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

### 15.8.8 DECISION OF 2026-11-14 (J1-a2): J1 is rotated clockwise, C10 (-87, -277), yaw 37.5 deg

- User: the N arm must NOT cut the hill (36 m deep cut, 8 lanes is bad); a bypass beside the hill is not possible with R >= 591 m from the fixed 340 m start (R ~344 m only gives max cut 20 m); the user asked to ROTATE J1 clockwise instead, then answered OK to: yaw about 37 deg, bend limit 20 -> 35 deg, changed files only.
- Scan (docs/STEPJ1A2_SCAN.txt): straight N arm max cut 88 m at yaw 17.6, 20 m at 30, 9 m at 35, 11 m at 40, 15 m at 45. Yaw 37.5 chosen. At C9 the W approach was 14 m too short (slope on the west side); J1 moved 30 m east: **C10 = (-87, -277)**, yaw 37.5, J1-a 12 PASS 0 FAIL (docs/STEPJ1A2_OUTPUT.txt): clear N 380, E 350, S 350, W 330 m (need 330 / 324 / 330 / 324).
- N arm route (docs/j1c4a_yaw375.png, docs/j1c4_hybrid.json): 3149 m, R >= 1031 m, max centre cut 8.9 m, no cut over 12 m, fill over 7 m 180 m, 1 rail crossing, ends at the ring N straight at about 90 deg (T), about st 12040 (ring N straight 11049-12512, so about 990 m clear west, 470 m east). Route is wavy (grid search), c4b smooths it. Grade shows 3.18 % (0.9 m height bins), c4c fixes it. Touches eng-tech-park buffer corner and passes eng-aerospace at about 57 m: shift in c4b.
- Bends to the ring points now about N -5, E -29, S +16, W +30 deg. W arm still climbs a 100-190 m hill on its straight axis for every yaw: c5 must route it around the hill.
- **REDONE for C10 / yaw 37.5 on 2026-11-14 (J1-a2b):** J1-b geometry (`GroundJ1Geometry.ts`: `J1_SITE` = (-87, -277, 37.5), `J1_APPROACH_INPUTS` clears N 380 / E 350 / S 350 / W 330; `j1-ground-check.ts`: 32 PASS 0 FAIL, box half 19.75 m, stop line 23.75 m, corner kerbs 53.8 m, lanes end at s 269 m), J1-c1 pad (`j1-pad-fit.ts`: ground 17.72-18.57 m, pad y 18.19 m, grade 0.63 %, max cut 0.31 m / fill 0.21 m, 3 PASS), S arm (`j1-arm-profile.ts S`: grade 0.56 %, edge cut 1.02 m, fill 0.42 m, 4 PASS), E arm (grade 0.30 %, edge cut 0.12 m, fill 1.94 m, 4 PASS). docs/j1a.json is now the C10 sheet (C9 values are in git history). STILL OPEN: `j1-site-check.ts` has no C10 (it picks its own yaw, city plan under the box not re-measured, do it in J1-f), 6.1d rail crossings (E north-1, S west-nw), N arm c4b / c4c, W arm c5, `j1a-plot.py` title still says C9.

### 15.8.9 DECISION OF 2026-11-14 (J1-g): J1 becomes a big OPEN ground interchange ("open star"), steps g1-g4

User wish (data): 4 M8 arms (8-lane) widen into one big paved star, NO island and NO roundabout ring inside; curved guide lines for through / left / right / U-turn; LEFT turn = free-flow slip road with early exit from the left lane (about 250-300 m before), corner R 60-80 m, own acceleration lane in the receiving road; right turn guided by curves, signal or priority only at conflicts; pedestrians grade-separated as before. Rail fixed, arms keep alignment / profile / structures, buildings and the EVLab plot may be overrun (re-placed later), ground level only. Steps: g1 sheet, g2 geometry + picture + check, g3 terrain pad + arm join, g4 mesh + marking + game layer + game check, then the rail / arm checks stay PASS.

**J1-g1 result (scripts/j1-g1-sheet.ts, docs/STEPJ1G1_OUTPUT.txt; every ASSUMED value waits for the user's OK):**
- 16 movements (4 arms x left, through, right, U-turn). Left: free slip, 40 km/h, R 70 m (supports up to 49 km/h), one lane, v/c <= 0.23. Through: 4 lanes, signal P1 / P3. Right: 2 pockets, guide R 30 m, 30 km/h, signal P2 / P4. U-turn: inner pocket, cars only, R about 10 m, 30 pcu/h per arm ASSUMED, with the right phase.
- Exit: 100 -> 40 km/h = 129.6 m + taper 91.3 m, arc tangent point at s 91.6 m, so the exit taper starts at s 312 m from the centre (fits the smallest clear length 330 m, W). Merge: 40 -> 70 km/h = 106.1 m + taper 84.8 m, receiving lane ends at s 282 m. Lane zone grows from s 269 to about s 315 m.
- Signal: cycle 100 s, greens 23 / 15 / 19 / 13 s, degree of saturation 0.71 on all phases, flows x 1.2 gives Y 0.61.
- Footprint: open star +-91.6 m minus 4 quarter disks R 70 = 18168 m2 (1.8 ha). Ground in +-130 m: 17.73 .. 18.74 m, slope 0.08 %, no water; rail 202 m away; EVLab plot covers 71 % of the square.
- Conflicts left: 4 exits, 4 merges (yield), opposing right turns together in P2 / P4 (swept paths in g2), U-turn only inside the right phase, pedestrian crossings (slip road zebra / refuge or one grade-separated crossing per leg, decided in a later step).
- To change later (g2-g4): J1_S_END and J1ArmData S0 = 270 move out to about 315, tools/j1-arm-data.py S0 / SJ, pad fit (rCore 60 + 20 m is too small), GroundJ1Geometry / Mesh / Terrain. Nothing in src/ was changed in g1. Checks run before and after: j1-arms-game-check, j1-game-check, rail-city-profile-check, ring-facade, ring-cut, ring-structures, j1-ground-check all PASS.

### 15.8.10 J1-g2 RESULT (open star geometry data, 2026-11-14)

- File `src/roads/junction/OpenJ1Geometry.ts` (pure math, uses the J1-b local frame and `rotCW`): `OPEN_PARAMS`, `deriveOpen()`, `buildArm(dir)` (edge functions of one arm: through lanes, pockets, median, exit lane `ws(s)`, receiving lane `wr(s)`, median shift `t(s)`), `buildMovements()` (32 lane centre lines), `pavedOutline()` (closed polygon: arms + star, corner islands outside the arcs). Check: `npx tsx scripts/j1-g2-check.ts docs` (23 PASS 0 FAIL), picture: `python3 tools/j1g2-plot.py` (docs/j1g2_layout.png, docs/j1g2_star.png).
- Numbers: slip lane centre 21.575 m from the axis, arc R 70 m, arc tangent point s 91.575 m; exit lane full width from s 221.2, taper starts at s 312.5 (decel 129.6 m + taper 91.3 m); receiving lane full width to s 197.7, merge taper ends s 282.4; lane zone of every arm ends at s 312.5 m (clear N 380, E 350, S 350, W 330). Median shift (0.65 m) now runs s 225..265 (N, S) and 219..259 (E, W), inside the exit taper (different edge), pockets end at s 224.5 (R1) / 194.5 (R2) for N, S and 218.5 / 188.5 for E, W.
- Right turn: R2 -> O1 (R 23.4 m), R1 -> O2 (R 27.1 m), concentric, arc ends on the stop line of the target arm (g1 had a guide R 30 m; the geometry fixes it at 23.4 / 27.1 m, both >= 19.7 m at 30 km/h). U-turn: from R2 to O4, R 8.8 m (cars only), leaves at s 19.75. Through: 16 straight lines with no lateral shift for |s| <= 218 m. Left: 4 free slip roads N -> E -> S -> W -> N.
- Conflicts: same phase and free movements never closer than 3.0 m except at the 4 exits and 4 merges (excluded zones). Different phases cross (separated by the signal). Paved outline 5.82 ha (arms to s 312.5), open star inside +-91.6 m 1.90 ha.
- NOT in g2 (later): terrain / pad (g3), mesh, kerbs, corner islands, marking, zebra / pedestrian crossing, signal heads (g4). Sight over the corner island needs nothing higher than 0.6 m within 3.74 m of the slip lane centre.
- Old code (`GroundJ1Geometry/Mesh/Layer/Terrain`) is untouched: j1-game-check, j1-ground-check, j1-arms-game-check, rail-city-profile-check, ring-facade, ring-cut, ring-structures all still PASS.

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


## 16. RAIL-B: road / rail height fixes (user screenshot review 2026-11-14), STEPS 3-7 + starter prompt

Status row: section 12, row RAIL-B. STEP 1 (survey) and STEP 2 (buffer setting + measure script) are DONE. This section says what to do next so any AI chat can continue with the project zip + this file.

**Rules (all steps):**
- Railway PLAN (x, z), road design (x, z) and the river stay as they are. Only HEIGHTS (y) and the bridge / viaduct type change. A change of plan needs the user's OK first.
- No new .md files. Record every step in section 12, row RAIL-B (and in this section if a rule changes).
- Say honestly what could not be run. Never write "pass" for a check that was not run (the sandbox usually has no network: npm install, tsc, npm run build may be impossible; then say so and ask the user to run them).
- One step per session: show numbers, a PASS / FAIL list, give the screenshot (x, z), then STOP and wait for the user's OK.
- Deliver ONLY changed files in a versioned zip (same paths as the project), for example EVCity_Rail_fix_v1.4.zip, and update row RAIL-B.
- Reply in the user's language (Banglish): simple words, short answers. The user has no coding knowledge: explain in plain words, no code in the reply.

**Buffer (Config.roads.roadRailBuffer, src/core/Config.ts, one place):** railOverRoad 7.0 m (rail deck underside over the road surface), roadOverRail 9.0 m (road surface over rail top), pierToDeckEdge 3.0 m (plan, rail pier to road deck edge), armPierToRailPier 3.0 m. Measure with `npx tsx scripts/road-rail-buffer-check.ts`. Baseline before STEP 3: 12 FAIL (7 rail-over-road short by 1.7-1.8 m, 5 road-over-rail short by 0.4-1.2 m), rail piers beside decks 0 FAIL.
Rule when a rail height must change: at the named point the rail goes DOWN to the ground and the road gets a bridge (road over rail) there. Rail grade stays <= 2.5 % (RAIL_DESIGN.maxGrade), no grade exception. Raising the rail about 1.8 m needs about 70 m of ramp on each side.

**Where things are (check by reading before changing; this list is from the survey, not tested):**
- J1 arm road heights: src/roads/junction/J1ArmData.ts is GENERATED by tools/j1-arm-data.py from the profile files docs/j1c4c_profile.json (N), j1c5c_profile.json (W), j1c6c_profile.json (S), j1c7c_profile.json (E) (point every 10 m: ys = surface height; structs = structure station ranges of 6.1d). Do not edit the generated file by hand: change the inputs and rerun the tool, or ask the user.
- Arm structures: registered by RoadNetwork.addJ1Arms (src/roads/RoadNetwork.ts), meshes in src/roads/ring/RingBridgeGeometry.ts (ringStructures, buildStructure; arm structures are 'plain' decks without piers until the 6.1d types are OK'd).
- Railway heights: src/rail/RailNetwork.ts (joinLateRoads: plan without arms, then addJ1Arms, crossings rebuilt; elevateStations; piers + pierFree in src/rail/RailContext.ts), src/rail/RailPlan.ts (RAIL_DESIGN: roadClearance 5.2, ballast 0.45, deckThick 2.2, maxGrade 0.025; STATION_LEVELS { central: 34 }).
- Checks that must stay PASS: scripts/rail-city-profile-check.ts (ALL PASS), j1-arms-game-check, ring-facade-check, ring-cut-check, ring-structures-check, j1-game-check, j1-structures-s. Old known FAIL (not from this work, ask the user before touching): rail-plan-test 2 station links (3.7 m, 3.2 m), rail-mesh-test Central diamond nose, rail-link-test collider count, people-rail-test ground probes (13 under J1-S bridges, max 0.26 m).

**The 11 points (point 7 and 10 dropped; camera coordinates from the user's screenshots, matched to the game data in STEP 1):**

| # | Where | Now | User wants |
|---|---|---|---|
| 1 | E1: J1-E x north-1 (250, -20), rail over road | road 25.9, ground 18.2, rail 33.8, road bridge 200 m, gap 5.3 m | road DOWN (to the ground) |
| 2 | S1: J1-S x west-nw (-339, 52) | road 25.6, ground 17.7, rail 33.7, bridge 192 m, gap 5.4 m | road DOWN |
| 3 | W1: J1-W x west-nw (-717, -167) | road 32.8, ground 28.2, rail 40.6, bridge 56 m, gap 5.2 m | road DOWN |
| 4 | S3: J1-S x west-sw (-695, 789), river | road 29.6, ground 14.7, rail 37.5, bridge 152 m, gap 5.2 m | road stays UP on the bridge (AI choice, user said "your choice"), river unchanged |
| 5 | J1-S x ring-south (-993, 1559), road over rail | road 22.0, rail 14.2, gap 7.8 m | road UP |
| 6 | M8 x east-2 (1925, 1649), rail over road | rail 41.1, road 33.2, gap 5.3 m | rail UP |
| 7 | J1-E end / ring T (2967, 194) | arm and ring both on bridge, y 78.9, ground 44 | DROPPED 2026-11-14: user sees no change to make there. Do nothing. |
| 8 | M8 x ring-northeast (2432, -2435), rail over road | rail 38.8, road 30.8, gap 5.3 m | rail UP |
| 9 | M8 x airport-branch (1558, -3297), rail over road | rail 42.0, road 34.1, gap 5.2 m | rail UP |
| 10 | (was J1-N x north-1 (491, -1690)) | road 44.1, rail 36.1, gap 8.1 m | DROPPED 2026-11-14: user sees no change to make there. Do nothing. |
| 11 | NEW 2026-11-14: J1-W x ring-west (-2457, 242), screenshot camera (-2453, 22, 301), road over rail | road 25.7, rail 17.6 (ground 17.2), road bridge 208 m, gap 8.1 m, need 9.0 m | problem = road bridge too low / too close over the rail: road UP (gap >= 9.0 m) |

**Steps (one per session, STOP after each):**
- STEP 3 (points 1, 2, 3 = E1, S1, W1): bring the road down to the ground at the three crossings; the rail passes over it with the buffer (rail over road >= 7.0 m). Remove or shorten the arm structure that was designed as road-over-rail. Rail and plan unchanged. First find how the arm profile and structure ranges are produced (tool + profile json) and tell the user in plain words what will change. Grade of the arm <= 4 % (hill stretch) / 3 % elsewhere (J1-c rows). Check: road-rail-buffer-check, rail-city-profile-check, j1-arms-game-check, j1-structures-s.
- STEP 4 DONE 2026-11-14 (see row RAIL-B; point 4 road lowered with the river unchanged, point 5 road up, point 11 rail down 0.9 m because the road cannot go up). Original text: S3 road stays up (river untouched); points 5 (J1-S x ring-south) and 11 (J1-W x ring-west) road up to roadOverRail >= 9.0 m with approach grade within the arm limits; bridge lengths follow. Points 7 and 10 are dropped (no change).
- STEP 5 (points 6, 8, 9): rail up to railOverRoad >= 7.0 m at the three M8 crossings. If the 2.5 % grade does not allow it, use the rule "rail to the ground + road bridge" at that point and show the user the list BEFORE changing. Rail plan (x, z) unchanged; stations stay.
- STEP 6: no work (point 7 dropped). Skip to STEP 7.
- STEP 7: run all checks of this section, update row RAIL-B and the 6.1d note (arm piers keep >= 3 m from rail piers, no arm pier under a rail slab), give the screenshot (x, z) list for points 1-6, 8, 9, 11, deliver the zip (EVCity_Rail_fix_v1.x.zip).

**Starter prompt for the next chat (paste it, upload the project zip with this file inside):**

```
Project: EVCity (main game zip uploaded). Read HANDOFF_ROAD_DESIGN.md: section 0, section 12 (rows RAIL-A+C2 and RAIL-B) and section 16. Ami Banglish-e likhi, tumi Banglish-e uttor dao: shohoj bhasha, chhoto uttor. Ami code jani na.
Kaj: road / rail height fixes (RAIL-B). STEP 1 ar STEP 2 shesh. Ekhon STEP 3 (ba ami ja bolbo) koro. Ek step shesh hole thamo, ami OK dile porer step.
Niyom: road design ar railway plan (x, z) ar nodi amar OK chhara bodlabe na. Notun .md file bonabe na, section 12-er row RAIL-B update koro. Je check chalate pari ni ta sotti kore bolo, "pass" claim korba na. Sudhu changed file zip-e dao (same path, version soho). Shuru-te dekho section 12-e row RAIL-B ache kina, na thakle thamo ar amake bolo.
```
