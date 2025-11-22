import { useState, useEffect, useRef } from 'react';
import { Layout, Typography, Button, Select, message, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import './App.css';
import TextInputArea from './components/TextInputArea';
import OutputArea from './components/OutputArea';
import ConfigPanel from './components/ConfigPanel';
import { SUPPORTED_MODELS, STORAGE_KEYS } from './utils/modelConfig';
import translateText, { splitTextIntoChunks, translateTextStream } from './services/translationService';


const { Header, Content } = Layout;
const { Title } = Typography;
const { Option } = Select;

function App() {
  const [inputText, setInputText] = useState<string>('');
  const [outputText, setOutputText] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [configVisible, setConfigVisible] = useState<boolean>(false);
  const [translationTime, setTranslationTime] = useState<number | null>(null);
  const [outputChunks, setOutputChunks] = useState<string[]>([]);
  const outputChunksRef = useRef<string[]>([]);
  const [totalChunks, setTotalChunks] = useState<number>(0);
  const [completedChunks, setCompletedChunks] = useState<number>(0);
  const [selectedChunkIndex, setSelectedChunkIndex] = useState<number | null>(null);
  const [inputRanges, setInputRanges] = useState<Array<{ start: number; end: number }>>([]);
  const [chunkStates, setChunkStates] = useState<Array<'pending' | 'streaming' | 'completed' | 'error'>>([]);
  const chunkStatesRef = useRef<Array<'pending' | 'streaming' | 'completed' | 'error'>>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [inputHidden, setInputHidden] = useState<boolean>(false);

  // 从本地存储加载设置
  useEffect(() => {
    const savedApiKey = localStorage.getItem(STORAGE_KEYS.API_KEY);
    const savedModel = localStorage.getItem(STORAGE_KEYS.SELECTED_MODEL);
    const savedPrompt = localStorage.getItem(STORAGE_KEYS.CUSTOM_PROMPT);
    const savedInput = localStorage.getItem(STORAGE_KEYS.TR_INPUT_TEXT);
    const savedOutput = localStorage.getItem(STORAGE_KEYS.TR_OUTPUT_TEXT);
    const savedChunks = localStorage.getItem(STORAGE_KEYS.TR_OUTPUT_CHUNKS);
    const savedRanges = localStorage.getItem(STORAGE_KEYS.TR_INPUT_RANGES);
    const savedIndex = localStorage.getItem(STORAGE_KEYS.TR_SELECTED_INDEX);
    const savedTotal = localStorage.getItem(STORAGE_KEYS.TR_TOTAL_CHUNKS);
    const savedCompleted = localStorage.getItem(STORAGE_KEYS.TR_COMPLETED_CHUNKS);
    const savedTime = localStorage.getItem(STORAGE_KEYS.TR_TIME);
    const savedStates = localStorage.getItem(STORAGE_KEYS.TR_CHUNK_STATES);
    
    if (savedApiKey) setApiKey(savedApiKey);
    if (savedModel) setSelectedModel(savedModel);
    if (savedPrompt) setCustomPrompt(savedPrompt);
    if (savedInput) setInputText(savedInput);
    if (savedOutput) setOutputText(savedOutput);
    if (savedChunks) { try { const arr = JSON.parse(savedChunks); if (Array.isArray(arr)) { setOutputChunks(arr); outputChunksRef.current = arr; } } catch (e) { void e; } }
    if (savedRanges) {
      try { setInputRanges(JSON.parse(savedRanges)); } catch (e) { void e; }
    }
    if (savedIndex) {
      const n = Number(savedIndex);
      if (!Number.isNaN(n)) setSelectedChunkIndex(n);
    }
    if (savedTotal) { const n = Number(savedTotal); if (!Number.isNaN(n)) setTotalChunks(n); }
    if (savedCompleted) { const n = Number(savedCompleted); if (!Number.isNaN(n)) setCompletedChunks(n); }
    if (savedTime) { const n = Number(savedTime); if (!Number.isNaN(n)) setTranslationTime(n); }
    if (savedStates) { try { const st = JSON.parse(savedStates); if (Array.isArray(st)) { setChunkStates(st); chunkStatesRef.current = st; } } catch (e) { void e; } }

    // 若未持久化分段，但有完整输出，则按双换行拆分恢复卡片形式
    try {
      const chk = savedChunks ? JSON.parse(savedChunks) : null;
      const needRestore = (!chk || !Array.isArray(chk)) && !!savedOutput;
      if (needRestore) {
        const restored = (savedOutput || '').split(/\n\n/);
        setOutputChunks(restored);
        outputChunksRef.current = restored;
        const st = restored.map((c) => (c && c.trim().length > 0 ? 'completed' : 'pending')) as Array<'pending' | 'streaming' | 'completed' | 'error'>;
        setChunkStates(st);
        chunkStatesRef.current = st;
        setTotalChunks(restored.length);
        setCompletedChunks(st.filter((s) => s === 'completed').length);
        if (selectedChunkIndex === null && restored.length > 0) setSelectedChunkIndex(0);
      }
    } catch (e) { void e; }
  }, []);

  // 保存模型选择到本地存储
  const handleModelChange = (value: string) => {
    setSelectedModel(value);
    localStorage.setItem(STORAGE_KEYS.SELECTED_MODEL, value);
  };

  // 保存自定义提示词到本地存储
  const handleCustomPromptChange = (value: string) => {
    setCustomPrompt(value);
    localStorage.setItem(STORAGE_KEYS.CUSTOM_PROMPT, value);
  };

  // 保存API密钥到本地存储
  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    localStorage.setItem(STORAGE_KEYS.API_KEY, value);
  };

  // 持久化翻译状态，防止页面刷新或热更新后内容丢失
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.TR_INPUT_TEXT, inputText); }, [inputText]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.TR_OUTPUT_TEXT, outputText); }, [outputText]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.TR_OUTPUT_CHUNKS, JSON.stringify(outputChunks)); }, [outputChunks]);
  useEffect(() => { outputChunksRef.current = outputChunks; }, [outputChunks]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.TR_INPUT_RANGES, JSON.stringify(inputRanges)); }, [inputRanges]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.TR_SELECTED_INDEX, String(selectedChunkIndex ?? '')); }, [selectedChunkIndex]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.TR_TOTAL_CHUNKS, String(totalChunks)); }, [totalChunks]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.TR_COMPLETED_CHUNKS, String(completedChunks)); }, [completedChunks]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.TR_TIME, String(translationTime ?? '')); }, [translationTime]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.TR_CHUNK_STATES, JSON.stringify(chunkStates)); chunkStatesRef.current = chunkStates; }, [chunkStates]);

  const setChunkContentAtomic = (idx: number, content: string, final: boolean, stateOverride?: 'pending' | 'streaming' | 'completed' | 'error') => {
    setOutputChunks((prev) => {
      const total = totalChunks || prev.length;
      const base = prev.length ? [...prev] : new Array(total).fill('');
      // 原子保护：已完成的段不再被覆盖
      if (chunkStatesRef.current[idx] === 'completed') return prev;
      base[idx] = content;
      return base;
    });
    setChunkStates((prev) => {
      const base = prev.length ? [...prev] : new Array(totalChunks || outputChunksRef.current.length).fill('pending') as Array<'pending' | 'streaming' | 'completed' | 'error'>;
      base[idx] = stateOverride ? stateOverride : (final ? 'completed' : 'streaming');
      // 统计完成段数
      const done = base.filter((s) => s === 'completed').length;
      setCompletedChunks(done);
      return base;
    });
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) {
      message.error('请输入需要翻译的文本');
      return;
    }
    if (!apiKey.trim()) {
      message.error('请输入API密钥');
      return;
    }
    setIsLoading(true);
    setOutputChunks([]);
    setOutputText('');
    setTranslationTime(null);
    setTotalChunks(0);
    setCompletedChunks(0);
    setSelectedChunkIndex(null);
    setInputHidden(false);
    try {
      const defaultChunkSize = selectedModel === 'deepseek-v3' ? 800 : 4000;
      const preChunks = splitTextIntoChunks(inputText, defaultChunkSize);
      setTotalChunks(preChunks.length);
      const initial = new Array(preChunks.length).fill('');
      setOutputChunks(initial);
      outputChunksRef.current = initial;
      setChunkStates(new Array(preChunks.length).fill('pending') as Array<'pending' | 'streaming' | 'completed' | 'error'>);
      chunkStatesRef.current = new Array(preChunks.length).fill('pending') as Array<'pending' | 'streaming' | 'completed' | 'error'>;
      const ranges: Array<{ start: number; end: number }> = [];
      let searchPos = 0;
      for (const chunk of preChunks) {
        const cleaned = chunk.replace(/^\[这是第[\s\S]*?\]\n\n/, '');
        const idx = inputText.indexOf(cleaned.slice(0, Math.min(cleaned.length, 50)).trim(), searchPos);
        const start = idx >= 0 ? idx : searchPos;
        const end = Math.min(start + cleaned.length, inputText.length);
        ranges.push({ start, end });
        searchPos = end;
      }
      setInputRanges(ranges);
      // 持久化初始分段与范围，确保刷新后仍可查看
      localStorage.setItem(STORAGE_KEYS.TR_INPUT_TEXT, inputText);
      localStorage.setItem(STORAGE_KEYS.TR_OUTPUT_CHUNKS, JSON.stringify(new Array(preChunks.length).fill('')));
      localStorage.setItem(STORAGE_KEYS.TR_INPUT_RANGES, JSON.stringify(ranges));
      localStorage.setItem(STORAGE_KEYS.TR_TOTAL_CHUNKS, String(preChunks.length));
      const useStream = selectedModel === 'gpt-4o' || selectedModel === 'deepseek-v3' || selectedModel === 'claude-3-sonnet';
      const translator = useStream ? translateTextStream : translateText;
      const result = await translator({
        text: inputText,
        model: selectedModel,
        apiKey: apiKey,
        customPrompt: customPrompt,
        onProgress: (text, stats) => {
          setOutputText(text);
          if (typeof stats?.total === 'number' && typeof stats?.completed === 'number') {
            setCompletedChunks(stats.completed);
            setTotalChunks(stats.total);
          }
          if (typeof stats?.lastChunkIndex === 'number' && typeof stats?.chunkDelta === 'string') {
            const idx = stats.lastChunkIndex as number;
            const existing = outputChunksRef.current[idx] || '';
            const merged = existing + stats.chunkDelta!;
            setChunkContentAtomic(idx, merged, !!stats.isChunkFinal);
            if (selectedChunkIndex === null) {
              setSelectedChunkIndex(stats.lastChunkIndex as number);
            }
          }
          if (typeof stats?.lastChunkIndex === 'number' && typeof stats?.chunkContent === 'string') {
            const idx = stats.lastChunkIndex as number;
            const state = stats.isError ? 'error' : (stats.isChunkFinal ? 'completed' : 'streaming');
            setChunkContentAtomic(idx, stats.chunkContent!, !!stats.isChunkFinal, state);
          }
          if (typeof stats?.lastChunkIndex === 'number' && typeof stats?.offsetStart === 'number' && typeof stats?.offsetEnd === 'number') {
            setInputRanges((prev) => {
              const next = [...prev];
              const li = stats.lastChunkIndex as number;
              const st = stats.offsetStart as number;
              const en = stats.offsetEnd as number;
              next[li] = { start: st, end: en };
              return next;
            });
          }
        }
      });
      setTranslationTime(result.processingTime);
      message.success('翻译完成');
    } catch (error) {
      console.error('Translation error:', error);
      const e = error as unknown;
      let errorMessage = '翻译过程中发生未知错误';
      if (typeof e === 'object' && e) {
        const resp = (e as { response?: { data?: { error?: string } } }).response;
        const msg = (e as { message?: string }).message;
        errorMessage = resp?.data?.error || msg || errorMessage;
      }
      message.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryAll = async () => {
    if (isRetrying || isLoading) return;
    if (!inputText.trim()) {
      message.error('请输入需要翻译的文本');
      return;
    }
    if (!apiKey.trim()) {
      message.error('请输入API密钥');
      return;
    }
    setIsRetrying(true);
    try {
      const useStream = selectedModel === 'gpt-4o' || selectedModel === 'deepseek-v3' || selectedModel === 'claude-3-sonnet';
      const translator = useStream ? translateTextStream : translateText;
      const run = async () => translator({
        text: inputText,
        model: selectedModel,
        apiKey: apiKey,
        customPrompt: customPrompt,
        onProgress: (text, stats) => {
          setOutputText(text);
          if (typeof stats?.lastChunkIndex === 'number') {
            const idx = stats.lastChunkIndex as number;
            if (chunkStatesRef.current[idx] !== 'completed') {
              if (typeof stats?.chunkContent === 'string') {
                const state = stats.isError ? 'error' : (stats.isChunkFinal ? 'completed' : 'streaming');
                setChunkContentAtomic(idx, stats.chunkContent!, !!stats.isChunkFinal, state);
              } else if (typeof stats?.chunkDelta === 'string') {
                const merged = (outputChunksRef.current[idx] || '') + stats.chunkDelta!;
                setChunkContentAtomic(idx, merged, !!stats.isChunkFinal);
              }
            }
          }
          if (typeof stats?.total === 'number' && typeof stats?.completed === 'number') {
            setCompletedChunks(stats.completed);
            setTotalChunks(stats.total);
          }
        }
      });
      try {
        const res = await run();
        setTranslationTime(res.processingTime);
        message.success('重新请求完成');
      } catch (e) {
        if (useStream) {
          try {
            const res = await translateText({
              text: inputText,
              model: selectedModel,
              apiKey: apiKey,
              customPrompt: customPrompt,
              onProgress: (text, stats) => {
                setOutputText(text);
                if (typeof stats?.lastChunkIndex === 'number') {
                  const idx = stats.lastChunkIndex as number;
                  if (chunkStatesRef.current[idx] !== 'completed' && typeof stats?.chunkContent === 'string') {
                    const state = stats.isError ? 'error' : (stats.isChunkFinal ? 'completed' : 'streaming');
                    setChunkContentAtomic(idx, stats.chunkContent!, !!stats.isChunkFinal, state);
                  }
                }
                if (typeof stats?.total === 'number' && typeof stats?.completed === 'number') {
                  setCompletedChunks(stats.completed);
                  setTotalChunks(stats.total);
                }
              }
            });
            setTranslationTime(res.processingTime);
            message.success('降级模式重新请求完成');
          } catch (err2) {
          console.error('Retry failed:', err2);
          const e2 = err2 as unknown;
          const msg2 = typeof e2 === 'object' && e2 ? (e2 as { message?: string }).message : undefined;
          message.error(msg2 || '重新请求失败');
          }
        } else {
          console.error('Retry failed:', e);
          const ee = e as unknown;
          const msg = typeof ee === 'object' && ee ? (ee as { message?: string }).message : undefined;
          message.error(msg || '重新请求失败');
        }
      }
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <Layout className="app-container">
      <Header className="app-header">
        <Title level={3} style={{ color: 'white', margin: 0 }}>
          Polyglot Scholar - 智能文献翻译平台
        </Title>
      </Header>
      
      <Content className="app-content">
        <div className="control-panel">
          <Select 
            value={selectedModel} 
            onChange={handleModelChange}
            style={{ width: 180 }}
            popupRender={(menu) => (
              <div>
                {menu}
                <div className="model-info">
                  {SUPPORTED_MODELS.find(m => m.value === selectedModel)?.description}
                </div>
              </div>
            )}
          >
            {SUPPORTED_MODELS.map(model => (
              <Option key={model.value} value={model.value}>
                {model.label}
              </Option>
            ))}
          </Select>
          
          <Button 
            type="primary" 
            onClick={handleTranslate}
            loading={isLoading}
          >
            翻译
          </Button>
          
          <Button 
            type="link" 
            onClick={() => setConfigVisible(!configVisible)}
          >
            显示配置
          </Button>
          
          <Tooltip title="上传中文文献，选择模型，输入API密钥，即可获得高质量英文翻译">
            <InfoCircleOutlined style={{ fontSize: '16px', color: '#1677ff' }} />
          </Tooltip>
        </div>
        
        {configVisible && (
          <ConfigPanel 
            apiKey={apiKey}
            setApiKey={handleApiKeyChange}
            customPrompt={customPrompt}
            setCustomPrompt={handleCustomPromptChange}
            onClose={() => setConfigVisible(false)}
          />
        )}
        
        <div className="translation-area">
          {!inputHidden && (
            <TextInputArea 
              value={inputText}
              onChange={setInputText}
              isLoading={isLoading}
              selectionRange={selectedChunkIndex !== null ? inputRanges[selectedChunkIndex] : null}
              onSelectionChange={(start, end) => {
                const idx = inputRanges.findIndex(r => start >= r.start && end <= r.end);
                if (idx >= 0) setSelectedChunkIndex(idx);
              }}
              textareaRef={inputRef}
            />
          )}
          
      <OutputArea 
        value={outputText}
        isLoading={isLoading}
        translationTime={translationTime}
        modelName={selectedModel}
        outputChunks={outputChunks}
        totalChunks={totalChunks}
        completedChunks={completedChunks}
        chunkStates={chunkStates}
        selectedChunkIndex={selectedChunkIndex}
        onRetry={handleRetryAll}
        retrying={isRetrying}
        onSelectChunk={(idx) => {
          if (idx < 0 || idx >= inputRanges.length) return;
              setSelectedChunkIndex(idx);
              const range = inputRanges[idx];
              const el = inputRef.current as HTMLTextAreaElement | null;
              if (range && el && typeof el.setSelectionRange === 'function') {
                el.focus();
                el.setSelectionRange(range.start, range.end);
                const totalScrollRange = el.scrollHeight - el.clientHeight;
                if (totalScrollRange > 0 && typeof el.value === 'string') {
                  const middle = (range.start + range.end) / 2;
                  const ratio = Math.min(1, Math.max(0, middle / el.value.length));
                  const target = Math.floor(ratio * totalScrollRange - el.clientHeight * 0.3);
                  el.scrollTo({ top: Math.max(0, Math.min(totalScrollRange, target)), behavior: 'smooth' });
                }
              }
            }}
        inputText={inputText}
        inputRanges={inputRanges}
        isInputHidden={inputHidden}
        onToggleInputHidden={() => setInputHidden((v) => !v)}
        onSelectOriginalRange={(start, end, idx) => {
          const el = inputRef.current as HTMLTextAreaElement | null;
          if (typeof idx === 'number' && idx >= 0 && idx < inputRanges.length) {
            setSelectedChunkIndex(idx);
          }
          if (el && typeof el.setSelectionRange === 'function') {
            el.focus();
            el.setSelectionRange(start, end);
            const totalScrollRange = el.scrollHeight - el.clientHeight;
            if (totalScrollRange > 0 && typeof el.value === 'string') {
              const middle = (start + end) / 2;
              const ratio = Math.min(1, Math.max(0, middle / el.value.length));
              const target = Math.floor(ratio * totalScrollRange - el.clientHeight * 0.3);
              el.scrollTo({ top: Math.max(0, Math.min(totalScrollRange, target)), behavior: 'smooth' });
            }
          }
        }}
      />
        </div>
      </Content>
    </Layout>
  );
}

export default App;
