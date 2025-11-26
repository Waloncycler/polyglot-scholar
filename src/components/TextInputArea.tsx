import React, { useEffect } from 'react';
import { Input, Upload, Button, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { parseFile } from '../services/fileParser';

const { TextArea } = Input;

interface TextInputAreaProps {
  value: string;
  onChange: (value: string) => void;
  isLoading: boolean;
  selectionRange?: { start: number; end: number } | null;
  onSelectionChange?: (start: number, end: number) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}

const TextInputArea: React.FC<TextInputAreaProps> = ({ value, onChange, isLoading, selectionRange, onSelectionChange, textareaRef }) => {
  const handleFileUpload = async (file: File) => {
    try {
      const allowedTypes = [
        'text/plain', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ];
      
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const isAllowedExt = ['txt', 'docx', 'xlsx', 'xls'].includes(fileExt || '');

      if (allowedTypes.includes(file.type) || isAllowedExt) {
        const result = await parseFile(file);
        if (result.error) {
          message.error(result.error);
          return false;
        }
        onChange(result.text);
        message.success(`成功上传文件: ${file.name}`);
      } else {
        message.error('不支持的文件格式，请上传 .txt, .docx 或 .xlsx 文件');
        return false;
      }
    } catch (error) {
      console.error('File upload error:', error);
      message.error('文件上传失败');
      return false;
    }
    return false; // 阻止默认上传行为
  };

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

  return (
    <div className="input-area">
      <div className="area-header">
        <h3>中文输入</h3>
        <Upload
          beforeUpload={handleFileUpload}
          showUploadList={false}
          accept=".txt,.docx,.xlsx,.xls"
          disabled={isLoading}
        >
          <Button icon={<UploadOutlined />} disabled={isLoading}>
            上传文件
          </Button>
        </Upload>
      </div>
      <TextArea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onSelect={(e) => {
          const target = e.target as HTMLTextAreaElement;
          if (onSelectionChange) {
            onSelectionChange(target.selectionStart, target.selectionEnd);
          }
        }}
        placeholder="在此粘贴中文文本或上传文件..."
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
  );
};

export default TextInputArea;