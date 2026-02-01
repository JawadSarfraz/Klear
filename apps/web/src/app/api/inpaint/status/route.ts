import { NextRequest, NextResponse } from 'next/server';
import { KLEAR_API_KEY_HEADER } from '@klear/shared';

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
    return NextResponse.json(
      { error: 'Prediction ID is required' },
      { status: 400 }
    );
  }

  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Replicate API key not configured' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch prediction status' },
        { status: 500 }
      );
    }

    const prediction = await response.json();
    
    return NextResponse.json({
      status: prediction.status,
      output: prediction.output,
      error: prediction.error,
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
