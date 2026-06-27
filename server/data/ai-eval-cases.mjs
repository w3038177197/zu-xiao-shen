export const aiEvalCases = [
  {
    id: 'deposit-no-voucher',
    category: '押金',
    query: '退租时房东说要扣保洁费和维修费，但没有照片、清单和票据，我该怎么办？',
    expectedIds: ['deposit-evidence', 'deposit-return-time', 'moveout-evidence-pack'],
  },
  {
    id: 'illegal-lockout',
    category: '非法腾退',
    query: '房东因为我晚交租金就换锁，还说押金不退，这种情况怎么处理？',
    expectedIds: ['illegal-eviction', 'rent-payment-notice'],
  },
  {
    id: 'repair-transfer',
    category: '维修',
    query: '合同写水管老化、墙面开裂都由租客自己维修并承担费用，可以签吗？',
    expectedIds: ['repair-duty'],
  },
  {
    id: 'entry-privacy',
    category: '入户隐私',
    query: '合同写房东和中介可以随时进屋检查、维修和带人看房，需要改吗？',
    expectedIds: ['privacy-and-entry'],
  },
  {
    id: 'checkin-handover',
    category: '入住验房',
    query: '入住当天验房要拍哪些地方，怎么避免退租时被说是我弄坏的？',
    expectedIds: ['checkin-handover', 'moveout-evidence-pack'],
  },
  {
    id: 'subsidy-graduate',
    category: '补贴',
    query: '我是应届毕业生，想查杭州或南京租房补贴，一般要准备什么材料？',
    expectedIds: ['subsidy-policy'],
  },
  {
    id: 'brokerage-fake-listing',
    category: '中介',
    query: '中介发的房源和实际不一样，还收了服务费，退费和投诉怎么说？',
    expectedIds: ['brokerage-fee', 'lessor-info-duty'],
  },
  {
    id: 'format-terms',
    category: '格式条款',
    query: '合同最后写签字就代表完全理解，解释权都归甲方，这是不是有问题？',
    expectedIds: ['standard-terms'],
  },
  {
    id: 'unsafe-partition',
    category: '房源安全',
    query: '房间是隔断出来的，厨房旁边也住人，消防和租住安全要注意什么？',
    expectedIds: ['safe-housing-standard', 'housing-rental-measures'],
  },
  {
    id: 'renewal-rent-increase',
    category: '续租涨租',
    query: '合同写到期自动续租并且房东可以按市场价单方涨租，这条怎么谈？',
    expectedIds: ['rent-increase-renewal'],
  },
  {
    id: 'ownership-before-sign',
    category: '签约核验',
    query: '签约前怎么确认房东身份、产权证和收款账户，防止二房东风险？',
    expectedIds: ['lessor-info-duty'],
  },
  {
    id: 'tenant-action',
    category: '沟通维权',
    query: '房东拒绝维修还催我搬走，我想先发一段克制但有依据的话术。',
    expectedIds: ['tenant-action-path', 'repair-duty'],
  },
]
