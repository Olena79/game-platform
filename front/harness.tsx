import { useState } from 'react'
import ReactDOM from 'react-dom/client'
import './src/index.css'
import './src/i18n'
import { CoinModal } from './src/components/gameroom/CoinModal'
const me = { userId: 'p1', name: 'Player', coins: 100, isGamemaster: false, isSpectator: false, connected: true } as any
const gm = { userId: 'gm', name: 'GM', coins: 0, isGamemaster: true, isSpectator: false, connected: true } as any
function App() {
  const [open, setOpen] = useState(true)
  return <div style={{ height: '100vh' }}>
    <div id='state' style={{ color: '#fff' }}>{open ? 'open' : 'closed'}</div>
    <button id='reopen' onClick={() => setOpen(true)} style={{ color: '#fff' }}>reopen</button>
    {open && <CoinModal me={me} players={[me, gm]} onTransfer={() => {}} onPayBank={() => {}} onClose={() => setOpen(false)} />}
  </div>
}
ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
