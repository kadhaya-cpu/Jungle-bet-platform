import React from 'react';
import { Loader2 } from 'lucide-react';

export interface LoaderProps {
  label?: string;
  fullScreen?: boolean;
  rows?: number;
  variant?: 'spinner' | 'skeleton';
}

/**
 * Unified Loader & Skeleton Screen Component
 */
export const Loader: React.FC<LoaderProps> = ({
  label = 'Synchronizing live optical telemetry...',
  fullScreen = false,
  rows = 3,
  variant = 'spinner',
}) => {
  if (variant === 'skeleton') {
    return (
      <div className="space-y-3 w-full animate-pulse">
        {Array.from({ length: rows }).map((_, idx) => (
          <div
            key={idx}
            className="h-20 w-full rounded-2xl bg-[#1a1a1a] border border-white/5 p-4 flex items-center justify-between"
          >
            <div className="space-y-2 w-2/3">
              <div className="h-3.5 bg-white/10 rounded w-1/2" />
              <div className="h-2.5 bg-white/5 rounded w-3/4" />
            </div>
            <div className="h-8 w-20 bg-[#FFD700]/15 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  const content = (
    <div className="flex flex-col items-center justify-center gap-3 py-10">
      <div className="relative flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-[#FFD700]/20 animate-ping absolute" />
        <Loader2 className="w-8 h-8 text-[#FFD700] animate-spin" />
      </div>
      {label && <p className="text-xs font-medium text-gray-400 tracking-wide">{label}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0f0f0f]/90 backdrop-blur-md flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
};

export default Loader;
