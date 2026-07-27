export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/contract/index',
    'pages/ai/index',
    'pages/checkin/index',
    'pages/evidence/index',
    'pages/subsidy/index'
  ],
  tabBar: {
    color: '#5f6a62',
    selectedColor: '#078d50',
    backgroundColor: '#fffdf8',
    borderStyle: 'black',
    list: [
      { pagePath: 'pages/index/index', text: '首页', iconPath: 'assets/tabs/home.png', selectedIconPath: 'assets/tabs/home-active.png' },
      { pagePath: 'pages/contract/index', text: '审查', iconPath: 'assets/tabs/review.png', selectedIconPath: 'assets/tabs/review-active.png' },
      { pagePath: 'pages/ai/index', text: 'AI', iconPath: 'assets/tabs/ai.png', selectedIconPath: 'assets/tabs/ai-active.png' },
      { pagePath: 'pages/checkin/index', text: '验房', iconPath: 'assets/tabs/checkin.png', selectedIconPath: 'assets/tabs/checkin-active.png' },
      { pagePath: 'pages/evidence/index', text: '证据', iconPath: 'assets/tabs/evidence.png', selectedIconPath: 'assets/tabs/evidence-active.png' }
    ]
  },
  window: {
    backgroundTextStyle: 'light',
    backgroundColor: '#eef2ec',
    navigationBarBackgroundColor: '#eef2ec',
    navigationBarTitleText: '租小审',
    navigationBarTextStyle: 'black'
  }
})
