import React, { useEffect, useRef } from 'react';
import { Typography, Progress, Button, Tooltip } from 'antd';

const { Text } = Typography;

interface OutputAreaProps {
  value: string;
  isLoading: boolean;
  translationTime: number | null;
  modelName: string;
  outputChunks: string[];
  totalChunks: number;
  completedChunks: number;
  selectedChunkIndex: number | null;
  onSelectChunk: (index: number) => void;
}

const OutputArea: React.FC<OutputAreaProps> = ({ 
  value, 
  translationTime, 
  modelName,
  outputChunks,
  totalChunks,
  completedChunks,
  selectedChunkIndex,
  onSelectChunk
}) => {
  const chunkRefs = useRef<any[]>([]);
  const getPreview = (s: string) => (s || '').replace(/\s+/g, ' ').slice(0, 80);
  const getModelDisplayName = (model: string) => {
    switch (model) {
      case 'gpt-4o': return 'GPT-4o';
      case 'deepseek-v3': return 'DeepSeek-V3';
      case 'claude-3-sonnet': return 'Claude-3-Sonnet';
      default: return model;
    }
  };

  useEffect(() => {
    if (
      selectedChunkIndex !== null &&
      typeof selectedChunkIndex === 'number' &&
      chunkRefs.current[selectedChunkIndex]
    ) {
      const el = chunkRefs.current[selectedChunkIndex];
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedChunkIndex]);

  return (
    <div className="output-area">
      <div className="area-header">
        <div className="header-left">
          <h3>翻译结果</h3>
          {totalChunks > 0 && (
            <div className="translation-progress">
              <Progress 
                type="circle" 
                percent={Math.min(100, Math.round(((completedChunks || 0) / totalChunks) * 100))} 
                size={32}
                format={() => `${completedChunks}/${totalChunks}`}
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
        <div className="translation-container">
          <div className="index-list">
            {outputChunks.map((chunk, idx) => (
              <div
                key={idx}
                className={`chunk ${selectedChunkIndex === idx ? 'chunk-active' : ''}`}
                onMouseDown={() => onSelectChunk(idx)}
                onMouseUp={() => onSelectChunk(idx)}
                ref={(el) => {
                  chunkRefs.current[idx] = el as any;
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text type="secondary">第 {idx + 1} 段</Text>
                  <Tooltip title="复制本段">
                    <Button size="small" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(chunk || ''); }}>复制</Button>
                  </Tooltip>
                </div>
                <div className="index-preview">{chunk ? getPreview(chunk) : '正在生成...'}</div>
              </div>
            ))}
            {outputChunks.length === 0 && (
              <div className="chunk">
                {value || '翻译结果将在此处显示'}
              </div>
            )}
          </div>
          <div className="detail-card">
            {selectedChunkIndex !== null ? (
              <div className="chunk">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text type="secondary">第 {selectedChunkIndex + 1} 段</Text>
                  <Tooltip title="复制本段">
                    <Button size="small" onClick={() => navigator.clipboard.writeText(outputChunks[selectedChunkIndex] || '')}>复制</Button>
                  </Tooltip>
                </div>
                <div className="chunk-content">{outputChunks[selectedChunkIndex] || '该段尚未生成'}</div>
              </div>
            ) : (
              <div className="chunk">请选择上方段落卡片查看内容</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OutputArea;