'use client';

import { useState } from 'react';
import type { CleaningTask } from '@/types';
import { formatMinutes } from '@/lib/utils';
import { TASK_PRIORITIES } from '@/lib/constants';

interface TaskListProps {
  tasks: CleaningTask[];
  onTaskUpdate: (taskId: string, status: CleaningTask['status']) => void;
  totalMinutes: number;
}

export function TaskList({ tasks, onTaskUpdate, totalMinutes }: TaskListProps) {
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const progressPercent = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Progress header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">
            Your cleaning plan
          </h2>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {completedTasks}/{tasks.length} tasks
          </span>
        </div>
        
        <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
          Estimated time: {formatMinutes(totalMinutes)}
        </p>
      </div>

      {/* Task list */}
      <div className="space-y-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`
              p-4 rounded-xl border transition-all
              ${task.status === 'completed'
                ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900'
                : task.status === 'in_progress'
                ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900'
                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
              }
            `}
          >
            <div className="flex items-start gap-3">
              {/* Checkbox */}
              <button
                onClick={() => onTaskUpdate(
                  task.id, 
                  task.status === 'completed' ? 'pending' : 'completed'
                )}
                className={`
                  flex-shrink-0 w-6 h-6 mt-0.5 rounded-full border-2 
                  flex items-center justify-center transition-all
                  ${task.status === 'completed'
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-zinc-300 dark:border-zinc-600 hover:border-green-400'
                  }
                `}
              >
                {task.status === 'completed' && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              {/* Task content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className={`font-medium ${
                    task.status === 'completed' 
                      ? 'text-zinc-500 line-through' 
                      : 'text-zinc-800 dark:text-zinc-200'
                  }`}>
                    {task.title}
                  </h3>
                  
                  <span className={`
                    text-xs px-2 py-0.5 rounded-full
                    ${task.priority === 'high' 
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      : task.priority === 'medium'
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                      : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    }
                  `}>
                    {TASK_PRIORITIES[task.priority].label}
                  </span>
                  
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {formatMinutes(task.estimatedMinutes)}
                  </span>
                </div>

                {/* Expandable description */}
                {task.description && (
                  <>
                    <button
                      onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-1"
                    >
                      {expandedTask === task.id ? 'Hide details' : 'Show details'}
                    </button>
                    
                    {expandedTask === task.id && (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 animate-in fade-in slide-in-from-top-1">
                        {task.description}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Skip button */}
              {task.status !== 'completed' && (
                <button
                  onClick={() => onTaskUpdate(task.id, 'skipped')}
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  Skip
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Completion message */}
      {progressPercent === 100 && (
        <div className="mt-8 p-6 bg-green-50 dark:bg-green-950/30 rounded-2xl text-center animate-in fade-in zoom-in">
          <span className="text-4xl mb-3 block">🎉</span>
          <h3 className="text-lg font-semibold text-green-800 dark:text-green-300">
            Amazing work!
          </h3>
          <p className="text-sm text-green-600 dark:text-green-400 mt-1">
            You&apos;ve completed all your cleaning tasks
          </p>
        </div>
      )}
    </div>
  );
}
