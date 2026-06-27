export const defaultDepositInputs = {
  depositAmount: '3800',
  unpaidFees: '0',
  repairCost: '0',
  cleaningCost: '400',
  hasVoucher: 'no',
  normalWear: 'yes',
}

export const providerPresets = {
  DeepSeek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-v4-flash',
    models: ['deepseek-v4-flash', 'deepseek-chat', 'deepseek-reasoner'],
    note: '适合中文合同审查，OpenAI 兼容格式。',
  },
  通义千问: {
    label: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    models: ['qwen-plus', 'qwen-max', 'qwen-turbo'],
    note: '阿里云百炼兼容模式，适合国内部署演示。',
  },
  智谱GLM: {
    label: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    models: ['glm-4-flash', 'glm-4-plus', 'glm-4-air'],
    note: '国产通用模型，接口走兼容聊天格式。',
  },
  Moonshot: {
    label: 'Moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    note: '长文本合同可切换更大上下文模型。',
  },
  OpenAICompatible: {
    label: 'OpenAI Compatible',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4.1-mini',
    models: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini'],
    note: '适合任意 OpenAI 兼容网关或自建代理。',
  },
  Custom: {
    label: '自定义网关',
    baseUrl: 'https://api.example.com/v1',
    defaultModel: 'custom-model',
    models: ['custom-model'],
    note: '填写你自己的代理地址、模型名和密钥。',
  },
}
