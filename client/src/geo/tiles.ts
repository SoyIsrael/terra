import type { HexTile, V3 } from "./icosphere";

export type ClimateZone = "equator" | "midlat" | "polar" | "ocean";
export type Resource = "water" | "grain" | "gold" | "wood" | "iron" | "stone";

export interface TileData extends HexTile {
  zone: ClimateZone;
  resource: Resource | null;
  isOcean: boolean;
  ownerId: string | null;
}

// latitude in degrees from center of tile
function latitude(v: V3): number {
  return (Math.asin(v.y) * 180) / Math.PI;
}

// Deterministic "random" from a tile id for resource distribution
function seededRand(id: number): number {
  let x = Math.sin(id * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const OCEAN_FRACTION = 0.38; // ~38% of tiles are ocean

export function assignZones(tiles: HexTile[]): TileData[] {
  // Mark ocean tiles by seeded pseudo-random clustering (simple for now)
  const oceanSet = new Set<number>();
  // seed some ocean "seeds" and flood is too complex for MVP; use noise-free approach:
  // tiles with certain seeded rand below threshold become ocean
  tiles.forEach(t => {
    if (seededRand(t.id * 7 + 13) < OCEAN_FRACTION) oceanSet.add(t.id);
  });

  return tiles.map(t => {
    const lat = Math.abs(latitude(t.center));
    const isOcean = oceanSet.has(t.id);

    let zone: ClimateZone;
    if (isOcean) {
      zone = "ocean";
    } else if (lat < 23) {
      zone = "equator";
    } else if (lat < 60) {
      zone = "midlat";
    } else {
      zone = "polar";
    }

    const r = seededRand(t.id);
    let resource: Resource | null = null;
    if (!isOcean) {
      if (zone === "equator") resource = r < 0.5 ? "grain" : "gold";
      else if (zone === "midlat") resource = r < 0.5 ? "wood" : "water";
      else resource = r < 0.5 ? "iron" : "stone";
    }

    return { ...t, zone, resource, isOcean, ownerId: null };
  });
}

// Color each tile for rendering
export function tileColor(t: TileData): number {
  if (t.ownerId) return 0xff4444; // placeholder — will be player color later
  if (t.isOcean) return 0x1a3a6b;
  switch (t.zone) {
    case "equator": return 0x2d7a3a;
    case "midlat":  return 0x4a8c3f;
    case "polar":   return 0xd4e8f0;
  }
  return 0x888888;
}
