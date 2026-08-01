export const contractRiskScenarios = [
  {
    id: 'lease-auto-renewal-rent-up',
    label: '沉默续租并自动涨租',
    variants: [
      '租赁期满前，如乙方未书面提出退租，本合同自动顺延一年，顺延期内月租金上浮10%。',
      '合同到期双方均未表示终止的，视为自动续租十二个月，续期月租提高8%。',
      '租期届满前三十日未通知不续租的，本合同自动续期，续期租金在原标准上上调12%。',
    ],
  },
  {
    id: 'lease-termination-asymmetry',
    label: '提前解约责任不对等',
    variants: [
      '承租人提前退租须提前六十日通知并支付两个月租金；出租人可提前收回房屋，仅需提前十五日通知。',
      '乙方提前退租应提前90日申请并承担两个月租金的违约金，甲方可提前解除且无需补偿。',
      '租客提前解约须支付双倍月租金，甲方因经营需要收房时提前七日通知即可，无需补偿。',
    ],
  },
  {
    id: 'lease-unilateral-rent-adjustment',
    label: '租期内单方涨租',
    variants: [
      '甲方可根据市场行情调整租金，乙方不同意调整的，应在十日内搬离。',
      '周边租金上涨时，出租人有权提高租金；承租人不接受的，视为主动退租。',
      '因经营需要，甲方可上浮租金，乙方拒绝调整即构成违约。',
    ],
  },
  {
    id: 'lease-daily-late-fee-5-percent',
    label: '按日高额逾期费',
    variants: [
      '乙方逾期交租的，每日按月租金3%支付违约金。',
      '租金未按期支付，每逾期一日按当月租金百分之二计收滞纳金。',
      '欠付租金期间按日加收租金5%的逾期费用。',
    ],
  },
  {
    id: 'lease-lockout-forfeiture',
    label: '欠租后自行换锁停水电',
    variants: [
      '乙方拖欠租金超过五日，甲方可直接换锁并自行收回房屋。',
      '承租人逾期交租七日的，出租人有权停水停电并强行收房。',
      '欠租超过三日，甲方可自行收回房屋并更换门锁。',
    ],
  },
  {
    id: 'lease-deposit-return-delay',
    label: '押金返还周期过长',
    variants: [
      '退房验收完成后，押金在60日内返还。',
      '保证金自乙方搬离并结清费用之日起两个月内退还。',
      '甲方在交房后45个工作日内退还押金。',
    ],
  },
  {
    id: 'lease-arbitrary-deposit-deduction',
    label: '押金可由出租方任意扣减',
    variants: [
      '退租时甲方可从押金中酌情扣除管理费及其认定的其他费用。',
      '保证金结算金额以出租人认定为准，甲方酌情扣除后返还余额。',
      '甲方可从押金中扣收固定管理费，无需提供票据。',
    ],
  },
  {
    id: 'lease-all-maintenance-tenant',
    label: '所有维修均由承租人承担',
    variants: [
      '租期内设施损坏不论原因，一律由乙方维修并承担费用。',
      '房屋出现故障，无论何种原因均由承租人负责维修。',
      '包括自然老化在内的全部维修均由租客承担维修费用。',
    ],
  },
  {
    id: 'lease-landlord-entry-no-consent',
    label: '出租方无需通知即可入室',
    variants: [
      '为检查房屋状况，甲方可随时进入房屋，无需通知乙方。',
      '出租人有权自行进入租赁房屋，不必征得承租人同意。',
      '甲方或中介可开门检查房屋，无需通知。',
    ],
  },
  {
    id: 'lease-pet-forfeiture-no-cure',
    label: '养宠即没收押金',
    variants: [
      '房屋内发现宠物的，押金不退并立即终止合同。',
      '乙方饲养猫狗的，租赁保证金不予返还。',
      '未经同意饲养宠物，甲方可没收保证金。',
    ],
  },
  {
    id: 'lease-sublet-share-overbroad',
    label: '合住和访客限制过宽',
    variants: [
      '乙方不得与任何人合住，否则视为严重违约。',
      '房屋一律禁止增加共同居住人，违反即解除合同。',
      '亲友留宿超过一晚即视为严重违约。',
    ],
  },
  {
    id: 'lease-excessive-restoration',
    label: '退租必须翻新保洁',
    variants: [
      '乙方退租时必须完成全屋粉刷和专业保洁。',
      '交还房屋前，承租人须重新刷墙并深度清洁。',
      '搬离时应对全部房间深度保洁，墙面一律重新粉刷。',
    ],
  },
  {
    id: 'lease-utility-no-voucher',
    label: '杂费不提供账单',
    variants: [
      '水电费按甲方内部标准收取，乙方不得查账。',
      '水电燃气费由出租人通知金额，不提供账单。',
      '能源费以甲方结算为准，乙方不得提出异议。',
    ],
  },
  {
    id: 'lease-broad-default-six-months',
    label: '普通违约叠加没收和高额违约金',
    variants: [
      '乙方任何违约均没收押金，并另付三个月租金作为违约金。',
      '发生任一违约，保证金不予返还，乙方还应支付6个月租金。',
      '甲方认为违约的，可没收押金并要求六个月租金的赔偿。',
    ],
  },
  {
    id: 'lease-overbroad-exemption',
    label: '出租方自身风险也免责',
    variants: [
      '因甲方债务纠纷导致无法居住的，甲方不承担责任。',
      '房屋被司法查封或受到物业干涉时，均不构成甲方违约。',
      '因邻居投诉导致乙方搬离的，甲方免责。',
    ],
  },
  {
    id: 'lease-unfavorable-jurisdiction',
    label: '争议管辖偏向出租方',
    variants: [
      '争议应向甲方住所地人民法院起诉。',
      '双方同意由出租方所在地法院起诉解决争议。',
      '本合同争议提交甲方注册地仲裁委员会处理。',
    ],
  },
  {
    id: 'lease-format-clause-waiver',
    label: '单方解释并排除异议',
    variants: [
      '本合同最终解释权归甲方，乙方不得提出异议。',
      '乙方签字后放弃抗辩，合同最终解释权由出租人享有。',
      '乙方不得以未阅读为由提出异议，甲方享有最终解释权。',
    ],
  },
  {
    id: 'lease-title-defect-no-liability',
    label: '无权出租也不赔偿',
    variants: [
      '因甲方无权出租导致合同不能履行的，只退未住租金，不承担赔偿。',
      '出现产权争议致乙方搬离时，甲方仅退剩余租金，双方互不追究。',
      '因权属瑕疵无法继续居住的，出租人只退未住租金。',
    ],
  },
  {
    id: 'lease-sale-terminates-tenancy',
    label: '出售房屋即终止租约',
    variants: [
      '甲方出售房屋时本合同自动终止，乙方应无条件搬离。',
      '房屋出售后租约立即终止，承租人须在七日内腾退。',
      '产权转让时乙方无条件搬离，原合同不再履行。',
    ],
  },
  {
    id: 'lease-abandoned-property-disposal',
    label: '自行处置承租人物品',
    variants: [
      '乙方逾期搬离的，甲方可自行处置遗留物品。',
      '租客留在屋内的个人物品均视为放弃，出租人可直接丢弃。',
      '甲方有权清理变卖承租人物品，不承担赔偿。',
    ],
  },
  {
    id: 'lease-rent-loan-forced',
    label: '强制绑定租金贷',
    variants: [
      '乙方签约即视为同意办理租金分期。',
      '承租人必须办理甲方指定机构的租金贷款。',
      '甲方可授权金融机构自动开通租金贷。',
    ],
  },
  {
    id: 'lease-excessive-deposit',
    label: '超高押金',
    variants: [
      '乙方应支付相当于三个月租金的押金。',
      '本合同租赁保证金为4个月租金。',
      '签约时承租人须支付三倍月租金作为押金。',
    ],
  },
  {
    id: 'lease-unsafe-housing-waiver',
    label: '不安全房屋免责',
    variants: [
      '乙方确认甲醛问题由其自行承担，甲方概不负责。',
      '房屋存在消防隐患的风险由乙方自行承担，不得据此退租。',
      '承租人知悉违法隔断，相关房屋安全问题出租方免责。',
    ],
  },
  {
    id: 'lease-agency-fee-nonrefundable',
    label: '中介费未成交也不退',
    variants: [
      '中介费一经支付概不退还，即使最终未签约。',
      '居间服务费一律不退，未成交不影响收费。',
      '经纪服务费在未签约时也不退还。',
    ],
  },
  {
    id: 'lease-rental-tax-transfer',
    label: '租赁税费全部转嫁承租人',
    variants: [
      '房屋租赁产生的全部税费和开票费用均由乙方承担。',
      '租金为出租方净收金额，租赁税费及开票成本由承租方承担。',
      '本合同产生的租赁税费、开票费全部由乙方负担。',
    ],
  },
  {
    id: 'lease-sublet-extra-fee',
    label: '转租另收手续费',
    variants: [
      '乙方转租须经甲方同意，并支付月租金30%的转租手续费。',
      '承租人申请分租时，应向出租人支付500元转租服务费。',
      '乙方转借房屋除取得书面同意外，还需支付半个月租金作为手续费。',
    ],
  },
  {
    id: 'lease-visitor-occupancy-fee',
    label: '访客留宿按日收费',
    variants: [
      '亲友留宿超过两晚的，每日收取100元房屋占用费。',
      '访客留宿满24小时须向甲方报备，并按日支付80元占用费。',
      '外来人员留宿超过3天的，乙方应按每日60元标准支付房屋占用费。',
    ],
  },
  {
    id: 'lease-pet-additional-penalty',
    label: '宠物违约另收固定清除费',
    variants: [
      '乙方饲养宠物除没收押金外，还应额外支付2000元异味清除费。',
      '未经同意饲养任何宠物的，甲方可额外收取1500元宠物清洁费。',
      '发现乙方饲养猫狗时，除解除合同外另收1000元固定清除费。',
    ],
  },
  {
    id: 'lease-self-help-utility-cutoff',
    label: '欠费后停水停电催缴',
    variants: [
      '乙方欠缴任何费用超过3日，甲方有权停水停电并限制入户。',
      '承租人拖欠物业等费用时，出租人可断水断电催缴。',
      '欠费逾期未补交的，甲方可限制乙方入户和正常使用房屋。',
    ],
  },
  {
    id: 'lease-lien-on-tenant-property',
    label: '以留置权处置承租人物品',
    variants: [
      '乙方欠租时，甲方有权行使留置权并处置屋内物品抵扣欠款。',
      '出租人可留置并变卖承租人物品，用于抵扣未付租金。',
      '租金逾期后，甲方可行使留置权，将乙方物品折价抵扣。',
    ],
  },
]

