import { NextRequest, NextResponse } from 'next/server';
import { KLEAR_API_KEY_HEADER } from '@klear/shared';

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  
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

    console.log(`[PlanRequest] ID: ${requestId} | TimeBudget: ${timeBudget}`);

    // Call Llama 3.2 Vision for room analysis and task generation
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Llama 3.2 Vision model
        version: '90a3693f73602497fc67702f928e07971775e18f2d573880f08a3d3c7f9996e3',
        input: {
          image: image,
          prompt: `Analyze this messy room and create a structured cleaning plan for a ${timeBudget} session. 
          Return ONLY a JSON array of tasks. Each task must have:
          - id: string (unique)
          - title: string (short, actionable)
          - description: string (detailed instructions)
          - estimatedMinutes: number
          - priority: "high" | "medium" | "low"
          
          Example format:
          [
            {"id": "1", "title": "Clear surface", "description": "Remove clutter from table", "estimatedMinutes": 5, "priority": "high"}
          ]`,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[PlanError] ID: ${requestId} | Replicate API error: ${error}`);
      return NextResponse.json({ error: 'Failed to start analysis' }, { status: 500 });
    }

    const prediction = await response.json();
    return NextResponse.json({ predictionId: prediction.id });
  } catch (error) {
    console.error(`[PlanError] ID: ${requestId} | Error: ${error}`);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
