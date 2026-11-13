// STEP 5.3c-1: the 3D layer of the ring's structures. One mesh per structure (vertex colours, one shared material), absolute world coordinates, parent = world.root.
import * as THREE from 'three';
import type { RoadNetwork } from '../RoadNetwork';
import { buildStructure, ringStructures } from './RingBridgeGeometry';

export class RingStructureLayer {
  private readonly group = new THREE.Group();
  private readonly mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide });
  private readonly geos: THREE.BufferGeometry[] = [];

  constructor(private readonly parent: THREE.Object3D, roads: RoadNetwork) {
    this.group.name = 'ring-structures';
    ringStructures(roads).forEach((b, k) => {
      const d = buildStructure(roads, b, k);
      if (d.indices.length === 0) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(d.positions, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(d.colors, 3));
      g.setIndex(d.indices);
      g.computeVertexNormals();
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, this.mat);
      mesh.name = `ring-structure-${k + 1}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.geos.push(g);
      this.group.add(mesh);
    });
    parent.add(this.group);
  }

  dispose(): void {
    this.parent.remove(this.group);
    for (const g of this.geos) g.dispose();
    this.mat.dispose();
  }
}
