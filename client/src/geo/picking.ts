import * as THREE from "three";
import type { TileData } from "./tiles";

// Build a spatial index: map each tile center to a THREE.Vector3 for fast lookup
export function buildTileIndex(tiles: TileData[]) {
  const centers = tiles.map(t => new THREE.Vector3(t.center.x, t.center.y, t.center.z));
  return { tiles, centers };
}

type TileIndex = ReturnType<typeof buildTileIndex>;

// Cast a ray from the camera through (mouseX, mouseY) in NDC space,
// intersect with the unit sphere, then return the closest tile to that point.
export function pickTile(
  index: TileIndex,
  globeGroup: THREE.Group,
  camera: THREE.Camera,
  mouseNDC: THREE.Vector2
): TileData | null {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouseNDC, camera);

  // Intersect with unit sphere (radius 1)
  const sphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1.0);

  // Transform ray into globe's local space (handles rotation)
  const localRay = raycaster.ray.clone();
  const inverseMatrix = new THREE.Matrix4().copy(globeGroup.matrixWorld).invert();
  localRay.applyMatrix4(inverseMatrix);

  const hit = new THREE.Vector3();
  if (!localRay.intersectSphere(sphere, hit)) return null;

  // Find closest tile center to the hit point
  let bestId = -1;
  let bestDot = -Infinity;
  const hitNorm = hit.clone().normalize();

  for (let i = 0; i < index.centers.length; i++) {
    const dot = hitNorm.dot(index.centers[i]);
    if (dot > bestDot) { bestDot = dot; bestId = i; }
  }

  return bestId >= 0 ? index.tiles[bestId] : null;
}
