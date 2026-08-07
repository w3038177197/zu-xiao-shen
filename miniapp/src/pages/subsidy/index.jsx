import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Input, ScrollView, Text, Textarea, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import {
  evaluateSubsidyMatch,
  getSubsidyFreshness,
  subsidyCities,
  subsidyPolicies,
  subsidyMatchStatusLabel,
} from '../../shared/subsidyPolicies.js'
import { buildLocalReply, formatMessageBlocks, loadAllModuleContext } from '../../features/aiAssistant'
import { AI_TASK_PRESETS, buildRemoteAiPayload } from '../../features/remoteAi'
import { REMOTE_AI_CONFIG } from '../../constants/appConfig'
import { copyText } from '../../utils/copyText'
import { confirmRemoteConsent, fetchRemoteSubsidyPolicies, getRemoteAiError, startRemoteAiRequest } from '../../utils/remoteAiRequest'
import { hasHouseSwitchedSince } from '../../features/houseProfile'
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

function detectProfileCities(text) {
  const value = String(text || '')
  if (!value.trim()) return []
  return subsidyCities.filter((item) => value.includes(item) || value.includes(`${item}市`))
}

function formatGeneratedAt(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '刚刚' : date.toLocaleString('zh-CN')
}

function getFirstFailedCriterion(policy) {
  return policy.criteria?.find((item) => item.status === 'unsatisfied')
}

function getPolicyStatusText(policy, hasProfile) {
  if (!hasProfile && policy.matchStatus !== 'unsatisfied') return '填写资料后判断'
  const label = subsidyMatchStatusLabel(policy.matchStatus)
  if (policy.matchStatus !== 'unsatisfied') return label
  const failed = getFirstFailedCriterion(policy)
  return failed?.label ? `${label}：${failed.label}` : label
}

function getInitialState() {
  try {
    const saved = Taro.getStorageSync(STORAGE_KEY)
    const savedCity = String(saved?.city || '').trim().replace(/市$/, '')
    return saved && subsidyCities.includes(savedCity)
      ? { ...saved, city: savedCity, profile: saved.profile === LEGACY_DEMO_PROFILE ? '' : String(saved.profile || '') }
      : { city: '杭州', profile: '' }
  } catch {
    return { city: '杭州', profile: '' }
  }
}

function formatRefreshInterval(hours) {
  const value = Number(hours) || 24
  if (value === 24) return '每天'
  if (value === 168) return '每周'
  if (value % 24 === 0) return `每 ${value / 24} 天`
  return `每 ${value} 小时`
}

