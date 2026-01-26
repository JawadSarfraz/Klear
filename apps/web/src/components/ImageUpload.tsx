'use client';

import { useCallback, useState } from 'react';
import { validateImage, fileToBase64 } from '@/lib/utils';

interface ImageUploadProps {
  onImageSelect: (imageData: string) => void;
}

export function ImageUpload({ onImageSelect }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    const validation = validateImage(file);
    
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      onImageSelect(base64);
    } catch {
      setError('Failed to read file');
    }
  }, [onImageSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  return (
    <div className="w-full max-w-xl mx-auto">
      <label
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          flex flex-col items-center justify-center w-full h-64 
          border-2 border-dashed rounded-2xl cursor-pointer
          transition-all duration-200
          ${isDragging 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
            : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600'
          }
          ${error ? 'border-red-400 bg-red-50 dark:bg-red-950/20' : ''}
        `}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <svg
            className={`w-12 h-12 mb-4 ${isDragging ? 'text-blue-500' : 'text-zinc-400'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="mb-2 text-lg font-medium text-zinc-700 dark:text-zinc-300">
            {isDragging ? 'Drop your photo here' : 'Upload a photo of your space'}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Drag & drop or click to browse
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            PNG, JPG, WebP up to 10MB
          </p>
        </div>
        <input
          type="file"
          className="hidden"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleInputChange}
        />
      </label>
      
      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400 text-center">
          {error}
        </p>
      )}
    </div>
  );
}
