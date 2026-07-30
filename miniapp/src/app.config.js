export default defineAppConfig({
  __usePrivacyCheck__: true,
  pages: [
    'pages/index/index',
    'pages/contract/index',
    'pages/ai/index',
    'pages/checkin/index',
    'pages/evidence/index',
    'pages/subsidy/index'
  ],
  tabBar: {
    color: '#5c6a60',
    selectedColor: '#1a4d3a',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      { pagePath: 'pages/index/index', text: '首页', iconPath: 'assets/tabs/home.png', selectedIconPath: 'assets/tabs/home-active.png' },
      { pagePath: 'pages/contract/index', text: '审查', iconPath: 'assets/tabs/review.png', selectedIconPath: 'assets/tabs/review-active.png' },
      { pagePath: 'pages/checkin/index', text: '验房', iconPath: 'assets/tabs/checkin.png', selectedIconPath: 'assets/tabs/checkin-active.png' },
      { pagePath: 'pages/evidence/index', text: '证据', iconPath: 'assets/tabs/evidence.png', selectedIconPath: 'assets/tabs/evidence-active.png' },
      { pagePath: 'pages/subsidy/index', text: '补贴', iconPath: 'assets/tabs/subsidy.png', selectedIconPath: 'assets/tabs/subsidy-active.png' }
    ]
  },
  window: {
    backgroundTextStyle: 'light',
    backgroundColor: '#f6f7f6',
    navigationBarBackgroundColor: '#f6f7f6',
    navigationBarTitleText: '租小审',
    navigationBarTextStyle: 'black'
  }
})
