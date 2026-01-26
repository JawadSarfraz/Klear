// API client for Klear - works in both web and mobile

import { API_BASE_URL } from './constants';
import type { InpaintRequest, InpaintResponse, PredictionStatus } from './types';

export async function startInpainting(data: InpaintRequest): Promise<InpaintResponse> {
  const response = await fetch(`${API_BASE_URL}/api/inpaint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Failed to start inpainting');
  }

  return response.json();
}

export async function getPredictionStatus(predictionId: string): Promise<PredictionStatus> {
  const response = await fetch(`${API_BASE_URL}/api/inpaint/status?id=${predictionId}`);

  if (!response.ok) {
    throw new Error('Failed to get prediction status');
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
