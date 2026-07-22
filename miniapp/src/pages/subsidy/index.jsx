import { useEffect, useMemo, useState } from 'react'
import { Button, Picker, ScrollView, Text, Textarea, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { getSubsidyFreshness, getSubsidyMatchScore, subsidyCities, subsidyPolicies } from '../../../../src/data/subsidyPolicies.js'
import './index.css'

const STORAGE_KEY = 'zu-xiao-shen-subsidy-matcher'
const DEFAULT_PROFILE = '我是2026年应届本科毕业生，已签劳动合同并缴纳社保，目前租房居住，本市无房。'

function getInitialState() {
  try {
    const saved = Taro.getStorageSync(STORAGE_KEY)
    return saved && subsidyCities.includes(saved.city)
      ? saved
      : { city: '杭州', profile: DEFAULT_PROFILE }
  } catch {
    return { city: '杭州', profile: DEFAULT_PROFILE }
  }
}

export default function SubsidyMatcher() {
  const [initial] = useState(getInitialState)
  const [city, setCity] = useState(initial.city)
  const [profile, setProfile] = useState(initial.profile)
  const matches = useMemo(() => subsidyPolicies
    .filter((item) => item.city === city)
    .map((item) => ({ ...item, matchScore: getSubsidyMatchScore(item, profile), freshness: getSubsidyFreshness(item.checkedAt) }))
    .sort((first, second) => second.matchScore - first.matchScore), [city, profile])
  const topScore = matches[0]?.matchScore || 0

  useEffect(() => {
    Taro.setStorageSync(STORAGE_KEY, { city, profile })
  }, [city, profile])

  const copyOfficialUrl = (policy) => {
    const url = policy.applyUrl || policy.sourceUrl
    Taro.setClipboardData({
      data: url,
      success: () => Taro.showModal({ title: '官方入口已复制', content: '请粘贴到微信或浏览器打开，提交前核对最新政策口径。', showCancel: false }),
    })
  }

  return (
    <ScrollView className='subsidy-page' scrollY>
      <View className='subsidy-hero'>
        <View><Text className='eyebrow'>补贴匹配</Text><Text className='page-title'>毕业生租房补贴线索匹配</Text><Text className='page-copy'>按城市和个人情况筛选官方补贴入口，政策强时效，申请前请再次核对。</Text></View>
        <View className='score-box'><Text>{topScore}%</Text><Text>最高匹配度</Text><Text>{city} · {matches.length} 条</Text></View>
      </View>

      <View className='panel'>
        <Text className='panel-title'>填写基础情况</Text>
        <Text className='field-label'>城市</Text>
        <Picker range={subsidyCities} value={Math.max(0, subsidyCities.indexOf(city))} onChange={(event) => setCity(subsidyCities[Number(event.detail.value)])}>
          <View className='picker-field'>{city}<Text>⌄</Text></View>
        </Picker>
        <Text className='field-label'>个人情况</Text>
        <Textarea className='profile-input' value={profile} maxlength={500} onInput={(event) => setProfile(event.detail.value)} />
        <Button className='primary-button' onClick={() => Taro.showToast({ title: `已匹配 ${matches.length} 条线索`, icon: 'success' })}>匹配补贴线索</Button>
      </View>

      <View className='panel'>
        <View className='result-head'><View><Text className='eyebrow'>官方政策</Text><Text className='panel-title'>{city}政策线索</Text></View><Text className='count'>{topScore}%</Text></View>
        {matches.map((policy) => (
          <View className='policy-card' key={`${policy.city}-${policy.policy}`} onClick={() => copyOfficialUrl(policy)}>
            <View className='policy-head'><Text>{policy.type}</Text><Text>{policy.matchScore}%</Text></View>
            <Text className='policy-title'>{policy.policy}</Text>
            <Text className='policy-amount'>{policy.amount}</Text>
            <View className='policy-detail'><Text>常见条件</Text><Text>{policy.condition}</Text></View>
            <View className='materials'>{policy.materials.slice(0, 6).map((item) => <Text key={item}>✓ {item}</Text>)}</View>
            <Text className={policy.freshness.stale ? 'freshness stale' : 'freshness'}>{policy.freshness.stale ? '政策可能已过期，请以官网最新页面为准' : `数据更新时间：${policy.checkedAt}（${policy.freshness.label}）`}</Text>
            <View className='policy-foot'><Text>{policy.sourceName}</Text><Text>复制官网入口 →</Text></View>
          </View>
        ))}
        <Text className='legal-note'>提示：本页只提供官方政策线索，不构成申领资格确认。提交申请前应以官方页面和经办部门最新口径为准。</Text>
      </View>
    </ScrollView>
  )
}
