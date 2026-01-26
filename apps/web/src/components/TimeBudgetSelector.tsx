'use client';

import { TIME_BUDGETS } from '@/lib/constants';
import type { TimeBudget } from '@/types';

interface TimeBudgetSelectorProps {
  selected: TimeBudget;
  onSelect: (budget: TimeBudget) => void;
}

export function TimeBudgetSelector({ selected, onSelect }: TimeBudgetSelectorProps) {
  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">
          How much time do you have?
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          We&apos;ll create a plan that fits your schedule
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(Object.entries(TIME_BUDGETS) as [TimeBudget, typeof TIME_BUDGETS[TimeBudget]][]).map(
          ([key, value]) => (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={`
                relative p-6 rounded-2xl border-2 transition-all text-left
                ${selected === key
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                }
              `}
            >
              <span className="text-3xl mb-3 block">{value.icon}</span>
              <h3 className={`text-lg font-semibold ${
                selected === key 
                  ? 'text-blue-700 dark:text-blue-400' 
                  : 'text-zinc-800 dark:text-zinc-200'
              }`}>
                {value.label}
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                {value.description}
              </p>
              
              {selected === key && (
                <div className="absolute top-3 right-3">
                  <svg
                    className="w-6 h-6 text-blue-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </button>
          )
        )}
      </div>
    </div>
  );
}
