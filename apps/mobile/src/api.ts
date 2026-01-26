// API service for Klear mobile app

// Configure API URL via environment variable:
// Create a .env file with: EXPO_PUBLIC_API_URL=http://your-ip:3000
// Or for production: EXPO_PUBLIC_API_URL=https://your-domain.vercel.app
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface InpaintResponse {
  predictionId: string;
}

export interface PredictionStatus {
  status: 'starting' | 'processing' | 'succeeded' | 'failed';
  output?: string | string[];
  error?: string;
}

export async function startInpainting(imageBase64: string, maskBase64: string): Promise<InpaintResponse> {
  const response = await fetch(`${API_BASE_URL}/api/inpaint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: imageBase64,
      mask: maskBase64,
    }),
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

// Generate a simple white mask (process entire image)
export function generateFullMask(width: number, height: number): string {
  // For MVP, we'll use a placeholder approach
  // In production, this would be a proper base64 mask image
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
}