const safeContractClauses = [
  '甲方保证对房屋享有合法出租权，房屋信息与权属材料真实有效。',
  '租期为十二个月，固定租期内月租金保持不变。',
  '押金为一个月租金，交房验收并结清费用后七个工作日内退还。',
  '房屋自然老化和非乙方原因造成的维修由甲方负责，乙方不当使用造成的损坏由乙方负责。',
  '甲方入室检查或带看应提前二十四小时通知并取得乙方同意，紧急抢修除外。',
  '租赁期间房屋所有权变动不影响本合同效力。',
  '争议协商不成的，由房屋所在地有管辖权的人民法院处理。',
]

export const sanitizedHiddenBugContract = {
  id: 'sanitized-hidden-bugs-12',
  title: '脱敏隐蔽漏洞合同（12 项）',
  fictional: true,
  expectedRiskIds: [
    'lease-date-range-invalid',
    'lease-deposit-forfeiture-on-late-rent',
    'lease-deposit-forfeiture-on-no-notice',
    'lease-termination-asymmetry',
    'lease-safety-liability-waiver',
    'lease-all-maintenance-tenant',
    'lease-device-warranty-shift',
    'lease-oral-overrides-written',
    'lease-lockout-forfeiture',
    'lease-common-area-fee-transfer',
    'lease-arbitrary-deposit-deduction',
    'lease-landlord-entry-no-consent',
  ],
  text: [
    '房屋租赁合同（测试瑕疵版·虚构且已脱敏）',
    '',
    '甲方（出租方）：示例出租人',
    '乙方（承租方）：示例承租人',
    '房屋地址：示例市示例区示例小区 3 栋 1802 室',
    '',
    '第一条 房屋信息：两室一厅，建筑面积 86 平方米。',
    '第二条 租赁期限：租赁时间为2026年2月1日—2025年12月30日，租期共计12个月。乙方到期不续租，必须提前30天书面告知甲方，未提前通知视为违约，押金全额没收。',
    '第三条 租金标准：月租金1850元，押二付一，每月5号前支付。逾期当日直接停水停电，逾期1天扣除全部押金。',
    '第四条 押金条款：退房清洁费、折旧费统一扣除300元，不予退还。',
    '第五条 费用划分：水费、电费、物业费、宽带费、公摊能耗费、楼道维修费、小区管理费全部由乙方承担。租赁期间房屋主体漏水、墙体开裂、管道老化、线路故障，维修费用均由乙方自理。',
    '第六条 看房条款：甲方可随时未经乙方同意开门入户巡查、看房、带人看房，乙方不得以隐私为由阻拦。',
    '第七条 转租与解约：乙方绝对禁止任何形式退租、转租、转借、换租，无论任何理由提前退租，剩余租金、押金全部没收。甲方如需要收回房屋，可随时无理由解约，仅需提前3天通知乙方，不承担任何违约金。',
    '第八条 安全责任：租赁期间屋内发生盗窃、火灾、漏水、摔伤、触电、高空坠物等所有安全事故、财产损失、人身损害，全部由乙方全权负责，甲方不承担任何连带责任。',
    '第九条 设备保修：屋内家电、家具、厨卫设施仅保修1个月，1个月后所有损坏、故障、老化问题一律乙方自费维修更换。',
    '第十条 口头约定优先：本合同未尽事宜以双方口头约定为准，口头效力高于书面合同。',
    '第十一条 合同生效：本合同一式两份，双方签字生效。',
    '',
    '本样本已去除姓名、电话、身份证号和精确地址，仅用于软件测试。',
  ].join('\n'),
}