export default function SubsidyMatcher() {
  const [initial] = useState(getInitialState)
  const [city, setCity] = useState(initial.city)
  const [cityQuery, setCityQuery] = useState(initial.city)
  const [showCityResults, setShowCityResults] = useState(false)
  const [profile, setProfile] = useState(initial.profile)
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState(null)
  const [aiError, setAiError] = useState(null)
  const [isAiExpanded, setIsAiExpanded] = useState(false)
  const [profileFocus, setProfileFocus] = useState(false)
  const [remotePolicies, setRemotePolicies] = useState([])
  const [policySync, setPolicySync] = useState({ loading: true, generatedAt: '', failed: false, refreshIntervalHours: 24 })
  const pendingAiRef = useRef(null)
  const aiRunRef = useRef(0)
  const loadedAtRef = useRef(Date.now())
  const hasProfile = Boolean(profile.trim())
  const citySuggestions = useMemo(() => {
    const query = cityQuery.trim().replace(/市$/, '')
    return subsidyCities.filter((item) => {
      if (!query) return true
      const searchText = subsidyPolicies
        .filter((policy) => policy.city === item)
        .flatMap((policy) => [policy.city, policy.policy, policy.type, policy.status, ...(policy.keywords || [])])
        .join(' ')
      return searchText.includes(query)
    }).slice(0, 12)
  }, [cityQuery])
  const policies = remotePolicies.length ? remotePolicies : subsidyPolicies
  const matches = useMemo(() => policies
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
    }), [city, policies, profile])
  const topScore = hasProfile ? (matches[0]?.matchScore || 0) : null
  const satisfiedCount = matches.filter((m) => m.matchStatus === 'satisfied').length
  const pendingCount = matches.filter((m) => m.matchStatus === 'pending').length
  const profileCities = useMemo(() => detectProfileCities(profile), [profile])
  const conflictCity = hasProfile ? profileCities.find((item) => item !== city) : ''
  const topStatus = matches[0]?.matchStatus
  const heroPrimary = !hasProfile ? '待填写' : !matches.length ? '暂无政策' : conflictCity ? '不满足' : subsidyMatchStatusLabel(topStatus)
  const heroSecondary = !hasProfile ? '个人情况' : conflictCity ? '城市不一致' : matches.length ? `参考匹配度 ${topScore} 分` : '官方线索'

  useEffect(() => {
    try {
      Taro.setStorageSync(STORAGE_KEY, { city, profile })
    } catch {
      // Matching stays usable even when local storage is unavailable.
    }
  }, [city, profile])

  useDidShow(() => {
    if (!hasHouseSwitchedSince(loadedAtRef.current)) return
    const fresh = getInitialState()
    setCity(fresh.city)
    setCityQuery(fresh.city)
    setProfile(fresh.profile)
    setAiAnalysis(null)
    setAiError(null)
    setIsAiAnalyzing(false)
    aiRunRef.current += 1
    pendingAiRef.current?.cancel()
    loadedAtRef.current = Date.now()
  })

  useEffect(() => {
    let active = true
    setRemotePolicies([])
    setPolicySync((prev) => ({ ...prev, loading: true, generatedAt: '', failed: false }))
    fetchRemoteSubsidyPolicies(city).then((result) => {
      if (!active) return
      setRemotePolicies(result.policies)
      setPolicySync({ loading: false, generatedAt: result.generatedAt || '', failed: false, refreshIntervalHours: Number(result.refreshIntervalHours) || 24 })
    }).catch(() => {
      if (active) setPolicySync((prev) => ({ ...prev, loading: false, generatedAt: '', failed: true }))
    })
    return () => { active = false }
  }, [city])

  const selectCity = (nextCity) => {
    setCity(nextCity)
    setCityQuery(nextCity)
    setShowCityResults(false)
  }

  useEffect(() => () => {
    aiRunRef.current += 1
    pendingAiRef.current?.cancel()
  }, [])

  useEffect(() => {
    aiRunRef.current += 1
    pendingAiRef.current?.cancel()
    pendingAiRef.current = null
    setIsAiAnalyzing(false)
    setAiAnalysis(null)
    setAiError(null)
    setIsAiExpanded(false)
  }, [city, profile])

  const copyOfficialUrl = (policy) => {
    const url = String(policy.applyUrl || policy.sourceUrl || '').trim()
    if (!/^https:\/\//i.test(url)) {
      Taro.showToast({ title: '该政策暂缺可用官网链接', icon: 'none' })
      return
    }
    copyText(url, '官网链接已复制')
  }

  const explainWithAi = async (force = false) => {
    if (isAiAnalyzing) return
    try {
      Taro.setStorageSync(STORAGE_KEY, { city, profile })
    } catch {
      Taro.showToast({ title: '资料保存失败，请清理空间后重试', icon: 'none' })
      return
    }

    const prompt = AI_TASK_PRESETS.subsidy.prompt
    const context = loadAllModuleContext()
    const runId = ++aiRunRef.current
    const showLocalAnalysis = (meta) => {
      if (runId !== aiRunRef.current) return
      setAiAnalysis({
        reply: buildLocalReply({ prompt, context }),
        meta,
        citations: [],
      })
    }

    setIsAiAnalyzing(true)
    setAiError(null)
    setIsAiExpanded(false)
    if (!REMOTE_AI_CONFIG.enabled) {
      showLocalAnalysis('本地分析')
      setIsAiAnalyzing(false)
      return
    }

    try {
      if (!await confirmRemoteConsent()) {
        showLocalAnalysis('本地分析')
        return
      }
      if (runId !== aiRunRef.current) return
      const payload = buildRemoteAiPayload({ prompt, context, selectedModules: ['subsidy'] })
      const request = startRemoteAiRequest(payload, { force })
      pendingAiRef.current = request
      const result = await request.promise
      if (runId !== aiRunRef.current) return
      setAiAnalysis({ reply: result.reply, meta: 'AI生成 · 联网', citations: result.citations })
    } catch (error) {
      const detail = getRemoteAiError(error)
      if (detail.cancelled || runId !== aiRunRef.current) return
      showLocalAnalysis('本地降级')
      setAiError({
        message: detail.code === 'quota' ? '今日联网额度已用完，已显示本地分析' : `${detail.message}，已显示本地分析`,
        retryable: detail.retryable,
      })
    } finally {
      if (runId === aiRunRef.current) {
        pendingAiRef.current = null
        setIsAiAnalyzing(false)
      }
    }
  }

  return (
    <ScrollView className='subsidy-page' scrollY>
      <View className='card subsidy-hero'>
        <View><Text className='eyebrow'>补贴匹配</Text><Text className='page-title'>毕业生租房补贴线索匹配</Text><Text className='body-text'>按城市和个人情况逐项判断满足 / 待确认 / 不满足，给出缺失条件。政策强时效，申请前请再次核对。</Text></View>
        <View className={`score-box score-box-${conflictCity ? 'unsatisfied' : topStatus || 'pending'}`}><Text>{heroPrimary}</Text><Text>{heroSecondary}</Text><Text>{city} · {matches.length} 条</Text></View>
      </View>

      <View className='card panel'>
        <Text className='section-title'>填写基础情况</Text>
        <Text className='field-label'>城市</Text>
        <View className='city-search'>
          <Input className='city-search-input' aria-label='搜索城市' value={cityQuery} maxlength={30} placeholder='输入城市关键词，例如：贵阳' onFocus={() => setShowCityResults(true)} onInput={(event) => { setCityQuery(event.detail.value); setShowCityResults(true) }} />
          {cityQuery ? <Button className='city-search-clear' aria-label='清空城市关键词' onClick={() => { setCityQuery(''); setShowCityResults(true) }}>×</Button> : null}
        </View>
        {showCityResults ? (
          <View className='city-search-results'>
            {citySuggestions.map((item) => (
              <Button className={item === city ? 'city-result is-selected' : 'city-result'} key={item} onClick={() => selectCity(item)}>
                <Text>{item}</Text><Text>已收录政策</Text>
              </Button>
            ))}
            {!citySuggestions.length ? <Text className='city-search-empty'>未找到该城市，请检查关键词</Text> : null}
          </View>
        ) : null}
        <Text className='city-count'>当前选择：{city}。可搜索 {subsidyCities.length} 个已收录政策城市。</Text>
        <Text className='field-label'>个人情况</Text>
        <Textarea className='profile-input' aria-label='个人情况' name='subsidyProfile' adjustPosition cursorSpacing={20} focus={profileFocus} value={profile} maxlength={500} placeholder='例如：2025 年本科毕业，已就业并连续缴纳 6 个月社保，本市无房…' onBlur={() => setProfileFocus(false)} onInput={(event) => setProfile(event.detail.value)} />
        <Text className={hasProfile ? 'auto-match-note' : 'profile-empty-hint'}>{hasProfile ? '修改城市或个人情况后，结果会自动更新' : '请填写真实情况后再查看匹配判断，页面不会再使用演示身份代替你。'}</Text>
        {conflictCity ? (
          <View className='city-conflict-card'>
            <Text className='city-conflict-title'>识别到城市不一致</Text>
            <Text className='city-conflict-copy'>当前选择：{city}；个人情况里提到：{conflictCity}。请确认以哪个城市为准。</Text>
            <View className='city-conflict-actions'>
              <Button onClick={() => selectCity(conflictCity)}>改为{conflictCity}重新匹配</Button>
              <Button onClick={() => setProfileFocus(true)}>保留{city}，修改个人情况</Button>
            </View>
          </View>
        ) : null}
        {matches.length && hasProfile ? (
          <View className='match-summary'>
            <Text className={`match-pill ${STATUS_TONE.satisfied}`}>满足 {satisfiedCount}</Text>
            <Text className={`match-pill ${STATUS_TONE.pending}`}>待确认 {pendingCount}</Text>
            <Text className={`match-pill ${STATUS_TONE.unsatisfied}`}>不满足 {matches.length - satisfiedCount - pendingCount}</Text>
          </View>
        ) : null}
        {hasProfile && matches.length ? <Button className='ai-task-btn' disabled={isAiAnalyzing} onClick={() => explainWithAi()}>{isAiAnalyzing ? '正在生成申请建议…' : '生成申请建议'}</Button> : null}
        {isAiAnalyzing || aiAnalysis ? (
          <View className='inline-ai-panel'>
            <View className='inline-ai-head'><Text>AI 匹配解释</Text><Text>{isAiAnalyzing ? '分析中' : aiAnalysis?.meta}</Text></View>
            {isAiAnalyzing ? <Text className='inline-ai-loading'>正在结合当前资料生成解释…</Text> : null}
            {aiAnalysis ? (
              <View className={`inline-ai-content ${!isAiExpanded && aiAnalysis.reply.length > 280 ? 'is-collapsed' : ''}`}>
                {formatMessageBlocks(aiAnalysis.reply).map((block, index) => (
                  <View className='inline-ai-block' key={`${block.title}-${index}`}>
                    {block.title ? <Text className='inline-ai-title'>{block.title}</Text> : null}
                    {block.lines.map((line, lineIndex) => <Text className='inline-ai-text' userSelect key={`${index}-${lineIndex}`}>{line}</Text>)}
                  </View>
                ))}
              </View>
            ) : null}
            {aiAnalysis?.reply?.length > 280 ? (
              <Button className='inline-ai-toggle' aria-label={isAiExpanded ? '收起完整分析' : '查看完整分析'} onClick={() => setIsAiExpanded((value) => !value)}>
                {isAiExpanded ? '收起完整分析' : '查看完整分析'}
              </Button>
            ) : null}
            {aiError ? <View className='inline-ai-error'><Text>{aiError.message}</Text>{aiError.retryable ? <Button disabled={isAiAnalyzing} onClick={() => explainWithAi(true)}>重试联网</Button> : null}</View> : null}
            {aiAnalysis?.citations?.length ? <Text className='inline-ai-notice'>政策资格和申报时间仍以本页官方链接及经办部门最新口径为准。</Text> : null}
          </View>
        ) : null}
      </View>

      <View className='card panel'>
        <View className='result-head'><View><Text className='eyebrow'>官方政策</Text><Text className='section-title'>{city}政策线索</Text></View><Text className='count'>{matches.length} 条</Text></View>
        {matches.length ? <Text className={policySync.failed ? 'freshness stale' : 'freshness'}>{policySync.loading ? '正在检查官网…' : policySync.failed ? '官网核验暂不可用 · 已显示人工核对版本' : `官网已核验 · ${formatGeneratedAt(policySync.generatedAt)}`}</Text> : null}
        {!matches.length ? <Text className='no-match-hint'>当前城市暂无收录线索，请前往当地人社、住建或政务服务官网查询。</Text> : null}
        {matches.map((policy) => (
          <View className='policy-card' key={`${policy.city}-${policy.policy}`}>
            <View className='policy-head'>
              <Text>{policy.type}</Text>
              <View className='match-status-wrap'>
                <Text className={`match-status ${hasProfile || policy.matchStatus === 'unsatisfied' ? STATUS_TONE[policy.matchStatus] : 'pending'}`}>{getPolicyStatusText(policy, hasProfile)}</Text>
                {hasProfile || policy.matchStatus === 'unsatisfied' ? <Text className='match-score-note'>参考匹配度 {policy.matchScore} 分</Text> : null}
              </View>
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

            {hasProfile && policy.matchStatus === 'unsatisfied' ? (
              <View className='next-steps'>
                <Text>下一步建议</Text>
                {conflictCity ? (
                  <>
                    <Text>如果实际申请 {conflictCity} 补贴，请切换到 {conflictCity} 重新匹配。</Text>
                    <Text>如果要看 {city} 政策，请把个人情况中的 {conflictCity} 改为 {city}，并补充当地就业、租住、无房情况。</Text>
                  </>
                ) : (
                  <>
                    <Text>先补齐上方“不满足 / 待确认”的条件，再核对官网申报入口。</Text>
                    <Text>提交前以官网最新办事指南和经办部门口径为准。</Text>
                  </>
                )}
              </View>
            ) : null}

            <View className='policy-detail'><Text>常见条件</Text><Text>{policy.condition}</Text></View>
            <View className='materials'><Text className='materials-title'>需准备材料</Text>{policy.materials.slice(0, 6).map((item) => <Text key={item}>{item}</Text>)}</View>
            <Text className={policy.liveReview?.mayHaveChanged || policy.freshness.stale ? 'freshness stale' : 'freshness'}>{policy.liveReview?.mayHaveChanged ? '官网页面在人工核对后有更新，请打开官网确认最新条件' : policy.liveReview?.status === 'available' ? `官网可访问 · 政策内容人工核对于 ${policy.checkedAt}` : policy.freshness.label}</Text>
            <View className='policy-foot'><Text>{policy.sourceName}</Text><Button className='copy-url-btn' onClick={() => copyOfficialUrl(policy)}>复制官网链接</Button></View>
            <Text className='policy-url' userSelect>{policy.applyUrl || policy.sourceUrl}</Text>
          </View>
        ))}
        <Text className='legal-note'>提示：本页只提供官方政策线索，不构成申领资格确认。提交申请前应以官方页面和经办部门最新口径为准。</Text>
      </View>
      <View className='scroll-bottom-spacer' />
    </ScrollView>
  )
}
