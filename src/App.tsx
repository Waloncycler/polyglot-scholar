import { useState, useEffect } from 'react';
import { Layout, Typography, Button, Select, Spin, message, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import './App.css';
import TextInputArea from './components/TextInputArea';
import OutputArea from './components/OutputArea';
import ConfigPanel from './components/ConfigPanel';
import { SUPPORTED_MODELS, STORAGE_KEYS } from './utils/modelConfig';
import translateText from './services/translationService';


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
    try {
      const result = await translateText({
        text: inputText,
        model: selectedModel,
        apiKey: apiKey,
        customPrompt: customPrompt,
        onProgress: (text) => {
          setOutputText(text);
          // 更新分段显示
          const chunks = text.split(/\n\n/);
          setOutputChunks(chunks);
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
          />
          
          <OutputArea 
            value={outputText}
            isLoading={isLoading}
            translationTime={translationTime}
            modelName={selectedModel}
            outputChunks={outputChunks}
          />
        </div>
      </Content>
    </Layout>
  );
}

export default App;
