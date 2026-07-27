# 租小审项目进度说明

更新时间：2026-07-27

## 项目位置

- 项目根目录：`E:\web-dev\contract-guardian`
- Web 源码：`E:\web-dev\contract-guardian\src`
- 微信小程序源码：`E:\web-dev\contract-guardian\miniapp`
- GitHub：`https://github.com/w3038177197/zu-xiao-shen.git`
- 分支：`main`
- 当前最新提交：`d18f1a3 docs: update handoff for miniapp takeover`
- 最近功能基线：`35b25ed feat(miniapp): expand core rental workflows`

请直接打开项目根目录，不要新建项目，也不要整体覆盖现有文件。

## 我已经完成的事情

我已经把“租小审”做成了 Web 版 + 微信小程序双端项目。

### Web 版

- 完成 React + Vite Web 版主应用。
- 完成租房合同审查、风险评分、风险证据、修改建议、谈判话术和修订稿生成。
- 完成 TXT / MD / PDF / DOCX / 图片 OCR 导入链路。
- 完成 AI 助手、RAG 知识库、AI 额度、取消请求、重试和本地兜底。
- 完成隐私脱敏、仅本地分析模式、导出/清除本地数据。
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

## 我刻意还没做的事情

这些不是遗漏，是为了安全和时间边界先保留：

1. 小程序远程 AI 还没开放。
2. 小程序 OCR 还没接入。
3. 小程序 PDF / DOCX 完整导入还没接入。
4. 微信登录、用户会话、云端证据存储还没接入。
5. 正式发布所需的隐私协议、用户授权、合法域名和真机全量回归还没完成。

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

最近一次我的验证结果：

- ESLint：通过
- Web 构建：通过
- AI/RAG：12/12
- Playwright E2E：22/22
- 小程序核心检查：通过
- Taro 微信小程序构建：通过
- 微信开发者工具：首页、合同审查、AI、验房页面无白屏、无红色运行错误

## 修改规则

1. 不要整体重写项目。
2. 不要把小程序恢复成蓝色通用模板 UI。
3. 不要替换 `project.config.json` 里的 AppID：`wx1ffa57d1c8b48905`。
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

1. 用 iPhone 和 Android 真机测试小程序拍照、预览、重启后照片持久化。
2. 补微信隐私保护指引和用户数据删除入口。
3. 配置正式小程序后台的 HTTPS 合法域名。
4. 设计微信登录 + 服务端会话方案。
5. 服务端完成鉴权、额度、脱敏后，再接入小程序远程 AI / OCR。

远程 AI 的正确方向：

- 小程序只拿微信登录态或短期会话 token。
- 合同正文先脱敏。
- 请求发到自己的 HTTPS 后端。
- 后端再调用大模型 API。
- 用户可以取消请求，并能清除本地与云端数据。
