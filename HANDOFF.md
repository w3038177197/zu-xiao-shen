# 租小审项目交接说明

更新时间：2026-07-27

## 项目位置

- 项目根目录：`E:\web-dev\contract-guardian`
- Web 源码：`E:\web-dev\contract-guardian\src`
- 微信小程序源码：`E:\web-dev\contract-guardian\miniapp`
- GitHub：`https://github.com/w3038177197/zu-xiao-shen.git`
- 分支：`main`
- 最近功能基线：`35b25ed feat(miniapp): expand core rental workflows`

TRAE 应直接打开项目根目录，不要新建项目或整体覆盖现有文件。

## 产品定位

“租小审”是面向租客的租房全流程风险审查和证据管理工具，覆盖：

1. 租房补贴匹配
2. 签约前合同审查
3. 租房 AI 助手
4. 入住验房和照片留证
5. 退租证据包及沟通话术
6. 押金扣款估算

## 技术结构

### Web 版

- React 19
- Vite
- Express AI/OCR 代理
- Playwright E2E

### 微信小程序

- Taro 4.2.1
- React 18
- Webpack 5
- AppID：`wx1ffa57d1c8b48905`

微信开发者工具导入目录：

```text
E:\web-dev\contract-guardian\miniapp
```

不要直接导入 `miniapp\dist`，`project.config.json` 已配置 `miniprogramRoot: dist/`。

## 当前小程序能力

- 五项原生 TabBar：首页、审查、AI 助手、验房、证据包。
- 完整本地合同审查：合同类型、审查角色、审查深度、多份演示合同、风险维度、逐条采纳、全部采纳、修订草案、报告复制和审查记录。
- Web 合同审查规则可同步到小程序，避免两端规则分叉。
- 本地 AI 会结合当前合同及审查结果，使用内置知识库生成结构化建议并保存本地聊天记录。
- 入住验房支持房型、房间、瑕疵、备注、拍照、照片预览、报告生成及房东确认话术。
- 删除或重置验房照片时会清理小程序保存文件。
- 退租证据包支持信息录入、证据清单、行动清单、沟通说明和摘要复制。
- 首页保持米白、墨黑和绿色的原产品视觉，并按补贴、签约、入住、退租组织流程。

## 安全边界

小程序 AI 当前只开放本地模式，这是有意保留的安全限制。

不要把以下内容直接加入小程序前端：

- `AI_PROXY_ACCESS_TOKEN`
- 大模型 API Key
- 可编辑的共享后端密钥
- 未脱敏的合同远程上传

正式接入远程 AI 前必须完成：

1. `wx.login` 与服务端会话鉴权
2. HTTPS 合法请求域名
3. 服务端额度和频率限制
4. 合同个人信息脱敏
5. 用户明确授权、取消请求及数据删除

## 运行命令

### Web

```powershell
cd E:\web-dev\contract-guardian
npm install
npm run dev:full
```

仅运行前端：`npm run dev`

### 小程序

```powershell
cd E:\web-dev\contract-guardian\miniapp
npm install
npm run dev:weapp
```

构建：`npm run build:weapp`

## 合同规则同步

合同审查规则以 Web 端为来源：

```text
src/features/contractReview.js
```

修改 Web 规则后运行：

```powershell
npm run sync:miniapp-review
npm run test:miniapp-core
```

不要直接长期维护 `miniapp/src/features/contractReview.js`，它由同步脚本生成。

## 验证命令

```powershell
npm run lint
npm run build
npm run test:ai
npm run test:e2e
npm run test:miniapp-core
cd miniapp
npm run build:weapp
```

最近验证结果：

- ESLint：通过
- Web 构建：通过
- AI/RAG：12/12
- Playwright E2E：22/22
- 小程序核心检查：通过
- Taro 微信小程序构建：通过
- 微信开发者工具：首页、合同审查、AI、验房页面无白屏、无红色运行错误

## 开发注意事项

1. 修改前先运行 `git status` 和 `git pull origin main`。
2. 不要回退或整体替换现有 UI，不要恢复成蓝色通用卡片模板。
3. 不要删除用户已有改动或 `project.config.json` 中的 AppID。
4. TabBar 页面之间使用 `Taro.switchTab`；补贴页不在 TabBar，使用 `Taro.navigateTo`。
5. 微信开发者工具显示旧页面时，先清除全部缓存，再重新编译。
6. 照片使用 `Taro.saveFile`，新增删除逻辑时必须同步调用 `Taro.removeSavedFile`。
7. Web 版和小程序均需保持“仅供风险自查、不构成法律意见”的边界。

## 推荐下一步

优先做真机回归和小程序发布准备，不要先进行全量重写：

1. iPhone/Android 真机拍照、预览、重启后持久化测试
2. 微信隐私保护指引和用户数据删除入口
3. 正式 AppID 的合法域名及发布配置
4. 完成服务端微信鉴权后再接入远程 AI/OCR
