'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface BeforeAfterViewProps {
  beforeImage: string;
  afterImage: string;
  onContinue: () => void;
  onRetry: () => void;
}

export function BeforeAfterView({ 
  beforeImage, 
  afterImage, 
  onContinue, 
  onRetry 
}: BeforeAfterViewProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const updateSliderPosition = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    updateSliderPosition(e.clientX);
  }, [updateSliderPosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    updateSliderPosition(e.clientX);
  }, [isDragging, updateSliderPosition]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    updateSliderPosition(e.touches[0].clientX);
  }, [updateSliderPosition]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    updateSliderPosition(e.touches[0].clientX);
  }, [isDragging, updateSliderPosition]);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-100">
          Your space, transformed
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Drag the slider to compare before and after
        </p>
      </div>

      <div
        ref={containerRef}
        className="relative w-full aspect-video rounded-2xl overflow-hidden cursor-ew-resize select-none bg-zinc-100 dark:bg-zinc-900"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
      >
        {/* After image (full width, below) */}
        <div className="absolute inset-0">
          <img
            src={afterImage}
            alt="After cleaning"
            className="w-full h-full object-contain"
            draggable={false}
          />
          <span className="absolute bottom-4 right-4 px-3 py-1 bg-green-600 text-white text-sm font-medium rounded-full">
            After
          </span>
        </div>

        {/* Before image (clipped) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${sliderPosition}%` }}
        >
          <img
            src={beforeImage}
            alt="Before cleaning"
            className="absolute inset-0 w-full h-full object-contain"
            style={{ 
              width: containerWidth ? containerWidth : '100%',
              maxWidth: 'none'
            }}
            draggable={false}
          />
          <span className="absolute bottom-4 left-4 px-3 py-1 bg-zinc-800 text-white text-sm font-medium rounded-full">
            Before
          </span>
        </div>

        {/* Slider handle */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize"
          style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
            <svg
              className="w-6 h-6 text-zinc-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 9l4-4 4 4m0 6l-4 4-4-4"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
        <button
          onClick={onRetry}
          className="px-6 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 
                     text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800
                     transition-colors"
        >
          Try Again
        </button>
        
        <button
          onClick={onContinue}
          className="px-8 py-3 rounded-xl bg-blue-600 text-white font-medium
                     hover:bg-blue-700 transition-colors"
        >
          Create Cleaning Plan
        </button>
      </div>
    </div>
  );
}