function makeContract(caseId, clauses, expectedRiskIds) {
  return {
    id: caseId,
    title: `虚构租房合同 ${caseId}`,
    fictional: true,
    expectedRiskIds,
    text: [
      '房屋租赁合同（虚构评测样本）',
      '',
      '出租人（甲方）：示例房屋管理方',
      '承租人（乙方）：示例承租人',
      '房屋：示例市安居路 88 号 2 栋 1203 室',
      '',
      ...safeContractClauses.slice(0, 2).map((clause, index) => `${index + 1}. ${clause}`),
      ...clauses.map((clause, index) => `${index + 3}. ${clause}`),
      '',
      '本样本仅用于软件测试，不对应真实主体、房屋或交易。',
    ].join('\n'),
  }
}

export function buildContractReviewBenchmark() {
  const cases = []
  const groupCount = Math.ceil(contractRiskScenarios.length / 12)
  for (let variant = 0; variant < 3; variant += 1) {
    for (let group = 0; group < groupCount; group += 1) {
      const selected = contractRiskScenarios.slice(group * 12, group * 12 + 12)
      cases.push(makeContract(
        `v${variant + 1}-g${group + 1}`,
        selected.map((scenario) => scenario.variants[variant]),
        selected.map((scenario) => scenario.id),
      ))
    }
  }

  cases.push({
    id: 'balanced-control',
    title: '虚构规范租房合同',
    fictional: true,
    expectedRiskIds: [],
    text: [
      '房屋租赁合同（虚构低风险对照样本）',
      '',
      ...safeContractClauses.map((clause, index) => `${index + 1}. ${clause}`),
      '',
      '本样本仅用于软件测试，不对应真实主体、房屋或交易。',
    ].join('\n'),
  })

  cases.push(sanitizedHiddenBugContract)

  return cases
}

function createSeededRandom(seed) {
  let state = Number(seed) >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

export function generateSyntheticRentalContracts({ count = 10, risksPerContract = 12, seed = Date.now() } = {}) {
  const random = createSeededRandom(seed)
  const safeCount = Math.max(1, Math.min(Number(count) || 10, 100))
  const riskCount = Math.max(1, Math.min(Number(risksPerContract) || 12, contractRiskScenarios.length))

  return Array.from({ length: safeCount }, (_, caseIndex) => {
    const selected = [...contractRiskScenarios]
      .map((scenario) => ({ scenario, order: random() }))
      .sort((a, b) => a.order - b.order)
      .slice(0, riskCount)
      .map(({ scenario }) => scenario)
    const clauses = selected
      .map((scenario) => scenario.variants[Math.floor(random() * scenario.variants.length)])
      .map((clause) => ({ clause, order: random() }))
      .sort((a, b) => a.order - b.order)
      .map(({ clause }) => clause)

    return makeContract(`seed-${seed}-${caseIndex + 1}`, clauses, selected.map((scenario) => scenario.id))
  })
}
