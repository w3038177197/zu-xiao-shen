import assert from 'node:assert/strict'
import { analyzeContract, createReportText, getRiskSummary, groupFindingsByTheme } from '../src/features/contractReview.js'
import { reviewContractOcrText } from '../miniapp/src/utils/contractOcrReview.js'
import {
  buildContractReviewBenchmark,
  contractRiskScenarios,
  generateSyntheticRentalContracts,
  sanitizedHiddenBugContract,
} from './contract-review-benchmark-data.mjs'

const profile = { contractType: 'lease', partyRole: 'partyB', reviewDepth: 'strict' }
const benchmark = buildContractReviewBenchmark()
const failures = []
let expectedTotal = 0
let matchedTotal = 0

assert.equal(new Set(contractRiskScenarios.map((item) => item.id)).size, contractRiskScenarios.length, '风险场景 id 必须唯一')
assert.ok(contractRiskScenarios.every((item) => item.variants.length >= 3), '每类风险至少需要三种独立表述')
assert.equal(
  benchmark.filter((item) => item.expectedRiskIds.length > 0).length,
  Math.ceil(contractRiskScenarios.length / 12) * 3 + 1,
  '黄金评测应覆盖全部风险变体和一份脱敏失败合同',
)
assert.equal(benchmark.find((item) => item.id === 'sanitized-hidden-bugs-12')?.expectedRiskIds.length, 12, '脱敏失败合同应保留12个标准风险')

for (const testCase of benchmark) {
  const findings = analyzeContract(testCase.text, profile)
  const foundIds = new Set(findings.map((finding) => finding.id))
  const missing = testCase.expectedRiskIds.filter((id) => !foundIds.has(id))

  expectedTotal += testCase.expectedRiskIds.length
  matchedTotal += testCase.expectedRiskIds.length - missing.length
  if (missing.length) failures.push({ id: testCase.id, missing })

  findings.forEach((finding) => {
    assert.ok(finding.evidence && testCase.text.includes(finding.evidence), `${testCase.id}/${finding.id} 的证据必须逐字来自合同`)
    assert.ok(finding.suggestion && finding.replacement, `${testCase.id}/${finding.id} 必须给出建议和替代条款`)
  })

  if (testCase.expectedRiskIds.length === 0) {
    assert.equal(findings.length, 0, `低风险对照合同不应误报：${findings.map((item) => item.id).join(', ')}`)
  }
}

assert.deepEqual(failures, [], `存在漏检：${JSON.stringify(failures)}`)
assert.equal(matchedTotal, expectedTotal)

const first = generateSyntheticRentalContracts({ count: 3, risksPerContract: 12, seed: 20260731 })
const replay = generateSyntheticRentalContracts({ count: 3, risksPerContract: 12, seed: 20260731 })
const changed = generateSyntheticRentalContracts({ count: 3, risksPerContract: 12, seed: 20260801 })

assert.deepEqual(first, replay, '相同 seed 必须生成完全一致的合同，便于复现漏检')
assert.notDeepEqual(first, changed, '不同 seed 应生成不同合同组合')
assert.ok(first.every((item) => item.fictional && item.expectedRiskIds.length === 12), '生成合同必须标注为虚构并携带标准答案')

const hiddenFindings = analyzeContract(sanitizedHiddenBugContract.text, profile)
const hiddenSummary = getRiskSummary(hiddenFindings)
assert.ok(hiddenSummary.consistencyFindings.some((item) => item.id === 'consistency-lease-date-order'), '日期倒置应进入内部一致性提示')
assert.ok(hiddenSummary.missingFindings.some((item) => item.id === 'missing-handover-list'), '缺失交接清单应进入完整性提示')
assert.ok(hiddenFindings.some((item) => item.evidenceLocation?.line >= 1), '风险条目应提供原文行号定位')
assert.ok(hiddenFindings.every((item) => item.confidence >= 0 && item.confidence <= 1), '风险条目置信度必须在 0 到 1 之间')
assert.ok(hiddenSummary.coverage.percent >= 0 && hiddenSummary.coverage.percent <= 100, '审查覆盖率必须在 0 到 100 之间')

