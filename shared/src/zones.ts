import type { HexTile, V3 } from "./icosphere";

export type ClimateZone = "equator" | "midlat" | "polar" | "ocean";
export type LandResource = "grain" | "gold" | "wood" | "water" | "iron" | "stone";

export interface TileInfo {
  id: number;
  zone: ClimateZone;
  resource: LandResource | null;
  isOcean: boolean;
}

// Grain yield per tick for each zone — base values before any bonuses
export const ZONE_GRAIN_YIELD: Record<ClimateZone, number> = {
  equator: 2,
  midlat:  1,
  polar:   0,
  ocean:   0,
};

function latitude(v: V3): number {
  return (Math.asin(v.y) * 180) / Math.PI;
}

function seededRand(id: number): number {
  const x = Math.sin(id * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const OCEAN_FRACTION = 0.38;

export function assignZones(tiles: HexTile[]): TileInfo[] {
  const oceanSet = new Set<number>();
  tiles.forEach(t => {
    if (seededRand(t.id * 7 + 13) < OCEAN_FRACTION) oceanSet.add(t.id);
  });

  return tiles.map(t => {
    const lat = Math.abs(latitude(t.center));
    const isOcean = oceanSet.has(t.id);

    let zone: ClimateZone;
    if (isOcean)       zone = "ocean";
    else if (lat < 23) zone = "equator";
    else if (lat < 60) zone = "midlat";
    else               zone = "polar";

    const r = seededRand(t.id);
    let resource: LandResource | null = null;
    if (!isOcean) {
      if (zone === "equator")     resource = r < 0.5 ? "grain" : "gold";
      else if (zone === "midlat") resource = r < 0.5 ? "wood" : "water";
      else                        resource = r < 0.5 ? "iron" : "stone";
    }

    return { id: t.id, zone, resource, isOcean };
  });
}
