import ReactDOM from 'react-dom/client'
import './src/index.css'
import './src/i18n'
import { PreJoinScreen } from './src/components/gameroom/PreJoinScreen'
ReactDOM.createRoot(document.getElementById('root')!).render(<PreJoinScreen roomTitle='Test' userName='Ann' onJoin={() => {}} />)
