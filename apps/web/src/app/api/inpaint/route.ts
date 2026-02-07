import { NextRequest, NextResponse } from 'next/server';
import { INPAINTING_PROMPT, KLEAR_API_KEY_HEADER } from '@klear/shared';
import sharp from 'sharp';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();

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

    const body = await request.json();
    const { image, mask, strength = 0.85, guidance_scale = 7.5 } = body;

    if (!image) {
      console.error(`[InpaintError] ID: ${requestId} | Missing image`);
      return NextResponse.json(
        { error: 'Image is required' },
        { status: 400 }
      );
    }

    // --- Dimension Logging & Normalization ---
    const imageBuffer = Buffer.from(image.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    const imageMeta = await sharp(imageBuffer).metadata();

    if (!imageMeta.width || !imageMeta.height) {
      throw new Error('Invalid image dimensions');
    }

    console.log(`[InpaintRequest] ID: ${requestId} | ` +
      `Img: ${imageMeta.width}x${imageMeta.height} (${image.length}b) | ` +
      `Mask: ${mask ? 'user-provided' : 'auto-generated'} | ` +
      `Strength: ${strength} | Guidance: ${guidance_scale}`);

    // --- Mask Preprocessing: Auto-generate or Process User Mask ---
    let processedMaskBuffer: Buffer;

    if (!mask) {
      // V1: Auto-generate full-room mask (clean everything visible)
      console.log(`[InpaintMask] ID: ${requestId} | Generating full-room white mask ${imageMeta.width}x${imageMeta.height}`);
      processedMaskBuffer = await sharp({
        create: {
          width: imageMeta.width,
          height: imageMeta.height,
          channels: 3, // RGB
          background: { r: 255, g: 255, b: 255 } // White
        }
      })
      .grayscale() // Convert to grayscale
      .toBuffer();
    } else {
      // User provided mask: Resize & Dilate
      const maskBuffer = Buffer.from(mask.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      const maskMeta = await sharp(maskBuffer).metadata();
      console.log(`[InpaintMask] ID: ${requestId} | Processing user mask ${maskMeta.width}x${maskMeta.height}`);
      
      processedMaskBuffer = await sharp(maskBuffer)
        .resize(imageMeta.width, imageMeta.height, { fit: 'fill' })
        .grayscale()
        .convolve({
          width: 3,
          height: 3,
          kernel: [1, 1, 1, 1, 1, 1, 1, 1, 1] // Dilation kernel
        })
        .toBuffer();
    }
    
    const processedMask = `data:image/png;base64,${processedMaskBuffer.toString('base64')}`;

    const apiKey = process.env.REPLICATE_API_TOKEN;
    if (!apiKey) {
      console.error(`[InpaintError] ID: ${requestId} | Replicate API key not configured`);
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
          mask: processedMask,
          prompt: INPAINTING_PROMPT,
          negative_prompt: 'cluttered, messy, dirty, disorganized, blurry, distorted',
          num_inference_steps: 30,
          guidance_scale: guidance_scale,
          strength: strength,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[InpaintError] ID: ${requestId} | Replicate API error: ${error}`);
      return NextResponse.json(
        { error: `Inpainting failed: ${error}` },
        { status: 500 }
      );
    }

    const prediction = await response.json();
    const duration = Date.now() - startTime;
    console.log(`[InpaintSuccess] ID: ${requestId} | PredictionID: ${prediction.id} | Duration: ${duration}ms`);
    
    return NextResponse.json({ predictionId: prediction.id });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[InpaintError] ID: ${requestId} | Error: ${error} | Duration: ${duration}ms`);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
