'use client';

interface ProcessingViewProps {
  message?: string;
}

export function ProcessingView({ message = 'Generating your clean space...' }: ProcessingViewProps) {
  return (
    <div className="w-full max-w-md mx-auto text-center py-16">
      <div className="relative w-24 h-24 mx-auto mb-8">
        {/* Outer spinning ring */}
        <div className="absolute inset-0 border-4 border-blue-200 dark:border-blue-900 rounded-full" />
        <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin" />
        
        {/* Inner icon */}
        <div className="absolute inset-4 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-full">
          <svg
            className="w-8 h-8 text-blue-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
            />
          </svg>
        </div>
      </div>

      <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100 mb-2">
        {message}
      </h2>
      
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        This usually takes 15-30 seconds
      </p>

      <div className="mt-8 flex justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
