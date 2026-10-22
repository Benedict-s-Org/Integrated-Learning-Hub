import React from 'react';
import { WorkflowStep } from '../types';

interface WorkflowStepperProps {
  currentStep: WorkflowStep;
  onStepChange: (step: WorkflowStep) => void;
  canNavigateTo: (step: WorkflowStep) => boolean;
}

const STEPS: { key: WorkflowStep; label: string; number: number }[] = [
  { key: 'prep', label: 'Preparation', number: 1 },
  { key: 'intake', label: 'Add Scans', number: 2 },
  { key: 'pair', label: 'Match Students', number: 3 },
  { key: 'grade', label: 'Verify & Review Marking', number: 4 },
  { key: 'report', label: 'Report', number: 5 },
];

export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({
  currentStep,
  onStepChange,
  canNavigateTo,
}) => {
  return (
    <nav
      className="flex items-center gap-1 border-b border-slate-200 bg-slate-50/70 px-4 py-2 overflow-x-auto sticky top-0 z-20 backdrop-blur-sm"
      aria-label="Essay marking workflow"
    >
      {STEPS.map((step) => {
        const isCurrent = currentStep === step.key || (step.key === 'grade' && currentStep === 'ocr');
        const isAllowed = canNavigateTo(step.key) || (step.key === 'grade' && canNavigateTo('ocr'));

        return (
          <button
            key={step.key}
            type="button"
            disabled={!isAllowed}
            aria-current={isCurrent ? 'step' : undefined}
            onClick={() => onStepChange(step.key)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors min-h-[34px] ${
              isCurrent
                ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                : isAllowed
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                : 'text-slate-400 cursor-not-allowed opacity-60'
            }`}
          >
            <span
              className={`inline-grid place-items-center w-5 h-5 rounded-full text-xs font-semibold ${
                isCurrent
                  ? 'bg-blue-600 text-white'
                  : isAllowed
                  ? 'bg-slate-200 text-slate-700'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {step.number}
            </span>
            <span>{step.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
