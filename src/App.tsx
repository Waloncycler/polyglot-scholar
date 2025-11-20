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
  const [totalChunks, setTotalChunks] = useState<number>(0);
  const [completedChunks, setCompletedChunks] = useState<number>(0);
  const [selectedChunkIndex, setSelectedChunkIndex] = useState<number | null>(null);
  const [inputRanges, setInputRanges] = useState<Array<{ start: number; end: number }>>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 从本地存储加载设置
  useEffect(() => {
    const savedApiKey = localStorage.getItem(STORAGE_KEYS.API_KEY);
    const savedModel = localStorage.getItem(STORAGE_KEYS.SELECTED_MODEL);
    const savedPrompt = localStorage.getItem(STORAGE_KEYS.CUSTOM_PROMPT);
    
    if (savedApiKey) setApiKey(savedApiKey);
    if (savedModel) setSelectedModel(savedModel);
    if (savedPrompt) setCustomPrompt(savedPrompt);
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
    try {
      const defaultChunkSize = selectedModel === 'deepseek-v3' ? 800 : 4000;
      const preChunks = splitTextIntoChunks(inputText, defaultChunkSize);
      setTotalChunks(preChunks.length);
      setOutputChunks(new Array(preChunks.length).fill(''));
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
            setOutputChunks((prev) => {
              const next = prev.length === totalChunks && prev.length > 0 ? [...prev] : new Array(totalChunks || (stats.total || 0)).fill('');
              const idx = stats!.lastChunkIndex!;
              next[idx] = (next[idx] || '') + (stats!.chunkDelta!);
              return next;
            });
            if (selectedChunkIndex === null) {
              setSelectedChunkIndex(stats.lastChunkIndex as number);
            }
          }
          if (typeof stats?.lastChunkIndex === 'number' && typeof stats?.chunkContent === 'string') {
            setOutputChunks((prev) => {
              const next = prev.length === totalChunks && prev.length > 0 ? [...prev] : new Array(totalChunks || (stats.total || 0)).fill('');
              next[stats!.lastChunkIndex!] = stats!.chunkContent!;
              return next;
            });
          }
          if (typeof stats?.lastChunkIndex === 'number' && typeof stats?.offsetStart === 'number' && typeof stats?.offsetEnd === 'number') {
            setInputRanges((prev) => {
              const next = [...prev];
              next[stats!.lastChunkIndex!] = { start: stats!.offsetStart!, end: stats!.offsetEnd! } as any;
              return next;
            });
          }
        }
      });
      setTranslationTime(result.processingTime);
      message.success('翻译完成');
    } catch (error) {
      console.error('Translation error:', error);
      const errorMessage = (error as any).response?.data?.error || (error as any).message || '翻译过程中发生未知错误';
      message.error(errorMessage);
    } finally {
      setIsLoading(false);
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
          
      <OutputArea 
        value={outputText}
        isLoading={isLoading}
        translationTime={translationTime}
        modelName={selectedModel}
        outputChunks={outputChunks}
        totalChunks={totalChunks}
        completedChunks={completedChunks}
        selectedChunkIndex={selectedChunkIndex}
        onSelectChunk={(idx) => {
          if (idx < 0 || idx >= inputRanges.length) return;
              setSelectedChunkIndex(idx);
              const range = inputRanges[idx];
              const el: any = inputRef.current;
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
          />
        </div>
      </Content>
    </Layout>
  );
}

export default App;
