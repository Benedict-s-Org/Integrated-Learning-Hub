// ============================================================
// GripAnalyzer — iPhone Grip Analysis UI Component
// ============================================================
// Main component for the iPhone grip analysis station.
// Combines GripCamera + GripClassifier into a guided workflow.
// ============================================================

import React, { useState } from 'react';
import { GripCamera } from './GripCamera';
import { GripResult, GripType } from '../shared/types';
import { GRIP_TYPE_LABELS, GRIP_TYPE_DESCRIPTIONS } from '../shared/constants';

interface GripAnalyzerProps {
  /** Called when grip analysis is complete */
  onComplete: (result: GripResult) => void;
  /** Called to go back */
  onBack?: () => void;
}

/**
 * Full grip analysis UI for the iPhone station.
 *
 * Flow:
 * 1. Show instructions + camera preview
 * 2. Student holds pencil in writing position
 * 3. Camera detects hand → runs classifier
 * 4. Show result with confidence + description
 * 5. Allow re-capture or confirm
 *
 * TODO Phase 2:
 * - Wire up GripCamera frame callback to GripClassifier
 * - Implement step-by-step guided UI
 * - Add capture/confirm/re-capture flow
 * - Upload snapshot to Supabase Storage
 * - Show classification result with visual feedback
 */
export const GripAnalyzer: React.FC<GripAnalyzerProps> = ({
  onComplete: _onComplete,
  onBack: _onBack,
}) => {
  const [_result, setResult] = useState<GripResult | null>(null);
  const [_step, setStep] = useState<'instructions' | 'capturing' | 'result'>('instructions');

  // Suppress unused variable warnings
  void setResult;
  void setStep;

  return (
    <div className="grip-analyzer flex flex-col h-full bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <button
          onClick={_onBack}
          className="text-white/70 hover:text-white transition-colors"
        >
          ← Back
        </button>
        <h2 className="text-lg font-semibold">✋ Grip Analysis</h2>
        <div className="w-16" /> {/* Spacer */}
      </div>

      {/* Camera Area */}
      <div className="flex-1 px-4 pb-4">
        <GripCamera />
      </div>

      {/* Instructions / Results Panel */}
      <div className="bg-white text-slate-800 rounded-t-3xl p-6 min-h-[200px]">
        {/* TODO: Step-based content */}
        <h3 className="font-bold text-lg mb-2">How to capture:</h3>
        <ol className="list-decimal list-inside space-y-1 text-slate-600 text-sm">
          <li>Hold your pencil in your normal writing position</li>
          <li>Point the camera at your hand from the side</li>
          <li>Keep your hand steady for 3 seconds</li>
          <li>The app will automatically detect your grip type</li>
        </ol>

        {/* TODO: Show result card when analysis is complete */}
        {/* Placeholder for grip type display */}
        <div className="mt-4 p-4 bg-slate-50 rounded-xl text-center text-slate-400">
          <p>Grip classification will appear here</p>
          <p className="text-xs mt-1">
            Types: {Object.values(GRIP_TYPE_LABELS).join(', ')}
          </p>
          <p className="text-xs mt-1 text-slate-300">
            {GRIP_TYPE_DESCRIPTIONS[GripType.DYNAMIC_TRIPOD].substring(0, 60)}…
          </p>
        </div>
      </div>
    </div>
  );
};
