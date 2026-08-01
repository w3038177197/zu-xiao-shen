# 租小审项目进度说明

更新时间：2026-08-02

## 项目位置

- 项目根目录：`E:\web-dev\contract-guardian`
- Web 源码：`E:\web-dev\contract-guardian\src`
- 微信小程序源码：`E:\web-dev\contract-guardian\miniapp`
- GitHub：`https://github.com/w3038177197/zu-xiao-shen.git`
- 分支：`main`
- 当前最新提交：以 `git log -1` 为准，不在此写死 hash
- 最近功能基线：以 `git log --oneline` 实际查询为准

请直接打开项目根目录，不要新建项目，也不要整体覆盖现有文件。

## 我已经完成的事情

我已经把“租小审”做成了 Web 版 + 微信小程序双端项目。

### Web 版

- 完成 React + Vite Web 版主应用。
- 完成租房合同审查、风险评分、风险证据、修改建议、谈判话术和修订稿生成。
- 完成 TXT / MD / PDF / DOCX / 图片 OCR 导入链路。
- 完成 AI 助手、RAG 知识库、AI 额度、取消请求、重试和本地兜底。
- 完成隐私脱敏、默认联网 AI、本地兜底、导出/清除本地数据。
- 完成入住验房、退租证据包、补贴匹配、押金估算和报告导出。
- 完成移动端适配、弱网测试、360/390px 窄屏测试。

### 微信小程序

- 初始化 Taro 4.2.1 + React 18 小程序。
- 完成五项原生 TabBar：首页、审查、AI 助手、验房、证据包。
- 完成首页租房全流程入口，保留米白、墨黑、绿色的产品视觉。
- 完成本地合同审查页：合同类型、审查角色、审查深度、多份演示合同、风险维度、逐条采纳、全部采纳、修订草案、报告复制和审查记录。
- 完成 Web 审查规则同步到小程序的脚本，避免两端规则分叉。
- 完成本地 AI 助手：结合当前合同和审查结果，用内置知识库生成结构化建议。
- 完成入住验房：房型选择、房间切换、瑕疵记录、拍照、照片预览、报告生成和房东确认话术。
- 完成照片删除和重置时的小程序保存文件清理。
- 完成退租证据包：基本信息、证据清单、行动清单、沟通说明和报告摘要复制。
- 完成联网 AI：默认优先联网，首次联网前单独授权，拒绝或服务不可用时自动本地分析；后端为微信云托管。
- 完成微信登录与服务端短期会话：`wx.login` 换取服务端签名令牌，401 时刷新一次。
- 完成合同导入：剪贴板、微信聊天文件（TXT/MD）、DOCX/PDF（逐次确认后上传服务端提取文字，仅内存处理）、拍照/相册 OCR。
- 完成隐私授权弹层与用户数据删除入口。
- 完成整包备份与恢复、补贴政策人工复核报告、服务端脱敏可观测性。

## 我刻意还没做的事情

这些不是遗漏，是为了安全和时间边界先保留：

1. 生产额度持久化尚未配置：微信云托管环境变量中的 `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN` 仍为空，当前额度存储为 `memory`，服务重启后丢失，仅适合本地开发与比赛演示。
2. 真机全量回归尚未完成：iPhone 和 Android 各需一轮真实微信环境验收（相机、相册、微信聊天文件、剪贴板、PDF/DOCX、OCR、联网 AI、弱网取消、重启后照片恢复、TXT/PDF/ZIP 分享、清除全部数据）。
3. 微信公众平台后台的隐私保护指引需确认已披露模型服务商的数据处理范围。

原因：API Key、后端访问令牌、未脱敏合同正文不能直接放进小程序前端。远程 AI / OCR 必须走服务端鉴权和脱敏。

## 请 TRAE 执行的操作

### 1. 先同步最新代码

```powershell
cd E:\web-dev\contract-guardian
git status
git pull origin main
```

### 2. 安装并启动 Web 版

```powershell
npm install
npm run dev:full
```

仅启动前端：

```powershell
npm run dev
```

### 3. 安装并启动微信小程序

```powershell
cd E:\web-dev\contract-guardian\miniapp
npm install
npm run dev:weapp
```

微信开发者工具导入：

```text
E:\web-dev\contract-guardian\miniapp
```

不要导入 `miniapp\dist`，`project.config.json` 已经配置了 `miniprogramRoot: dist/`。

### 4. 必须先验证这些命令

```powershell
cd E:\web-dev\contract-guardian
npm run lint
npm run build
npm run test:ai
npm run test:e2e
npm run test:miniapp-core
cd miniapp
npm run build:weapp
```

最近一次本地验证结果：

- ESLint：通过
- Web 构建：通过
- 合同对抗评测：110/110
- Playwright E2E：22/22
- 小程序核心检查：22 findings / 88 分
- 小程序可靠性：138/138
- 小程序 AI：39/39
- 小程序用量存储：11/11
- 合同导入：8/8
- 服务端 HTTP 集成：15/15
- 补贴人工复核测试：24/24
- 小程序静态冒烟：14/14
- 官方 npm 源生产依赖审计：0 vulnerabilities
- Taro 微信小程序构建：通过
- 微信开发者工具：首页、合同审查、AI、验房页面待真机/开发者工具复核（本轮未真实打开开发者工具验证）

## 修改规则

1. 不要整体重写项目。
2. 不要把小程序恢复成蓝色通用模板 UI。
3. 不要替换 `project.config.json` 里的 AppID：`wxa9ace892fd7b06e1`。
4. 不要把 API Key、`AI_PROXY_ACCESS_TOKEN` 或后端共享密钥放进小程序前端。
5. 不要直接长期维护 `miniapp/src/features/contractReview.js`。

合同审查规则以 Web 端为来源：

```text
src/features/contractReview.js
```

如果改了 Web 审查规则，请运行：

```powershell
npm run sync:miniapp-review
npm run test:miniapp-core
```

## 下一步优先级

请优先做这些，不要先大改架构：

1. 用 iPhone 和 Android 真机完成全量回归（相机、相册、微信聊天文件、剪贴板、PDF/DOCX、OCR、联网 AI、弱网取消、重启后照片恢复、TXT/PDF/ZIP 分享、清除全部数据）。
2. 在微信云托管环境变量中配置 `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN`，使额度持久化从 `memory` 切换为 `redis-rest`。
3. 确认微信公众平台后台隐私保护指引已披露模型服务商的数据处理范围。
4. `server/` 改动发布前需要重新部署微信云托管。

当前远程 AI 的实际方案（已实现）：

- 小程序默认优先联网 AI，首次发送联网请求前单独征得用户同意。
- 用户拒绝、未授权或服务不可用时自动使用本地分析。
- 小程序只拿微信登录态或短期会话 token。
- 合同正文不发送；用户可逐项选择合同审查、验房、证据包和补贴模块的业务摘要，并在发送前预览。
- 资料摘要先在本机脱敏，服务端再次脱敏后交给模型。
- 后端为微信云托管，通过 `cloud.callContainer` 调用。
- 用户可以取消请求，并能清除本地与云端数据。
