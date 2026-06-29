import type { GameState } from "@terra/shared";

interface Props {
  gameState: GameState;
  myId: string | null;
  onJoin: (name: string) => void;
  onReady: () => void;
}

export default function HUD({ gameState, myId, onJoin, onReady }: Props) {
  const me = myId ? gameState.players[myId] : null;
  const { phase, players, draftOrder, draftIndex } = gameState;
  const playerList = Object.values(players);
  const currentPickerId = draftOrder[draftIndex] ?? null;
  const isMyTurn = currentPickerId === myId;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }}>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-3 bg-black/50 backdrop-blur-sm pointer-events-auto">
        <span className="text-white font-bold text-xl tracking-widest">TERRA</span>
        <PhaseLabel phase={phase} isMyTurn={isMyTurn} currentPicker={currentPickerId ? players[currentPickerId] : null} />
      </div>

      {/* Lobby panel */}
      {phase === "lobby" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
          <div className="bg-black/70 backdrop-blur-md rounded-2xl p-8 w-80 flex flex-col gap-4">
            <h2 className="text-white text-2xl font-bold text-center">Join Game</h2>

            {!me ? (
              <JoinForm onJoin={onJoin} />
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-gray-300 text-sm text-center">
                  Waiting for players… ({playerList.length} joined)
                </p>
                <PlayerList players={playerList} myId={myId} />
                {!me.ready && (
                  <button
                    onClick={onReady}
                    className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded-lg transition"
                  >
                    Ready
                  </button>
                )}
                {me.ready && (
                  <p className="text-green-400 text-sm text-center">
                    You're ready! Waiting for others…
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Draft turn banner */}
      {phase === "draft" && (
        <div className={`absolute bottom-16 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl text-white font-semibold text-sm pointer-events-none
          ${isMyTurn ? "bg-yellow-500/90" : "bg-black/60"}`}>
          {isMyTurn
            ? "Your turn — click a tile to place your capital"
            : `Waiting for ${currentPickerId ? players[currentPickerId]?.name : "…"} to pick…`}
        </div>
      )}

      {/* Expansion phase banner */}
      {phase === "expansion" && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl bg-blue-600/80 text-white font-semibold text-sm pointer-events-none">
          All capitals placed — expansion phase begins!
        </div>
      )}

      {/* Player list sidebar (draft + expansion) */}
      {phase !== "lobby" && (
        <div className="absolute top-14 right-4 flex flex-col gap-2 pointer-events-none">
          {draftOrder.map((pid, i) => {
            const p = players[pid];
            if (!p) return null;
            const picked = p.capitalTileId !== null;
            const isCurrent = i === draftIndex && phase === "draft";
            return (
              <div key={pid} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
                ${isCurrent ? "bg-yellow-500/20 ring-1 ring-yellow-400" : "bg-black/40"}`}>
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.color }} />
                <span className="text-white">{p.name}{pid === myId ? " (you)" : ""}</span>
                {picked && <span className="text-green-400 text-xs ml-auto">✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PhaseLabel({ phase, isMyTurn, currentPicker }: {
  phase: string;
  isMyTurn: boolean;
  currentPicker: { name: string } | null;
}) {
  if (phase === "lobby") return <span className="text-gray-400 text-sm">Lobby</span>;
  if (phase === "draft") {
    return (
      <span className={`text-sm font-medium ${isMyTurn ? "text-yellow-400" : "text-gray-300"}`}>
        Draft phase {currentPicker && !isMyTurn ? `— ${currentPicker.name}'s turn` : ""}
      </span>
    );
  }
  if (phase === "expansion") return <span className="text-blue-400 text-sm">Expansion phase</span>;
  return null;
}

function JoinForm({ onJoin }: { onJoin: (name: string) => void }) {
  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        const name = (e.currentTarget.elements.namedItem("name") as HTMLInputElement).value.trim();
        if (name) onJoin(name);
      }}
      className="flex flex-col gap-3"
    >
      <input
        name="name"
        placeholder="Your name"
        maxLength={20}
        className="bg-white/10 text-white placeholder-gray-400 border border-white/20 rounded-lg px-4 py-2 focus:outline-none focus:border-white/50"
        autoFocus
      />
      <button
        type="submit"
        className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg transition"
      >
        Join
      </button>
    </form>
  );
}

function PlayerList({ players, myId }: { players: ReturnType<typeof Object.values<any>>; myId: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      {players.map((p: any) => (
        <div key={p.id} className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-200">{p.name}{p.id === myId ? " (you)" : ""}</span>
          {p.ready && <span className="text-green-400 text-xs ml-auto">ready</span>}
        </div>
      ))}
    </div>
  );
}
