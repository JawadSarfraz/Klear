import { NextRequest, NextResponse } from 'next/server';
import { KLEAR_API_KEY_HEADER, CleaningTask, TaskPriority, TaskStatus } from '@klear/shared';

// Robust JSON extraction from conversational AI output
function extractJsonArray(text: string): any[] | null {
  if (!text) return null;

  // Remove markdown fences (```json ... ```)
  let cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  // Try to find a JSON array first
  const arrayStart = cleaned.indexOf('[');
  const arrayEnd = cleaned.lastIndexOf(']');
  
  if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
    const jsonStr = cleaned.slice(arrayStart, arrayEnd + 1);
    try {
      const parsed = JSON.parse(jsonStr);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      // Try cleaning trailing commas
      try {
        const fixedJson = jsonStr.replace(/,\s*([\]}])/g, '$1');
        const parsed = JSON.parse(fixedJson);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (e2) {
        console.error('[PlanError] JSON array parse failed:', e2);
      }
    }
  }

  // Fallback: Try to find a single JSON object
  const objStart = cleaned.indexOf('{');
  const objEnd = cleaned.lastIndexOf('}');
  if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
    const jsonStr = cleaned.slice(objStart, objEnd + 1);
    try {
      const parsed = JSON.parse(jsonStr);
      return [parsed];
    } catch (e) {
      console.error('[PlanError] JSON object parse failed:', e);
    }
  }

  console.error('[PlanError] No valid JSON array or object found in AI output');
  console.error('[PlanError] Raw output head:', text.slice(0, 200));
  return null;
}

/**
 * KLEAR-102: Task Schema Validator + Sanitizer
 * Ensures every task has the required fields and reasonable defaults.
 */
function sanitizeTasks(tasks: any[]): CleaningTask[] {
  const taskArray = Array.isArray(tasks) ? tasks : [tasks];

  return taskArray
    .filter(t => t !== null && t !== undefined)
    .map((t, index) => {
      const isObj = typeof t === 'object' && !Array.isArray(t);
      const sanitized: CleaningTask = {
        id: String(isObj ? (t.id || index + 1) : (index + 1)),
        title: String(isObj ? (t.title || 'Cleaning task') : t),
        description: String(isObj ? (t.description || '') : ''),
        estimatedMinutes: Number(isObj ? t.estimatedMinutes : 5) || 5,
        priority: (isObj && ['high', 'medium', 'low'].includes(t.priority))
          ? (t.priority as TaskPriority) 
          : 'medium',
        status: 'pending' as TaskStatus,
        area: String((isObj && t.area) || 'General'),
        completed: false
      };
      return sanitized;
    });
}

/**
 * KLEAR-103: Budget Clipper
 * Enforces the time budget by dropping low-priority tasks if they exceed the limit.
 */
function enforceBudget(tasks: CleaningTask[], budgetStr: string): CleaningTask[] {
  const budgetLimits: Record<string, number> = {
    '15min': 20,
    '1hr': 75,
    'weekend': 240,
  };

  const limit = budgetLimits[budgetStr] || 60;
  
  // Sort by priority (high > medium > low)
  const priorityMap: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const sortedTasks = [...tasks].sort((a, b) => priorityMap[b.priority] - priorityMap[a.priority]);

  const result: CleaningTask[] = [];
  let currentTotal = 0;

  for (const task of sortedTasks) {
    if (currentTotal + task.estimatedMinutes <= limit) {
      result.push(task);
      currentTotal += task.estimatedMinutes;
    }
  }

  // If we ended up with 0 tasks (e.g., first task was too long), at least return the first one
  if (result.length === 0 && tasks.length > 0) {
    return [tasks[0]];
  }

  return result;
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
    
    // We need the budget to enforce it
    const budget = searchParams.get('budget') || '1hr';
    
    // For vision models, the output might be a string containing JSON
    let tasks = null;
    if (prediction.status === 'succeeded' && prediction.output) {
      const outputString = Array.isArray(prediction.output) ? prediction.output.join('') : prediction.output;
      try {
        const rawTasks = extractJsonArray(outputString);
        if (rawTasks) {
          const sanitized = sanitizeTasks(rawTasks);
          tasks = enforceBudget(sanitized, budget);
        }
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
