// Core types for Klear - shared across web and mobile

export type TimeBudget = '15min' | '1hr' | 'weekend';

export type TaskPriority = 'high' | 'medium' | 'low';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface CleaningTask {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  priority: TaskPriority;
  status: TaskStatus;
  area: string; // e.g., "desk", "floor", "shelves"
}

export interface CleaningPlan {
  id: string;
  originalImageUrl: string;
  cleanedImageUrl: string;
  maskDataUrl?: string;
  timeBudget: TimeBudget;
  tasks: CleaningTask[];
  totalEstimatedMinutes: number;
  createdAt: Date;
}

export interface FeedbackData {
  planId: string;
  rating: 'positive' | 'negative';
  comment?: string;
  timestamp: Date;
}

export interface AppState {
  step: 'upload' | 'mask' | 'processing' | 'preview' | 'plan';
  originalImage: string | null;
  cleanedImage: string | null;
  maskData: string | null;
  timeBudget: TimeBudget;
  plan: CleaningPlan | null;
  isLoading: boolean;
  error: string | null;
}

// API types
export interface InpaintRequest {
  image: string; // base64
  mask: string;  // base64
}

export interface InpaintResponse {
  predictionId: string;
}

export interface PredictionStatus {
  status: 'starting' | 'processing' | 'succeeded' | 'failed';
  output?: string | string[];
  error?: string;
}
