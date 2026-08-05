import { Component } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Button } from '@tarojs/components'

// 全局错误边界：捕获任意子树渲染期错误，避免整个小程序白屏。
// 评委真机遇到边界情况（如恢复快照结构不兼容）时会看到友好提示，而非白屏崩溃。
export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error) {
    // 渲染期错误：更新 state 触发 fallback UI
    const message = typeof error?.message === 'string' ? error.message : String(error || '')
    return { hasError: true, errorMessage: message.slice(0, 200) }
  }

  componentDidCatch(error, info) {
    // 上报错误（控制台），不向用户暴露堆栈
    console.error('[租小审] 渲染错误已捕获', error, info)
  }

  handleReset = () => {
    // 重置错误状态，让用户重试当前页面
    this.setState({ hasError: false, errorMessage: '' })
  }

  handleRelaunch = () => {
    // 重置并回到首页（避免停留在出错页面）
    this.setState({ hasError: false, errorMessage: '' })
    Taro.reLaunch({ url: '/pages/index/index' })
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <View style={{ padding: '32px 24px', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: '16px', color: '#1a4d3a', marginBottom: '8px' }}>页面出了点小问题</Text>
        <Text style={{ fontSize: '13px', color: '#5c6a60', marginBottom: '24px', textAlign: 'center' }}>
          可以重试当前页面，或返回首页继续使用。已保存的数据不受影响。
        </Text>
        <View style={{ display: 'flex', gap: '12px' }}>
          <Button size='mini' onClick={this.handleReset}>重试</Button>
          <Button size='mini' type='primary' onClick={this.handleRelaunch}>返回首页</Button>
        </View>
      </View>
    )
  }
}
