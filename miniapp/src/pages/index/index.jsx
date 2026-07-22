import { Component } from 'react'
import { Button, Text, View, WebView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.css'

const WEB_APP_URL = 'https://zu-xiao-shen.onrender.com'

export default class Index extends Component {
  state = { webError: false }

  handleWebError = () => this.setState({ webError: true })

  openNative = (path) => Taro.navigateTo({ url: path })

  renderFallback() {
    return (
      <View className='fallback'>
        <View className='fallback-brand'>租小审</View>
        <Text className='fallback-title'>完整工作台暂时无法连接</Text>
        <Text className='fallback-desc'>网络恢复后重新打开即可使用原网页的全部功能。本地 MVP 仍可继续记录。</Text>
        <Button className='fallback-retry' onClick={() => this.setState({ webError: false })}>重新连接</Button>
        <View className='fallback-links'>
          <Button onClick={() => this.openNative('/pages/contract/index')}>合同审查</Button>
          <Button onClick={() => this.openNative('/pages/checkin/index')}>入住验房</Button>
          <Button onClick={() => this.openNative('/pages/evidence/index')}>退租证据包</Button>
        </View>
      </View>
    )
  }

  render() {
    return this.state.webError ? this.renderFallback() : <WebView className='web-app' src={WEB_APP_URL} onError={this.handleWebError} />
  }
}
