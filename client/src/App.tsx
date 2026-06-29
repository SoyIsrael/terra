import GlobeCanvas from './components/GlobeCanvas'
import HUD from './components/HUD'

export default function App() {
  return (
    <div className="relative w-full h-full">
      <GlobeCanvas />
      <HUD />
    </div>
  )
}
