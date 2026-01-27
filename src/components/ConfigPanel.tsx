import React, { useEffect, useState } from 'react';
import { Input, Drawer, Button, Select, List, Space, Typography, Tag } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Password } = Input;
const { Text } = Typography;

// 预设的专业学术提示词
const PRESET_PROMPTS = [
  {
    key: 'generic',
    label: '通用学术英译 (Generic Academic)',
    prompt:
      'Translate into formal, precise academic English. Maintain terminology consistency, clear logic, and concise sentence structures. Avoid subjective or redundant phrasing. Use passive voice or impersonal expressions where appropriate.',
  },
  {
    key: 'cs',
    label: '计算机科学 (Computer Science)',
    prompt:
      'Translate following CS academic conventions (e.g., IEEE/ACM style). Strictly preserve technical terms (e.g., "cloud computing", "latency", "throughput"). Use "we propose", "our method" for contributions. Handle code/variables/LaTeX verbatim.',
  },
  {
    key: 'bio',
    label: '生物医学 (Biomedical)',
    prompt:
      'Translate using standard medical/biological terminology (e.g., PubMed/Nature style). Ensure precise anatomical and chemical nomenclature. Use objective, evidence-based tone.',
  },
  {
    key: 'social',
    label: '人文社科 (Social Sciences)',
    prompt:
      'Translate with a focus on nuance and cultural context. Use sophisticated vocabulary appropriate for humanities/social science journals. Maintain the author\'s voice while ensuring academic rigor.',
  },
  {
    key: 'spe',
    label: '油气工程 (Oil & Gas SPE)',
    prompt:
      'Translate for SPE conference papers: Use oil & gas engineering terms (reservoir, porosity, permeability). Emphasize reproducibility and engineering feasibility. Use standard units (API, psi, bbl). Avoid marketing language.',
  },
];

const QUICK_MODIFIERS = [
  { label: 'British English', value: 'Use British English spelling (e.g., colour, analyse).' },
  { label: 'LaTeX', value: 'Do not translate LaTeX formulas or code blocks.' },
  { label: 'First Person', value: 'Use active voice with "We" for the authors\' actions.' },
  { label: 'Passive Voice', value: 'Prefer passive voice for objective description.' },
  { label: 'No Chinglish', value: 'Avoid "Chinglish" expressions; ensure natural English flow.' },
];

interface ConfigPanelProps {
  visible: boolean;
  apiKey: string;
  setApiKey: (key: string) => void;
  customPrompt: string;
  setCustomPrompt: (prompt: string) => void;
  glossary: { [key: string]: string };
  setGlossary: (glossary: { [key: string]: string }) => void;
  onClose: () => void;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({
  visible,
  apiKey,
  setApiKey,
  customPrompt,
  setCustomPrompt,
  glossary,
  setGlossary,
  onClose,
}) => {
  const [newTermSource, setNewTermSource] = useState('');
  const [newTermTarget, setNewTermTarget] = useState('');

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

  const handleAddModifier = (modifierValue: string) => {
    if (customPrompt.includes(modifierValue)) return;
    const newPrompt = customPrompt ? `${customPrompt}\n- ${modifierValue}` : `- ${modifierValue}`;
    setCustomPrompt(newPrompt);
  };

  const handleAddTerm = () => {
    if (!newTermSource.trim() || !newTermTarget.trim()) return;
    const newGlossary = { ...glossary, [newTermSource.trim()]: newTermTarget.trim() };
    setGlossary(newGlossary);
    setNewTermSource('');
    setNewTermTarget('');
  };

  const handleDeleteTerm = (key: string) => {
    const newGlossary = { ...glossary };
    delete newGlossary[key];
    setGlossary(newGlossary);
  };

  return (
    <Drawer
      title="配置设置"
      placement="right"
      onClose={onClose}
      open={visible}
      width={600}
      className="config-panel-drawer"
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
        <h4>术语表 (Glossary)</h4>
        <div style={{ marginBottom: 16 }}>
          <Space.Compact style={{ width: '100%' }}>
            <Input 
              placeholder="原文 (如: Agent)" 
              value={newTermSource}
              onChange={(e) => setNewTermSource(e.target.value)}
            />
            <Input 
              placeholder="译文 (如: 智能体)" 
              value={newTermTarget}
              onChange={(e) => setNewTermTarget(e.target.value)}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddTerm}>添加</Button>
          </Space.Compact>
        </div>
        
        {Object.keys(glossary).length > 0 ? (
          <List
            size="small"
            bordered
            dataSource={Object.entries(glossary)}
            renderItem={([key, value]) => (
              <List.Item
                actions={[
                  <Button 
                    type="text" 
                    danger 
                    icon={<DeleteOutlined />} 
                    onClick={() => handleDeleteTerm(key)}
                  />
                ]}
              >
                <Text strong>{key}</Text>
                <ArrowLeftOutlined style={{ margin: '0 8px', color: '#999', transform: 'rotate(180deg)' }} />
                <Text>{value}</Text>
              </List.Item>
            )}
            style={{ maxHeight: '200px', overflow: 'auto' }}
          />
        ) : (
          <div style={{ color: '#999', textAlign: 'center', padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
            暂无术语，请在上方添加
          </div>
        )}
      </div>

      <div className="config-item">
        <h4>自定义提示词</h4>
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
        <div style={{ marginTop: 12 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>快速修饰符 (点击添加):</Text>
          <Space size={[0, 8]} wrap>
            {QUICK_MODIFIERS.map((mod) => (
              <Tag 
                key={mod.label} 
                onClick={() => handleAddModifier(mod.value)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
                color="blue"
              >
                <PlusOutlined style={{ marginRight: 4 }} />
                {mod.label}
              </Tag>
            ))}
          </Space>
        </div>
      </div>
    </Drawer>
  );
};

export default ConfigPanel;