const contradictory = analyzeContract([
  '房屋租赁合同',
  '租赁时间：2026年2月1日—2027年1月31日，租期共计12个月。',
  '月租金2500元，补充条款月租金2800元。',
  '押金2500元，补充条款押金5000元。',
].join('\n'), profile)
const contradictorySummary = getRiskSummary(contradictory)
assert.ok(contradictorySummary.consistencyFindings.some((item) => item.id === 'consistency-lease-months') === false, '正常十二个月租期不应误报月数矛盾')
assert.ok(contradictorySummary.consistencyFindings.some((item) => item.id === 'consistency-rent-amount'), '重复月租金应被识别')
assert.ok(contradictorySummary.consistencyFindings.some((item) => item.id === 'consistency-deposit-amount'), '重复押金应被识别')
assert.ok(contradictorySummary.consistencyFindings.find((item) => item.id === 'consistency-rent-amount')?.evidence.includes('月租金2500元'), '月租金矛盾证据应包含实际金额')
assert.ok(contradictorySummary.consistencyFindings.find((item) => item.id === 'consistency-deposit-amount')?.evidence.includes('押金2500元'), '押金矛盾证据应包含实际金额')

const wrongDuration = analyzeContract('房屋租赁合同\n租赁时间：2026年2月1日—2026年5月31日，租期共计12个月。', profile)
assert.ok(getRiskSummary(wrongDuration).consistencyFindings.some((item) => item.id === 'consistency-lease-months'), '起止日期与租期月数矛盾应被识别')

const wrongDepositRatio = analyzeContract('房屋租赁合同\n月租金2000元，押金3000元，押二付一。', profile)
assert.ok(getRiskSummary(wrongDepositRatio).consistencyFindings.some((item) => item.id === 'consistency-deposit-ratio'), '押金金额与押付方式矛盾应被识别')
assert.ok(getRiskSummary(wrongDepositRatio).consistencyFindings.find((item) => item.id === 'consistency-deposit-ratio')?.evidence.includes('押金3000元'), '押付方式矛盾证据应包含押金金额')

assert.ok(reviewContractOcrText('租赁期限：2026年2月1日至2027年1月31日，月租金2000元。').ok, '完整日期和金额 OCR 文本不应产生误报')
assert.ok(reviewContractOcrText('租赁期限：日期待确认，月租金待确认。').requiresManualCheck, '关键字段缺失时 OCR 应要求人工核对')

const secondGenerationMisses = analyzeContract([
  '乙方任何情况不得提前解除租赁合同，提前搬走视为根本违约。',
  '甲方因自身卖房需求，可以单方面解除合同，仅需要提前7天通知乙方，无需支付违约金，只退还剩余房租。',
  '合同手写修改内容效力高于打印文字。',
  '双方产生纠纷，只能向甲方户籍地人民法院提起诉讼。',
  '租金逾期超过3日，甲方有权直接解除合同，押金全部没收。',
].join('\n'), profile)
const secondGenerationIds = new Set(secondGenerationMisses.map((item) => item.id))
assert.ok(secondGenerationIds.has('lease-termination-asymmetry'), '卖房单方解约与租客禁止解约应识别为权责不对等')
assert.ok(secondGenerationIds.has('lease-handwritten-overrides-printed'), '手写修改高于打印文字应单独识别')
assert.ok(secondGenerationIds.has('lease-unfavorable-jurisdiction'), '甲方户籍地法院应识别为管辖偏向')
assert.ok(secondGenerationIds.has('lease-overdue-termination-forfeiture'), '逾期三日解除并没收押金应识别为独立风险')

const thirdGenerationMisses = analyzeContract([
  '乙方任何情形不得提前解除租赁合同，主动搬离视为根本违约，剩余租金、押金全部没收。',
  '甲方因房屋出售、自用等原因收回房屋，仅需提前10日通知乙方，只退还剩余租金，无需承担任何违约金。',
  '本合同未尽事宜，以甲方口头说明为准。',
].join('\n'), profile)
const thirdGenerationIds = new Set(thirdGenerationMisses.map((item) => item.id))
assert.ok(thirdGenerationIds.has('lease-termination-asymmetry'), '房屋出售/自用单方收回与租客禁止解约应识别为权责不对等')
assert.ok(thirdGenerationIds.has('lease-oral-overrides-written'), '以甲方口头说明为准应识别为书面效力风险')

