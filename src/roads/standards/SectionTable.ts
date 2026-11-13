// STEP 1.3  Cross-section tables, distances from the centreline, ONE side. M8 is the handoff table 3.5.
// M6 and M4 use the same element pattern with fewer lanes (and 4 m median for M4): PROPOSAL, confirm in CP1.3.
// Arterial, collector and local tables come in Step 7 (the handoff gives no numbers for them yet).
import { DESIGN } from './Criteria';

export type SectionKind = 'median' | 'shoulder-in' | 'lanes' | 'shoulder-out' | 'barrier' | 'ditch' | 'clear-zone' | 'row-strip';
export interface SectionElement { name: string; kind: SectionKind; from: number; to: number; width: number; note: string }
export interface Section { id: string; lanesPerDir: number; elements: SectionElement[]; pavementEdge: number; rowHalf: number }

function build(id: string, lanesPerDir: number, medianTotal: number): Section {
  const spec: Array<[string, SectionKind, number, string]> = [
    ['median (half of ' + medianTotal + ' m)', 'median', medianTotal / 2, 'kerb or concrete barrier + planting or paved'],
    ['inner paved shoulder', 'shoulder-in', 1.5, ''],
    [lanesPerDir + ' travel lanes x ' + DESIGN.laneWidth + ' m', 'lanes', lanesPerDir * DESIGN.laneWidth, ''],
    ['outer paved shoulder (breakdown)', 'shoulder-out', 3.0, ''],
    ['guardrail / barrier offset', 'barrier', 0.6, ''],
    ['verge + drainage ditch', 'ditch', 1.5, 'ditch 1.5 m wide, 0.5 m deep'],
    ['clear zone', 'clear-zone', 7.8, 'no trees, no poles; side slope 1:4 flat, 1:3 max, 1:2 only with barrier'],
    ['right-of-way strip', 'row-strip', 8.0, 'fence, planting, service road if used'],
  ];
  let at = 0;
  const elements = spec.map(([name, kind, width, note]) => {
    const e = { name, kind, from: at, to: at + width, width, note };
    at += width;
    return e;
  });
  const pave = elements.find((e) => e.kind === 'shoulder-out')!.to;
  return { id, lanesPerDir, elements, pavementEdge: pave, rowHalf: at };
}

export const SECTION_M8 = build('M8', 4, 6);
export const SECTION_M6 = build('M6', 3, 6);
export const SECTION_M4 = build('M4', 2, 4);
