import { useEffect, useMemo, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { STORAGE_KEYS } from '../constants/appConfig.js'
import { getSubsidyMatchScore, subsidyCities, subsidyPolicies } from '../data/subsidyPolicies.js'
import { loadSubsidyMatcherState } from '../features/subsidyMatcher.js'

export default function SubsidyMatcher({ onStatus }) {
  const [initialState] = useState(() => loadSubsidyMatcherState())
  const [city, setCity] = useState(initialState.city)
  const [profile, setProfile] = useState(initialState.profile)
  const selectedPolicies = useMemo(() => subsidyPolicies.filter((item) => item.city === city), [city])
  const policyMatches = useMemo(
    () =>
      selectedPolicies
        .map((policy) => ({
          ...policy,
          matchScore: getSubsidyMatchScore(policy, profile),
        }))
        .sort((a, b) => b.matchScore - a.matchScore),
    [profile, selectedPolicies],
  )
  const matchScore = policyMatches[0]?.matchScore || 0

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.subsidyMatcher, JSON.stringify({ city, profile }))
  }, [city, profile])

  const matchPolicy = () => {
    onStatus(`已匹配${city}${policyMatches.length}条官方补贴/安居线索，最高匹配度 ${matchScore}%`)
  }

  return (
    <div className="subsidy-layout">
      <section className="work-panel subsidy-hero">
        <div>
          <p className="section-kicker">Rental Subsidy</p>
          <h2>毕业生租房补贴线索匹配</h2>
          <p>按城市和个人情况快速整理可能相关的租房补贴入口。政策口径会变化，正式申请前仍需以官方最新发布为准。</p>
        </div>
        <div className={`evidence-score ${matchScore >= 80 ? 'safe' : matchScore >= 65 ? 'warning' : 'danger'}`}>
          <strong>{matchScore}%</strong>
          <span>最高匹配度</span>
          <em>{city} · {policyMatches.length}条</em>
        </div>
      </section>

      <section className="work-panel subsidy-panel">
        <div className="panel-head">
          <div>
            <h2>填写基础情况</h2>
            <p>选择城市后只展示该城市政策线索，避免杭州页面混入其他地区。</p>
          </div>
          <button className="primary-button compact-button" type="button" onClick={matchPolicy}>
            <Search size={15} aria-hidden="true" />
            匹配补贴线索
          </button>
        </div>
        <div className="config-grid">
          <label className="field">
            <span>城市</span>
            <select value={city} onChange={(event) => setCity(event.target.value)}>
              {subsidyCities.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="field subsidy-profile-field">
            <span>个人情况</span>
            <textarea value={profile} onChange={(event) => setProfile(event.target.value)} />
          </label>
        </div>
      </section>

      <section className="work-panel subsidy-result-panel">
        <div className="panel-head compact">
          <div>
            <h2>{city}官方政策卡片</h2>
            <p>当前只显示所选城市。每张卡片都绑定官方来源，点击卡片可跳转到政策官网或申报入口。</p>
          </div>
          <span className="knowledge-count">{matchScore}%</span>
        </div>
        <div className="subsidy-result-grid">
          {policyMatches.map((policy) => (
            <a className="subsidy-policy-card" href={policy.applyUrl || policy.sourceUrl} key={`${policy.city}-${policy.policy}`} target="_blank" rel="noreferrer">
              <div className="subsidy-card-head">
                <span>{policy.type}</span>
                <em>{policy.matchScore}%</em>
              </div>
              <strong>{policy.policy}</strong>
              <p>{policy.amount}</p>
              <dl>
                <div>
                  <dt>常见条件</dt>
                  <dd>{policy.condition}</dd>
                </div>
                <div>
                  <dt>官方依据</dt>
                  <dd>{policy.sourceName} · 核对 {policy.checkedAt}</dd>
                </div>
              </dl>
              <div className="subsidy-materials">
                {policy.materials.slice(0, 6).map((item) => (
                  <span key={item}>
                    <Check size={14} aria-hidden="true" />
                    {item}
                  </span>
                ))}
              </div>
              <div className="subsidy-card-foot">
                <span>{policy.status}</span>
                <strong>打开官网 →</strong>
              </div>
            </a>
          ))}
        </div>
        <div className="footer-note">
          提示：补贴政策属于强时效信息。本页只收录已绑定官方链接的政策卡片，提交申请前仍应以跳转后的官方页面、申报系统和经办部门最新口径为准。
        </div>
      </section>
    </div>
  )
}

