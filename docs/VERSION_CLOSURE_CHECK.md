# 租小审版本收口检查

检查日期：2026-07-30

## 当前结论

- 当前工作区不是小补丁，而是一轮产品级改动：37 个已跟踪文件变更，约 +7043 / -1539 行。
- 本轮新增脚本、文档和小程序预览文件仍未跟踪；提交前不能只看 git diff。
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
- miniapp/src/features/aiAssistant.js
- miniapp/src/features/remoteAi.js
- miniapp/src/features/workflowContext.js
- miniapp/src/shared/knowledgeBase.js
- miniapp/src/utils/localDataManager.js
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

## 需要用户确认后再处理的预览产物

这些看起来是 UI 设计预览，不参与构建或测试。不要自动删除；如果只是给 Trae/你自己看效果，可以留在工作区但不提交。

- zu-xiao-shen-miniapp-ui-preview.html，约 56 KB
- zu-xiao-shen-miniapp-ui-preview.png，约 263 KB
- zu-xiao-shen-miniapp-ui.design，当前未跟踪

建议：提交前由用户确认“保留为设计资料”还是“移出仓库”。未确认前不要删。

## 建议提交批次

如果要拆提交，建议按下面切：

1. 后端安全与联网 AI：server/、scripts/test-miniapp-http.mjs、scripts/test-miniapp-ai.mjs。
2. RAG 知识库：server/data/、server/evaluate-rag.mjs、server/rag-engine.mjs、src/data/knowledgeBase.js、miniapp/src/shared/knowledgeBase.js。
3. 小程序体验与 UI：miniapp/src/pages/、miniapp/src/app.css、miniapp/src/app.config.js。
4. 本地数据与备份：miniapp/src/utils/localDataManager.js、miniapp/src/utils/textFileExport.js、相关可靠性测试。
5. 补贴复核：scripts/review-subsidy-policies.mjs、scripts/test-subsidy-review.mjs、package.json。
6. 交付文档：README.md、HANDOFF.md、miniapp/docs/、docs/。

## 发布前阻塞项

- 微信云托管配置 Redis REST 后重新部署，并用生产验收模式检查。
- 微信公众平台后台隐私指引终核。
- iPhone + Android 真机回归。
- 任何 server/ 改动上线前都必须重新部署微信云托管。

## 已执行验证

- npm run verify:miniapp：通过。
- 官方 npm 源 npm audit --omit=dev：found 0 vulnerabilities。

## 不要做

- 不要把 Redis、模型 Key、微信 AppSecret 写进仓库。
- 不要把开发者工具模拟器结果当真机验收。
- 不要在未确认前删除未跟踪预览产物。
- 不要在未确认范围前执行 git add、commit、push、reset、checkout、stash、clean。
