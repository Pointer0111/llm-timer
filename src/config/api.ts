// DeepSeek API配置
export const DEEPSEEK_CONFIG = {
  // 请替换为您的实际API密钥和端点
  API_KEY: import.meta.env.VITE_DEEPSEEK_API_KEY || 'your-api-key-here',
  API_ENDPOINT: import.meta.env.VITE_DEEPSEEK_API_ENDPOINT || 'https://api.deepseek.com/v1/chat/completions',
  MODEL: 'deepseek-chat',
  TEMPERATURE: 0.1,
  MAX_TOKENS: 1000
}

// 检查API配置是否有效
export const isApiConfigured = () => {
  return DEEPSEEK_CONFIG.API_KEY && DEEPSEEK_CONFIG.API_KEY !== 'your-api-key-here'
} 