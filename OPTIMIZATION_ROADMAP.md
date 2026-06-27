# 租小审 · 优化路线图

> 基于当前代码状态（`App.jsx` 1911 行）的全面审查报告
> 最后更新：2026-06-24

---

## 一、当前状态速览

| 维度 | 状态 | 评分 |
|------|------|------|
| 核心功能（风险审查） | ✅ 可用，但基于本地规则 | 6/10 |
| UI 设计 | ✅ 极简黑白风格已应用 | 8/10 |
| AI 集成 | ⚠️ 半完成（函数存在但未接入主流程） | 3/10 |
| 代码架构 | ❌ 单文件 1911 行，无拆分 | 2/10 |
| 文件上传 | ❌ UI 存在但无功能 | 0/10 |
| 对比视图（diff） | ❌ 无 | 0/10 |
| 导出功能 | ⚠️ 仅支持 .txt | 3/10 |
| 撤销/重做 | ❌ 无 | 0/10 |
| 测试 | ❌ 无 | 0/10 |

---

## 二、优先级任务清单

### 🔴 P0 — 必须做（影响核心可用性）

#### P0-1：拆分组件，重构架构

**问题**
- `App.jsx` 1911 行，所有逻辑混在一起
- 状态管理用 `useState` 管理复杂对象，难以维护
- 没有 Error Boundary，任何报错都会导致整个应用崩溃

**目标结构**
```
src/
├── App.jsx                    # 主组件，只做路由和状态组装
├── components/
│   ├── Sidebar.jsx           # 侧边栏（品牌 + 导航 + 定位面板）
│   ├── ContractInput.jsx      # 合同输入区（文本域 + 上传 + 操作按钮）
│   ├── RiskPanel.jsx         # 风险列表面板（卡片列表 + 采纳按钮）
│   ├── SummaryCard.jsx       # 评分卡片（环形图 + 统计）
│   ├── FindingItem.jsx       # 单个风险卡片（类型 + 等级 + 建议 + 操作）
│   ├── HighlightedContract.jsx # 合同高亮视图
│   ├── AiConfigPanel.jsx     # AI 配置面板
│   └── ProposalPage.jsx      # 创意提案页面
├── hooks/
│   ├── useContractReview.js   # 审查逻辑（analyzeContract + applySuggestion）
│   ├── useAiModel.js         # AI 调用（callAiModel + 错误处理）
│   └── useLocalStorage.js    # 持久化（防抖保存）
├── data/
│   ├── riskRules.js           # 风险规则（从硬编码移出）
│   └── knowledgeBase.js      # 知识库（从硬编码移出）
└── utils/
    ├── contractParser.js       # 合同解析（extractClause 等）
    ├── highlight.js           # 高亮逻辑（优化性能）
    └── diff.js               # 文本对比工具（后续实现 diff 视图）
```

**验收标准**
- [ ] `App.jsx` 降至 300 行以内
- [ ] 每个组件文件不超过 200 行
- [ ] 添加 Error Boundary 组件
- [ ] 用 `useReducer` 管理复杂状态

**工作量**：4 小时

---

#### P0-2：实现文件上传功能

**问题**
```jsx
// 当前代码（App.jsx 约第 470 行）
<input aria-label="上传合同" type="file" />
// ❌ 没有 onChange 处理
// ❌ 没有文件读取逻辑
// ❌ 点击后无任何反应
```

**实现方案**
```jsx
// components/ContractInput.jsx
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // 校验文件类型
  const allowedTypes = ['text/plain', 'application/pdf', 'application/msword'];
  if (!allowedTypes.includes(file.type) && !file.name.match(/\.(txt|pdf|doc|docx)$/)) {
    alert('仅支持 .txt / .pdf / .doc / .docx 格式');
    return;
  }

  // 校验文件大小（限制 5MB）
  if (file.size > 5 * 1024 * 1024) {
    alert('文件大小不能超过 5MB');
    return;
  }

  // 读取文件内容
  const reader = new FileReader();
  reader.onload = (e) => {
    setContractText(e.target.result);
  };
  reader.onerror = () => {
    alert('文件读取失败，请重试');
  };

  if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
    reader.readAsText(file, 'UTF-8');
  } else {
    // PDF/DOC 需要后端解析，前端先提示
    alert('PDF/DOC 格式需要后端支持，请先上传至服务器或粘贴文本');
  }
}
```

**验收标准**
- [ ] 支持 `.txt` 文件上传并读取内容
- [ ] 文件类型和大小校验
- [ ] 读取成功后自动填入合同输入框
- [ ] 提供清除按钮，移除已上传文件

**工作量**：2 小时

---

### 🟠 P1 — 应该做（提升用户体验）

#### P1-1：实现真正的 Diff 对比视图

**问题**
- 当前「采纳并改写合同」直接替换或追加，用户看不到修改前后对比
- 没有可视化 diff，用户无法判断修改是否合理

**实现方案**

在 `src/utils/diff.js` 中实现简单的文本对比：
```js
// 基于最长公共子序列（LCS）的简单 diff
export function computeDiff(oldText, newText) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  
  // 返回：[{ type: 'unchanged' | 'added' | 'removed', content: string }]
  return lcsDiff(oldLines, newLines);
}
```

