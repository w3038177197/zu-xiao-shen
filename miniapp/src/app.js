import { useLaunch } from '@tarojs/taro'
import './app.css'

function App({ children }) {
  useLaunch(() => {})
  return children
}

export default App
