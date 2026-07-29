import { useEffect, useMemo, useState } from 'react'
import { Button, Picker, ScrollView, Text, Textarea, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import {
  evaluateSubsidyMatch,
  getSubsidyFreshness,
  subsidyCities,
  subsidyPolicies,
  subsidyMatchStatusLabel,
} from '../../shared/subsidyPolicies.js'
import { copyText } from '../../utils/copyText'
import { openAiTask } from '../../utils/aiTaskHandoff'
import './index.css'

const STORAGE_KEY = 'zu-xiao-shen-subsidy-matcher'
const LEGACY_DEMO_PROFILE = '我是2026年应届本科毕业生，已签劳动合同并缴纳社保，目前租房居住，本市无房。'

const STATUS_TONE = {
  satisfied: 'satisfied',
  pending: 'pending',
  unsatisfied: 'unsatisfied',
}
const STATUS_ICON = {
  satisfied: '✓',
  pending: '?',
  unsatisfied: '×',
}

function getInitialState() {
  try {
    const saved = Taro.getStorageSync(STORAGE_KEY)
    return saved && subsidyCities.includes(saved.city)
      ? { ...saved, profile: saved.profile === LEGACY_DEMO_PROFILE ? '' : String(saved.profile || '') }
      : { city: '杭州', profile: '' }
  } catch {
    return { city: '杭州', profile: '' }
  }
}

export default function SubsidyMatcher() {
  const [initial] = useState(getInitialState)
  const [city, setCity] = useState(initial.city)
  const [profile, setProfile] = useState(initial.profile)
  const hasProfile = Boolean(profile.trim())
  const matches = useMemo(() => subsidyPolicies
    .filter((item) => item.city === city)
    .map((item) => {
      const evaluation = evaluateSubsidyMatch(item, profile)
      return {
        ...item,
        matchScore: evaluation.score,
        matchStatus: evaluation.status,
        criteria: evaluation.criteria,
        freshness: getSubsidyFreshness(item.checkedAt),
      }
    })
    .sort((first, second) => {
      // 先按结构化状态排序：满足 > 待确认 > 不满足
      const order = { satisfied: 0, pending: 1, unsatisfied: 2 }
      const statusDiff = (order[first.matchStatus] ?? 3) - (order[second.matchStatus] ?? 3)
      if (statusDiff !== 0) return statusDiff
      return second.matchScore - first.matchScore
    }), [city, profile])
  const topScore = hasProfile ? (matches[0]?.matchScore || 0) : null
  const satisfiedCount = matches.filter((m) => m.matchStatus === 'satisfied').length
  const pendingCount = matches.filter((m) => m.matchStatus === 'pending').length

  useEffect(() => {
    try {
      Taro.setStorageSync(STORAGE_KEY, { city, profile })
    } catch {
      // Matching stays usable even when local storage is unavailable.
    }
  }, [city, profile])

  const copyOfficialUrl = (policy) => {
    const url = String(policy.applyUrl || policy.sourceUrl || '').trim()
    if (!/^https:\/\//i.test(url)) {
      Taro.showToast({ title: '该政策暂缺可用官网链接', icon: 'none' })
      return
    }
    copyText(url, '官网链接已复制')
  }

  const explainWithAi = () => {
    try {
      Taro.setStorageSync(STORAGE_KEY, { city, profile })
      openAiTask('subsidy')
    } catch {
      Taro.showToast({ title: '资料保存失败，请清理空间后重试', icon: 'none' })
    }
  }

  return (
    <ScrollView className='subsidy-page' scrollY>
      <View className='subsidy-hero'>
        <View><Text className='eyebrow'>补贴匹配</Text><Text className='page-title'>毕业生租房补贴线索匹配</Text><Text className='page-copy'>按城市和个人情况逐项判断满足 / 待确认 / 不满足，给出缺失条件。政策强时效，申请前请再次核对。</Text></View>
        <View className='score-box'><Text>{hasProfile ? `${topScore} 分` : '待填写'}</Text><Text>{hasProfile ? '线索参考分' : '个人情况'}</Text><Text>{city} · {matches.length} 条</Text></View>
      </View>

      <View className='panel'>
        <Text className='panel-title'>填写基础情况</Text>
        <Text className='field-label'>城市</Text>
        <Picker aria-label='选择补贴城市' range={subsidyCities} value={Math.max(0, subsidyCities.indexOf(city))} onChange={(event) => setCity(subsidyCities[Number(event.detail.value)])}>
          <View className='picker-field'>{city}<Text>⌄</Text></View>
        </Picker>
        <Text className='city-count'>已收录 {subsidyCities.length} 个城市，滚动选择更多城市</Text>
        <Text className='field-label'>个人情况</Text>
        <Textarea className='profile-input' aria-label='个人情况' name='subsidyProfile' adjustPosition cursorSpacing={20} value={profile} maxlength={500} placeholder='例如：2025 年本科毕业，已就业并连续缴纳 6 个月社保，本市无房…' onInput={(event) => setProfile(event.detail.value)} />
        <Text className={hasProfile ? 'auto-match-note' : 'profile-empty-hint'}>{hasProfile ? '修改城市或个人情况后，结果会自动更新' : '请填写真实情况后再查看匹配判断，页面不会再使用演示身份代替你。'}</Text>
        {matches.length && hasProfile ? (
          <View className='match-summary'>
            <Text className={`match-pill ${STATUS_TONE.satisfied}`}>满足 {satisfiedCount}</Text>
            <Text className={`match-pill ${STATUS_TONE.pending}`}>待确认 {pendingCount}</Text>
            <Text className={`match-pill ${STATUS_TONE.unsatisfied}`}>不满足 {matches.length - satisfiedCount - pendingCount}</Text>
          </View>
        ) : null}
        {hasProfile ? <Button className='ai-task-btn' onClick={explainWithAi}>让 AI 解释匹配结果</Button> : null}
      </View>

      <View className='panel'>
        <View className='result-head'><View><Text className='eyebrow'>官方政策</Text><Text className='panel-title'>{city}政策线索</Text></View><Text className='count'>{matches.length} 条</Text></View>
        {!matches.length ? <Text className='no-match-hint'>当前城市暂无收录线索，请前往当地人社、住建或政务服务官网查询。</Text> : null}
        {matches.map((policy) => (
          <View className='policy-card' key={`${policy.city}-${policy.policy}`}>
            <View className='policy-head'>
              <Text>{policy.type}</Text>
              <Text className={`match-status ${hasProfile ? STATUS_TONE[policy.matchStatus] : 'pending'}`}>{hasProfile ? `${subsidyMatchStatusLabel(policy.matchStatus)} · 参考 ${policy.matchScore} 分` : '填写资料后判断'}</Text>
            </View>
            <Text className='policy-title'>{policy.policy}</Text>
            <Text className='policy-amount'>{policy.amount}</Text>

            {hasProfile && policy.criteria && policy.criteria.length ? (
              <View className='criteria-list'>
                <Text className='criteria-title'>逐项判断</Text>
                {policy.criteria.map((c) => (
                  <View key={c.key} className={`criterion criterion-${c.status}`}>
                    <View className='criterion-head'>
                      <Text className={`criterion-icon criterion-icon-${c.status}`}>{STATUS_ICON[c.status]}</Text>
                      <Text className='criterion-label'>{c.label}</Text>
                      <Text className={`criterion-status criterion-status-${c.status}`}>{subsidyMatchStatusLabel(c.status)}</Text>
                    </View>
                    {c.evidence ? <Text className='criterion-evidence'>依据：{c.evidence}</Text> : null}
                    {c.missing ? <Text className='criterion-missing'>缺失：{c.missing}</Text> : null}
                  </View>
                ))}
              </View>
            ) : null}

            <View className='policy-detail'><Text>常见条件</Text><Text>{policy.condition}</Text></View>
            <View className='materials'>{policy.materials.slice(0, 6).map((item) => <Text key={item}>✓ {item}</Text>)}</View>
            <Text className={policy.freshness.stale ? 'freshness stale' : 'freshness'}>{policy.freshness.stale ? '政策可能已过期，请以官网最新页面为准' : `数据更新时间：${policy.checkedAt}（${policy.freshness.label}）`}</Text>
            <View className='policy-foot'><Text>{policy.sourceName}</Text><Button className='copy-url-btn' onClick={() => copyOfficialUrl(policy)}>复制官网链接</Button></View>
            <Text className='policy-url' userSelect>{policy.applyUrl || policy.sourceUrl}</Text>
          </View>
        ))}
        <Text className='legal-note'>提示：本页只提供官方政策线索，不构成申领资格确认。提交申请前应以官方页面和经办部门最新口径为准。</Text>
      </View>
    </ScrollView>
  )
}
