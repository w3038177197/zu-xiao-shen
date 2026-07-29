# 小程序合同导入实现说明

合同页已经支持手机剪贴板、微信聊天文件、直接拍照和相册图片四条导入路径。解析后的正文仍交给小程序本地审查引擎，不会把合同正文自动发送给联网 AI。

## 当前支持

1. 手机文本：读取剪贴板，不上传。
2. TXT/MD：使用 `chooseMessageFile` + `FileSystemManager.readFile`，不上传。
3. DOCX/PDF：逐次确认后上传至内存解析接口，使用微信登录会话鉴权，限制 8 MB；服务端不保存原文件。
4. 图片/OCR：使用相机或相册选择图片，逐次确认后上传 OCR；返回识别文字和整体置信度。
5. 所有远程解析都支持上传进度和取消；失败或取消不会覆盖当前编辑区正文。

## 推荐接口

`POST /api/miniapp/contract/parse`：`multipart/form-data`，字段 `document`、`fileName`。

返回：

```json
{
  "text": "合同纯文本",
  "ok": true,
  "fileName": "租赁合同.pdf",
  "extension": "pdf",
  "pageCount": 3,
  "charCount": 8200,
  "retained": false
}
```

图片 OCR 使用 `POST /api/miniapp/ocr/image`，字段为 `image`。两个小程序接口都使用短期微信会话与内存上传；旧版 Web OCR 接口仍保留来源校验。客户端只在解析成功且用户确认替换后更新正文。遇到 `401` 会刷新一次微信会话，网络失败、取消或解析失败时不覆盖现有文本。

## 验收标准

- TXT/MD 在无网络环境可导入、审查和复制报告。
- DOCX/PDF/OCR 失败不会清空已有草稿，且给出登录、合法域名、网络或解析错误提示。
- 单文件超过 8 MB、非白名单扩展名、伪造 PDF/DOCX 或空正文会被拒绝。
- 真机验证 iOS/Android 的文件权限、弱网超时和重复点击行为。
