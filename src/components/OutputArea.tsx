import React, { useEffect, useRef, useState } from 'react';
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
  chunkStates?: Array<'pending' | 'streaming' | 'completed' | 'error'>;
  selectedChunkIndex: number | null;
  onRetry?: () => void;
  retrying?: boolean;
  onSelectChunk: (index: number) => void;
  inputText: string;
  inputRanges: Array<{ start: number; end: number }>;
  onSelectOriginalRange?: (start: number, end: number, chunkIndex?: number) => void;
  isInputHidden?: boolean;
  onToggleInputHidden?: () => void;
}

const OutputArea: React.FC<OutputAreaProps> = ({ 
  value, 
  translationTime, 
  modelName,
  outputChunks,
  totalChunks,
  completedChunks,
  chunkStates,
  selectedChunkIndex,
  onRetry,
  retrying,
  onSelectChunk,
  inputText,
  inputRanges,
  onSelectOriginalRange,
  isInputHidden,
  onToggleInputHidden
}) => {
  const chunkRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState<boolean>(false);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [detailVisible, setDetailVisible] = useState<boolean>(false);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [activeParaIdx, setActiveParaIdx] = useState<number | null>(null);
  const getPreview = (s: string) => (s || '').replace(/\s+/g, ' ').slice(0, 80);
  const getModelDisplayName = (model: string) => {
    switch (model) {
      case 'gpt-4o': return 'GPT-4o';
      case 'deepseek-v3': return 'DeepSeek-V3';
      case 'claude-3-sonnet': return 'Claude-3-Sonnet';
      default: return model;
    }
  };

  const handleMouseEnter = (idx: number) => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
    if (hoverTimer.current) { clearTimeout(hoverTimer.current); }
    setHoverIdx(idx);
    hoverTimer.current = setTimeout(() => setTooltipVisible(true), 1000);
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };
  const handleMouseLeave = () => {
    if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; }
    hideTimer.current = setTimeout(() => setTooltipVisible(false), 500);
  };
  const openDock = (idx: number) => {
    onSelectChunk(idx);
    setDetailIndex(idx);
    setDetailVisible(true);
    setActiveParaIdx(null);
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
          {onRetry && (
            <Button 
              className="retry-btn" 
              type="primary" 
              loading={!!retrying} 
              disabled={!!retrying}
              onClick={onRetry}
            >
              重新请求
            </Button>
          )}
          {onToggleInputHidden && (
            <Button 
              className={`toggle-input-btn ${isInputHidden ? 'on' : ''}`}
              onClick={onToggleInputHidden}
            >
              {isInputHidden ? '显示中文输入' : '隐藏中文输入'}
            </Button>
          )}
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
        <div className="cards-row">
          {outputChunks.map((chunk, idx) => {
            const state = chunkStates && chunkStates[idx];
            const previewText = chunk && chunk.trim().length > 0
              ? getPreview(chunk)
              : (state === 'error' ? '生成失败' : (state === 'pending' ? '等待中...' : '正在生成...'));
            const active = selectedChunkIndex === idx;
            return (
              <div
                key={idx}
                className={`card ${active ? 'card-active' : ''}`}
                onClick={() => openDock(idx)}
                onMouseEnter={() => handleMouseEnter(idx)}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                ref={(el) => { chunkRefs.current[idx] = el as HTMLDivElement | null; }}
              >
                <div className="card-header">
                  <Text type="secondary">第 {idx + 1} 段</Text>
                  <Tooltip title="复制本段">
                    <Button size="small" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(chunk || ''); }}>复制</Button>
                  </Tooltip>
                </div>
                <div className="card-preview">{previewText}</div>
              </div>
            );
          })}
          {outputChunks.length === 0 && (
            <div className="card"><div className="card-preview">{value || '翻译结果将在此处显示'}</div></div>
          )}
        </div>
        <div
          className={`hover-tooltip ${tooltipVisible && hoverIdx !== null ? 'visible' : ''}`}
          style={{ left: tooltipPos.x + 12, top: tooltipPos.y + 12 }}
        >
          {hoverIdx !== null ? getPreview(outputChunks[hoverIdx] || '') : ''}
        </div>
        {detailVisible && detailIndex !== null && (
          <DetailDock
            index={detailIndex}
            inputText={inputText}
            inputRange={inputRanges[detailIndex]}
            translationText={outputChunks[detailIndex] || ''}
            activeParaIdx={activeParaIdx}
            onClose={() => { setDetailVisible(false); setActiveParaIdx(null); }}
            onSelectPara={(paraIdx, absStart, absEnd) => {
              setActiveParaIdx(paraIdx);
              if (onSelectOriginalRange) onSelectOriginalRange(absStart, absEnd, detailIndex);
            }}
            full={!!isInputHidden}
          />
        )}
      </div>
    </div>
  );
};

interface DetailDockProps {
  index: number;
  inputText: string;
  inputRange: { start: number; end: number };
  translationText: string;
  activeParaIdx: number | null;
  onClose: () => void;
  onSelectPara: (paraIdx: number, absStart: number, absEnd: number) => void;
  full?: boolean;
}

const splitParas = (s: string): string[] => (s || '')
  .split(/\n\n+/)
  .map((t) => t.trim())
  .filter((t) => t.length > 0);

const DetailDock: React.FC<DetailDockProps> = ({
  index,
  inputText,
  inputRange,
  translationText,
  activeParaIdx,
  onClose,
  onSelectPara,
  full
}) => {
  const origChunk = inputText.slice(inputRange.start, inputRange.end);
  const origParas = splitParas(origChunk);
  const transParas = splitParas(translationText);
  const origOffsets: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (const p of origParas) {
    const relStart = origChunk.indexOf(p, cursor);
    const relEnd = relStart + p.length;
    origOffsets.push({ start: relStart, end: relEnd });
    cursor = relEnd;
  }
  return (
    <div className={`detail-dock dock-visible ${full ? 'dock-full' : ''}`}>
      <div className="dock-header">
        <span>第 {index + 1} 段对照</span>
        <Button size="small" onClick={onClose}>关闭</Button>
      </div>
      <div className="dock-cols">
        <div className="dock-col">
          {origParas.length > 0 ? origParas.map((p, i) => (
            <div key={i} className={`para-item ${activeParaIdx === i ? 'para-active' : ''}`}>{p}</div>
          )) : (<div className="para-item">原文尚未定位</div>)}
        </div>
        <div className="dock-col">
          {transParas.length > 0 ? transParas.map((p, i) => (
            <div
              key={i}
              className={`para-item ${activeParaIdx === i ? 'para-active' : ''}`}
              onClick={() => {
                const off = origOffsets[i] || { start: 0, end: 0 };
                const absStart = inputRange.start + off.start;
                const absEnd = inputRange.start + off.end;
                onSelectPara(i, absStart, absEnd);
              }}
            >
              {p}
            </div>
          )) : (<div className="para-item">译文尚未生成</div>)}
        </div>
      </div>
    </div>
  );
};

export default OutputArea;