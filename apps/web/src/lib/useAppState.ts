'use client';

import { useState, useCallback } from 'react';
import type { AppState, TimeBudget, CleaningTask, CleaningPlan } from '@/types';
import { generateId } from '@/lib/utils';
import { TIME_BUDGETS } from '@/lib/constants';

const initialState: AppState = {
  step: 'upload',
  originalImage: null,
  cleanedImage: null,
  maskData: null,
  timeBudget: '1hr',
  plan: null,
  isLoading: false,
  error: null,
};

// Sample task generation (in production, this would use AI/vision API)
function generateTasks(timeBudget: TimeBudget): CleaningTask[] {
  const allTasks: CleaningTask[] = [
    {
      id: generateId(),
      title: 'Clear desk surface',
      description: 'Remove items from desk, wipe down surface, only return essential items',
      estimatedMinutes: 5,
      priority: 'high',
      status: 'pending',
      area: 'desk',
    },
    {
      id: generateId(),
      title: 'Organize loose papers',
      description: 'Sort papers into keep, recycle, and action piles. File what needs keeping.',
      estimatedMinutes: 10,
      priority: 'high',
      status: 'pending',
      area: 'desk',
    },
    {
      id: generateId(),
      title: 'Put away clothes',
      description: 'Fold or hang clean clothes, put dirty clothes in hamper',
      estimatedMinutes: 8,
      priority: 'medium',
      status: 'pending',
      area: 'floor',
    },
    {
      id: generateId(),
      title: 'Clear floor items',
      description: 'Pick up items from floor and return to proper storage locations',
      estimatedMinutes: 5,
      priority: 'high',
      status: 'pending',
      area: 'floor',
    },
    {
      id: generateId(),
      title: 'Organize shelf items',
      description: 'Arrange books and items neatly, remove items that don\'t belong',
      estimatedMinutes: 10,
      priority: 'medium',
      status: 'pending',
      area: 'shelves',
    },
    {
      id: generateId(),
      title: 'Dust surfaces',
      description: 'Wipe down all visible surfaces with microfiber cloth',
      estimatedMinutes: 8,
      priority: 'low',
      status: 'pending',
      area: 'general',
    },
    {
      id: generateId(),
      title: 'Empty trash',
      description: 'Empty all trash cans and replace bags',
      estimatedMinutes: 3,
      priority: 'medium',
      status: 'pending',
      area: 'general',
    },
    {
      id: generateId(),
      title: 'Organize cables',
      description: 'Bundle and route cables neatly, use cable ties if available',
      estimatedMinutes: 10,
      priority: 'low',
      status: 'pending',
      area: 'desk',
    },
    {
      id: generateId(),
      title: 'Clean windows',
      description: 'Wipe down window glass and sills',
      estimatedMinutes: 10,
      priority: 'low',
      status: 'pending',
      area: 'general',
    },
    {
      id: generateId(),
      title: 'Vacuum floor',
      description: 'Vacuum entire floor area including corners and under furniture',
      estimatedMinutes: 15,
      priority: 'medium',
      status: 'pending',
      area: 'floor',
    },
  ];

  const maxTasks = TIME_BUDGETS[timeBudget].maxTasks;
  
  // Sort by priority and return limited number
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return allTasks
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, maxTasks);
}

export function useAppState() {
  const [state, setState] = useState<AppState>(initialState);

  const setStep = useCallback((step: AppState['step']) => {
    setState(prev => ({ ...prev, step, error: null }));
  }, []);

  const setOriginalImage = useCallback((imageData: string) => {
    setState(prev => ({ 
      ...prev, 
      originalImage: imageData, 
      step: 'mask',
      error: null 
    }));
  }, []);

  const setMaskData = useCallback((maskData: string) => {
    setState(prev => ({ ...prev, maskData }));
  }, []);

  const setTimeBudget = useCallback((budget: TimeBudget) => {
    setState(prev => ({ ...prev, timeBudget: budget }));
  }, []);

  const setLoading = useCallback((isLoading: boolean) => {
    setState(prev => ({ ...prev, isLoading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error, isLoading: false }));
  }, []);

  const startInpainting = useCallback(async (maskData: string) => {
    setState(prev => ({ 
      ...prev, 
      maskData, 
      step: 'processing', 
      isLoading: true, 
      error: null 
    }));

    try {
      // Call inpainting API
      const response = await fetch('/api/inpaint', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-klear-api-key': process.env.NEXT_PUBLIC_KLEAR_API_KEY || '',
        },
        body: JSON.stringify({
          image: state.originalImage,
          mask: maskData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to start inpainting');
      }

      const { predictionId } = await response.json();

      // Poll for completion
      let attempts = 0;
      const maxAttempts = 60; // 2 minutes max
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const statusResponse = await fetch(`/api/inpaint/status?id=${predictionId}`, {
          headers: {
            'x-klear-api-key': process.env.NEXT_PUBLIC_KLEAR_API_KEY || '',
          }
        });
        const statusData = await statusResponse.json();

        if (statusData.status === 'succeeded') {
          const cleanedImageUrl = Array.isArray(statusData.output) 
            ? statusData.output[0] 
            : statusData.output;
            
          setState(prev => ({
            ...prev,
            cleanedImage: cleanedImageUrl,
            step: 'preview',
            isLoading: false,
          }));
          return;
        }

        if (statusData.status === 'failed') {
          throw new Error(statusData.error || 'Inpainting failed');
        }

        attempts++;
      }

      throw new Error('Inpainting timed out');
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'An error occurred',
        step: 'mask',
        isLoading: false,
      }));
    }
  }, [state.originalImage]);

  const generatePlan = useCallback(() => {
    const tasks = generateTasks(state.timeBudget);
    const totalMinutes = tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);

    const plan: CleaningPlan = {
      id: generateId(),
      originalImageUrl: state.originalImage || '',
      cleanedImageUrl: state.cleanedImage || '',
      maskDataUrl: state.maskData || undefined,
      timeBudget: state.timeBudget,
      tasks,
      totalEstimatedMinutes: totalMinutes,
      createdAt: new Date(),
    };

    setState(prev => ({ ...prev, plan, step: 'plan' }));
  }, [state.timeBudget, state.originalImage, state.cleanedImage, state.maskData]);

  const updateTask = useCallback((taskId: string, status: CleaningTask['status']) => {
    setState(prev => {
      if (!prev.plan) return prev;
      
      const updatedTasks = prev.plan.tasks.map(task =>
        task.id === taskId ? { ...task, status } : task
      );

      return {
        ...prev,
        plan: { ...prev.plan, tasks: updatedTasks },
      };
    });
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  const goBack = useCallback(() => {
    setState(prev => {
      switch (prev.step) {
        case 'mask':
          return { ...prev, step: 'upload', originalImage: null };
        case 'preview':
          return { ...prev, step: 'mask', cleanedImage: null };
        case 'plan':
          return { ...prev, step: 'preview', plan: null };
        default:
          return prev;
      }
    });
  }, []);

  return {
    state,
    setStep,
    setOriginalImage,
    setMaskData,
    setTimeBudget,
    setLoading,
    setError,
    startInpainting,
    generatePlan,
    updateTask,
    reset,
    goBack,
  };
}
