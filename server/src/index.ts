import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { generateTiles, assignZones, ZONE_GRAIN_YIELD } from "@terra/shared";
import type { GameState, PlayerId, TileId, TileInfo } from "@terra/shared";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

const PLAYER_COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c", "#e67e22", "#ff69b4"];
const EXPAND_COST = 5;
const DAY_NIGHT_CYCLE_MS = 60_000; // 60s total: ~40s day, ~20s night per tile
const DAY_TICK_MS = 100;           // broadcast dayAngle 10x/sec for smooth light movement

// Build world data once at startup
const worldTiles = generateTiles(4);
const neighborMap: Map<TileId, number[]> = new Map(worldTiles.map(t => [t.id, t.neighbors]));
const tileInfoMap: Map<TileId, TileInfo> = new Map(assignZones(worldTiles).map(i => [i.id, i]));

let state: GameState = freshState();

function freshState(): GameState {
  return {
    phase: "lobby",
    players: {},
    tiles: {},
    tick: 0,
    dayAngle: 0,
    draftOrder: [],
    draftIndex: 0,
    winnerId: null,
  };
}

function eliminatePlayer(loserId: PlayerId) {
  state.players[loserId].isAlive = false;
  // Free all their tiles so others can claim them
  for (const tile of Object.values(state.tiles)) {
    if (tile.ownerId === loserId) tile.ownerId = null;
  }
}

function checkWin(): PlayerId | null {
  const alive = Object.values(state.players).filter(p => p.isAlive);
  return alive.length === 1 ? alive[0].id : null;
}

function assignColor(): string {
  const used = new Set(Object.values(state.players).map(p => p.color));
  return PLAYER_COLORS.find(c => !used.has(c)) ?? "#ffffff";
}

function broadcast(diff: Partial<GameState>) {
  Object.assign(state, diff);
  io.emit("stateDiff", diff);
}

function playerOwnedTiles(playerId: PlayerId): Set<TileId> {
  const owned = new Set<TileId>();
  for (const [id, tile] of Object.entries(state.tiles)) {
    if (tile.ownerId === playerId) owned.add(Number(id));
  }
  return owned;
}

function isAdjacentToOwned(tileId: TileId, playerId: PlayerId): boolean {
  const owned = playerOwnedTiles(playerId);
  return (neighborMap.get(tileId) ?? []).some(n => owned.has(n));
}

function tryStartDraft() {
  const players = Object.values(state.players);
  if (players.length < 2) return;
  if (!players.every(p => p.ready)) return;
  if (state.phase !== "lobby") return;
  const draftOrder = [...Object.keys(state.players)].sort(() => Math.random() - 0.5);
  broadcast({ phase: "draft", draftOrder, draftIndex: 0 });
}

io.on("connection", (socket) => {
  console.log("connected:", socket.id);
  socket.emit("fullState", state);

  socket.on("join", ({ name }: { name: string }) => {
    if (state.phase !== "lobby") {
      socket.emit("error", { message: "Game already in progress." });
      return;
    }
    state.players[socket.id] = {
      id: socket.id as PlayerId,
      name,
      color: assignColor(),
      capitalTileId: null,
      resources: { water: 10, grain: 30, gold: 5 },
      isAlive: true,
      ready: false,
    };
    broadcast({ players: { ...state.players } });
  });

  socket.on("ready", () => {
    if (!state.players[socket.id]) return;
    state.players[socket.id].ready = true;
    broadcast({ players: { ...state.players } });
    tryStartDraft();
  });

  socket.on("pickCapital", ({ tileId }: { tileId: TileId }) => {
    if (state.phase !== "draft") return;
    if (state.draftOrder[state.draftIndex] !== socket.id) {
      socket.emit("error", { message: "Not your turn." });
      return;
    }
    if (state.tiles[tileId]?.ownerId) {
      socket.emit("error", { message: "Tile already claimed." });
      return;
    }

    state.players[socket.id].capitalTileId = tileId;
    state.tiles[tileId] = { id: tileId, ownerId: socket.id, resource: null };

    const nextIndex = state.draftIndex + 1;
    const allPicked = nextIndex >= state.draftOrder.length;

    broadcast({
      players: { ...state.players },
      tiles: { ...state.tiles },
      draftIndex: nextIndex,
      ...(allPicked ? { phase: "expansion" } : {}),
    });
  });

  socket.on("expandTo", ({ tileId }: { tileId: TileId }) => {
    if (state.phase !== "expansion") {
      socket.emit("error", { message: "Not in expansion phase." });
      return;
    }
    const player = state.players[socket.id];
    if (!player) return;

    const existingOwner = state.tiles[tileId]?.ownerId;
    if (existingOwner === socket.id) {
      socket.emit("error", { message: "You already own this tile." });
      return;
    }
    if (!isAdjacentToOwned(tileId, socket.id)) {
      socket.emit("error", { message: "Tile not adjacent to your territory." });
      return;
    }
    const cost = existingOwner ? EXPAND_COST * 3 : EXPAND_COST; // enemy tiles cost 3x
    if (player.resources.grain < cost) {
      socket.emit("error", { message: "Not enough grain." });
      return;
    }
    player.resources.grain -= cost;

    state.tiles[tileId] = { id: tileId, ownerId: socket.id, resource: null };

    // Check if this tile was someone's capital → eliminate them
    for (const other of Object.values(state.players)) {
      if (other.id !== socket.id && other.isAlive && other.capitalTileId === tileId) {
        eliminatePlayer(other.id);
      }
    }

    const winnerId = checkWin();
    if (winnerId) {
      broadcast({
        players: { ...state.players },
        tiles: { ...state.tiles },
        phase: "ended",
        winnerId,
      });
    } else {
      broadcast({
        players: { ...state.players },
        tiles: { ...state.tiles },
      });
    }
  });

  socket.on("restart", () => {
    if (state.phase !== "ended") return;
    state = freshState();
    io.emit("fullState", state);
  });

  socket.on("disconnect", () => {
    delete state.players[socket.id];
    const newOrder = state.draftOrder.filter(id => id !== socket.id);
    broadcast({ players: { ...state.players }, draftOrder: newOrder });
    if (Object.keys(state.players).length === 0) state = freshState();
  });
});

// Day/night tick — always runs, 10x/sec for smooth sun movement
setInterval(() => {
  if (state.phase === "lobby") return;
  state.dayAngle = (state.dayAngle + (360 / (DAY_NIGHT_CYCLE_MS / DAY_TICK_MS))) % 360;
  io.emit("stateDiff", { dayAngle: state.dayAngle });
}, DAY_TICK_MS);

// Resource tick — runs every second during expansion
setInterval(() => {
  if (state.phase !== "expansion") return;

  let anyChange = false;
  for (const player of Object.values(state.players)) {
    let grainGain = 0;
    for (const [id, tile] of Object.entries(state.tiles)) {
      if (tile.ownerId !== player.id) continue;
      const info = tileInfoMap.get(Number(id));
      if (info) grainGain += ZONE_GRAIN_YIELD[info.zone];
    }
    if (grainGain > 0) {
      player.resources.grain += grainGain;
      anyChange = true;
    }
  }

  if (anyChange) io.emit("stateDiff", { players: { ...state.players } });
}, 1000);

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => console.log(`server on :${PORT}`));
