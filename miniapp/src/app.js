import { Component } from 'react'
import './app.css'

class App extends Component {
  componentDidMount() {}

  componentDidShow() {}

  componentDidHide() {}

  render() {
    return this.props.children
  }
}

export default App
