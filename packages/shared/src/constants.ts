// Shared constants for Klear - used by web and mobile

export const TIME_BUDGETS = {
  '15min': {
    label: '15 Minutes',
    description: 'Quick wins only',
    maxTasks: 3,
    icon: '⚡',
  },
  '1hr': {
    label: '1 Hour',
    description: 'Solid progress',
    maxTasks: 8,
    icon: '🎯',
  },
  'weekend': {
    label: 'Weekend',
    description: 'Deep clean',
    maxTasks: 20,
    icon: '🏠',
  },
} as const;

export const TASK_PRIORITIES = {
  high: { label: 'High', color: 'red' },
  medium: { label: 'Medium', color: 'yellow' },
  low: { label: 'Low', color: 'green' },
} as const;

export const MAX_IMAGE_SIZE_MB = 10;

export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const INPAINTING_PROMPT = 
  'A clean, organized, and tidy version of this room. Remove clutter, organize items neatly, clear surfaces. Photorealistic, same lighting and perspective.';

// API endpoints - change for production
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const KLEAR_API_KEY_HEADER = 'x-klear-api-key';
export const KLEAR_DEVICE_ID_HEADER = 'x-device-id';