在 `App.jsx` 中添加对比视图：
```jsx
function DiffView({ original, modified }) {
  const diff = computeDiff(original, modified);
  
  return (
    <div className="diff-view">
      <div className="diff-header">
        <span>修改前</span>
        <span>修改后</span>
      </div>
      <div className="diff-content">
        {diff.map((line, i) => (
          <div key={i} className={`diff-line diff-line--${line.type}`}>
            <span className="diff-line-number">{i + 1}</span>
            <span className="diff-line-content">{line.content}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**验收标准**
- [ ] 点击「采纳建议」后，弹出 diff 对比视图
- [ ] 用颜色区分新增/删除/未变内容
- [ ] 提供「确认采纳」和「取消」按钮
- [ ] 支持逐条采纳（而非一次性全部）

**工作量**：3 小时

---

#### P1-2：升级导出功能（PDF + Word）

**问题**
- 当前只导出 `.txt` 文件
- 法务文档需要规范的 PDF 或 Word 格式

**实现方案**

安装依赖：
```bash
npm install jspdf html2canvas docx
```

实现 PDF 导出：
```jsx
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

async function exportAsPdf(contractText, findings) {
  const doc = new jsPDF();
  
  // 添加标题
  doc.setFontSize(20);
  doc.text('合同审查报告', 20, 20);
  
  // 添加合同文本
  doc.setFontSize(12);
  const lines = doc.splitTextToSize(contractText, 170);
  doc.text(lines, 20, 40);
  
  // 添加风险列表
  findings.forEach((finding, i) => {
    doc.text(`${i + 1}. ${finding.riskType} (${finding.level})`, 20, 40 + i * 10);
  });
  
  doc.save('合同审查报告.pdf');
}
```

实现 Word 导出：
```jsx
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';

async function exportAsWord(contractText, findings) {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: '合同审查报告',
          heading: 'Heading1',
        }),
        new Paragraph({
          text: contractText,
        }),
        // ... 风险列表
      ],
    }],
  });
  
  const blob = await Packer.toBlob(doc);
  saveAs(blob, '合同审查报告.docx');
}
```

**验收标准**
- [ ] 导出为 PDF（保留基本格式）
- [ ] 导出为 Word（.docx）
- [ ] 导出内容包括：合同原文 + 风险列表 + 修改建议
- [ ] 提供格式选择弹窗

**工作量**：2 小时

---

#### P1-3：添加撤销/重做功能

**问题**
- 采纳建议后无法撤销
- 用户容易误操作，且无法恢复

**实现方案**

使用 `useReducer` 管理历史状态：
```jsx
const initialState = {
  past: [],          // 历史状态栈
  present: '',       // 当前合同文本
  future: [],        // 重做栈
};

function contractReducer(state, action) {
  switch (action.type) {
    case 'UPDATE':
      return {
        past: [...state.past, state.present],
        present: action.payload,
        future: [],
      };
    case 'UNDO':
      if (state.past.length === 0) return state;
      return {
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [state.present, ...state.future],
      };
    case 'REDO':
      if (state.future.length === 0) return state;
      return {
        past: [...state.past, state.present],
        present: state.future[0],
        future: state.future.slice(1),
      };
    default:
      return state;
  }
}
```

**验收标准**
- [ ] 采纳建议后，可以撤销（Ctrl+Z）
- [ ] 撤销后，可以重做（Ctrl+Shift+Z）
- [ ] 在 UI 上显示撤销/重做按钮
- [ ] 历史记录最多保存 50 步

**工作量**：3 小时

---

### 🟡 P2 — 建议做（提升代码质量）

#### P2-1：优化高亮逻辑性能

**问题**
```jsx
// 当前实现（App.jsx 约第 1600 行）
// 嵌套循环，复杂度 O(n² * m)，大合同会卡顿
findings.forEach((finding) => {
  finding.hits.forEach((hit) => {
    for (let i = 0; i < segments.length; i += 1) {
      // ...
    }
  })
})
```

**方案**
- 用 Map 缓存关键词位置
- 用一次遍历替代嵌套循环
- 对大文本（>10000 字）做虚拟滚动

**工作量**：2 小时

---

#### P2-2：添加 Error Boundary

**问题**
- 任何组件报错都会导致整个应用崩溃
- 用户看到白屏，无法恢复

**方案**
```jsx
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>抱歉，出现了错误</h2>
          <pre>{this.state.error?.message}</pre>
          <button onClick={() => window.location.reload()}>
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**工作量**：1 小时

---

#### P2-3：添加单元测试

**问题**
- 没有测试，重构风险高
- 无法保证核心逻辑（风险检测）正确性

**方案**
- 用 Vitest 替代 Jest（Vite 项目推荐）
- 优先测试 `riskRules` 和 `analyzeContract`
- 目标覆盖率：核心逻辑 80%+

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

**工作量**：8 小时（持续添加）

---

### 🟢 P3 — 可以做（产品化方向）

#### P3-1：接入真实 AI API

**问题**
- 当前审查逻辑基于本地规则，覆盖面有限
- AI 接口函数存在，但未接入主流程

