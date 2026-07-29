import { useLaunch } from '@tarojs/taro'
import { initCloudContainer } from './utils/cloudContainer.js'
import './app.css'

function App({ children }) {
  useLaunch(() => {
    initCloudContainer().catch(() => {})
  })

  return children
}

export default App
