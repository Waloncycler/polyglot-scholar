import React from 'react';
import { Input, Spin, Typography, Progress } from 'antd';

const { TextArea } = Input;
const { Text } = Typography;

interface OutputAreaProps {
  value: string;
  isLoading: boolean;
  translationTime: number | null;
  modelName: string;
  outputChunks: string[];
}

const OutputArea: React.FC<OutputAreaProps> = ({ 
  value, 
  isLoading, 
  translationTime, 
  modelName,
  outputChunks 
}) => {
  const getModelDisplayName = (model: string) => {
    switch (model) {
      case 'gpt-4o': return 'GPT-4o';
      case 'deepseek-v3': return 'DeepSeek-V3';
      case 'claude-3-sonnet': return 'Claude-3-Sonnet';
      default: return model;
    }
  };

  return (
    <div className="output-area">
      <div className="area-header">
        <div className="header-left">
          <h3>翻译结果</h3>
          {outputChunks.length > 0 && (
            <div className="translation-progress">
              <Progress 
                type="circle" 
                percent={Math.min(100, outputChunks.length * 10)} 
                size={32}
                format={() => `${outputChunks.length}`}
              />
              <Text type="secondary">已完成段数</Text>
            </div>
          )}
        </div>
        <div className="output-info">
          {modelName && (
            <Text type="secondary" className="output-model">
              模型：{getModelDisplayName(modelName)}
            </Text>
          )}
          {translationTime !== null && (
            <Text type="secondary" className="output-time">
              用时：{translationTime}秒
            </Text>
          )}
        </div>
      </div>
      
      <div className="output-content">
        <Spin spinning={isLoading} tip="正在翻译...">
          <div className="translation-container">
            <div className="translation-result">
              <TextArea
                value={value}
                readOnly
                className="result-textarea"
                placeholder="翻译结果将在此处显示"
              />
            </div>
          </div>
        </Spin>
      </div>
    </div>
  );
};

export default OutputArea;