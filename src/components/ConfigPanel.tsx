import React, { useEffect } from 'react';
import { Input, Card, Button, Select } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Password } = Input;

// 预设的专业学术提示词
const PRESET_PROMPTS = [
  {
    key: 'generic',
    label: '通用学术英译',
    prompt:
      '将下文译为正式精准的学术英语：保持术语一致、逻辑清晰、句式简洁、避免主观和冗余；保留数字/单位与符号；必要时使用被动或非人称表达；不臆造新增信息。',
  },
  {
    key: 'spe',
    label: '油气行业SPE会议论文',
    prompt:
      '按 SPE 会议论文语域翻译：采用油气工程术语（reservoir, wellbore, porosity, permeability, drilling, completion, production optimization 等），强调方法与数据的可复现与工程可行性；使用客观、规范单位与缩写（如 API, psi, bbl, mD）；避免营销性措辞与未经数据支持的断言；保持章节语气接近 IMRaD。',
  },
  {
    key: 'paper',
    label: '科技论文风格与格式',
    prompt:
      '按科技论文 IMRaD 风格翻译：引言/方法/结果/讨论语域与词汇；方法多用一般过去时，结论与普遍事实用一般现在时；优先被动或非人称表达；术语与缩写首次出现定义并保持一致；避免口语化与夸张。',
  },
];

interface ConfigPanelProps {
  apiKey: string;
  setApiKey: (key: string) => void;
  customPrompt: string;
  setCustomPrompt: (prompt: string) => void;
  onClose: () => void;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({
  apiKey,
  setApiKey,
  customPrompt,
  setCustomPrompt,
  onClose,
}) => {
  // 从本地存储加载API密钥
  useEffect(() => {
    const savedApiKey = localStorage.getItem('polyglot_api_key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
  }, [setApiKey]);

  // 保存API密钥到本地存储
  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    localStorage.setItem('polyglot_api_key', value);
  };

  const handlePresetChange = (key?: string) => {
    if (!key) return;
    const preset = PRESET_PROMPTS.find((p) => p.key === key);
    if (preset) {
      setCustomPrompt(preset.prompt);
    }
  };

  return (
    <Card
      className="config-panel"
      title={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={onClose}
            style={{ marginRight: '10px' }}
          />
          <span>配置设置</span>
        </div>
      }
    >
      <div className="config-item">
        <h4>API密钥</h4>
        <Password
          value={apiKey}
          onChange={(e) => handleApiKeyChange(e.target.value)}
          placeholder="请输入API密钥"
          visibilityToggle
        />
        <small>密钥仅存储在您的浏览器中，不会传输到我们的服务器</small>
      </div>

      <div className="config-item">
        <h4>自定义提示词/术语表</h4>
        <Select
          options={PRESET_PROMPTS.map((p) => ({ value: p.key, label: p.label }))}
          placeholder="选择预设提示词（选择后可在下方编辑）"
          allowClear
          onChange={handlePresetChange}
          style={{ width: '100%', marginBottom: 8 }}
        />
        <TextArea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="输入或编辑提示词/术语映射，例如：'神经网络': 'neural network'"
          autoSize={{ minRows: 3, maxRows: 6 }}
        />
      </div>
    </Card>
  );
};

export default ConfigPanel;