// 定义支持的翻译模型
export interface ModelOption {
  value: string;
  label: string;
  description: string;
  apiEndpoint: string;
  maxTokens: number;
}

// 支持的模型列表
export const SUPPORTED_MODELS: ModelOption[] = [
  {
    value: 'gpt-4o',
    label: 'GPT-4o',
    description: 'OpenAI的最新多模态模型，具有强大的翻译能力',
    apiEndpoint: '/api/openai/chat/completions',
    maxTokens: 8000
  },
  {
    value: 'deepseek-v3',
    label: 'DeepSeek-Chat',
    description: '深度求索的大语言模型，擅长中英文翻译',
    apiEndpoint: '/api/deepseek/chat/completions',
    maxTokens: 6000
  },
  {
    value: 'claude-3-sonnet',
    label: 'Claude-3-Sonnet',
    description: 'Anthropic的Claude模型，提供高质量学术翻译',
    apiEndpoint: '/api/anthropic/messages',
    maxTokens: 7000
  }
];

// 获取模型信息
export const getModelInfo = (modelValue: string): ModelOption => {
  const model = SUPPORTED_MODELS.find(m => m.value === modelValue);
  if (!model) {
    throw new Error(`不支持的模型: ${modelValue}`);
  }
  return model;
};

// 构建系统提示词
export const buildSystemPrompt = (): string => {
  return '你是一名专业的学术翻译助手。请将用户提供的中文学术文献内容精准、流畅地翻译成英文。保持术语准确、风格正式、逻辑清晰。';
};

// 构建用户提示词
export const buildUserPrompt = (text: string, customPrompt: string = ''): string => {
  return `${customPrompt ? customPrompt + '\n\n' : ''}请翻译以下内容：\n【【【${text}】】】`;
};

// 本地存储键名
export const STORAGE_KEYS = {
  API_KEY: 'polyglot_api_key',
  SELECTED_MODEL: 'polyglot_selected_model',
  CUSTOM_PROMPT: 'polyglot_custom_prompt',
  TR_INPUT_TEXT: 'polyglot_tr_input_text',
  TR_OUTPUT_TEXT: 'polyglot_tr_output_text',
  TR_OUTPUT_CHUNKS: 'polyglot_tr_output_chunks',
  TR_INPUT_RANGES: 'polyglot_tr_input_ranges',
  TR_SELECTED_INDEX: 'polyglot_tr_selected_index',
  TR_TOTAL_CHUNKS: 'polyglot_tr_total_chunks',
  TR_COMPLETED_CHUNKS: 'polyglot_tr_completed_chunks',
  TR_TIME: 'polyglot_tr_time',
  TR_CHUNK_STATES: 'polyglot_tr_chunk_states'
};