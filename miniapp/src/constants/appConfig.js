export const STORAGE_KEYS = {
  contractDraft: 'zu-xiao-shen-contract-draft',
  reviewHistory: 'zu-xiao-shen-review-history',
  reviewProfile: 'zu-xiao-shen-review-profile',
  aiChat: 'zu-xiao-shen-mini-ai-chat',
  history: 'zu-xiao-shen-history',
  aiConfig: 'zu-xiao-shen-ai-config',
  aiFeedback: 'zu-xiao-shen-ai-feedback',
  aiSession: 'zu-xiao-shen-ai-session',
  aiRemoteConsent: 'zu-xiao-shen-ai-remote-consent',
  aiMode: 'zu-xiao-shen-ai-mode',
  aiTaskHandoff: 'zu-xiao-shen-ai-task-handoff',
  evidencePack: 'zu-xiao-shen-evidence-pack',
  checkinInspection: 'zu-xiao-shen-checkin-inspection',
  checkinRoomType: 'zu-xiao-shen-checkin-room-type',
  subsidyMatcher: 'zu-xiao-shen-subsidy-matcher',
  localOnlyMode: 'zu-xiao-shen-local-only-mode',
  accountId: 'zu-xiao-shen-account-id',
}

export const REMOTE_AI_CONFIG = {
  enabled: true,
  transport: 'cloud',
  apiBaseUrl: 'https://express-kqoh-288630-10-1435338026.sh.run.tcloudbase.com',
  requestTimeoutMs: 45_000,
}

export const CLOUD_CONTAINER_CONFIG = {
  envId: 'prod-d9g4hyr35745b1ad8',
  serviceName: 'express-kqoh',
}

export const workflowLabels = {
  review: '租房审查',
  evidence: '退租证据包',
  checkin: '入住验房',
  subsidy: '补贴匹配',
  proposal: '创意提案',
  ai: 'AI 助手',
}
