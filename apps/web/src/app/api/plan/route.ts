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

    const { image, timeBudget, roomType } = await request.json();

    if (!image) {
      console.error(`[PlanError] ID: ${requestId} | No image provided`);
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    // DEBUG: Log image details
    const imageSize = image?.length || 0;
    const imagePreview = image?.slice(0, 100) || 'empty';
    console.log(`[PlanDebug] ID: ${requestId} | Image size: ${imageSize} chars | Preview: ${imagePreview}`);

    if (imageSize < 100) {
      console.error(`[PlanError] ID: ${requestId} | Image too small or invalid`);
      return NextResponse.json({ error: 'Invalid image data' }, { status: 400 });
    }

    const apiKey = process.env.REPLICATE_API_TOKEN;
    if (!apiKey) {
      return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 500 });
    }

    const deviceId = request.headers.get('x-device-id') || 'unknown';
    console.log(`[PlanRequest] ID: ${requestId} | Device: ${deviceId} | Budget: ${timeBudget} | Room: ${roomType || 'unspecified'}`);

    // Humanize room type for prompt
    const roomLabel = roomType ? ` ${roomType.replace('_', ' ')}` : 'room';

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
          prompt: `You are analyzing a photo of a messy${roomLabel}. Create a personalized ${timeBudget} cleaning plan based on EXACTLY what you see in the photo.

RULES:
1. Describe specific visible items, their locations, and quantities (e.g., "3 coffee mugs on the left side of desk", "pile of clothes near the bed")
2. Be concrete and actionable - mention colors, positions, and object types you can clearly see
3. If you see clutter but can't identify specific items, describe the area (e.g., "mixed items on floor near window")
4. Prioritize by clutter severity: high = blocking walkways or workspace, medium = visible mess, low = minor tidying
5. Match the time budget:
   - 15min: 2-3 quick high-impact tasks (15-20 minutes total)
   - 1hr: 4-6 tasks covering main visible clutter (50-70 minutes total)
   - weekend: 6-10 tasks including deep cleaning (120-180 minutes total)

OUTPUT FORMAT: Return ONLY a valid JSON array. No markdown, no explanations, no extra text.

Each task must have:
- "id": sequential number as string
- "title": specific action referencing what you see (e.g., "Put away the 3 water bottles on desk")
- "description": detailed steps mentioning visible items/locations
- "estimatedMinutes": realistic time estimate (5-25 minutes per task)
- "priority": "high" (urgent/blocking), "medium" (visible mess), or "low" (finishing touches)
- "area": room zone (e.g., "Desk", "Floor", "Bed area", "Shelves")

Example:
[{"id":"1","title":"Clear the papers and notebooks from left side of desk","description":"Gather the stack of loose papers, mail, and 2 notebooks. File important docs, recycle junk mail","estimatedMinutes":8,"priority":"high","area":"Desk"}]

Now analyze the photo and return the JSON array:`,
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
