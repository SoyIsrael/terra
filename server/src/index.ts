import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import type { GameState, PlayerId } from "@terra/shared";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

const TICK_RATE = 10; // ticks per second
const DAY_CYCLE_TICKS = TICK_RATE * 240; // 4 minutes

let state: GameState = {
  phase: "lobby",
  players: {},
  tiles: {},
  tick: 0,
  dayAngle: 0,
};

io.on("connection", (socket) => {
  console.log("connected:", socket.id);

  socket.on("join", ({ name }: { name: string }) => {
    const player = {
      id: socket.id as PlayerId,
      name,
      color: randomColor(),
      capitalTileId: null,
      resources: { water: 10, grain: 10, gold: 5 },
      isAlive: true,
    };
    state.players[socket.id] = player;
    io.emit("stateDiff", { players: state.players });
  });

  socket.on("disconnect", () => {
    delete state.players[socket.id];
    io.emit("stateDiff", { players: state.players });
  });
});

// Game tick loop
setInterval(() => {
  state.tick++;
  state.dayAngle = (state.dayAngle + 360 / DAY_CYCLE_TICKS) % 360;
  io.emit("stateDiff", { tick: state.tick, dayAngle: state.dayAngle });
}, 1000 / TICK_RATE);

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => console.log(`server on :${PORT}`));

function randomColor() {
  const colors = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c"];
  return colors[Math.floor(Math.random() * colors.length)];
}
