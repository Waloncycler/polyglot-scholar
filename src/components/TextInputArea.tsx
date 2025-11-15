import React from 'react';
import { Input, Upload, Button, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import mammoth from 'mammoth';

const { TextArea } = Input;

interface TextInputAreaProps {
  value: string;
  onChange: (value: string) => void;
  isLoading: boolean;
}

const TextInputArea: React.FC<TextInputAreaProps> = ({ value, onChange, isLoading }) => {
  const handleFileUpload = async (file: File) => {
    try {
      if (file.type === 'text/plain') {
        // 处理 .txt 文件
        const text = await file.text();
        onChange(text);
        message.success(`成功上传文件: ${file.name}`);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // 处理 .docx 文件
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        onChange(result.value);
        message.success(`成功上传文件: ${file.name}`);
      } else {
        message.error('不支持的文件格式，请上传 .txt 或 .docx 文件');
        return false;
      }
    } catch (error) {
      console.error('File upload error:', error);
      message.error('文件上传失败');
      return false;
    }
    return false; // 阻止默认上传行为
  };

  return (
    <div className="input-area">
      <div className="area-header">
        <h3>中文输入</h3>
        <Upload
          beforeUpload={handleFileUpload}
          showUploadList={false}
          accept=".txt,.docx"
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
        placeholder="在此粘贴中文文本或上传文件..."
        autoSize={{ minRows: 20, maxRows: 30 }}
        disabled={isLoading}
      />
    </div>
  );
};

export default TextInputArea;