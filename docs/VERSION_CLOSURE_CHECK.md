# 租小审版本收口检查

检查日期：2026-08-05

## 当前结论

- 当前工作区不是小补丁，而是多批产品级改动叠加；提交前必须以 `git status --short` 当前输出为准分组确认。
- 本轮包含源码、测试、文档和已归档设计预览产物；提交前不能只看 `git diff`。
- 本地完整验证通过，官方 npm 源生产依赖审计通过。
- 生产发布仍卡在三件事：Redis 持久化、微信后台隐私指引终核、iPhone + Android 真机回归。

## 必须纳入本轮的源码和测试

这些文件属于当前功能闭环的一部分，漏掉会导致功能、测试或文档断链：

- package.json
- .env.example
- server/ai-proxy.mjs
- server/miniapp-ai.mjs
- server/rag-engine.mjs
- server/evaluate-rag.mjs
- server/data/legal-knowledge.mjs
- server/data/ai-eval-cases.mjs
- miniapp/src/app.config.js
- miniapp/src/app.css
- miniapp/src/constants/appConfig.js
- miniapp/src/features/aiAssistant.js
- miniapp/src/features/houseProfile.js
- miniapp/src/features/remoteAi.js
- miniapp/src/features/workflowContext.js
- miniapp/src/shared/knowledgeBase.js
- miniapp/src/utils/localDataManager.js
- miniapp/src/utils/evidencePackageExport.js
- miniapp/src/utils/remoteAiRequest.js
- miniapp/src/utils/textFileExport.js
- miniapp/src/pages/index/index.jsx
- miniapp/src/pages/index/index.css
- miniapp/src/pages/ai/index.jsx
- miniapp/src/pages/ai/index.css
- miniapp/src/pages/contract/index.jsx
- miniapp/src/pages/contract/index.css
- miniapp/src/pages/checkin/index.jsx
- miniapp/src/pages/checkin/index.css
- miniapp/src/pages/evidence/index.jsx
- miniapp/src/pages/evidence/index.css
- miniapp/src/pages/subsidy/index.jsx
- miniapp/src/pages/subsidy/index.css
- src/data/knowledgeBase.js
- scripts/check-miniapp-core.mjs
- scripts/test-miniapp-ai.mjs
- scripts/test-miniapp-reliability.mjs
- scripts/test-miniapp-http.mjs
- scripts/test-subsidy-review.mjs
- scripts/review-subsidy-policies.mjs
- scripts/smoke-miniapp.mjs

## 必须纳入本轮的文档

- HANDOFF.md
- README.md
- OPTIMIZATION_ROADMAP.md
- docs/TRAE_BACKLOG.md
- docs/redis-persistence-verification.md
- docs/VERSION_CLOSURE_CHECK.md
- miniapp/docs/ai-remote-plan.md
- miniapp/docs/manual-smoke-checklist.md

## 已归档的设计预览产物

这些是 UI 设计预览，不参与构建或测试；已归档到 `docs/design/`，作为设计资料随文档提交。

- TRAE-租小审-创意产物.html，约 35 KB（已移至 docs/design/）
- zu-xiao-shen-miniapp-ui-preview.html，约 56 KB（已移至 docs/design/）
- zu-xiao-shen-miniapp-ui-preview.png，约 263 KB（已移至 docs/design/）
- zu-xiao-shen-miniapp-ui.design，约 2 KB（已移至 docs/design/）

## 建议提交批次

如果要拆提交，建议按下面切：

1. 后端安全与联网 AI：server/、scripts/test-miniapp-http.mjs、scripts/test-miniapp-ai.mjs。
2. RAG 知识库：server/data/、server/evaluate-rag.mjs、server/rag-engine.mjs、src/data/knowledgeBase.js、miniapp/src/shared/knowledgeBase.js。
3. 小程序体验与 UI：miniapp/src/pages/、miniapp/src/app.css、miniapp/src/app.config.js、miniapp/src/constants/appConfig.js。
4. 本地数据、房源档案与备份：miniapp/src/features/houseProfile.js、miniapp/src/utils/localDataManager.js、miniapp/src/utils/evidencePackageExport.js、相关可靠性测试。
5. 补贴复核：scripts/review-subsidy-policies.mjs、scripts/test-subsidy-review.mjs、package.json。
6. 交付文档：README.md、HANDOFF.md、miniapp/docs/、docs/。

## 发布前阻塞项

- 微信云托管配置 Redis REST 后重新部署，并用生产验收模式检查。
- 微信公众平台后台隐私指引终核。
- iPhone + Android 真机回归。
- 任何 server/ 改动上线前都必须重新部署微信云托管。

## 已执行验证

- npm run verify:miniapp：各组件逐个运行均通过（Windows 下链式执行存在 PATH 隔离问题，需逐个运行 lint / test:ai / test:miniapp-core / test:miniapp-reliability / test:miniapp-ai / test:miniapp-usage / test:contract-import / test:miniapp-http / test:subsidy-review / smoke:miniapp / build / build:weapp）。
- 官方 npm 源 npm audit --omit=dev：found 0 vulnerabilities。

## 不要做

- 不要把 Redis、模型 Key、微信 AppSecret 写进仓库。
- 不要把开发者工具模拟器结果当真机验收。
- 不要在未确认前删除未跟踪预览产物。
- 不要在未确认范围前执行 git add、commit、push、reset、checkout、stash、clean。