const fourthGeneration = analyzeContract([
  '租金逾期1天，增收50元滞纳金；逾期满3天，甲方有权更换门锁，合同直接终止，押金不予返还。',
  '禁止饲养任何宠物，一经发现，立刻解除租赁，押金全额没收。',
  '乙方不得留宿外人连续超过12小时，违规一次罚款100元。',
  '合同未尽事宜，按照甲方口头安排执行。',
].join('\n'), profile)
const fourthGenerationIds = new Set(fourthGeneration.map((item) => item.id))
assert.ok(fourthGenerationIds.has('lease-lockout-forfeiture'), '更换门锁并终止合同应识别为逾期强制收房风险')
assert.ok(fourthGenerationIds.has('lease-pet-forfeiture-no-cure'), '立刻解除租赁并押金全额没收应识别为宠物违约风险')
assert.ok(fourthGenerationIds.has('lease-sublet-share-overbroad'), '限制访客留宿并固定罚款应识别为居住限制风险')
assert.ok(fourthGenerationIds.has('lease-oral-overrides-written'), '按照甲方口头安排执行应识别为口头约定风险')
assert.ok(fourthGeneration.every((item) => item.evidence && /更换门锁|宠物|留宿外人|口头安排/.test(item.evidence)), '新增措辞的证据必须来自对应原文片段')

const noRentAdjustment = analyzeContract('禁止饲养宠物，一经发现押金不予返还。', profile)
assert.equal(noRentAdjustment.some((item) => item.id === 'lease-unilateral-rent-adjustment'), false, '单独出现押金不予返还不能误报为出租方单方调价')

const fifthGeneration = analyzeContract([
  '租金逾期每日收取60元违约金；逾期满4日，甲方有权强制收房，租赁合同终止，押金不予返还。',
  '房屋内设施出现故障，举证责任归于乙方，无法证明属于自然老化，则全部维修费用由乙方承担。',
  '乙方留宿访客单次不能超过20小时，每违规一次扣除押金150元。',
  '合同没有约定的事项，均以甲方口头说明为准。',
].join('\n'), profile)
const fifthGenerationIds = new Set(fifthGeneration.map((item) => item.id))
assert.ok(fifthGenerationIds.has('lease-daily-late-fee-5-percent'), '每日固定金额违约金应进入逾期责任风险')
assert.ok(fifthGenerationIds.has('lease-overdue-termination-forfeiture'), '逾期满4日收房并没收押金应被识别')
assert.ok(fifthGenerationIds.has('lease-maintenance-burden-of-proof'), '维修举证责任倒置应单独识别')
assert.ok(fifthGenerationIds.has('lease-sublet-share-overbroad'), '20小时访客限制并扣押金应被识别')
assert.equal(fifthGeneration.some((item) => item.id === 'lease-appliance-depreciation-deduction'), false, '访客扣押金不能误报为家具家电折旧')

