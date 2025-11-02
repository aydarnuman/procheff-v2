"use client";

import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import "./progress-bar.css";

interface ProgressBarProps {
  progress: number; // 0-100 arası
  status?: string; // Durum mesajı (örn: "Sayfa 5/71 işleniyor...")
  substatus?: string; // Alt durum mesajı
  showPercentage?: boolean; // Yüzde göster
  className?: string;
}

export function ProgressBar({
  progress,
  status,
  substatus,
  showPercentage = true,
  className = ""
}: ProgressBarProps) {
  const clampedProgress = Math.max(0, Math.min(100, progress));

  // En yakın 5'in katına yuvarla
  const roundedProgress = Math.round(clampedProgress / 5) * 5;
  const progressClass = `progress-bar-${roundedProgress}`;

  return (
    <div className={`w-full space-y-2 ${className}`}>
      {/* Durum mesajı */}
      {status && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Loader2 className="w-4 h-4 text-accent-400 animate-spin" />
            <span className="text-sm font-medium text-surface-primary">{status}</span>
          </div>
          {showPercentage && (
            <span className="text-sm font-semibold text-accent-400">
              {Math.round(clampedProgress)}%
            </span>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div className={`w-full bg-platinum-800/60 rounded-full h-3`}>
        <motion.div
          className={`bg-accent-500 h-3 rounded-full progress-bar-dynamic ${progressClass}`}
          initial={{ width: "0%" }}
          animate={{ width: `${clampedProgress}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          title={`Progress: ${Math.round(clampedProgress)}%`}
        />
      </div>

      {/* Alt durum mesajı */}
      {substatus && (
        <p className="text-xs text-surface-secondary ml-6">{substatus}</p>
      )}
    </div>
  );
}

// Multi-step progress component
interface MultiStepProgressProps {
  currentStep: number;
  totalSteps: number;
  steps: Array<{
    label: string;
    sublabel?: string;
  }>;
  className?: string;
}

export function MultiStepProgress({
  currentStep,
  totalSteps,
  steps,
  className = "",
}: MultiStepProgressProps) {
  const progress = ((currentStep - 1) / totalSteps) * 100;

  return (
    <div className={`w-full space-y-4 ${className}`}>
      {/* Progress bar */}
      <div className="w-full h-2 bg-platinum-800/60 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
          initial={{ width: "0%" }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {/* Step indicators */}
      <div className="space-y-2">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isPending = stepNumber > currentStep;

          return (
            <motion.div
              key={stepNumber}
              className="flex items-start space-x-3"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              {/* Step indicator */}
              <div className="flex-shrink-0 mt-0.5">
                {isCompleted && (
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
                {isCurrent && (
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <Loader2 className="w-3 h-3 text-white animate-spin" />
                  </div>
                )}
                {isPending && (
                  <div className="w-5 h-5 rounded-full border-2 border-platinum-600" />
                )}
              </div>

              {/* Step text */}
              <div className="flex-1">
                <p
                  className={`text-sm font-medium ${
                    isCompleted
                      ? "text-green-400"
                      : isCurrent
                      ? "text-blue-400"
                      : "text-platinum-400"
                  }`}
                >
                  {step.label}
                </p>
                {step.sublabel && isCurrent && (
                  <p className="text-xs text-surface-secondary mt-0.5">
                    {step.sublabel}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}