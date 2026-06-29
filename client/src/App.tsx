import GlobeCanvas from './components/GlobeCanvas'
import HUD from './components/HUD'
import { useSocket } from './hooks/useSocket'

export default function App() {
  const { gameState, myId, send } = useSocket()

  function handleTileClick(tileId: number) {
    if (gameState.phase === 'draft') {
      const currentPicker = gameState.draftOrder[gameState.draftIndex]
      if (currentPicker === myId) {
        send('pickCapital', { tileId })
      }
    }
  }

  return (
    <div className="relative w-full h-full">
      <GlobeCanvas gameState={gameState} onTileClick={handleTileClick} />
      <HUD
        gameState={gameState}
        myId={myId}
        onJoin={name => send('join', { name })}
        onReady={() => send('ready')}
      />
    </div>
  )
}
