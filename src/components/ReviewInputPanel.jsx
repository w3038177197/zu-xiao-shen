import { Bot, ClipboardCheck, FileText, RefreshCw, Scale, Sparkles, UploadCloud } from 'lucide-react'
import { demoContracts } from '../data/demoContracts.js'
import { contractTypeOptions, partyRoleOptions, reviewDepthOptions } from '../constants/reviewOptions.js'
import { getContractTypeLabel } from '../features/contractReview.js'

export default function ReviewInputPanel({
  contractText,
  effectiveReviewProfile,
  handleContractFileChange,
  handleContractFileDrop,
  handleContractTextChange,
  importedConfidence,
  importedContractMeta,
  importedIsOcr,
  importedNeedsManualCheck,
  isImportingContract,
  isReviewing,
  loadDemoContract,
  onClearImportMeta,
  resetContractText,
  reviewProfile,
  reviewText,
  selectedDemoContract,
  selectedDemoContractId,
  setSelectedDemoContractId,
  startReview,
  updateReviewProfile,
}) {
  return (
    <section className="work-panel input-panel">
      <div className="panel-head">
        <div>
          <h2>租房合同输入</h2>
          <p>粘贴租房合同或载入示例合同，系统会优先按租客视角严格审查。</p>
        </div>
        <span>{contractText.length} 字</span>
      </div>

      <label
        className={`upload-drop ${isImportingContract ? 'importing' : ''}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleContractFileDrop}
      >
        <UploadCloud size={24} aria-hidden="true" />
        <strong>{isImportingContract ? '正在解析合同...' : '拖入 PDF / Word / 图片租房合同'}</strong>
        <span>支持 TXT、MD、DOCX、PDF 和图片 OCR，导入后会写入下方合同正文</span>
        <input
          accept=".txt,.md,.docx,.pdf,image/*"
          aria-label="上传合同"
          disabled={isImportingContract}
          onChange={handleContractFileChange}
          type="file"
        />
      </label>

      {importedContractMeta && (
        <div className={`contract-import-card ${importedNeedsManualCheck ? 'needs-check' : ''}`} aria-label="已导入合同状态">
          <div className="contract-import-head">
            <span className="contract-import-icon">
              <FileText size={18} aria-hidden="true" />
            </span>
            <div>
              <strong>已导入：{importedContractMeta.name}</strong>
              <p>
                {importedNeedsManualCheck
                  ? 'OCR 识别结果需要人工核对，确认正文无误后再进入审查。'
                  : '合同正文已写入编辑区，可以直接开始审查。'}
              </p>
            </div>
          </div>
          <dl className="contract-import-meta">
            <div>
              <dt>来源</dt>
              <dd>{importedContractMeta.source}</dd>
            </div>
            <div>
              <dt>字数</dt>
              <dd>{importedContractMeta.size} 字</dd>
            </div>
            {importedIsOcr && (
              <div>
                <dt>OCR 置信度</dt>
                <dd>{importedConfidence}%</dd>
              </div>
            )}
          </dl>
          {importedIsOcr && (
            <p className="contract-import-note">
              {importedNeedsManualCheck
                ? '图片合同可能存在漏字、错字或换行错位，请先对照原图检查金额、日期、押金和解除条款。'
                : '图片 OCR 结果可信度较高，仍建议快速核对金额、日期和押金条款。'}
            </p>
          )}
          <div className="contract-import-actions">
            <button className="primary-button compact-button" type="button" onClick={startReview} disabled={isReviewing || !reviewText.trim()}>
              {isReviewing ? <RefreshCw className="spin-icon" size={15} aria-hidden="true" /> : <Bot size={15} aria-hidden="true" />}
              {isReviewing ? '审查中...' : '开始审查这份合同'}
            </button>
            {importedIsOcr && (
              <button className="ghost-button compact-button" type="button" onClick={onClearImportMeta}>
                我已核对正文
              </button>
            )}
          </div>
        </div>
      )}

      <div className="review-profile" aria-label="租房合同审查画像">
        <label>
          <span>合同类型</span>
          <select value={reviewProfile.contractType} onChange={(event) => updateReviewProfile('contractType', event.target.value)}>
            {contractTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>我方身份</span>
          <select value={reviewProfile.partyRole} onChange={(event) => updateReviewProfile('partyRole', event.target.value)}>
            {partyRoleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>审查强度</span>
          <select value={reviewProfile.reviewDepth} onChange={(event) => updateReviewProfile('reviewDepth', event.target.value)}>
            {reviewDepthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="detected-type">
        <span>当前知识库</span>
        <strong>{getContractTypeLabel(effectiveReviewProfile.contractType)}</strong>
        {reviewProfile.contractType === 'auto' && <em>自动识别</em>}
      </div>

      <div className={`demo-contract-picker ${contractText.trim() ? '' : 'empty'}`} aria-label="演示合同模板">
        <div className="demo-contract-copy">
          <FileText size={18} aria-hidden="true" />
          <div>
            <strong>{contractText.trim() ? '演示合同模板' : '合同已清空，可载入演示合同'}</strong>
            <span>{selectedDemoContract.description}</span>
          </div>
        </div>
        <div className="demo-contract-controls">
          <label>
            <span>模板</span>
            <select value={selectedDemoContractId} onChange={(event) => setSelectedDemoContractId(event.target.value)}>
              {demoContracts.map((contract) => (
                <option key={contract.id} value={contract.id}>
                  {contract.title}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-button compact-button" type="button" onClick={() => loadDemoContract()}>
            <Sparkles size={15} aria-hidden="true" />
            载入演示合同
          </button>
        </div>
        <div className="demo-contract-list">
          {demoContracts.map((contract) => (
            <button
              className={contract.id === selectedDemoContractId ? 'active' : ''}
              key={contract.id}
              type="button"
              onClick={() => loadDemoContract(contract)}
            >
              <strong>{contract.title}</strong>
              <span>{contract.tag}</span>
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={contractText}
        onChange={(event) => handleContractTextChange(event.target.value)}
        placeholder="在这里粘贴租房合同正文，系统会自动识别押金、涨租、维修、解除等风险条款..."
      />

      <div className="input-actions">
        <button className="ghost-button" type="button" onClick={() => resetContractText('')}>
          清空
        </button>
        <button className="primary-button" type="button" onClick={startReview} disabled={isReviewing}>
          {isReviewing ? <RefreshCw className="spin-icon" size={17} aria-hidden="true" /> : <Bot size={17} aria-hidden="true" />}
          {isReviewing ? '审查中...' : '开始审查'}
        </button>
      </div>

      <div className="review-scope" aria-label="审查范围">
        <div className="scope-chip">
          <ClipboardCheck size={17} aria-hidden="true" />
          <div>
            <strong>租房条款筛选</strong>
            <span>押金、涨租、维修</span>
          </div>
        </div>
        <div className="scope-chip">
          <Scale size={17} aria-hidden="true" />
          <div>
            <strong>风险定级</strong>
            <span>高、中、低风险</span>
          </div>
        </div>
        <div className="scope-chip">
          <FileText size={17} aria-hidden="true" />
          <div>
            <strong>谈判输出</strong>
            <span>替代条款和话术</span>
          </div>
        </div>
      </div>
    </section>
  )
}
