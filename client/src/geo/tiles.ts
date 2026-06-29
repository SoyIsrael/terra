import type { HexTile } from "./icosphere";
import { assignZones } from "@terra/shared";
import type { TileInfo, ClimateZone } from "@terra/shared";

export { assignZones };
export type { ClimateZone };

// Client-side extension — adds rendering data on top of shared TileInfo
export interface TileData extends TileInfo {
  center: HexTile["center"];
  polygon: HexTile["polygon"];
  neighbors: HexTile["neighbors"];
  ownerId: string | null;
}

export function mergeTileData(tiles: HexTile[]): TileData[] {
  const infos = assignZones(tiles);
  return tiles.map((t, i) => ({ ...t, ...infos[i], ownerId: null }));
}

export function tileColor(t: TileData): number {
  if (t.isOcean) return 0x1a3a6b;
  switch (t.zone) {
    case "equator": return 0x2d7a3a;
    case "midlat":  return 0x4a8c3f;
    case "polar":   return 0xd4e8f0;
  }
  return 0x888888;
}
