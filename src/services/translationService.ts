import axios from 'axios';

interface TranslationRequest {
  text: string;
  model: string;
  apiKey: string;
  customPrompt?: string;
  onProgress?: (text: string, stats?: { completed: number; total: number; lastChunkIndex?: number; offsetStart?: number; offsetEnd?: number; chunkDelta?: string; chunkContent?: string; isChunkFinal?: boolean }) => void;
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
  if (text.length <= maxChunkSize) return [text];
  const chunks: string[] = [];
  let current = '';
  // 保留原文段落逻辑：以空行作为段落分隔，不删除空行
  const paragraphs = text.split(/\n{2,}/); // 两个及以上换行视为段落分隔
  for (const para of paragraphs) {
    const paragraph = para; // 保留原样
    if (!paragraph.trim()) {
      // 空段落作为分隔，但不单独入块
      continue;
    }
    if (paragraph.length > maxChunkSize) {
      // 段落过长时按句子再分割，仍保持原顺序
      const sentences = paragraph.split(/(?<=[。！？.!?])\s+/);
      for (const s of sentences) {
        if (s.length > maxChunkSize) {
          // 极长句按字符安全切分
          let rest = s;
          while (rest.length > 0) {
            const size = Math.min(rest.length, maxChunkSize);
            let splitPoint = size;
            if (size < rest.length) {
              for (let i = size - 1; i >= Math.floor(size * 0.8); i--) {
                if ('，,。.！!？?;；:：'.includes(rest[i])) { splitPoint = i + 1; break; }
              }
            }
            const piece = rest.slice(0, splitPoint);
            if (current.length === 0) current = piece; else current += '\n\n' + piece;
            if (current.length >= maxChunkSize * 0.95) { chunks.push(current); current = ''; }
            rest = rest.slice(splitPoint);
          }
        } else {
          const addition = s;
          if (current.length === 0) current = addition; else current += '\n\n' + addition;
          if (current.length >= maxChunkSize * 0.95) { chunks.push(current); current = ''; }
        }
      }
    } else {
      const addition = paragraph;
      if (current.length === 0) current = addition; else current += '\n\n' + addition;
      if (current.length >= maxChunkSize * 0.95) { chunks.push(current); current = ''; }
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
};

const computeOffsets = (original: string, chunks: string[]): Array<{ start: number; end: number }> => {
  const ranges: Array<{ start: number; end: number }> = [];
  let pos = 0;
  for (const chunk of chunks) {
    const cleaned = chunk.replace(/^\[这是第[\s\S]*?\]\n\n/, '');
    const probe = cleaned.slice(0, Math.min(50, cleaned.length)).trim();
    const idx = original.indexOf(probe, pos);
    const start = idx >= 0 ? idx : pos;
    const end = Math.min(start + cleaned.length, original.length);
    ranges.push({ start, end });
    pos = end;
  }
  return ranges;
};

const stripPartHeader = (s: string): string => {
  return s.replace(/^\s*(\*\*\s*)?\[\s*Part\s+\d+\s+of\s+\d+\s*\](\s*\*\*)?\s*/i, '')
          .replace(/^\s*\[这是第[\s\S]*?\]\s*/i, '');
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
  const responseData = response?.data ? response.data : response;
  
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
    await checkBackendHealth();
    // 健康检查失败时不阻断流程，继续尝试请求以便在服务短暂不可达时仍可恢复
    const defaultChunkSize = model === 'deepseek-v3' ? 800 : 4000;
    const chunks = splitTextIntoChunks(text, maxChunkSize || defaultChunkSize);
    const total = chunks.length;
    const offsets = computeOffsets(text, chunks);
    let translatedText = '';
    let translationErrors: Array<{ chunkIndex: number; message: string }> = [];
    const maxRetries = 3;
    const retryDelay = 2000;
    const concurrency = model === 'deepseek-v3' ? 2 : 3;
    const results: Array<string | undefined> = new Array(total).fill(undefined);
    let nextToEmit = 0;

    const translateChunk = async (i: number) => {
      const chunk = chunks[i];
      const requestBody = {
        ...buildRequestBody(model, chunk, customPrompt),
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
            if (typeof response.data.success === 'undefined' && response.data.data) {
            } else {
              throw new Error(response.data.error || '未知错误');
            }
          }
          const payload = typeof response.data?.success !== 'undefined' && response.data?.data
            ? response.data.data
            : response.data;
          const chunkTranslation = stripPartHeader(parseApiResponse(model, payload));
          const serverChunkIdx = payload?._metadata?.clientMeta?.chunkIndex ?? i;
          results[serverChunkIdx] = chunkTranslation + (total > 1 ? '\n\n' : '');
          while (typeof results[nextToEmit] !== 'undefined') {
            translatedText += results[nextToEmit] as string;
            nextToEmit++;
          }
          if (onProgress) {
            const cm = payload?._metadata?.clientMeta || {};
            onProgress(translatedText.trim(), { completed: nextToEmit, total, lastChunkIndex: serverChunkIdx, offsetStart: cm.offsetStart, offsetEnd: cm.offsetEnd, chunkDelta: chunkTranslation, chunkContent: results[serverChunkIdx] || chunkTranslation, isChunkFinal: true });
          }
          return;
        } catch (chunkError: any) {
          if (retryCount === maxRetries) {
            translationErrors.push({
              chunkIndex: i,
              message: chunkError.response?.data?.error || chunkError.message
            });
            const errorMessage = `[翻译错误: 第${i + 1}部分未能成功翻译]\n\n`;
            results[i] = errorMessage;
            while (typeof results[nextToEmit] !== 'undefined') {
              translatedText += results[nextToEmit] as string;
              nextToEmit++;
            }
            if (onProgress) {
              onProgress(translatedText.trim(), { completed: nextToEmit, total });
            }
            return;
          }
          const isTransient =
            chunkError.code === 'ECONNABORTED' ||
            chunkError.code === 'ECONNREFUSED' ||
            chunkError.message?.includes('ERR_NETWORK') ||
            chunkError.message?.includes('aborted');
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
    return {
      translatedText: translatedText.trim(),
      model,
      processingTime,
      errors: translationErrors.length > 0 ? translationErrors : undefined
    };
  } catch (error) {
    throw error as any;
  }
};

export const translateTextStream = async ({
  text,
  model,
  apiKey,
  customPrompt = '',
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
    const body = {
      ...buildRequestBody(model, chunks[i], customPrompt),
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
      results[i] = `[翻译错误: 第${i + 1}部分未能成功翻译]\n\n`;
      while (typeof results[nextToEmit] !== 'undefined') {
        nextToEmit++;
      }
      if (onProgress) onProgress((results.filter(Boolean).join('') || '').trim(), { completed: nextToEmit, total });
      continue;
    }
    let buf = '';
    let lastMeta: any = null;
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
          try { lastMeta = JSON.parse(dataLine).clientMeta || null; } catch {}
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
          const assembled = (results.map((r) => (r ? r + (total > 1 ? '\n\n' : '') : '')).join('')).trim();
          if (onProgress) {
            onProgress(assembled, { completed: nextToEmit, total, lastChunkIndex: idx, offsetStart: lastMeta?.offsetStart, offsetEnd: lastMeta?.offsetEnd, chunkDelta: deltaClean, chunkContent: results[idx], isChunkFinal: false });
          }
        }
      }
    }
    while (typeof results[nextToEmit] !== 'undefined') {
      nextToEmit++;
    }
    const assembled = (results.map((r) => (r ? r + (total > 1 ? '\n\n' : '') : '')).join('')).trim();
    if (onProgress) onProgress(assembled, { completed: nextToEmit, total, lastChunkIndex: i, offsetStart: offsets[i]?.start, offsetEnd: offsets[i]?.end, chunkContent: results[i], isChunkFinal: true });
  }
  const processingTime = (Date.now() - startTime) / 1000;
  return { translatedText: (results.map((r) => (r ? r + (total > 1 ? '\n\n' : '') : '')).join('')).trim(), model, processingTime };
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