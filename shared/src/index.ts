// Shared types between client and server

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
  dayAngle: number; // 0–360, drives the day/night cycle
}

// Socket.io event payloads — client → server (intents)
export interface ClientIntents {
  join: { name: string };
  pickCapital: { tileId: TileId };
  expandTo: { tileId: TileId };
  ready: void;
}

// Socket.io event payloads — server → client
export interface ServerEvents {
  stateDiff: Partial<GameState>;
  error: { message: string };
}
