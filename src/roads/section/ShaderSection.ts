// STEP 5.2b  The ring's cross-section in the words of the road SHADER (pure, no three.js, so it can be tested headless).
// RoadMaterial finds a divided road's section from the road half width (vertex info z). The ring's half width (22.1 m) is not one of the Config
// sections (highway / arterial / avenue), so the ring gets its own row here. Every number is read from SECTION_M8 (Step 4.1) and MARKING (Step 4.5):
// nothing is typed twice. All values are metres from the road centreline.
import { SECTION_M8, type Section } from '../standards/SectionTable';
import { MARKING } from './Markings';

export interface ShaderRow {
  /** Centreline -> pavement edge (the key the shader matches on, +-0.02 m). */
  halfWidth: number;
  /** Centreline -> median edge. */
  medianHalf: number;
  /** Paved inner shoulder between the median and the first lane. */
  shyMedian: number;
  laneW: number;
  lanesPerDir: number;
  /** Centre of the solid yellow edge line (median side) and of the solid white edge line (outer side). */
  yellowAt: number;
  whiteAt: number;
  /** Half the width of every painted line. */
  lineHalf: number;
}

export function shaderRowOf(sec: Section): ShaderRow {
  const el = (kind: string) => sec.elements.find((e) => e.kind === kind)!;
  const lanes = el('lanes');
  const w = MARKING.width;
  return {
    halfWidth: sec.pavementEdge,
    medianHalf: el('median').to,
    shyMedian: el('shoulder-in').width,
    laneW: lanes.width / sec.lanesPerDir,
    lanesPerDir: sec.lanesPerDir,
    yellowAt: lanes.from - w / 2,
    whiteAt: lanes.to + w / 2,
    lineHalf: w / 2,
  };
}

export const SHADER_ROW_M8: ShaderRow = shaderRowOf(SECTION_M8);

const f3 = (v: number): string => v.toFixed(3);

/** GLSL line that returns the ring row from evcSection (vec4: median half, lane width, median-side shoulder, lanes per direction). */
export function sectionGlslLine(r: ShaderRow = SHADER_ROW_M8): string {
  return `  if (abs(hw - ${f3(r.halfWidth)}) < 0.02) return vec4(${f3(r.medianHalf)}, ${f3(r.laneW)}, ${f3(r.shyMedian)}, ${r.lanesPerDir.toFixed(1)});`;
}

/** GLSL function evcEdges(hw): vec3(yellow line centre, white line centre, line half width) for the ring, vec3(0) for every other road (they keep their old lines). */
export function edgesGlsl(r: ShaderRow = SHADER_ROW_M8): string {
  return `vec3 evcEdges(float hw) {\n  if (abs(hw - ${f3(r.halfWidth)}) < 0.02) return vec3(${f3(r.yellowAt)}, ${f3(r.whiteAt)}, ${f3(r.lineHalf)});\n  return vec3(0.0);\n}\n`;
}
