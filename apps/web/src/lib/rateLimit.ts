import { NextResponse } from 'next/server';
import { KLEAR_DEVICE_ID_HEADER } from '@klear/shared';

/**
 * KLEAR-202: Simple in-memory rate limiter for MVP.
 * In production, this should use Redis or a database.
 */

interface RateLimitStore {
  [deviceId: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

// Limits: 10 requests per hour per device
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 10;

export function checkRateLimit(request: Request) {
  const deviceId = request.headers.get(KLEAR_DEVICE_ID_HEADER) || 'unknown';
  const now = Date.now();

  if (!store[deviceId] || now > store[deviceId].resetTime) {
    store[deviceId] = {
      count: 1,
      resetTime: now + WINDOW_MS,
    };
    return null; // Limit not exceeded
  }

  store[deviceId].count++;

  if (store[deviceId].count > MAX_REQUESTS) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429 }
    );
  }

  return null;
}
