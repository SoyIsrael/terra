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
  draftOrder: PlayerId[];   // turn order for capital picks
  draftIndex: number;       // which index in draftOrder is currently picking
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