const sixthGeneration = analyzeContract([
  '租金为甲方净收金额，房屋租赁产生的全部税费、开票费用均由乙方承担。',
  '确需转租的，必须经甲方书面同意，且乙方需向甲方支付月租金30%的转租手续费。',
  '乙方留宿外来人员单次不得超过3天，超过需经甲方书面同意，违者按每日80元标准支付房屋占用费。',
  '禁止饲养任何宠物，一经发现立即解除合同，押金全额没收，乙方还需额外支付2000元异味清除费。',
  '租赁期间甲方可根据市场情况调整租金，提前7日通知乙方后生效，乙方不同意的可自行退租，押金不予退还。',
  '本合同未尽事宜，以甲方口头通知为准，甲方口头告知的事项对乙方具有约束力。',
  '乙方欠缴任何费用超过3日的，甲方有权采取停水停电、限制入户等措施催缴。',
  '逾期支付租金超过3日，甲方有权行使留置权，处置房屋内乙方的物品抵扣欠款。',
].join('\n'), profile)
const sixthGenerationIds = new Set(sixthGeneration.map((item) => item.id))
const sixthGenerationExpectedIds = [
  'lease-rental-tax-transfer',
  'lease-sublet-extra-fee',
  'lease-visitor-occupancy-fee',
  'lease-pet-additional-penalty',
  'lease-unilateral-rent-adjustment',
  'lease-oral-overrides-written',
  'lease-self-help-utility-cutoff',
  'lease-lien-on-tenant-property',
]
for (const id of sixthGenerationExpectedIds) {
  assert.ok(sixthGenerationIds.has(id), `第六代隐藏风险应识别：${id}`)
}
expectedTotal += sixthGenerationExpectedIds.length
matchedTotal += sixthGenerationExpectedIds.filter((id) => sixthGenerationIds.has(id)).length
assert.ok(sixthGeneration.every((item) => item.evidence && /甲方|乙方/.test(item.evidence)), '第六代风险证据应来自合同原文')

const sixthGenerationControlIds = new Set(analyzeContract([
  '房屋租赁税费由双方依法各自承担，开票按有效凭证办理。',
  '乙方确需转租的，应事先取得甲方书面同意，不另收手续费。',
  '正常亲友短期探访不视为转租，不收取占用费。',
  '宠物造成实际损坏的，按有效维修票据承担费用。',
  '固定租期内租金保持不变，续租价格由双方另行协商。',
  '重要补充事项以双方书面确认内容为准。',
  '费用逾期时先书面催告，不得停水停电或限制入户。',
  '遗留物品应制作清单并通知领取，未经法定程序不得处置。',
].join('\n'), profile).map((item) => item.id))
for (const id of sixthGenerationExpectedIds) {
  assert.equal(sixthGenerationControlIds.has(id), false, `规范条款不应误报：${id}`)
}

const farApartControlIds = new Set(analyzeContract([
  '第二条：市场情况良好，周边配套逐步改善。',
  '第八条：固定租期内租金保持不变。',
  '第十二条：乙方不同意其他事项的，双方可以继续协商。',
].join('\n'), profile).map((item) => item.id))
assert.equal(farApartControlIds.has('lease-unilateral-rent-adjustment'), false, '相隔较远的市场情况、租金、不同意不能拼成单方调租风险')

const negativeClauseControlIds = new Set(analyzeContract([
  '甲方不得以催缴费用为由停水停电或限制乙方入户。',
  '遗留物品应由甲方制作清单并合理保管，不得留置、变卖或折价抵扣欠款。',
  '访客正常短期留宿不视为转租，甲方不得收取占用费。',
].join('\n'), profile).map((item) => item.id))
for (const id of ['lease-self-help-utility-cutoff', 'lease-lien-on-tenant-property', 'lease-visitor-occupancy-fee']) {
  assert.equal(negativeClauseControlIds.has(id), false, '禁止性或规范性条款不应误报：' + id)
}

const amountAudit = analyzeContract([
  '月租金2100元，押金2100元。',
  '租金逾期支付的，每逾期一日按当月租金的5%收取违约金；逾期超过3日的，甲方有权解除合同。',
  '退租时统一收取房屋深度清洁费380元、家具家电养护折旧费320元，两项费用直接从押金中扣除。',
].join('\n'), profile)
const amountSummary = getRiskSummary(amountAudit)
const amountAuditIds = new Set(amountSummary.consistencyFindings.map((item) => item.id))
assert.ok(amountAuditIds.has('amount-late-fee-percent'), '按月租比例收取每日违约金应自动核算金额和累计比例')
assert.ok(amountAuditIds.has('amount-fixed-deductions-total'), '固定清洁费和折旧费应自动汇总提示')
assert.ok(amountSummary.consistencyFindings.find((item) => item.id === 'amount-late-fee-percent')?.explanation.includes('每日约 105 元'), '月租2100元每日5%应核算为105元')

