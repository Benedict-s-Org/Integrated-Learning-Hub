// ============================================================
// AssessmentReport — Combined Results Report Component
// ============================================================
// Displays the full assessment report combining:
// - Grip analysis (from iPhone)
// - Pressure analysis (from iPad)
// - Handwriting analysis (from Gemini Vision)
// With visual charts and actionable recommendations.
// ============================================================

import React from 'react';
import { FullAssessmentResult } from '../shared/types';
import { RadarChart } from './RadarChart';
import { PressureCurve } from './PressureCurve';

interface AssessmentReportProps {
  /** Complete assessment data */
  result: FullAssessmentResult;
  /** Whether to show the print-friendly version */
  printMode?: boolean;
  /** Called to start a new assessment */
  onNewAssessment?: () => void;
}

/**
 * Full assessment report page component.
 *
 * TODO Phase 5:
 * - Display student info + session metadata header
 * - Grip analysis section with snapshot + classification
 * - Pressure analysis section with PressureCurve chart
 * - Handwriting analysis section with RadarChart
 * - Problem letters highlight section
 * - AI-generated recommendations
 * - Print / Export PDF functionality
 * - Overall summary score
 */
export const AssessmentReport: React.FC<AssessmentReportProps> = ({
  result,
  printMode: _printMode = false,
  onNewAssessment: _onNewAssessment,
}) => {
  return (
    <div className="assessment-report max-w-4xl mx-auto p-6 bg-white min-h-screen">
      {/* Header */}
      <header className="text-center mb-8 pb-6 border-b border-slate-200">
        <h1 className="text-3xl font-bold text-slate-800">
          📝 Handwriting Assessment Report
        </h1>
        <p className="text-slate-500 mt-2">
          Student: <strong>{result.studentName}</strong>
        </p>
        <p className="text-slate-400 text-sm">
          Session: {result.sessionId} • {result.metadata.reportGeneratedAt}
        </p>
      </header>

      {/* Section 1: Grip Analysis */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-700 mb-4 flex items-center gap-2">
          ✋ Grip Analysis
        </h2>
        {result.gripResult ? (
          <div className="bg-slate-50 rounded-xl p-4">
            {/* TODO: Display grip type, confidence, snapshot image */}
            <p className="text-slate-500">
              Grip type: {result.gripResult.gripType} (confidence: {result.gripResult.confidence})
            </p>
            {/* TODO: Grip snapshot image */}
            {/* TODO: Thumb position details */}
            {/* TODO: Finger flexion diagram */}
          </div>
        ) : (
          <p className="text-slate-400 italic">Grip analysis not completed</p>
        )}
      </section>

      {/* Section 2: Pressure Analysis */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-700 mb-4 flex items-center gap-2">
          📊 Pressure Analysis
        </h2>
        {result.pressureResult ? (
          <div className="bg-slate-50 rounded-xl p-4">
            {/* TODO: Pressure statistics cards */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-800">
                  {result.pressureResult.avgPressure.toFixed(2)}
                </p>
                <p className="text-xs text-slate-500">Avg Pressure</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-800">
                  {result.pressureResult.maxPressure.toFixed(2)}
                </p>
                <p className="text-xs text-slate-500">Max Pressure</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-800">
                  {result.pressureResult.fatigueIndex.toFixed(2)}
                </p>
                <p className="text-xs text-slate-500">Fatigue Index</p>
              </div>
            </div>
            {/* Pressure Curve Chart */}
            <PressureCurve
              samples={result.pressureResult.rawData}
              fatigueIndex={result.pressureResult.fatigueIndex}
            />
          </div>
        ) : (
          <p className="text-slate-400 italic">Pressure analysis not completed</p>
        )}
      </section>

      {/* Section 3: Handwriting Analysis */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-700 mb-4 flex items-center gap-2">
          ✍️ Handwriting Analysis
        </h2>
        {result.handwritingResult ? (
          <div className="bg-slate-50 rounded-xl p-4">
            {/* Radar Chart */}
            <div className="flex justify-center mb-4">
              <RadarChart
                scores={{
                  letterClarity: result.handwritingResult.letterClarity,
                  sizeConsistency: result.handwritingResult.sizeConsistency,
                  lineAdherence: result.handwritingResult.lineAdherence,
                  letterFormation: result.handwritingResult.letterFormation,
                  spacing: result.handwritingResult.spacing,
                }}
              />
            </div>

            {/* Problem Letters */}
            {result.handwritingResult.problemLetters.length > 0 && (
              <div className="mt-4">
                <h3 className="font-medium text-slate-600 mb-2">Problem Letters:</h3>
                <div className="flex gap-2 flex-wrap">
                  {result.handwritingResult.problemLetters.map((letter) => (
                    <span
                      key={letter}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-mono"
                    >
                      {letter}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {result.handwritingResult.suggestions.length > 0 && (
              <div className="mt-4">
                <h3 className="font-medium text-slate-600 mb-2">Recommendations:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                  {result.handwritingResult.suggestions.map((suggestion, i) => (
                    <li key={i}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-slate-400 italic">Handwriting analysis not completed</p>
        )}
      </section>

      {/* Actions */}
      <footer className="text-center pt-6 border-t border-slate-200">
        {/* TODO: Print / Export PDF buttons */}
        <button
          onClick={_onNewAssessment}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
        >
          Start New Assessment
        </button>
      </footer>
    </div>
  );
};
