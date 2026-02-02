import { KLEAR_API_KEY_HEADER } from '@klear/shared';

// API service for Klear mobile app

// Configure API URL via environment variable:
const getBaseUrl = () => {
  let url = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
  // Remove trailing slash
  url = url.replace(/\/$/, '');
  // If the user accidentally included /api in the env, remove it because we add it in the calls
  url = url.replace(/\/api$/, '');
  return url;
};

const API_BASE_URL = getBaseUrl();
const KLEAR_API_KEY = process.env.EXPO_PUBLIC_KLEAR_API_KEY || '';

console.log(`[API] Initialized with Base URL: ${API_BASE_URL}`);

export interface InpaintResponse {
  predictionId: string;
}

export interface PlanResponse {
  predictionId: string;
}

export interface PredictionStatus {
  status: 'starting' | 'processing' | 'succeeded' | 'failed';
  output?: string | string[];
  tasks?: any[]; // For plan generation
  error?: string;
}

export async function startInpainting(
  imageBase64: string, 
  maskBase64: string,
  options?: { strength?: number; guidance_scale?: number }
): Promise<InpaintResponse> {
  const response = await fetch(`${API_BASE_URL}/api/inpaint`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      [KLEAR_API_KEY_HEADER]: KLEAR_API_KEY,
    },
    body: JSON.stringify({
      image: imageBase64,
      mask: maskBase64,
      strength: options?.strength,
      guidance_scale: options?.guidance_scale,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    if (error && error.error) {
      throw new Error(error.error);
    }
    throw new Error(`Server returned error ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export async function generatePlan(
  imageBase64: string,
  timeBudget: string
): Promise<PlanResponse> {
  const response = await fetch(`${API_BASE_URL}/api/plan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [KLEAR_API_KEY_HEADER]: KLEAR_API_KEY,
    },
    body: JSON.stringify({
      image: imageBase64,
      timeBudget,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    if (error && error.error) {
      throw new Error(error.error);
    }
    throw new Error(`Server returned error ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export async function getPredictionStatus(predictionId: string): Promise<PredictionStatus> {
  const response = await fetch(`${API_BASE_URL}/api/inpaint/status?id=${predictionId}`, {
    headers: {
      [KLEAR_API_KEY_HEADER]: KLEAR_API_KEY,
    }
  });

  if (!response.ok) {
    throw new Error('Failed to get prediction status');
  }

  return response.json();
}

export async function getPlanStatus(predictionId: string): Promise<PredictionStatus> {
  const response = await fetch(`${API_BASE_URL}/api/plan/status?id=${predictionId}`, {
    headers: {
      [KLEAR_API_KEY_HEADER]: KLEAR_API_KEY,
    }
  });

  if (!response.ok) {
    throw new Error('Failed to get plan status');
  }

  return response.json();
}

export async function pollForCompletion(
  predictionId: string,
  onProgress?: (status: string) => void,
  maxAttempts = 60,
  intervalMs = 2000
): Promise<string> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const status = await getPredictionStatus(predictionId);
    
    onProgress?.(status.status);

    if (status.status === 'succeeded') {
      const output = Array.isArray(status.output) ? status.output[0] : status.output;
      if (!output) throw new Error('No output received');
      return output;
    }

    if (status.status === 'failed') {
      throw new Error(status.error || 'Inpainting failed');
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
    attempts++;
  }

  throw new Error('Inpainting timed out');
}

export async function pollForPlan(
  predictionId: string,
  onProgress?: (status: string) => void,
  maxAttempts = 60,
  intervalMs = 2000
): Promise<any[]> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const status = await getPlanStatus(predictionId);
    
    onProgress?.(status.status);

    if (status.status === 'succeeded') {
      if (!status.tasks) throw new Error('No plan generated');
      return status.tasks;
    }

    if (status.status === 'failed') {
      throw new Error(status.error || 'Analysis failed');
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
    attempts++;
  }

  throw new Error('Analysis timed out');
}

// Generate a simple white mask (process entire image)
export function generateFullMask(width: number, height: number): string {
  // For MVP, we'll use a placeholder approach
  // In production, this would be a proper base64 mask image
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
}