const fixedLateFeeAudit = analyzeContract('月租金1680元，押金1680元。租金逾期每日收取60元违约金；逾期满4日，押金不予退还。', profile)
assert.ok(getRiskSummary(fixedLateFeeAudit).consistencyFindings.some((item) => item.id === 'amount-late-fee-fixed'), '每日固定违约金应折算占月租比例')

const stackedPenaltyAudit = analyzeContract([
  '月租金2000元，押金2000元。',
  '乙方提前退租的，押金及剩余租金不予退还，并额外支付相当于2个月租金的违约金。',
].join('\n'), profile)
const stackedPenaltySummary = getRiskSummary(stackedPenaltyAudit)
const stackedPenaltyFinding = stackedPenaltySummary.consistencyFindings.find((item) => item.id === 'amount-penalty-stacking')
assert.ok(stackedPenaltyFinding, '押金、剩余租金和月租倍数违约金叠加时应单独提示')
assert.ok(stackedPenaltyFinding.explanation.includes('至少约 6000 元'), '已知叠加责任应计算押金与两个月违约金合计')

const dateConflictAudit = analyzeContract([
  '租赁期限：2026年9月1日至2027年8月31日。',
  '补充条款租期：2026年10月1日至2027年9月30日。',
].join('\n'), profile)
assert.ok(getRiskSummary(dateConflictAudit).consistencyFindings.some((item) => item.id === 'consistency-lease-date-conflict'), '正文和补充条款租赁日期不一致应提示')

const sameDateAudit = analyzeContract([
  '租赁期限：2026年9月1日至2027年8月31日。',
  '附件确认租期：2026年9月1日至2027年8月31日。',
].join('\n'), profile)
assert.equal(getRiskSummary(sameDateAudit).consistencyFindings.some((item) => item.id === 'consistency-lease-date-conflict'), false, '重复出现相同租期不应误报')

const compactDateAudit = analyzeContract('租赁时间：2026.09.20 — 2025.09.20，租期共计12个月。', profile)
assert.ok(getRiskSummary(compactDateAudit).consistencyFindings.some((item) => item.id === 'consistency-lease-date-order'), '点号日期和长破折号日期倒置也应识别')

const reasonablePenaltyAudit = analyzeContract('月租金2000元，押金2000元。乙方违约时押金不当然没收，违约金以实际损失为限且最高不超过当期租金20%。', profile)
assert.equal(getRiskSummary(reasonablePenaltyAudit).consistencyFindings.some((item) => item.id === 'amount-penalty-stacking'), false, '明确不没收押金且设置上限不应误报责任叠加')

const incompleteDepositAudit = analyzeContract('月租金2000元，合同到期退还押金。', profile)
assert.ok(getRiskSummary(incompleteDepositAudit).missingFindings.some((item) => item.id === 'missing-deposit-return-deadline'), '只写退还押金但没有期限时应继续提示缺失')

const completeDepositAudit = analyzeContract('月租金2000元，合同终止、费用结清并完成验收后7个工作日内退还押金。', profile)
assert.equal(getRiskSummary(completeDepositAudit).missingFindings.some((item) => item.id === 'missing-deposit-return-deadline'), false, '写明验收、结清和期限后不应误报押金期限缺失')

const grouped = groupFindingsByTheme(amountAudit)
assert.deepEqual(grouped.flatMap((group) => group.items.map((item) => item.index)).sort((a, b) => a - b), amountAudit.map((_, index) => index), '主题分组不得丢失或重复风险')
const groupedReport = createReportText({
  summary: amountSummary,
  findings: amountAudit,
  revisionItems: [],
  contractText: '测试合同正文',
  reviewProfile: profile,
})
assert.ok(groupedReport.includes('【押金与退租扣款】'), '导出报告应按风险主题分组')
assert.ok(groupedReport.includes('固定或近似固定费用合计约 700 元'), '导出报告应包含金额核算结果')

console.log(`Contract review benchmark passed: ${benchmark.length} contracts, ${matchedTotal}/${expectedTotal} expected risks recalled`)
