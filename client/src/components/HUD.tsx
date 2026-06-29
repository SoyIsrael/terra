export default function HUD() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-3 bg-black/40 backdrop-blur-sm pointer-events-auto">
        <span className="text-white font-bold text-xl tracking-widest">TERRA</span>
        <span className="text-gray-400 text-sm">Lobby — waiting for players</span>
      </div>

      {/* Bottom resource bar placeholder */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-8 px-6 py-3 bg-black/40 backdrop-blur-sm pointer-events-auto">
        {(["Water", "Grain", "Gold"] as const).map((r) => (
          <div key={r} className="flex items-center gap-2 text-white text-sm">
            <span className="text-gray-400">{r}</span>
            <span className="font-mono">—</span>
          </div>
        ))}
      </div>
    </div>
  );
}
