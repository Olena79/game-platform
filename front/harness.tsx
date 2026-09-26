import ReactDOM from 'react-dom/client'
import { CoinFlights } from './src/components/gameroom/CoinFlights'
const tile = (id: string, left: number, top: number, label: string) => (
  <div data-coin-anchor={id} style={{ position: 'absolute', left, top, width: 150, height: 110, border: '1px solid #445', borderRadius: 9, color: '#ccd', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1120' }}>{label}</div>
)
ReactDOM.createRoot(document.getElementById('root')!).render(<div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
  {tile('gm', 30, 40, 'GM')}{tile('a', 30, 300, 'Player A')}{tile('b', 220, 300, 'Player B')}
  <CoinFlights gamemasterId='gm' />
</div>)
