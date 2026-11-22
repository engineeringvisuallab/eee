# HANDOFF: HATIKAMRUL-TYPE INTERCHANGE AT THE RING S NODE (ring x J1-S arm x island link M6-1)

Written 2026-11-22. Language of this file: English. Reply to the user in Banglish. This is the ONLY md file for this work. ONE micro-step per chat session (the chat limit ended too early before). Update the status table (section 9) after every step. Do not start the next step before the user says OK.

## 0. What the user decided (data, do not change without asking)
1. USER 2026-11-22 (Banglish, video 20261122-0607-46_3322224.mp4 + screenshot): 'game er junction design er kaj choltece. video er Hatikamrul interchange ta ami amar game a niye aste chai. age dekho and original dimension gula milaw. screenshot naw. kivabe korbe plan koro. atar jonno alada handoff banabe. point and junction coordinate image a diyeci. dekho and plan koro. and kaj gula k small small step a vag koro. karon besi boro hole limit ses hoy.'
2. MY READING (the user may correct): (a) bring the Hatikamrul interchange (4 loops, flyover on one axis, ground road under it, ponds / lawns inside the loops) into the game at the junction of his screenshot; (b) 'original dimension gula milaw' = compare the video's real proportions with the game numbers and keep the layout faithful; (c) 'screenshot naw' = take screenshots of the video as reference (done, docs/hatikumrul_ref/); (d) this step is PLAN ONLY, no src change.
3. The junction of the screenshot: the user's camera readout is X -1121, Y 24, Z 2304 (Bengali digits, read from the picture; Y is the camera height, not the road level). It is the RING S NODE: ring (road 0 'M8') x J1-S arm x island link M6-1, node (-1133.35, 2301.75), ring station 1208 (HANDOFF_ROAD_DESIGN.md calls it st 1205), road level 19.68 m. Distance from the readout to the node 12 m: same place.
4. Earlier decision D17-1 (HANDOFF_ROAD_DESIGN.md 17.0a, user 'koro' 2026-11-14): this node is a 4-LEG GRADE-SEPARATED INTERCHANGE (ring both ways + J1-S arm north + island link south). The type was left open ('chosen later in 9.2 / 17.4c'). THE USER NOW PICKS THE HATIKAMRUL TYPE. This replaces the 'RND / SGL' proposal of HANDOFF_RING_T_JUNCTIONS.md 3.1 for ring S.
5. Standing rules (from the other handoffs): left-hand traffic; reuse what exists; the ring (road 0), the J1 arms and the built R6 roads are FIXED (change them only with the user's word); PASS / FAIL printed by every check, never write PASS for a check that was not run, say plainly what was NOT run; zip of ONLY the changed files with project paths; no new grass / trees invented (existing ones are fixed and improved, rule of the road upgrade work); game NOT looked at unless the user sends a screenshot.

## 1. What the video shows (reference; screenshots in docs/hatikamrul_ref/, see HK_REFERENCE_INDEX below)
Video: 'Hatikamrul Interchange by KCI for RHD', 6:00 long. Chapters seen (frame every 12 s): present condition (roundabout), APPROVED DESIGN top view, drive-through views (from Pabna / Dhaka / Rangpur), BUS BAY WITH REST AREA (highway service area), rain-water harvesting + solar, NIGHT views with lamps.
Layout read from the top views (docs/hatikamrul_ref/shot_2s.jpg and shot_50s.jpg):
- Type: modified cloverleaf = cloverstack: FOUR loop ramps, one in each quadrant, plus outer ramps / slips; the through highway is a FLYOVER on the diagonal axis, the cross road runs at ground level underneath with one-way collector-distributor (C-D) roads beside it. Wikipedia and the tender text call it a cloverstack / modified cloverleaf interchange with a slow-moving-vehicle (SMVT) lane and a highway service area.
- Inside the loops: two loops hold a round pond with a ring of trees, two loops hold a big oval lawn with striped (colour ring) planting. Triangular green lawns with trees between the outer ramps. A long lake and a building group at the east side, a parallel service road along the south edge.
- The flyover is 2 x 2 lanes + median with kerb and railing; ramps are single lane with a barrier on the outside; lamp poles along ramps (night views).
PUBLISHED NUMBERS I FOUND (web search 2026-11-22, news + Wikipedia): about 100 acres (about 405,000 m2) of land acquired; package cost Tk 743.28 crore; approach road 4 lane; interchange part of the SASEC road project. NO drawing with lengths, radii or widths was found, and the video has no dimension plates. So the 'original dimensions' are NOT published in what I could reach.
MY READINGS FROM THE VIDEO (perspective views, scale taken from the flyover deck about 24 m wide; ERROR about +-25 %, label them ESTIMATE in every later file):
| Item | Estimate from video | Game value / rule |
|------|---------------------|-------------------|
| pond loops (2): centreline radius | about 55 - 65 m | V40 minimum radius 40.6 m (Standards.ts); 55 m = V about 45 |
| big striped loops (2): centreline radius | about 100 - 130 m | V60 minimum 113 m |
| whole interchange width | about 600 - 700 m (100 acres incl. service area) | footprint to be fitted to the site in HK-3 |
| flyover | 2 + 2 lanes, deck about 24 m | the game axes are 8-lane (ring, arm) and 6-lane (island link) = MUCH WIDER, so the loops and the footprint must be taken from the game standards, not scaled from the picture |
CONSEQUENCE (decision policy): TOPOLOGY, PROPORTIONS and LOOK come from the video (4 loops, flyover over a ground road with C-D roads, ponds / lawns inside loops, service area). NUMBERS (radius, lane widths, taper, grades, clearance) come from the game standards. The video proportions are only a cross-check.

## 2. Site facts already known (measured from the zip 2026-11-22, re-measure in HK-0)
- Ring at the node: runs EAST-WEST (tangent about 178 deg, x east, z south); level 19.68 m flat for +-100 m (19.68 to 19.78); section M8: 4 + 4 lanes of 3.65 m, median 6 m (half 3), half width 22.1 m, outer shoulder 3 m, V100. Ring station + goes WEST (x decreasing), station - goes EAST.
- J1-S arm: comes from the NORTH, ends on the ring at exactly 90 deg at (-1133.35, 2301.75), level 19.68 m, grade +1.5 % toward the ring (18.91 m at 50 m, 18.15 m at 100 m, 16.61 m at 200 m, 15.53 m at 300 m). Arm structures: the nearest one is 586 - 923 m north of the node (arm s 1903.9 - 2240.4), a second one is 1215 - 1292 (far). So the arm has about 580 m of ground-level length before its first structure.
- Island link M6-1 (south leg): built in the game (src/roads/island/IslandLinkData.ts), 6 lanes (3 + 3, SECTION_M6: lane 3.5, median 4, half width 16.0), starts 25 m south of the ring centreline at level 20.02 m, climbs to 3.5 % max; strait structure from s 487 to 870 (about 460 m south of the node). The first 100 - 200 m of the link may be changed by this interchange (assumption A1 of row 17.1d).
- Free ring length: 1000 m or more on the WEST side; EAST side only about 320 m to the river bridge S1 (ring structure at station - 420 .. - 320 from the node). Neighbours on the ring: T14 at station 2090 (885 m), RT-W at 4265.
- Terrain, rail, river, buildings, trees around the node were NOT measured in this step.

## 3. Mapping the video onto the game (4 legs)
| Video | Game |
|-------|------|
| through highway (flyover) | THE UPPER AXIS: decision D1 below. Recommended: the N-S axis (J1-S arm -> island link) |
| cross road (ground level, C-D roads beside it) | the ring (E-W), stays at its fixed level 19.68 m |
| 4 loops (2 pond + 2 striped lawn) | 4 loop ramps, one per quadrant (NE, NW, SE, SW of the node) |
| service area / bus bay | NOT in this work (later, only if the user asks) |
| lake and buildings at the east | the game ground there decides (HK-0); do not move the river |

## 4. Open decisions (the engineer proposes, the user says OK or changes; ask in HK-2, not before)
- D1 WHICH AXIS GOES OVER. Both the ring and the J1-S arm are FIXED, so one of them must change. Option 1 (RECOMMENDED): the N-S axis goes OVER the ring (flyover about 7.8 m: clearance 5.5 m + deck, rule 21.47). The arm is raised only in its last about 290 m (smoothstep, max grade 4 %: length = 1.5 x rise / grade) and the island link in its first about 290 m; the arm has about 580 m of ground before its first structure, so it fits. The ring does not change at all. Option 2: the ring goes over (ring raised, east side only 320 m to the river bridge: too short, rejected). Option 3: the ring goes UNDER in a cut (needs drainage, the ring is a closed fixed road: rejected). Needs the user's word because the arm profile is FIXED.
- D2 C-D ROADS: yes (Hatikamrul has them). The game already has the pattern 'cloverleaf-cd' (src/interchange/PatternCD.ts): loops weave on a one-way C-D road, not on the 8-lane main road. Recommended: ring has C-D roads (it is the ground road); the flyover axis has plain exits.
- D3 LOOP SIZES: pond loops about V45 (R about 55 m), lawn loops about V60 (R about 115 m), like the video; the minimum V40 R 40.6 m must hold for every loop (rule H1).
- D4 INFIELD: ponds + striped lawns + trees inside the loops: only from EXISTING water / vegetation systems (no new tree or grass kinds). Ask the user if a pond (lake water object) inside a loop is allowed.
- D5 SERVICE AREA / BUS BAY: later, separate handoff, only if the user asks.
- D6 NIGHT LAMPS like the night video: later, together with the street-light work already planned for the game.

## 5. What exists in the game and is reused
- src/interchange/: Builder.ts (buildInterchange), Patterns.ts (registerPattern; 'cloverleaf' with 8 ramps = 4 loops + 4 outer ramps), PatternCD.ts ('cloverleaf-cd'), Levels.ts (makeLevels, rise = clearance + deck, rampLen = 1.5 x rise / upperMaxGrade), Standards.ts (CRITERIA: rampMaxGrade 5 %, weaveMin 150 m, weaveDesirable 300 m, aDecel 2.5, aAccel 1.2, emax 8 %; minRadius V30 19.7 / V40 40.6 / V50 72.9 / V60 113.4 m; decelLength 100 -> 40: 130 m, 100 -> 60: 99 m; accelLength 40 -> 85: 181 m), Validate.ts, Geometry2D.ts, Structures.ts, RoadAdapter.ts (rampToRoadSpec), Analysis.ts, scripts/interchange-test.ts, interchange-viewer.html (a viewer exists: use it for pictures).
- Ring and arms: src/roads/ring/*, src/roads/junction/J1ArmData.ts, J1ArmProfiles.ts, RoadNetwork.ts (layoutJ1Arms, addJ1Arms, layoutIslandLink, ring apply() carve), RingBridgeGeometry.ts + RingStructures.ts (the structure registry: ringStructures(), the pattern for a ramp / flyover deck), UTurns.ts / MedianPlan.ts (ring median openings).
- Same-style plans: HANDOFF_JUNCTION_RTE.md (ring E ramp interchange, steps RE-0 .. RE-11, scripts/rte-site-check.ts, tools/rte-site-plot.py, tools/rte-types.py): copy the STRUCTURE of those scripts for the HK steps. HANDOFF_ROAD_DESIGN.md sections 17 (island link), 21.47 - 21.53 and 24 (interchange rules).

## 6. Hard rules (every step prints PASS / FAIL)
H1 Ramps: V 40 to 60 km/h, radius at least minRadius(V), grade 5 % or less, cross fall, K values from Standards.
H2 Grade separation: clearance 5.5 m + deck depth over every carriageway crossed; the profile of the fixed road is not changed (except what D1 allows).
H3 R1: no road crosses another except in a designed bridge; list every crossing.
H4 Weaving: weave 150 m minimum, 300 m desirable; with C-D roads the weaving happens on the C-D road.
H5 Smoothness: straight - spiral - arc - spiral - straight, G1 at every join.
H6 Speed change: taper + decel / accel lengths from Standards (numbers above).
H7 Every changed width / level of a fixed road is LISTED with its length and taper.
H8 Reuse: no second copy of code that exists in src/interchange.
H9 Size limit of a chat step (because the limit ends early): ONE step = ONE script (about 250 lines at most) or ONE game file, ONE output doc, ONE picture. If it grows, stop and split it.

## 7. What was NOT done in this planning step (honest)
No script run on the game (only the data modules were read and run: ring plan, J1-S arm data, Standards). Terrain, rail, river, buildings and trees at the node were not measured. The video was read from 29 frames (every 12 s) and 8 full-size screenshots; no frame with a dimension drawing exists, so all video dimensions are ESTIMATES. Nothing was built, no src file was changed, tsc and npm run build were NOT run. The game was not looked at.

## 8. Starter prompt for a NEW chat
"Read HANDOFF_HATIKAMRUL.md completely, then HANDOFF_JUNCTION_RTE.md sections 3 - 5 and HANDOFF_ROAD_DESIGN.md sections 17.0a and 24. Run ONLY the next step that is not DONE in the status table (section 9). Numbers + picture + PASS / FAIL, update the status table, zip of the changed files only, say what was NOT run, STOP and wait for my OK. Reply in Banglish."

## 9. Status table (update here)
| Step | Name | What it makes (small!) | Status | User OK |
|------|------|------------------------|--------|---------|
| HK-plan | This handoff + screenshots | HANDOFF_HATIKAMRUL.md, docs/hatikamrul_ref/ | DONE 2026-11-22 (no code) | waiting |
| HK-0 | Site check (headless, no src) | scripts/hk-site-check.ts -> docs/HK_SITE.txt + png: ground, cut / fill, rail, river, buildings, trees, free land in the 4 quadrants within 450 m, ring median | not started | |
| HK-1 | Reference sheet (no src) | docs/HK_REFERENCE.md: loops, C-D, flyover, infield read from the screenshots with the scale method and the error; a sketch png of the target layout | not started | |
| HK-2 | Decisions D1 - D6 | the user answers; the answers go into section 0 | not started | |
| HK-3 | Layout numbers (no src) | axes, lanes per leg, 4 loop radii and speeds, C-D roads, taper / decel / accel lengths, footprint; PASS / FAIL; picture (use interchange-viewer) | not started | |
| HK-4 | Vertical plan (numbers) | which road is over, ramp profiles, tie-in levels with ring / arm / island link, the last 290 m of the arm and first 290 m of the link, grades, K | not started | |
| HK-5a | Loops 1 + 2 geometry data | centrelines, spirals, terminals, Validate | not started | |
| HK-5b | Loops 3 + 4 geometry data | same | not started | |
| HK-5c | Outer ramps / slips + C-D roads data | same, then the cross-check H3 / H4 of all 8 ramps | not started | |
| HK-6 | Raised axis (flyover) data | arm end and link start new profile, deck range, register as structure DATA | not started | |
| HK-7 | Terrain pad | pad, embankment, cut, skirt like GroundJ1Terrain, check script | not started | |
| HK-8 | Structures | flyover deck + piers + ramp bridges as game structures (ringStructures pattern), physics solids | not started | |
| HK-9 | Ramp meshes + markings | surfaces, kerbs, barriers, gores, arrows, signs; Config switch default OFF | not started | |
| HK-10 | Infield | ponds, striped lawns from existing systems (D4) | not started | |
| HK-11 | Traffic graph + AI | lanes joined, every movement reachable, remove the tLink stand-in at this node | not started | |
| HK-12 | Lamps / night (optional, D6) | with the street-light work | not started | |
| HK-13 | Game check + final | switch ON, tsc, npm run build, earlier PASS checks stay PASS (ring-facade, ring-cut, ring-structures, j1-arms-game-check, island-link-game-check, island-bridge-*), the user looks in the game and sends a screenshot | not started | |

## 10. HK_REFERENCE_INDEX (screenshots taken from the video, docs/hatikamrul_ref/)
- shot_2s.jpg and shot_50s.jpg: approved design, top view (best for the layout: 4 loops, flyover, C-D roads, lake east, service road south).
- shot_56s.jpg: low aerial view along the flyover over the C-D roads, with the lake at the side. shot_80s.jpg: oblique aerial of the loops (two pond loops, two striped-lawn loops, flyover on the diagonal). shot_100s.jpg: aerial along the flyover with one pond loop and the ground cross road with its C-D roads.
- shot_140s.jpg: drive view 'from Pabna towards Rangpur' (ground road, median, barrier, kerb, yellow edge lines, lamp). shot_210s.jpg: ramp embankment and abutment under the flyover, with a footpath and a lamp pole. shot_250s.jpg: aerial of the bus bay with rest area (service area, not part of this work).
- The night views are not in the 8 screenshots (they come later in the video, seen only in the 12 s contact sheet): take them in HK-12 if the user wants lamps.
- The YouTube player buttons are visible in some frames (screen recording); they are not part of the design.
