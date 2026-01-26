'use client';

import { useState } from 'react';

interface FeedbackButtonsProps {
  onFeedback: (rating: 'positive' | 'negative', comment?: string) => void;
}

export function FeedbackButtons({ onFeedback }: FeedbackButtonsProps) {
  const [selected, setSelected] = useState<'positive' | 'negative' | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');

  const handleSelect = (rating: 'positive' | 'negative') => {
    setSelected(rating);
    if (rating === 'negative') {
      setShowComment(true);
    } else {
      onFeedback(rating);
    }
  };

  const handleSubmitComment = () => {
    if (selected) {
      onFeedback(selected, comment);
      setShowComment(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        How does this look?
      </p>
      
      <div className="flex gap-3">
        <button
          onClick={() => handleSelect('positive')}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-xl border transition-all
            ${selected === 'positive' 
              ? 'border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400' 
              : 'border-zinc-300 dark:border-zinc-700 hover:border-green-400 text-zinc-600 dark:text-zinc-400'
            }
          `}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
            />
          </svg>
          Looks great
        </button>
        
        <button
          onClick={() => handleSelect('negative')}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-xl border transition-all
            ${selected === 'negative' 
              ? 'border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400' 
              : 'border-zinc-300 dark:border-zinc-700 hover:border-red-400 text-zinc-600 dark:text-zinc-400'
            }
          `}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5"
            />
          </svg>
          Needs work
        </button>
      </div>

      {showComment && (
        <div className="w-full max-w-md mt-2 animate-in fade-in slide-in-from-top-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What could be better? (optional)"
            className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 
                       bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200
                       placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500
                       resize-none"
            rows={2}
          />
          <button
            onClick={handleSubmitComment}
            className="mt-2 px-4 py-2 text-sm rounded-lg bg-zinc-800 dark:bg-zinc-200 
                       text-white dark:text-zinc-800 hover:bg-zinc-700 dark:hover:bg-zinc-300
                       transition-colors"
          >
            Submit feedback
          </button>
        </div>
      )}

      {selected === 'positive' && (
        <p className="text-sm text-green-600 dark:text-green-400 animate-in fade-in">
          Thanks for your feedback!
        </p>
      )}
    </div>
  );
}
