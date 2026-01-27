import React, { useState, useRef } from 'react';
import { Typography, Empty, Spin, Button, Input, Space, message } from 'antd';
import { EditOutlined, SaveOutlined, CloseOutlined, CopyOutlined } from '@ant-design/icons';

const { Paragraph } = Typography;
const { TextArea } = Input;

interface ParallelTranslationViewProps {
  sourceChunks: string[];
  targetChunks: string[];
  isLoading: boolean;
  className?: string;
  onUpdateChunk?: (index: number, newText: string) => void;
  sourceHeaderActions?: React.ReactNode;
  targetHeaderActions?: React.ReactNode;
}

const ParallelTranslationView: React.FC<ParallelTranslationViewProps> = ({
  sourceChunks,
  targetChunks,
  isLoading,
  className = '',
  onUpdateChunk,
  sourceHeaderActions,
  targetHeaderActions,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const handleEdit = (index: number, text: string) => {
    setEditingIndex(index);
    setEditValue(text);
  };

  const handleSave = (index: number) => {
    if (onUpdateChunk) {
      onUpdateChunk(index, editValue);
      message.success('修改已保存');
    }
    setEditingIndex(null);
  };

  const handleCancel = () => {
    setEditingIndex(null);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('已复制');
  };

  // 如果没有内容
  if (sourceChunks.length === 0 && !isLoading) {
    return (
      <div className={`parallel-view-empty ${className}`}>
        <Empty description="暂无翻译内容" />
      </div>
    );
  }

  return (
    <div className={`parallel-view-container ${className}`} ref={containerRef}>
      <div className="parallel-header-row">
        <div className="parallel-header-cell" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>原文</span>
          {sourceHeaderActions && <div className="header-actions">{sourceHeaderActions}</div>}
        </div>
        <div className="parallel-header-cell" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>译文</span>
          {targetHeaderActions && <div className="header-actions">{targetHeaderActions}</div>}
        </div>
      </div>
      
      <div className="parallel-content">
        {sourceChunks.map((rawSourceText, index) => {
          // Remove trailing whitespace (including excessive newlines) but preserve indentation
          const sourceText = rawSourceText ? rawSourceText.replace(/\s+$/, '') : '';
          const targetText = targetChunks[index] || '';
          const isActive = hoveredIndex === index;
          const isEditing = editingIndex === index;
          
          return (
            <div 
              key={index} 
              className={`parallel-row ${isActive ? 'active' : ''}`}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => {
                // 点击时也可以触发某些选中状态，这里暂且复用 hover 效果或仅仅是平滑滚动
                if (!isEditing) setHoveredIndex(index);
              }}
            >
              <div className="parallel-cell source-cell">
                <div className="sticky-content">
                  <Paragraph className="parallel-text">
                    {sourceText || <span className="placeholder-text">(等待分段...)</span>}
                  </Paragraph>
                </div>
              </div>
              <div className="parallel-cell target-cell">
                {isEditing ? (
                  <div className="edit-wrapper" onClick={(e) => e.stopPropagation()}>
                    <TextArea
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      autoSize={{ minRows: 3 }}
                      style={{ marginBottom: 8 }}
                    />
                    <div className="edit-actions" style={{ textAlign: 'right' }}>
                      <Space>
                        <Button size="small" onClick={handleCancel} icon={<CloseOutlined />}>取消</Button>
                        <Button size="small" type="primary" onClick={() => handleSave(index)} icon={<SaveOutlined />}>保存</Button>
                      </Space>
                    </div>
                  </div>
                ) : targetText ? (
                  <div className="display-wrapper" style={{ position: 'relative' }}>
                    <Paragraph className="parallel-text">
                      {targetText}
                    </Paragraph>
                    <div 
                      className="hover-actions" 
                      style={{ 
                        position: 'absolute', 
                        top: -8, 
                        right: -8, 
                        opacity: isActive ? 1 : 0, 
                        transition: 'opacity 0.2s',
                        background: 'rgba(255,255,255,0.9)',
                        padding: '4px',
                        borderRadius: '4px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    >
                      <Space size={4}>
                        <Button 
                          type="text" 
                          size="small" 
                          icon={<CopyOutlined />} 
                          onClick={(e) => { e.stopPropagation(); handleCopy(targetText); }} 
                          title="复制"
                        />
                        {onUpdateChunk && (
                          <Button 
                            type="text" 
                            size="small" 
                            icon={<EditOutlined />} 
                            onClick={(e) => { e.stopPropagation(); handleEdit(index, targetText); }} 
                            title="编辑"
                          />
                        )}
                      </Space>
                    </div>
                  </div>
                ) : (
                  isLoading && !targetText && (index === 0 || targetChunks[index - 1]) ? (
                    <div className="loading-placeholder">
                      <Spin size="small" /> 翻译中...
                    </div>
                  ) : (
                    <div className="waiting-placeholder">...</div>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ParallelTranslationView;
