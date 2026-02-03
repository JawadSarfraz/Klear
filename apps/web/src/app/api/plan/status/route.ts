import { NextRequest, NextResponse } from 'next/server';
import { KLEAR_API_KEY_HEADER } from '@klear/shared';

// Robust JSON extraction from conversational AI output
function extractJsonArray(text: string): any[] | null {
  if (!text) return null;

  // Remove markdown fences (```json ... ```)
  const cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  // Try to find the first JSON array in the text
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  
  if (start === -1 || end === -1 || end < start) {
    return null;
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function GET(request: NextRequest) {
  // --- Security Check ---
  const clientApiKey = request.headers.get(KLEAR_API_KEY_HEADER);
  const serverApiKey = process.env.KLEAR_API_KEY;

  if (!serverApiKey || clientApiKey !== serverApiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const predictionId = searchParams.get('id');

  if (!predictionId) {
    return NextResponse.json({ error: 'Prediction ID is required' }, { status: 400 });
  }

  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) {
    return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 500 });
  }

  try {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
    }

    const prediction = await response.json();
    
    // For vision models, the output might be a string containing JSON
    let tasks = null;
    if (prediction.status === 'succeeded' && prediction.output) {
      const outputString = Array.isArray(prediction.output) ? prediction.output.join('') : prediction.output;
      try {
        tasks = extractJsonArray(outputString);
      } catch (e) {
        console.error('[PlanError] Failed to parse tasks from vision output:', e);
        console.error('[PlanError] Raw output:', outputString);
      }
    }

    return NextResponse.json({
      status: prediction.status,
      tasks: tasks,
      error: prediction.error,
    });
  } catch (error) {
    console.error('Plan status check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
