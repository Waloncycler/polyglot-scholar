import React, { useState, useRef } from 'react';
import { Typography, Empty, Spin } from 'antd';

const { Paragraph } = Typography;

interface ParallelTranslationViewProps {
  sourceChunks: string[];
  targetChunks: string[];
  isLoading: boolean;
  className?: string;
}

const ParallelTranslationView: React.FC<ParallelTranslationViewProps> = ({
  sourceChunks,
  targetChunks,
  isLoading,
  className = '',
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
        <div className="parallel-header-cell">原文</div>
        <div className="parallel-header-cell">译文</div>
      </div>
      
      <div className="parallel-content">
        {sourceChunks.map((rawSourceText, index) => {
          // Remove trailing whitespace (including excessive newlines) but preserve indentation
          const sourceText = rawSourceText ? rawSourceText.replace(/\s+$/, '') : '';
          const targetText = targetChunks[index] || '';
          const isActive = hoveredIndex === index;
          
          return (
            <div 
              key={index} 
              className={`parallel-row ${isActive ? 'active' : ''}`}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => {
                // 点击时也可以触发某些选中状态，这里暂且复用 hover 效果或仅仅是平滑滚动
                setHoveredIndex(index);
              }}
            >
              <div className="parallel-cell source-cell">
                <Paragraph className="parallel-text">
                  {sourceText || <span className="placeholder-text">(等待分段...)</span>}
                </Paragraph>
              </div>
              <div className="parallel-cell target-cell">
                {targetText ? (
                  <Paragraph className="parallel-text">
                    {targetText}
                  </Paragraph>
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
