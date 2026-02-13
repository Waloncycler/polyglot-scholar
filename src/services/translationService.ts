import axios from 'axios';
import { ACADEMIC_FORMAT_PROTOCOL } from '../config/promptRules';
import { postProcessText } from '../utils/textFormatter';

interface TranslationRequest {
  text: string;
  model: string;
  apiKey: string;
  customPrompt?: string;
  glossary?: { [key: string]: string };
  onProgress?: (chunks: string[], stats?: { completed: number; total: number; lastChunkIndex?: number; offsetStart?: number; offsetEnd?: number; chunkDelta?: string; isChunkFinal?: boolean }) => void;
}

interface TranslationResponse {
  translatedText: string;
  chunks: string[];
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
  
  // 预处理：标准化换行，保留段落结构，但限制最大连续空行数
  // 1. 统一换行符
  // 2. 将连续3个及以上换行符替换为2个（段落间最多保留一个空行）
  // 3. 去除首尾空白
  const cleanText = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 按双换行符分割段落，这样可以保留段落内部（如代码块、诗歌）的单换行格式
  const paragraphs = cleanText.split('\n\n');
  
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

export const computeOffsets = (original: string, chunks: string[]): Array<{ start: number; end: number }> => {
  const ranges: Array<{ start: number; end: number }> = [];
  let pos = 0;
  
  const cleanChunks = chunks.map(c => c.replace(/^\[这是第[\s\S]*?\]\n\n/, ''));
  
  for (let i = 0; i < cleanChunks.length; i++) {
    const chunk = cleanChunks[i];
    if (!chunk.trim()) {
      ranges.push({ start: pos, end: pos });
      continue;
    }

    // Use a probe to find the text content
    const probe = chunk.trim().slice(0, Math.min(50, chunk.length)).trim();
    const contentStart = original.indexOf(probe, pos);
    
    let start = contentStart;
    
    if (contentStart !== -1) {
      // Try to recover leading whitespace that matches the chunk's original leading whitespace
      // However, since chunks are from cleanText (which might have different whitespace than original),
      // we need to be careful. But generally we want to capture the indentation on the current line.
      // Backtrack from contentStart to find the beginning of the line or until pos
      let current = contentStart - 1;
      while (current >= pos) {
        const char = original[current];
        if (char === '\n' || char === '\r') {
          break; // Stop at newline
        }
        if (!/\s/.test(char)) {
          break; // Stop at non-whitespace (shouldn't happen if probe found content)
        }
        current--;
      }
      start = current + 1;
    } else {
       start = pos;
    }
    
    let end = -1;
    
    // Look ahead for the next chunk to determine where this one ends
    if (i < cleanChunks.length - 1) {
      const nextChunk = cleanChunks[i + 1];
      const nextProbe = nextChunk.slice(0, Math.min(50, nextChunk.length)).trim();
      // Search for next chunk starting from a reasonable position
      // (start + partial length to avoid false positives in current chunk)
      const searchStart = start + Math.floor(chunk.length * 0.5);
      const nextStart = original.indexOf(nextProbe, searchStart);
      
      if (nextStart !== -1) {
        end = nextStart;
      }
    }
    
    if (end === -1) {
      // For the last chunk or if next chunk not found, extend to end or use length
      if (i === cleanChunks.length - 1) {
        end = original.length;
      } else {
        // Fallback: use length, adjusting for potential newline differences
        // Use a heuristic: if original has more newlines, this might be short
        end = start + chunk.length;
      }
    }
    
    ranges.push({ start, end });
    pos = end;
  }
  return ranges;
};

const stripPartHeader = (s: string): string => {
  let result = s;
  
  // 1. Remove standard Part headers
  result = result.replace(/^\s*(\*\*\s*)?\[\s*Part\s+\d+\s+of\s+\d+\s*\](\s*\*\*)?\s*/i, '')
                 .replace(/^\s*\[这是第[\s\S]*?\]\s*/i, '');

  // 2. Remove echoed prompt sections (English & Chinese)
  // Handle "User-Defined Requirements" / "用户自定义要求"
  result = result.replace(/^\s*(?:\*\*\[|【)\s*(?:User-Defined Requirements|用户自定义要求)(?:\]\*\*|】)[\s\S]*?(?=(?:\*\*\[|【)(?:Previous Context|Text to Translate|前文内容)|$)/i, '');
  
  // Handle "Previous Context" / "前文内容"
  result = result.replace(/^\s*(?:\*\*\[|【)\s*(?:Previous Context|前文内容)[\s\S]*?(?:\]\*\*|】)[\s\S]*?(?=(?:\*\*\[|【)(?:Text to Translate)|$)/i, '');
  
  // Handle "Text to Translate" / "请将以下..." headers
  result = result.replace(/^\s*(?:\*\*\[|【)\s*Text to Translate(?:\]\*\*|】)\s*/i, '');
  result = result.replace(/^\s*请将以下中文段落翻译为英文：\s*[\n\r]*\s*【{3}\s*/i, '');
  
  // Remove trailing brackets if they match the input format
  result = result.replace(/\s*】{3}\s*$/, '');

  // 3. Remove markdown bold markers (**text**) to keep plain text
  result = result.replace(/\*\*/g, '');

  // 4. Apply post-processing formatting rules (for units, well names, stratigraphy)
  result = postProcessText(result);

  return result.trim();
};

// 构建API请求体
const buildRequestBody = (model: string, text: string, customPrompt: string = '', glossary?: { [key: string]: string }, previousContext?: string) => {
  let systemPrompt = `你是一位精通中英文的资深学术翻译专家，拥有各学科领域的深厚背景知识。你的任务是将用户提供的中文学术文献翻译成地道、专业、符合学术规范的英文。

请严格遵循以下翻译原则：
1. **准确性 (Accuracy)**：忠实于原文含义，准确传递学术概念，不随意增减信息。
2. **学术性 (Academic Tone)**：使用正式、客观的学术词汇和句式。避免口语化表达（如 contractions: don't -> do not）。恰当使用被动语态和名词化结构以增强客观性。
3. **流畅性 (Fluency)**：确保译文逻辑连贯，符合英文表达习惯。彻底消除“中式英语” (Chinglish)，调整语序以符合英语逻辑（例如：将修饰语过长的定语前置改为后置定语从句或分词结构）。
4. **术语一致性 (Terminology)**：确保专业术语在全文中的翻译保持一致。

${ACADEMIC_FORMAT_PROTOCOL}

特别注意：
- 遇到模糊的中文表达时，根据上下文推断最合理的学术含义。
- 保持段落结构与原文一致。
- 仅输出翻译后的英文内容，不要包含任何解释、注脚或额外的对话文本。
- 严禁在输出中重复用户的提示词、元数据标签（如 [User-Defined Requirements]）或【【【...】】】包裹结构。
- 严禁使用 Markdown 加粗符号（即 **text**），直接输出纯文本。`;
  
  // 如果有术语表，将其添加到系统提示词中
  if (glossary && Object.keys(glossary).length > 0) {
    const glossaryText = Object.entries(glossary)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\n');
    systemPrompt += `\n\n请严格遵守以下术语翻译对照表：\n${glossaryText}`;
  }

  const userPrompt = `${customPrompt ? '【用户自定义要求】\n' + customPrompt + '\n\n' : ''}${
    previousContext ? `【前文内容（仅作上下文参考，无需翻译）】\n...${previousContext}\n\n` : ''
  }请将以下中文段落翻译为英文：\n【【【${text}】】】`;
  
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

interface ErrorLike {
  response?: { data?: { error?: string } };
  message?: string;
  code?: string;
}

// 解析API响应
const parseApiResponse = (model: string, response: unknown): string => {
  const res = response as { data?: unknown; choices?: { message: { content: string } }[]; content?: { text: string }[] };
  const responseData = (res.data ? res.data : res) as { choices?: { message: { content: string } }[]; content?: { text: string }[] };
  
  switch (model) {
    case 'gpt-4o':
    case 'deepseek-v3':
      return responseData.choices?.[0]?.message?.content || '';
    case 'claude-3-sonnet':
      return responseData.content?.[0]?.text || '';
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
  glossary,
  maxChunkSize,
  onProgress
}: TranslationRequest & { maxChunkSize?: number }): Promise<TranslationResponse> => {
  const startTime = Date.now();
  
  await checkBackendHealth();
  // 健康检查失败时不阻断流程，继续尝试请求以便在服务短暂不可达时仍可恢复
  const defaultChunkSize = model === 'deepseek-v3' ? 800 : 4000;
  const chunks = splitTextIntoChunks(text, maxChunkSize || defaultChunkSize);
  const total = chunks.length;
  const offsets = computeOffsets(text, chunks);
  const translationErrors: Array<{ chunkIndex: number; message: string }> = [];
  const maxRetries = 3;
  const retryDelay = 2000;
  const concurrency = model === 'deepseek-v3' ? 2 : 3;
  const results: Array<string | undefined> = new Array(total).fill(undefined);

  const translateChunk = async (i: number) => {
    const chunk = chunks[i];
    // 获取前文作为上下文，取前一个分块的最后500个字符
    const previousContext = i > 0 ? chunks[i-1].slice(-500) : undefined;
    
    const requestBody = {
      ...buildRequestBody(model, chunk, customPrompt, glossary, previousContext),
      __meta: { chunkIndex: i, offsetStart: offsets[i]?.start ?? 0, offsetEnd: offsets[i]?.end ?? 0 }
    };
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
          if (!(typeof response.data.success === 'undefined' && response.data.data)) {
            throw new Error(response.data.error || '未知错误');
          }
        }
        const payload = typeof response.data?.success !== 'undefined' && response.data?.data
          ? response.data.data
          : response.data;
        const chunkTranslation = stripPartHeader(parseApiResponse(model, payload));
        const serverChunkIdx = payload?._metadata?.clientMeta?.chunkIndex ?? i;
        results[serverChunkIdx] = chunkTranslation;
        
        // Calculate completed count
        let completedCount = 0;
        for(let k=0; k<total; k++) {
          if (results[k] !== undefined) completedCount++;
        }

        if (onProgress) {
          const cm = payload?._metadata?.clientMeta || {};
          // Replace undefined with empty string for UI safety, but keep array structure
          const safeChunks = results.map(r => r || ''); 
          onProgress(safeChunks, { completed: completedCount, total, lastChunkIndex: serverChunkIdx, offsetStart: cm.offsetStart, offsetEnd: cm.offsetEnd, chunkDelta: chunkTranslation, isChunkFinal: true });
        }
        return;
      } catch (chunkError: unknown) {
        if (retryCount === maxRetries) {
          const err = chunkError as ErrorLike;
          const errorMessage = err.response?.data?.error || err.message;
          translationErrors.push({
            chunkIndex: i,
            message: errorMessage || 'Unknown error'
          });
          results[i] = `[翻译错误: 第${i + 1}部分未能成功翻译]`;
          
          let completedCount = 0;
          for(let k=0; k<total; k++) {
            if (results[k] !== undefined) completedCount++;
          }

          if (onProgress) {
             const safeChunks = results.map(r => r || '');
             onProgress(safeChunks, { completed: completedCount, total });
          }
          return;
        }
        const err = chunkError as ErrorLike;
        const isTransient =
          err.code === 'ECONNABORTED' ||
          err.code === 'ECONNREFUSED' ||
          err.message?.includes('ERR_NETWORK') ||
          err.message?.includes('aborted');
        if (isTransient) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
        retryCount++;
      }
    }
  };

  for (let i = 0; i < total; i += concurrency) {
    const batch: Promise<void>[] = [];
    for (let j = i; j < Math.min(i + concurrency, total); j++) {
      batch.push(translateChunk(j));
    }
    await Promise.all(batch);
  }

  const processingTime = (Date.now() - startTime) / 1000;
  if (translationErrors.length === total) {
    throw new Error('所有翻译请求均失败，请检查API密钥和网络连接');
  }
  const finalChunks = results.map(r => r || '');
  return {
    translatedText: finalChunks.join('\n\n'),
    chunks: finalChunks,
    model,
    processingTime,
    errors: translationErrors.length > 0 ? translationErrors : undefined
  };
};

export const translateTextStream = async ({
  text,
  model,
  apiKey,
  customPrompt = '',
  glossary,
  maxChunkSize,
  onProgress
}: TranslationRequest & { maxChunkSize?: number }): Promise<TranslationResponse> => {
  const startTime = Date.now();
  const defaultChunkSize = model === 'deepseek-v3' ? 800 : 4000;
  const chunks = splitTextIntoChunks(text, maxChunkSize || defaultChunkSize);
  const total = chunks.length;
  const offsets = computeOffsets(text, chunks);
  const results: Array<string | undefined> = new Array(total).fill(undefined);
  let nextToEmit = 0;
  const decode = new TextDecoder();
  const getStreamEndpoint = (m: string): string => {
    switch (m) {
      case 'gpt-4o': return '/api/openai/chat/stream';
      case 'deepseek-v3': return '/api/deepseek/chat/stream';
      case 'claude-3-sonnet': return '/api/anthropic/messages/stream';
      default: throw new Error(`不支持的模型: ${m}`);
    }
  };
  const parseSseChunk = (model: string, line: string): string => {
    try {
      const obj = JSON.parse(line);
      if (model === 'gpt-4o' || model === 'deepseek-v3') {
        const c = obj.choices?.[0]?.delta?.content || obj.choices?.[0]?.message?.content || '';
        return c || '';
      } else {
        const c = obj.delta?.text || obj.content?.[0]?.text || '';
        return c || '';
      }
    } catch {
      return '';
    }
  };
  for (let i = 0; i < total; i++) {
    const endpoint = getStreamEndpoint(model);
    // 获取前文作为上下文，取前一个分块的最后500个字符
    const previousContext = i > 0 ? chunks[i-1].slice(-500) : undefined;
    
    const body = {
      ...buildRequestBody(model, chunks[i], customPrompt, glossary, previousContext),
      __meta: { chunkIndex: i, offsetStart: offsets[i]?.start ?? 0, offsetEnd: offsets[i]?.end ?? 0 },
      stream: true
    };
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'apiKey': apiKey,
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify(body)
    });
    if (!resp.ok || !resp.body) {
      results[i] = `[翻译错误: 第${i + 1}部分未能成功翻译]`;
      while (typeof results[nextToEmit] !== 'undefined') {
        nextToEmit++;
      }
      if (onProgress) {
         const safeChunks = results.map(r => r || '');
         onProgress(safeChunks, { completed: nextToEmit, total });
      }
      continue;
    }
    let buf = '';
    let lastMeta: { chunkIndex?: number; offsetStart?: number; offsetEnd?: number } | null = null;
    const reader = resp.body.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decode.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop() || '';
      for (const evt of parts) {
        const lines = evt.split('\n');
        let eventType = 'message';
        let dataLine = '';
        for (const ln of lines) {
          if (ln.startsWith('event:')) eventType = ln.slice(6).trim();
          if (ln.startsWith('data:')) dataLine += ln.slice(5).trim();
        }
        if (eventType === 'meta') {
          try { lastMeta = JSON.parse(dataLine).clientMeta || null; } catch { /* ignore */ }
          continue;
        }
        if (dataLine === '[DONE]') continue;
        const delta = parseSseChunk(model, dataLine);
        if (delta) {
          const idx = (lastMeta && typeof lastMeta.chunkIndex === 'number') ? lastMeta.chunkIndex : i;
          const existing = results[idx] || '';
          const cleanedBefore = stripPartHeader(existing);
          const cleanedAfter = stripPartHeader(existing + delta);
          const deltaClean = cleanedAfter.slice(cleanedBefore.length);
          results[idx] = cleanedAfter;
          
          if (onProgress) {
            const safeChunks = results.map(r => r || '');
            onProgress(safeChunks, { completed: nextToEmit, total, lastChunkIndex: idx, offsetStart: lastMeta?.offsetStart, offsetEnd: lastMeta?.offsetEnd, chunkDelta: deltaClean, isChunkFinal: false });
          }
        }
      }
    }
    while (typeof results[nextToEmit] !== 'undefined') {
      nextToEmit++;
    }
    if (onProgress) {
       const safeChunks = results.map(r => r || '');
       onProgress(safeChunks, { completed: nextToEmit, total, lastChunkIndex: i, offsetStart: offsets[i]?.start, offsetEnd: offsets[i]?.end, isChunkFinal: true });
    }
  }
  const processingTime = (Date.now() - startTime) / 1000;
  const finalChunks = results.map(r => r || '');
  return { 
      translatedText: finalChunks.join('\n\n'), 
      chunks: finalChunks,
      model, 
      processingTime 
  };
};

// 导出默认翻译函数
export default translateText;
const checkBackendHealth = async (): Promise<boolean> => {
  try {
    const res = await axios.get('/api/health', { timeout: 3000 });
    return !!res.data && res.data.status === 'ok';
  } catch {
    return false;
  }
};