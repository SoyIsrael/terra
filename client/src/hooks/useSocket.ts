import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { GameState } from "@terra/shared";

const SERVER = "http://localhost:3001";

function emptyState(): GameState {
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

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState>(emptyState());
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    const socket = io(SERVER);
    socketRef.current = socket;

    socket.on("connect", () => setMyId(socket.id ?? null));

    socket.on("fullState", (state: GameState) => setGameState(state));

    socket.on("stateDiff", (diff: Partial<GameState>) =>
      setGameState(prev => ({ ...prev, ...diff }))
    );

    return () => { socket.disconnect(); };
  }, []);

  function send<T>(event: string, data?: T) {
    socketRef.current?.emit(event, data);
  }

  return { gameState, myId, send };
}
