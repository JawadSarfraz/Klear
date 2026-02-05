import { NextRequest, NextResponse } from 'next/server';
import { KLEAR_API_KEY_HEADER } from '@klear/shared';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);

  // --- Rate Limiting (KLEAR-202) ---
  const rateLimitResponse = checkRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;
  
  try {
    // --- Security Check ---
    const clientApiKey = request.headers.get(KLEAR_API_KEY_HEADER);
    const serverApiKey = process.env.KLEAR_API_KEY;

    if (!serverApiKey || clientApiKey !== serverApiKey) {
      console.error(`[SecurityError] ID: ${requestId} | Invalid or missing API key`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { image, timeBudget } = await request.json();

    if (!image) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    const apiKey = process.env.REPLICATE_API_TOKEN;
    if (!apiKey) {
      return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 500 });
    }

    const deviceId = request.headers.get('x-device-id') || 'unknown';
    console.log(`[PlanRequest] ID: ${requestId} | Device: ${deviceId} | Budget: ${timeBudget}`);

    // Call Llama 3.2 Vision for room analysis and task generation
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait'
      },
      body: JSON.stringify({
        // Verified Public Llama 3.2 11B Vision Instruct
        version: "d4e81fc1472556464f1ee5cea4de177b2fe95a6eaadb5f63335df1ba654597af",
        input: {
          image: image,
          max_tokens: 1024,
          temperature: 0.1,
          prompt: `Return ONLY valid JSON. No prose. No markdown. No explanation. 

Task: Analyze this room and create a ${timeBudget} cleaning plan as a JSON array.

Guidelines:
1. Identify visible room zones (e.g., "desk surface", "floor area", "bedside").
2. Look for clutter categories (e.g., "papers/mail", "cables/electronics", "dishes/cups", "clothes").
3. Create actionable tasks referencing these zones and categories.
4. Only mention specific objects if they are clearly visible. Otherwise, use categories.
5. Prioritize "decluttering" first, then "surfaces", then "floor".

Each task: {"id": "string", "title": "string", "description": "string", "estimatedMinutes": number, "priority": "high"|"medium"|"low", "area": "string"}

Example output format:
[{"id": "1", "title": "Clear papers from desk surface", "description": "Sort through mail and loose papers on the desk", "estimatedMinutes": 10, "priority": "high", "area": "Desk"}]`,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[PlanError] ID: ${requestId} | Replicate API error: ${error}`);
      return NextResponse.json({ error: `Analysis failed: ${error}` }, { status: 500 });
    }

    const prediction = await response.json();
    return NextResponse.json({ predictionId: prediction.id });
  } catch (error) {
    console.error(`[PlanError] ID: ${requestId} | Error: ${error}`);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
