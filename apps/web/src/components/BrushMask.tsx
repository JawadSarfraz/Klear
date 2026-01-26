'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

interface BrushMaskProps {
  imageData: string;
  onMaskComplete: (maskData: string) => void;
  onBack: () => void;
}

export function BrushMask({ imageData, onMaskComplete, onBack }: BrushMaskProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);

  // Load and display the image
  useEffect(() => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !maskCanvas || !container) return;

    const ctx = canvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    if (!ctx || !maskCtx) return;

    const img = new Image();
    img.onload = () => {
      // Calculate size to fit container while maintaining aspect ratio
      const containerWidth = container.clientWidth;
      const maxHeight = window.innerHeight * 0.6;
      
      let width = img.width;
      let height = img.height;
      
      if (width > containerWidth) {
        const ratio = containerWidth / width;
        width = containerWidth;
        height = height * ratio;
      }
      
      if (height > maxHeight) {
        const ratio = maxHeight / height;
        height = maxHeight;
        width = width * ratio;
      }

      setCanvasSize({ width, height });
      
      canvas.width = width;
      canvas.height = height;
      maskCanvas.width = width;
      maskCanvas.height = height;
      
      // Draw image
      ctx.drawImage(img, 0, 0, width, height);
      
      // Initialize mask canvas (transparent)
      maskCtx.clearRect(0, 0, width, height);
      
      setImageLoaded(true);
    };
    img.src = imageData;
  }, [imageData]);

  const getCanvasCoords = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  const draw = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!canvas || !maskCanvas) return;

    const ctx = canvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    if (!ctx || !maskCtx) return;

    // Draw on visible canvas (semi-transparent red overlay)
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.fill();

    // Draw on mask canvas (white on black = area to inpaint)
    maskCtx.beginPath();
    maskCtx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    maskCtx.fillStyle = 'white';
    maskCtx.fill();
  }, [brushSize]);

  const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const { x, y } = getCanvasCoords(e);
    draw(x, y);
  }, [draw, getCanvasCoords]);

  const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getCanvasCoords(e);
    draw(x, y);
  }, [isDrawing, draw, getCanvasCoords]);

  const handleEnd = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!canvas || !maskCanvas) return;

    const ctx = canvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    if (!ctx || !maskCtx) return;

    // Redraw original image
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = imageData;

    // Clear mask
    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  }, [imageData]);

  const handleComplete = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    // Create the final mask: black background with white painted areas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = maskCanvas.width;
    tempCanvas.height = maskCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    // Black background
    tempCtx.fillStyle = 'black';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Draw white mask areas
    tempCtx.drawImage(maskCanvas, 0, 0);

    const maskData = tempCanvas.toDataURL('image/png');
    onMaskComplete(maskData);
  }, [onMaskComplete]);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">
            Mark areas to clean
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Paint over clutter you want removed
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            Brush:
            <input
              type="range"
              min="10"
              max="100"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-24"
            />
            <span className="w-8 text-right">{brushSize}</span>
          </label>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="relative bg-zinc-100 dark:bg-zinc-900 rounded-xl overflow-hidden"
      >
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-pulse text-zinc-400">Loading image...</div>
          </div>
        )}
        
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="block mx-auto cursor-crosshair touch-none"
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        />
        
        {/* Hidden mask canvas */}
        <canvas
          ref={maskCanvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="hidden"
        />
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-between">
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 
                     text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800
                     transition-colors"
        >
          Back
        </button>
        
        <div className="flex gap-3">
          <button
            onClick={handleClear}
            className="px-6 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 
                       text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800
                       transition-colors"
          >
            Clear
          </button>
          
          <button
            onClick={handleComplete}
            disabled={!imageLoaded}
            className="px-8 py-3 rounded-xl bg-blue-600 text-white font-medium
                       hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            Generate Clean View
          </button>
        </div>
      </div>
    </div>
  );
}
