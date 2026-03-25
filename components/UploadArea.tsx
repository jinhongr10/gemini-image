import React, { useRef, useState } from 'react';
import { Button } from './Button';
import heic2any from 'heic2any';

export interface UploadedFile {
  id: string;
  data: string; // Base64
  name: string;
  type: string;
}

export const generateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      try {
        return crypto.randomUUID();
      } catch (e) { }
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

export const convertFileToBase64 = (file: File): Promise<UploadedFile> => {
    return new Promise(async (resolve, reject) => {
      try {
        let processedBlob: Blob = file;
        
        if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
          const conversionResult = await heic2any({
            blob: file,
            toType: "image/jpeg",
            quality: 0.9
          });
          processedBlob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          const base64 = result.split(',')[1];
          
          resolve({
            id: generateId(),
            data: base64,
            name: file.name,
            type: file.type
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(processedBlob);
      } catch (err) {
        reject(err);
      }
    });
};

interface UploadAreaProps {
  onImagesSelect: (files: UploadedFile[]) => void;
  currentCount: number;
  maxCount?: number;
  compact?: boolean; // For the "Add More" version
  isDarkMode?: boolean;
}

export const UploadArea: React.FC<UploadAreaProps> = ({ 
  onImagesSelect, 
  currentCount, 
  maxCount = 5,
  compact = false,
  isDarkMode = false
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentCount >= maxCount) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const processFiles = async (fileList: FileList | File[]) => {
    if (currentCount >= maxCount) {
      alert(`最多只能上传 ${maxCount} 张图片`);
      return;
    }

    setIsProcessing(true);
    const filesToProcess = Array.from(fileList).slice(0, maxCount - currentCount);
    
    const validFiles = filesToProcess.filter(f => 
      f.type.startsWith('image/') || 
      f.name.toLowerCase().endsWith('.heic') || 
      f.name.toLowerCase().endsWith('.heif')
    );

    if (validFiles.length < filesToProcess.length) {
      alert('部分文件格式不支持，已跳过');
    }

    try {
      const results = await Promise.all(validFiles.map(convertFileToBase64));
      onImagesSelect(results);
    } catch (error) {
      console.error("File processing error:", error);
      alert("处理图片时出错，请检查文件格式");
    } finally {
      setIsProcessing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const remaining = maxCount - currentCount;
  const isDisabled = remaining <= 0;

  // Colors
  const borderColor = isDragging 
    ? 'border-brand-500 bg-brand-50/50' 
    : isDarkMode 
        ? 'border-slate-700 bg-slate-800' 
        : 'border-slate-300 bg-white';
  
  const textColor = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const titleColor = isDarkMode ? 'text-slate-200' : 'text-slate-800';

  // Compact version for the sidebar
  if (compact) {
    return (
      <div 
        className={`w-full h-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${isDragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:border-brand-300 hover:bg-slate-50'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => !isDisabled && inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <svg className="w-6 h-6 mb-1 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span className="text-[10px] font-medium text-slate-500 leading-none">{isProcessing ? '...' : '添加'}</span>
        <input 
          type="file" 
          ref={inputRef}
          onChange={handleChange}
          accept="image/*,.heic,.heif"
          multiple
          className="hidden" 
          disabled={isDisabled}
        />
      </div>
    );
  }

  // Full size version matching the design
  return (
    <div 
      className={`relative h-full w-full flex flex-col items-center justify-center rounded-3xl transition-all duration-200 ease-in-out border-2 border-dashed ${borderColor}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center gap-6 max-w-md text-center">
        {/* Icon */}
        <div className={`p-6 rounded-3xl ${isDarkMode ? 'bg-slate-700' : 'bg-white shadow-sm border border-slate-100'}`}>
          {isProcessing ? (
             <svg className="animate-spin w-12 h-12 text-brand-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
               <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
               <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
             </svg>
          ) : (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-brand-500">
              <path d="M4 16L8.586 11.414C8.96106 11.0391 9.46967 10.8284 10 10.8284C10.5303 10.8284 11.0389 11.0391 11.414 11.414L16 16M14 14L15.586 12.414C15.9611 12.0391 16.4697 11.8284 17 11.8284C17.5303 11.8284 18.0389 12.0391 18.414 12.414L20 14M14 8H14.01M6 20H18C19.1046 20 20 19.1046 20 18V6C20 4.89543 19.1046 4 18 4H6C4.89543 4 4 4.89543 4 6V18C4 19.1046 4.89543 20 6 20Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
        
        {/* Text */}
        <div className="space-y-2">
          <h3 className={`text-xl font-medium ${titleColor}`}>点击或拖拽上传产品图</h3>
          <p className={`${textColor} text-sm leading-relaxed`}>
            支持 JPG, PNG, WEBP, HEIC. 最大 10MB.<br/>
            还可以上传 {remaining} 张
          </p>
        </div>

        {/* Input & Button */}
        <input 
          type="file" 
          ref={inputRef}
          onChange={handleChange}
          accept="image/*,.heic,.heif"
          multiple
          className="hidden" 
        />
        
        <Button 
          onClick={() => inputRef.current?.click()} 
          variant="secondary" 
          className="mt-2 min-w-[120px]"
          disabled={isProcessing}
        >
          浏览文件
        </Button>
      </div>
    </div>
  );
};