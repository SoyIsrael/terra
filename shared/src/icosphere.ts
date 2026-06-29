// Pure geometry — no Three.js dependency. Safe to import on server and client.

export interface V3 { x: number; y: number; z: number }

export interface HexTile {
  id: number;
  center: V3;
  polygon: V3[];
  neighbors: number[];
}

function norm(v: V3): V3 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}
function mid(a: V3, b: V3): V3 {
  return norm({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
}
function add(a: V3, b: V3): V3 { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function scale(v: V3, s: number): V3 { return { x: v.x * s, y: v.y * s, z: v.z * s }; }

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

export function generateTiles(subdivisions = 4): HexTile[] {
  const base = baseIcosahedron();
  const { verts, faces } = subdivide(base.verts, base.faces, subdivisions);

  const faceCentroids: V3[] = faces.map(([a, b, c]) =>
    norm(add(add(scale(verts[a], 1 / 3), scale(verts[b], 1 / 3)), scale(verts[c], 1 / 3)))
  );

  const vertFaces = new Map<number, number[]>();
  faces.forEach((face, fi) => {
    for (const vi of face) {
      if (!vertFaces.has(vi)) vertFaces.set(vi, []);
      vertFaces.get(vi)!.push(fi);
    }
  });

  const edgeToFaces = new Map<string, number[]>();
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

  const vertNeighbors = new Map<number, Set<number>>();
  faces.forEach(([a, b, c]) => {
    for (const [p, q] of [[a, b], [b, c], [c, a]] as [number, number][]) {
      if (!vertNeighbors.has(p)) vertNeighbors.set(p, new Set());
      if (!vertNeighbors.has(q)) vertNeighbors.set(q, new Set());
      vertNeighbors.get(p)!.add(q);
      vertNeighbors.get(q)!.add(p);
    }
  });

  return verts.map((v, vi) => ({
    id: vi,
    center: v,
    polygon: sortedFacesAroundVertex(vi).map(fi => faceCentroids[fi]),
    neighbors: [...(vertNeighbors.get(vi) ?? [])],
  }));
}
