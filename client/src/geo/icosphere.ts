// Generates a Goldberg polyhedron (mostly hexagons + 12 pentagons) by
// subdividing an icosahedron and taking its dual mesh.
// Each level multiplies faces by 4. subdivisions=3 → ~642 tiles, subdivisions=4 → ~2562 tiles.

export interface V3 { x: number; y: number; z: number }

export interface HexTile {
  id: number;
  center: V3;        // unit-sphere position
  polygon: V3[];     // ordered tile corner vertices (unit sphere)
  neighbors: number[];
}

// ─── helpers ────────────────────────────────────────────────────────────────

function norm(v: V3): V3 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function mid(a: V3, b: V3): V3 {
  return norm({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
}

function add(a: V3, b: V3): V3 { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function scale(v: V3, s: number): V3 { return { x: v.x * s, y: v.y * s, z: v.z * s }; }

function vkey(v: V3): string {
  return `${v.x.toFixed(8)},${v.y.toFixed(8)},${v.z.toFixed(8)}`;
}

// ─── icosahedron base ────────────────────────────────────────────────────────

function baseIcosahedron(): { verts: V3[]; faces: [number, number, number][] } {
  const t = (1 + Math.sqrt(5)) / 2;
  const raw: V3[] = [
    { x: -1, y: t, z: 0 }, { x: 1, y: t, z: 0 },
    { x: -1, y: -t, z: 0 }, { x: 1, y: -t, z: 0 },
    { x: 0, y: -1, z: t }, { x: 0, y: 1, z: t },
    { x: 0, y: -1, z: -t }, { x: 0, y: 1, z: -t },
    { x: t, y: 0, z: -1 }, { x: t, y: 0, z: 1 },
    { x: -t, y: 0, z: -1 }, { x: -t, y: 0, z: 1 },
  ];
  const verts = raw.map(norm);
  const faces: [number, number, number][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  return { verts, faces };
}

// ─── subdivision ─────────────────────────────────────────────────────────────

function subdivide(
  verts: V3[],
  faces: [number, number, number][],
  n: number
): { verts: V3[]; faces: [number, number, number][] } {
  if (n === 0) return { verts, faces };

  const newFaces: [number, number, number][] = [];
  const midCache = new Map<string, number>();
  const vs = [...verts];

  function midpoint(a: number, b: number): number {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    if (midCache.has(key)) return midCache.get(key)!;
    const idx = vs.length;
    vs.push(mid(vs[a], vs[b]));
    midCache.set(key, idx);
    return idx;
  }

  for (const [a, b, c] of faces) {
    const ab = midpoint(a, b);
    const bc = midpoint(b, c);
    const ca = midpoint(c, a);
    newFaces.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
  }

  return subdivide(vs, newFaces, n - 1);
}

// ─── dual mesh (Goldberg polyhedron) ─────────────────────────────────────────

export function generateTiles(subdivisions = 4): HexTile[] {
  const base = baseIcosahedron();
  const { verts, faces } = subdivide(base.verts, base.faces, subdivisions);

  // centroid of each triangle face (projected to sphere) = dual vertex
  const faceCentroids: V3[] = faces.map(([a, b, c]) =>
    norm(add(add(scale(verts[a], 1/3), scale(verts[b], 1/3)), scale(verts[c], 1/3)))
  );

  // Build vertex → surrounding face indices (ordered around the vertex)
  const vertFaces = new Map<number, number[]>();
  faces.forEach((face, fi) => {
    for (const vi of face) {
      if (!vertFaces.has(vi)) vertFaces.set(vi, []);
      vertFaces.get(vi)!.push(fi);
    }
  });

  // For each face index, find its two other faces that share an edge with given vertex
  // We need to sort surrounding faces in winding order around each vertex.
  // Strategy: build face adjacency then walk the ring.

  // face → edge → adjacent face map
  type EdgeKey = string;
  const edgeToFaces = new Map<EdgeKey, number[]>();
  faces.forEach((face, fi) => {
    const [a, b, c] = face;
    for (const [p, q] of [[a, b], [b, c], [c, a]] as [number, number][]) {
      const key = p < q ? `${p}_${q}` : `${q}_${p}`;
      if (!edgeToFaces.has(key)) edgeToFaces.set(key, []);
      edgeToFaces.get(key)!.push(fi);
    }
  });

  function sortedFacesAroundVertex(vi: number): number[] {
    const ring = vertFaces.get(vi)!;
    if (ring.length === 0) return ring;
    const ordered = [ring[0]];
    const used = new Set([ring[0]]);
    while (ordered.length < ring.length) {
      const cur = ordered[ordered.length - 1];
      const [a, b, c] = faces[cur];
      // edges of current face that touch vi
      const edges: [number, number][] = [];
      if (a === vi || b === vi) edges.push([a, b]);
      if (b === vi || c === vi) edges.push([b, c]);
      if (c === vi || a === vi) edges.push([c, a]);

      let found = false;
      for (const [p, q] of edges) {
        const key = p < q ? `${p}_${q}` : `${q}_${p}`;
        const adj = edgeToFaces.get(key) ?? [];
        for (const fi of adj) {
          if (!used.has(fi)) { ordered.push(fi); used.add(fi); found = true; break; }
        }
        if (found) break;
      }
      if (!found) break;
    }
    return ordered;
  }

  // Build neighbor map: two tiles (vertices) are neighbors if their vertex rings share a face
  const tiles: HexTile[] = [];
  const vertToTileId = new Map<number, number>();

  verts.forEach((_, vi) => {
    vertToTileId.set(vi, vi);
  });

  // Build face → vertex list (for neighbor lookups)
  // Two tiles are neighbors iff their corresponding verts share a face.
  // We'll derive neighbors from the face data directly.

  const vertNeighbors = new Map<number, Set<number>>();
  faces.forEach(([a, b, c]) => {
    for (const [p, q] of [[a, b], [b, c], [c, a]] as [number, number][]) {
      if (!vertNeighbors.has(p)) vertNeighbors.set(p, new Set());
      if (!vertNeighbors.has(q)) vertNeighbors.set(q, new Set());
      vertNeighbors.get(p)!.add(q);
      vertNeighbors.get(q)!.add(p);
    }
  });

  verts.forEach((v, vi) => {
    const ring = sortedFacesAroundVertex(vi);
    const polygon = ring.map(fi => faceCentroids[fi]);
    const neighbors = [...(vertNeighbors.get(vi) ?? [])];
    tiles.push({ id: vi, center: v, polygon, neighbors });
  });

  return tiles;
}
