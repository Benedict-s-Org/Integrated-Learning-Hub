import React from 'react';
import { BarChart3, Flame, Trophy, Zap } from 'lucide-react';

interface SessionResult {
  question_id: string;
  selected_answer_index: number;
  is_correct: boolean;
  response_time_ms: number;
}

interface SessionSummaryProps {
  results: SessionResult[];
  newStreak: number;
  achievementUnlocked?: { name: string; description: string; icon: string };
  onContinue: () => void;
  onBackToHub: () => void;
}

export function SessionSummary({
  results,
  newStreak,
  achievementUnlocked,
  onContinue,
  onBackToHub,
}: SessionSummaryProps) {
  const correctCount = results.filter(r => r.is_correct).length;
  const accuracy = Math.round((correctCount / results.length) * 100);
  const totalTime = Math.round(results.reduce((sum, r) => sum + r.response_time_ms, 0) / 1000);
  const avgTime = Math.round(totalTime / results.length);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <Trophy className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
          <h1 className="text-3xl font-bold text-gray-900">Session Complete!</h1>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600 mb-1">Accuracy</p>
              <p className="text-3xl font-bold text-blue-600">{accuracy}%</p>
              <p className="text-xs text-gray-500 mt-1">{correctCount}/{results.length} correct</p>
            </div>

            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600 mb-1">Time Spent</p>
              <p className="text-3xl font-bold text-green-600">{totalTime}s</p>
              <p className="text-xs text-gray-500 mt-1">{avgTime}s per card</p>
            </div>

            <div className="bg-orange-50 rounded-lg p-4 text-center">
              <Flame className="w-5 h-5 mx-auto text-orange-600 mb-1" />
              <p className="text-sm text-gray-600 mb-1">Streak</p>
              <p className="text-3xl font-bold text-orange-600">{newStreak} 🔥</p>
            </div>

            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <BarChart3 className="w-5 h-5 mx-auto text-purple-600 mb-1" />
              <p className="text-sm text-gray-600 mb-1">Cards Due</p>
              <p className="text-3xl font-bold text-purple-600">
                {results.filter(r => r.is_correct).length}
              </p>
            </div>
          </div>

          {achievementUnlocked && (
            <div className="bg-gradient-to-r from-yellow-100 to-orange-100 border-2 border-yellow-400 rounded-lg p-6 mb-8">
              <div className="text-center">
                <Zap className="w-12 h-12 mx-auto text-yellow-600 mb-3" />
                <p className="text-sm text-gray-600 mb-1">Achievement Unlocked!</p>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {achievementUnlocked.name}
                </h3>
                <p className="text-sm text-gray-700">{achievementUnlocked.description}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900 mb-3">Response Timeline</h3>
            {results.map((result, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg flex items-center justify-between ${
                  result.is_correct ? 'bg-green-50' : 'bg-red-50'
                }`}
              >
                <span className="text-sm text-gray-700">
                  Q{idx + 1}: {result.is_correct ? '✓' : '✗'}
                </span>
                <span className="text-xs text-gray-600">
                  {(result.response_time_ms / 1000).toFixed(1)}s
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onContinue}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Continue Learning
          </button>
          <button
            onClick={onBackToHub}
            className="flex-1 px-6 py-3 bg-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
          >
            Back to Hub
          </button>
        </div>
      </div>
    </div>
  );
}