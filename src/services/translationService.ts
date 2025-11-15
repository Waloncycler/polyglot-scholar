import axios from 'axios';

interface TranslationRequest {
  text: string;
  model: string;
  apiKey: string;
  customPrompt?: string;
  onProgress?: (text: string) => void;
}

interface TranslationResponse {
  translatedText: string;
  model: string;
  processingTime: number;
  errors?: Array<{
    chunkIndex: number;
    message: string;
  }>;
}

// 智能分段处理长文本
export const splitTextIntoChunks = (text: string, maxChunkSize: number = 4000): string[] => {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let currentChunk = '';
  let retryCount = 0;
  const maxRetries = 3;
  
  // 预处理：删除所有空行，优化文本格式
  const cleanText = text
    .split('\n')
    .filter(line => line.trim() !== '') // 删除空行
    .join('\n')
    .trim();
  // 按段落分割
  const paragraphs = cleanText.split('\n');
  
  for (const paragraph of paragraphs) {
    // 跳过空段落
    if (!paragraph.trim()) continue;
    // 如果单个段落就超过了最大块大小，需要进一步分割
    if (paragraph.length > maxChunkSize) {
      // 按句子分割段落
      const sentences = paragraph.split(/(?<=[。！？.!?])/);
      
      for (const sentence of sentences) {
        // 如果单个句子超过最大块大小，需要按字符分割
        if (sentence.length > maxChunkSize) {
          let remainingSentence = sentence;
          while (remainingSentence.length > 0) {
            const chunkSize = Math.min(remainingSentence.length, maxChunkSize);
            // 尽量在标点符号处分割
            let splitPoint = chunkSize;
            if (chunkSize < remainingSentence.length) {
              // 从后向前找最近的标点符号
              for (let i = chunkSize - 1; i >= chunkSize * 0.8; i--) {
                if ('，,。.！!？?;；:：'.includes(remainingSentence[i])) {
                  splitPoint = i + 1;
                  break;
                }
              }
            }
            chunks.push(remainingSentence.substring(0, splitPoint));
            remainingSentence = remainingSentence.substring(splitPoint);
          }
        } 
        // 处理正常长度的句子
        else if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = sentence;
        } else {
          currentChunk += sentence;
        }
      }
    } 
    // 处理正常长度的段落
    else if (currentChunk.length + paragraph.length + 2 > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = paragraph;
    } else {
      if (currentChunk.length > 0) {
        currentChunk += '\n\n' + paragraph;
      } else {
        currentChunk = paragraph;
      }
    }
  }
  
  // 添加最后一个块
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  
  // 添加上下文连接信息
  return chunks.map((chunk, index) => {
    let contextInfo = '';
    if (chunks.length > 1) {
      contextInfo = `[这是第 ${index + 1} 部分，共 ${chunks.length} 部分]\n\n`;
    }
    return contextInfo + chunk;
  });
};

// 构建API请求体
const buildRequestBody = (model: string, text: string, customPrompt: string = '') => {
  const systemPrompt = '你是一名专业的学术翻译助手。请将用户提供的中文学术文献内容精准、流畅地翻译成英文。保持术语准确、风格正式、逻辑清晰。';
  const userPrompt = `${customPrompt ? customPrompt + '\n\n' : ''}请翻译以下内容：\n【【【${text}】】】`;
  
  // 根据不同模型构建不同的请求体
  switch (model) {
    case 'gpt-4o':
      return {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      };
    case 'deepseek-v3':
      return {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      };
    case 'claude-3-sonnet':
      return {
        model: 'claude-3-sonnet',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      };
    default:
      throw new Error(`不支持的模型: ${model}`);
  }
};

// 获取API端点
const getApiEndpoint = (model: string): string => {
  // 这里应该返回实际的API端点
  // 在实际应用中，这些端点应该由后端代理提供
  switch (model) {
    case 'gpt-4o':
      return '/api/openai/chat/completions';
    case 'deepseek-v3':
      return '/api/deepseek/chat/completions';
    case 'claude-3-sonnet':
      return '/api/anthropic/messages';
    default:
      throw new Error(`不支持的模型: ${model}`);
  }
};

// 解析API响应
const parseApiResponse = (model: string, response: any): string => {
  // 适配新的后端响应格式
  const responseData = response.data ? response.data : response;
  
  switch (model) {
    case 'gpt-4o':
    case 'deepseek-v3':
      return responseData.choices[0].message.content;
    case 'claude-3-sonnet':
      return responseData.content[0].text;
    default:
      throw new Error(`不支持的模型: ${model}`);
  }
};

// 翻译文本
export const translateText = async ({
  text,
  model,
  apiKey,
  customPrompt = '',
  maxChunkSize,
  onProgress
}: TranslationRequest & { maxChunkSize?: number }): Promise<TranslationResponse> => {
  const startTime = Date.now();
  try {
    // 分段处理长文本，支持自定义分段长度
    // DeepSeek 模型使用更小的分段大小，避免超时
    const defaultChunkSize = model === 'deepseek-v3' ? 800 : 4000;
    const chunks = splitTextIntoChunks(text, maxChunkSize || defaultChunkSize);
    let translatedText = '';
    let translationErrors = [];
    
    // 最大重试次数和重试延迟
    const maxRetries = 3;
    const retryDelay = 2000;
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const requestBody = buildRequestBody(model, chunk, customPrompt);
      const endpoint = getApiEndpoint(model);
      let retryCount = 0;
      
      while (retryCount <= maxRetries) {
        try {
          const response = await axios.post(endpoint, requestBody, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
              'apiKey': apiKey
            },
            timeout: model === 'deepseek-v3' ? 120000 : 60000
          });
          
          if (!response.data.success && !response.data.data) {
            if (typeof response.data.success === 'undefined' && response.data.data) {
              // DeepSeek 兼容性处理：继续处理
            } else {
              throw new Error(response.data.error || '未知错误');
            }
          }
          
          const chunkTranslation = parseApiResponse(model, response.data);
          translatedText += chunkTranslation + (chunks.length > 1 ? '\n\n' : '');
          
          // 实时更新翻译进度
          if (onProgress) {
            onProgress(translatedText.trim());
          }
          
          break;
          
        } catch (chunkError) {
          console.error(`Error translating chunk ${i+1}/${chunks.length} (attempt ${retryCount + 1}/${maxRetries + 1}):`, chunkError);
          
          if (retryCount === maxRetries) {
            translationErrors.push({
              chunkIndex: i,
              message: chunkError.response?.data?.error || chunkError.message
            });
            const errorMessage = `[翻译错误: 第${i+1}部分未能成功翻译]\n\n`;
            translatedText += errorMessage;
            
            // 实时更新错误信息
            if (onProgress) {
              onProgress(translatedText.trim());
            }
            break;
          }
          
          if (chunkError.message.includes('aborted')) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
          
          retryCount++;
        }
      }
    }
    
    const processingTime = (Date.now() - startTime) / 1000;
    if (translationErrors.length === chunks.length) {
      throw new Error('所有翻译请求均失败，请检查API密钥和网络连接');
    }
    
    return {
      translatedText: translatedText.trim(),
      model,
      processingTime,
      errors: translationErrors.length > 0 ? translationErrors : undefined
    };
    
  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
};

// 导出默认翻译函数
export default translateText;