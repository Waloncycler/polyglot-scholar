import React, { useEffect, useState, type DragEvent } from 'react';
import { Input, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';

const { TextArea } = Input;

interface TextInputAreaProps {
  value: string;
  onChange: (value: string) => void;
  isLoading: boolean;
  selectionRange?: { start: number; end: number } | null;
  onSelectionChange?: (start: number, end: number) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  onFileUpload?: (file: File) => Promise<boolean | void>;
  headerActions?: React.ReactNode;
}

const TextInputArea: React.FC<TextInputAreaProps> = ({ 
  value, 
  onChange, 
  isLoading, 
  selectionRange, 
  onSelectionChange, 
  textareaRef,
  onFileUpload,
  headerActions
}) => {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const el = textareaRef?.current;
    if (selectionRange && el && typeof el.setSelectionRange === 'function') {
      el.focus();
      el.setSelectionRange(selectionRange.start, selectionRange.end);
      const totalScrollRange = el.scrollHeight - el.clientHeight;
      if (totalScrollRange > 0 && typeof el.value === 'string') {
        const middle = (selectionRange.start + selectionRange.end) / 2;
        const ratio = Math.min(1, Math.max(0, middle / el.value.length));
        const target = Math.floor(ratio * totalScrollRange - el.clientHeight * 0.3);
        el.scrollTo({ top: Math.max(0, Math.min(totalScrollRange, target)), behavior: 'smooth' });
      }
    }
  }, [selectionRange, textareaRef]);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!onFileUpload) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const allowedExts = ['.txt', '.docx', '.xlsx', '.md'];
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (allowedExts.includes(fileExt)) {
        await onFileUpload(file);
      } else {
        message.error('不支持的文件格式，请上传 .txt, .docx, .xlsx 或 .md 文件');
      }
    }
  };

  return (
    <div 
      className={`input-area ${isDragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="area-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0 }}>中文输入</h3>
        {headerActions && <div className="header-actions">{headerActions}</div>}
      </div>
      <div className="textarea-wrapper" style={{ position: 'relative', height: '100%' }}>
        {isDragging && (
          <div className="drag-overlay">
            <InboxOutlined style={{ fontSize: '48px', color: '#1677ff', marginBottom: '16px' }} />
            <div style={{ fontSize: '18px', color: '#1677ff' }}>释放以导入文件</div>
          </div>
        )}
        <TextArea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onSelect={(e) => {
            const target = e.target as HTMLTextAreaElement;
            if (onSelectionChange) {
              onSelectionChange(target.selectionStart, target.selectionEnd);
            }
          }}
          placeholder="在此粘贴中文文本，或者将文件拖拽到此处..."
          autoSize={{ minRows: 20, maxRows: 30 }}
          disabled={isLoading}
          ref={(node) => {
            if (!textareaRef) return;
            const textAreaNode = node as unknown as { resizableTextArea?: { textArea: HTMLTextAreaElement } };
            const el = textAreaNode?.resizableTextArea?.textArea || (node as unknown as HTMLTextAreaElement);
            (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el || null;
          }}
        />
      </div>
    </div>
  );
};

export default TextInputArea;