**方案**
```jsx
// hooks/useAiModel.js
async function callAiModel(apiKey, model, contractText, prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: '你是专业合同审查助手...' },
        { role: 'user', content: `${prompt}\n\n合同内容：\n${contractText}` },
      ],
    }),
  });
  
  if (!response.ok) {
    throw new Error(`API 调用失败：${response.status}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}
```

**验收标准**
- [ ] 用户配置 AI API Key 后，可以真正调用 AI
- [ ] 支持多个 AI 模型（GPT-4、Claude、通义千问等）
- [ ] 有错误处理和重试机制

**工作量**：4 小时

---

#### P3-2：添加后端 API

**问题**
- 纯前端应用，数据无法跨设备同步
- 文件上传（PDF/DOC）需要后端解析

**方案**
- 用 Express.js 或 FastAPI 搭建简单后端
- 提供 API：上传文件、解析合同、保存审查记录
- 用 SQLite 做本地数据库（MVP 阶段）

**工作量**：16 小时

---

## 三、实施路线图

### 第一阶段（1-2 天）：核心功能补全

| 任务 | 工作量 | 优先级 |
|------|--------|--------|
| 拆分组件（P0-1） | 4h | 🔴 P0 |
| 实现文件上传（P0-2） | 2h | 🔴 P0 |
| **合计** | **6h** | |

---

### 第二阶段（2-3 天）：用户体验提升

| 任务 | 工作量 | 优先级 |
|------|--------|--------|
| Diff 对比视图（P1-1） | 3h | 🟠 P1 |
| PDF/Word 导出（P1-2） | 2h | 🟠 P1 |
| 撤销/重做（P1-3） | 3h | 🟠 P1 |
| **合计** | **8h** | |

---

### 第三阶段（1-2 天）：代码质量提升

| 任务 | 工作量 | 优先级 |
|------|--------|--------|
| 优化高亮性能（P2-1） | 2h | 🟡 P2 |
| Error Boundary（P2-2） | 1h | 🟡 P2 |
| 单元测试（P2-3） | 8h | 🟡 P2 |
| **合计** | **11h** | |

---

### 第四阶段（3-5 天）：产品化探索

| 任务 | 工作量 | 优先级 |
|------|--------|--------|
| 接入真实 AI（P3-1） | 4h | 🟢 P3 |
| 后端 API（P3-2） | 16h | 🟢 P3 |
| **合计** | **20h** | |

---

## 四、快速决策表

### 如果你的目标是「比赛演示」

**推荐路线**：第一阶段 → 第二阶段（部分）

| 必须做 | 可选做 | 不做 |
|--------|--------|------|
| 拆分组件（让演示时不崩溃） | Diff 视图（最显价值） | 后端 API |
| 文件上传（补齐核心功能） | PDF 导出（提升专业感） | 单元测试 |
| | 撤销/重做（防止演示失误） | |

**时间预算**：6-12 小时

---

### 如果你的目标是「真正产品」

**推荐路线**：第一阶段 → 第二阶段 → 第三阶段 → 第四阶段（部分）

| 阶段 | 重点 |
|------|------|
| 第一阶段 | 架构重构，让代码可维护 |
| 第二阶段 | 核心用户体验功能 |
| 第三阶段 | 稳定性和质量保障 |
| 第四阶段 | AI 集成（核心价值）+ 后端（数据持久化） |

**时间预算**：45-60 小时

---

## 五、即刻可以开始的行动

### 如果你想今天就能看到进展

**选项 A**：实现文件上传（2h）
- 立竿见影，补齐核心功能
- 代码改动小，风险低

**选项 B**：拆分 Sidebar 组件（1h）
- 从最简单的组件开始，熟悉重构流程
- 为后续拆分建立信心

**选项 C**：添加 PDF 导出（2h）
- 用现成库（`jspdf`），快速出效果
- 演示时很加分

---

### 如果你想做最有价值的功能

**推荐**：Diff 对比视图（3h）
- 这是合同审查工具的「灵魂功能」
- 用户最能感知到价值
- 技术上不复杂，但效果显著

---

## 六、技术债务清单

记录需要后续处理但不会阻塞当前开发的问题：

- [ ] `featureCards` / `productBacklog` 等硬编码数据移到独立文件
- [ ] 添加 ESLint 和 Prettier，统一代码风格
- [ ] 用 TypeScript 重写（提升可维护性）
- [ ] 添加 CI/CD（自动构建和部署）
- [ ] 用 `react-window` 优化长列表渲染
- [ ] 添加 Service Worker，支持离线使用
- [ ] 国际支持（当前硬编码中文）

---

## 七、参考资源

- **React 性能优化**：https://react.dev/learn/thinking-in-react
- **Vitest 文档**：https://vitest.dev/
- **jspdf 文档**：https://parall.ax/products/jspdf
- **docx 文档**：https://docx.js.org/
- **React Error Boundary**：https://react.dev/reference/react/Component#static-getderivedstatefromerror

---

**文档版本**：v1.0  
**适用项目**：租小审
**下次更新**：完成任一 P0 任务后
