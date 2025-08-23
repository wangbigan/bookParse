import React, { useState, useRef } from 'react';
import { Upload, File, CheckCircle, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isUploading?: boolean;
  uploadProgress?: number;
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileSelect, 
  isUploading = false, 
  uploadProgress = 0 
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    // 检查文件类型
    if (!file.name.toLowerCase().endsWith('.epub')) {
      setError('请选择EPUB格式的电子书文件');
      return false;
    }

    // 检查文件大小 (限制50MB)
    if (file.size > 50 * 1024 * 1024) {
      setError('文件大小不能超过50MB');
      return false;
    }

    setError('');
    return true;
  };

  const handleFileSelect = (file: File) => {
    if (validateFile(file)) {
      setSelectedFile(file);
      onFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full">
      {/* 上传区域 */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
          ${
            isDragOver
              ? 'border-blue-400 bg-blue-50'
              : selectedFile
              ? 'border-green-300 bg-green-50'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400'
          }
          ${isUploading ? 'pointer-events-none opacity-75' : 'cursor-pointer'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".epub"
          onChange={handleInputChange}
          className="hidden"
          disabled={isUploading}
        />

        {/* 上传图标和文字 */}
        <div className="space-y-4">
          {selectedFile ? (
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
          ) : (
            <Upload className="h-12 w-12 text-gray-400 mx-auto" />
          )}

          <div>
            <h3 className="text-lg font-medium text-gray-900">
              {selectedFile ? '文件已选择' : '上传电子书文件'}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {selectedFile
                ? '点击重新选择文件'
                : '拖拽EPUB文件到此处，或点击选择文件'
              }
            </p>
          </div>

          <div className="text-xs text-gray-500">
            支持格式：EPUB | 最大文件大小：50MB
          </div>
        </div>

        {/* 上传进度条 */}
        {isUploading && (
          <div className="absolute inset-x-4 bottom-4">
            <div className="bg-white bg-opacity-90 rounded-lg p-3">
              <div className="flex items-center justify-between text-sm text-gray-700 mb-2">
                <span>上传中...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 文件信息卡片 */}
      {selectedFile && !isUploading && (
        <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <File className="h-8 w-8 text-blue-500" />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-gray-900 truncate">
                {selectedFile.name}
              </h4>
              <p className="text-sm text-gray-500">
                {formatFileSize(selectedFile.size)} • EPUB格式
              </p>
            </div>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </div>
        </div>
      )}

      {/* 错误信息 */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;