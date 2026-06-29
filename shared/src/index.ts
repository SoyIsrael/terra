export { generateTiles } from "./icosphere";
export type { HexTile, V3 } from "./icosphere";
export { assignZones, ZONE_GRAIN_YIELD } from "./zones";
export type { ClimateZone, LandResource, TileInfo } from "./zones";

export type PlayerId = string;
export type TileId = number;

export type Resource = "water" | "grain" | "gold";

export interface PlayerResources {
  water: number;
  grain: number;
  gold: number;
}

export interface Player {
  id: PlayerId;
  name: string;
  color: string;
  capitalTileId: TileId | null;
  resources: PlayerResources;
  isAlive: boolean;
  ready: boolean;
}

export interface Tile {
  id: TileId;
  ownerId: PlayerId | null;
  resource: Resource | null;
}

export interface GameState {
  phase: "lobby" | "draft" | "expansion" | "ended";
  players: Record<PlayerId, Player>;
  tiles: Record<TileId, Tile>;
  tick: number;
  dayAngle: number;
  draftOrder: PlayerId[];
  draftIndex: number;
  winnerId: PlayerId | null;
}

// client → server
export interface ClientIntents {
  join: { name: string };
  ready: void;
  pickCapital: { tileId: TileId };
  expandTo: { tileId: TileId };
}

// server → client
export interface ServerEvents {
  fullState: GameState;
  stateDiff: Partial<GameState>;
  error: { message: string };
}
