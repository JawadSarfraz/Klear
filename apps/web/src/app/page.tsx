'use client';

import { useAppState } from '@/lib/useAppState';
import {
  ImageUpload,
  BrushMask,
  BeforeAfterView,
  FeedbackButtons,
  TimeBudgetSelector,
  ProcessingView,
  TaskList,
} from '@/components';

export default function Home() {
  const {
    state,
    setOriginalImage,
    setTimeBudget,
    startInpainting,
    generatePlan,
    updateTask,
    reset,
    goBack,
  } = useAppState();

  const handleFeedback = (rating: 'positive' | 'negative', comment?: string) => {
    // In production, send to analytics/feedback API
    console.log('Feedback:', { rating, comment, planId: state.plan?.id });
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={reset} className="flex items-center gap-2">
            <span className="text-2xl">✨</span>
            <span className="font-semibold text-zinc-800 dark:text-zinc-100">
              CleanView
            </span>
          </button>
          
          {state.step !== 'upload' && (
            <button
              onClick={reset}
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Start over
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        {/* Error display */}
        {state.error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl text-red-700 dark:text-red-400">
            {state.error}
          </div>
        )}

        {/* Step: Upload */}
        {state.step === 'upload' && (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-3xl md:text-4xl font-bold text-zinc-800 dark:text-zinc-100">
                See your space, transformed
              </h1>
              <p className="mt-3 text-lg text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto">
                Upload a photo of your messy room and get a personalized cleaning plan
              </p>
            </div>

            <ImageUpload onImageSelect={setOriginalImage} />

            <div className="text-center text-sm text-zinc-400 dark:text-zinc-500">
              Your photos are processed securely and never stored
            </div>
          </div>
        )}

        {/* Step: Mask */}
        {state.step === 'mask' && state.originalImage && (
          <div className="space-y-6">
            <TimeBudgetSelector
              selected={state.timeBudget}
              onSelect={setTimeBudget}
            />
            
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
              <BrushMask
                imageData={state.originalImage}
                onMaskComplete={startInpainting}
                onBack={goBack}
              />
            </div>
          </div>
        )}

        {/* Step: Processing */}
        {state.step === 'processing' && (
          <ProcessingView message="Generating your clean space..." />
        )}

        {/* Step: Preview */}
        {state.step === 'preview' && state.originalImage && state.cleanedImage && (
          <div className="space-y-8">
            <BeforeAfterView
              beforeImage={state.originalImage}
              afterImage={state.cleanedImage}
              onContinue={generatePlan}
              onRetry={goBack}
            />
            
            <FeedbackButtons onFeedback={handleFeedback} />
          </div>
        )}

        {/* Step: Plan */}
        {state.step === 'plan' && state.plan && (
          <div className="space-y-8">
            {/* Mini before/after */}
            {state.originalImage && state.cleanedImage && (
              <div className="flex gap-4 max-w-md mx-auto">
                <div className="flex-1">
                  <img
                    src={state.originalImage}
                    alt="Before"
                    className="w-full aspect-video object-cover rounded-lg"
                  />
                  <p className="text-xs text-zinc-500 text-center mt-1">Before</p>
                </div>
                <div className="flex-1">
                  <img
                    src={state.cleanedImage}
                    alt="After"
                    className="w-full aspect-video object-cover rounded-lg"
                  />
                  <p className="text-xs text-zinc-500 text-center mt-1">Goal</p>
                </div>
              </div>
            )}

            <TaskList
              tasks={state.plan.tasks}
              onTaskUpdate={updateTask}
              totalMinutes={state.plan.totalEstimatedMinutes}
            />

            <div className="text-center pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <button
                onClick={reset}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Clean another room
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">
          CleanView AI - Visualize your clean space
        </div>
      </footer>
    </div>
  );
}
