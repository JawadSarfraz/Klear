import { NextRequest, NextResponse } from 'next/server';
import { INPAINTING_PROMPT } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    const { image, mask } = await request.json();

    if (!image || !mask) {
      return NextResponse.json(
        { error: 'Image and mask are required' },
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

    // Call Replicate API for SDXL inpainting
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // SDXL Inpainting model
        version: 'c11bac58203367db93a3c552bd49a25a5418458ddffb7e90dae55780765e26d6',
        input: {
          image: image,
          mask: mask,
          prompt: INPAINTING_PROMPT,
          negative_prompt: 'cluttered, messy, dirty, disorganized, blurry, distorted',
          num_inference_steps: 30,
          guidance_scale: 7.5,
          strength: 0.85,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Replicate API error:', error);
      return NextResponse.json(
        { error: 'Failed to start inpainting' },
        { status: 500 }
      );
    }

    const prediction = await response.json();
    return NextResponse.json({ predictionId: prediction.id });
  } catch (error) {
    console.error('Inpainting error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
