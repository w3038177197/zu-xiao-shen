export const knowledgeBaseItems = [
  {
    title: '民法典租赁规则',
    tag: '租房核心',
    text: '关注租期、维修义务、租赁物使用、解除责任、买卖不破租赁等租房基础规则。',
    source: '中国政府网',
    sourceUrl: 'https://www.gov.cn/xinwen/2020-06/01/content_5516649.htm',
  },
  {
    title: '商品房屋租赁管理办法',
    tag: '租赁合规',
    text: '关注租赁备案、隔断房限制、群租风险、消防安全、房屋用途和出租合规。',
    source: '住房城乡建设部规章',
    sourceUrl: 'https://www.moj.gov.cn/pub/sfbgw/flfggz/flfggzbmgz/201102/t20110225_144920.html',
  },
  {
    title: '住房租赁条例',
    tag: '监管趋势',
    text: '补充出租安全、合同备案、押金约定、经纪机构责任和禁止非法腾退等监管要求。',
    source: '国务院令第812号',
    sourceUrl: 'https://www.mee.gov.cn/zcwj/gwywj/202507/t20250722_1123995.shtml',
  },
  {
    title: '格式条款提示义务',
    tag: '格式条款',
    text: '识别签字即同意、解释权归甲方、押金不退等加重租客责任或限制租客权利的表述。',
    source: '民法典第四百九十六条',
    sourceUrl: 'https://www.gov.cn/xinwen/2020-06/01/content_5516649.htm',
  },
  {
    title: '押金返还与扣减',
    tag: '押金守护',
    text: '押金扣除应有明确项目、实际损失、合理必要和凭证支持，正常使用损耗不应随意扣款。',
    source: '住房租赁条例 + 裁判常识',
    sourceUrl: 'https://www.mee.gov.cn/zcwj/gwywj/202507/t20250722_1123995.shtml',
  },
  {
    title: '出租人维修义务',
    tag: '维修责任',
    text: '自然老化、水管老化、墙体开裂等不宜笼统转嫁给租客，需要结合原因和证据判断。',
    source: '民法典第七百一十二条',
    sourceUrl: 'https://www.gov.cn/xinwen/2020-06/01/content_5516649.htm',
  },
  {
    title: '禁止非法腾退',
    tag: '退租安全',
    text: '对换锁、断水断电、威胁收房等场景，优先提示留证、沟通和投诉路径。',
    source: '住房租赁条例第十二条',
    sourceUrl: 'https://www.mee.gov.cn/zcwj/gwywj/202507/t20250722_1123995.shtml',
  },
  {
    title: '入住验房留证',
    tag: '入住留证',
    text: '覆盖墙面地板、门窗门锁、家具家电、水电燃气表读数和已有瑕疵确认。',
    source: '产品流程库',
    sourceUrl: '',
  },
  {
    title: '退租证据包清单',
    tag: '退租留证',
    text: '整理合同、押金付款凭证、费用结清凭证、交接照片、维修票据、聊天记录和钥匙交还记录。',
    source: '产品流程库',
    sourceUrl: '',
  },
  {
    title: '续租涨租审查',
    tag: '涨租续租',
    text: '检查自动续租、单方涨租、到期通知、涨幅边界和双方确认方式。',
    source: '产品规则库',
    sourceUrl: '',
  },
  {
    title: '城市租房补贴线索',
    tag: '政策补贴',
    text: '按城市、学历、社保、无房、劳动合同等条件筛政策，结果必须提示以官方最新申报口径为准。',
    source: '各地政府公开入口',
    sourceUrl: '',
  },
  {
    title: '租房谈判策略',
    tag: '话术技巧',
    text: '提供押金、维修、提前解约、涨租限制、杂费凭证等条款的谈判话术。',
    source: '产品话术库',
    sourceUrl: '',
  },
]

export const aiResponseSkills = [
  {
    title: '租赁合同审查顾问',
    rule: '只围绕合同原文、当前模块数据和知识库回答，优先指出对租客最有实际影响的条款。',
  },
  {
    title: '证据核验员',
    rule: '涉及押金、维修、退租、验房时，必须提示需要照片、票据、聊天记录、交接单等证据支撑。',
  },
  {
    title: '专业沟通稿助手',
    rule: '需要行动建议时，给出可以直接发给房东、中介或平台的克制话术。',
  },
  {
    title: '回复排版编辑',
    rule: '用清晰短句和固定栏目输出，避免 Markdown 符号、堆叠分隔线、夸张语气和无依据判断。',
  },
  {
    title: '依据引用员',
    rule: '每次给建议都必须输出“依据”栏目，并优先引用知识库命中的标题、来源和适用范围。',
  },
]

export const aiReplySections = ['结论', '重点风险', '建议动作', '可发给房东的话', '依据', '提醒', '下一步', '话术']
