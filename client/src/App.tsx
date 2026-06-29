import { useState } from 'react'
import GlobeCanvas from './components/GlobeCanvas'
import HUD from './components/HUD'
import { useSocket } from './hooks/useSocket'

interface HoverInfo {
  tileId: number;
  cost: number | null;
  x: number;
  y: number;
}

export default function App() {
  const { gameState, myId, send } = useSocket()
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null)

  function handleTileClick(tileId: number) {
    if (gameState.phase === 'draft') {
      const currentPicker = gameState.draftOrder[gameState.draftIndex]
      if (currentPicker === myId) send('pickCapital', { tileId })
    } else if (gameState.phase === 'expansion') {
      send('expandTo', { tileId })
    }
  }

  return (
    <div className="relative w-full h-full">
      <GlobeCanvas
        gameState={gameState}
        myId={myId}
        onTileClick={handleTileClick}
        onHover={setHoverInfo}
      />
      <HUD
        gameState={gameState}
        myId={myId}
        hoverInfo={hoverInfo}
        onJoin={name => send('join', { name })}
        onReady={() => send('ready')}
        onRestart={() => send('restart')}
      />
    </div>
  )
}
