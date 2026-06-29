import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import type { GameState, PlayerId, TileId } from "@terra/shared";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

const PLAYER_COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c", "#e67e22", "#1abc9c"];

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
  };
}

function usedColors(): Set<string> {
  return new Set(Object.values(state.players).map(p => p.color));
}

function assignColor(): string {
  const used = usedColors();
  return PLAYER_COLORS.find(c => !used.has(c)) ?? "#ffffff";
}

function broadcast(diff: Partial<GameState>) {
  Object.assign(state, diff);
  io.emit("stateDiff", diff);
}

function currentPicker(): PlayerId | null {
  if (state.phase !== "draft") return null;
  return state.draftOrder[state.draftIndex] ?? null;
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

  // Send full state to new connection
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
      resources: { water: 10, grain: 10, gold: 5 },
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
    if (currentPicker() !== socket.id) {
      socket.emit("error", { message: "Not your turn." });
      return;
    }
    if (state.tiles[tileId]?.ownerId) {
      socket.emit("error", { message: "Tile already claimed." });
      return;
    }

    // Claim tile as capital
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

  socket.on("disconnect", () => {
    delete state.players[socket.id];
    // Remove from draft order if mid-draft
    const newOrder = state.draftOrder.filter(id => id !== socket.id);
    broadcast({ players: { ...state.players }, draftOrder: newOrder });

    // Reset to lobby if no players left
    if (Object.keys(state.players).length === 0) {
      state = freshState();
    }
  });
});

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => console.log(`server on :${PORT}`));
