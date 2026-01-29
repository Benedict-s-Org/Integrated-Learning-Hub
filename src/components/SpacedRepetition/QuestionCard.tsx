import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Zap, Clock } from 'lucide-react';
import { SpacedRepetitionQuestion } from '../../types';

interface QuestionCardProps {
  question: SpacedRepetitionQuestion;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (selectedIndex: number, responseTime: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  canGoNext: boolean;
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  onAnswer,
  onNext,
  onPrevious,
  canGoNext,
}: QuestionCardProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [startTime] = useState(Date.now());
  const [responseTime, setResponseTime] = useState(0);

  const handleSelectAnswer = (index: number) => {
    if (showFeedback) return;

    setSelectedIndex(index);
    const time = Date.now() - startTime;
    setResponseTime(time);
    setShowFeedback(true);

    setTimeout(() => {
      onAnswer(index, time);
    }, 1500);
  };

  const isCorrect = selectedIndex === question.correct_answer_index;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex-1">
            <div className="relative h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Question {questionNumber} of {totalQuestions}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 leading-relaxed">
              {question.question_text}
            </h2>
          </div>

          <div className="space-y-3">
            {question.choices.map((choice, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectAnswer(idx)}
                disabled={showFeedback}
                className={`w-full p-4 text-left border-2 rounded-lg transition-all duration-200 ${
                  selectedIndex === idx
                    ? isCorrect
                      ? 'border-green-500 bg-green-50'
                      : 'border-red-500 bg-red-50'
                    : showFeedback && idx === question.correct_answer_index
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                } ${showFeedback ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold flex-shrink-0 ${
                      selectedIndex === idx
                        ? isCorrect
                          ? 'bg-green-500 text-white'
                          : 'bg-red-500 text-white'
                        : showFeedback && idx === question.correct_answer_index
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span
                    className={`text-lg ${
                      selectedIndex === idx
                        ? isCorrect
                          ? 'text-green-900 font-semibold'
                          : 'text-red-900 font-semibold'
                        : 'text-gray-700'
                    }`}
                  >
                    {choice}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {showFeedback && (
            <div
              className={`mt-6 p-4 rounded-lg ${
                isCorrect
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              <p
                className={`font-semibold mb-2 ${
                  isCorrect ? 'text-green-900' : 'text-red-900'
                }`}
              >
                {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
              </p>
              {question.explanation && (
                <p className="text-sm text-gray-700">{question.explanation}</p>
              )}
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                <Clock className="w-4 h-4" />
                <span>{(responseTime / 1000).toFixed(1)}s</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center">
          <button
            onClick={onPrevious}
            disabled={questionNumber === 1}
            className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            onClick={onNext}
            disabled={!canGoNext}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-semibold transition-colors ${
              canGoNext
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-700 cursor-not-allowed'
            }`}
          >
            {questionNumber === totalQuestions ? 'Finish' : 'Next'}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}