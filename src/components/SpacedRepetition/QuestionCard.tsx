import { useState } from 'react';
import { ChevronRight, ChevronLeft, Clock } from 'lucide-react';
import { SpacedRepetitionQuestion } from '../../types';

interface QuestionCardProps {
  question: SpacedRepetitionQuestion;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (selectedIndex: number, responseTime: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  onSaveAndExit: () => void;
  canGoNext: boolean;
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  onAnswer,
  onNext,
  onPrevious,
  onSaveAndExit,
  canGoNext,
}: QuestionCardProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [startTime] = useState(Date.now());
  const [responseTime, setResponseTime] = useState(0);
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const [answerTimer, setAnswerTimer] = useState<NodeJS.Timeout | null>(null);

  const handleSelectAnswer = (index: number) => {
    if (showFeedback) return;

    setSelectedIndex(index);
    const time = Date.now() - startTime;
    setResponseTime(time);
    setShowFeedback(true);

    // Call onAnswer almost immediately for optimistic update
    // But keep a small delay for feedback visibility
    const timer = setTimeout(() => {
      onAnswer(index, time);
      setAnswerTimer(null);
    }, 800);
    setAnswerTimer(timer);
  };

  const handleExit = () => {
    // If there's a pending answer timer, flush it immediately before exiting
    if (answerTimer && selectedIndex !== null) {
      clearTimeout(answerTimer);
      onAnswer(selectedIndex, responseTime);
      setAnswerTimer(null);
    }
    onSaveAndExit();
  };

  const isCorrect = selectedIndex === question.correct_answer_index;

  return (
    <div className="min-h-full bg-gradient-to-b from-blue-50 to-white p-4 sm:p-6 pb-24 md:pb-8">
      <div className="max-w-2xl mx-auto flex flex-col h-full">
        <div className="mb-4 sm:mb-8 flex items-center justify-between gap-4">
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
          <button
            onClick={handleExit}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5 border border-transparent hover:border-red-100"
          >
            Save & Exit
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-5 sm:p-8 mb-4 sm:mb-6">
          <div className="mb-5 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-relaxed whitespace-pre-wrap">
              {question.question_text}
            </h2>
            {question.image_url && (
              <div className="mt-6">
                <img
                  src={question.image_url}
                  alt="Question Attachment"
                  className="rounded-lg max-h-64 object-contain border border-gray-200 cursor-zoom-in hover:shadow-md transition-shadow"
                  onClick={() => setIsImageExpanded(true)}
                />
              </div>
            )}
          </div>

          {isImageExpanded && question.image_url && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 cursor-zoom-out"
              onClick={() => setIsImageExpanded(false)}
            >
              <img
                src={question.image_url}
                alt="Question Attachment Fullscreen"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}

          <div className="space-y-2 sm:space-y-3">
            {question.choices.map((choice, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectAnswer(idx)}
                disabled={showFeedback}
                className={`w-full p-3 sm:p-4 text-left border-2 rounded-lg transition-all duration-200 ${selectedIndex === idx
                  ? isCorrect
                    ? 'border-green-500 bg-green-50'
                    : 'border-red-500 bg-red-50'
                  : showFeedback && idx === question.correct_answer_index
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                  } ${showFeedback ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  <span
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-semibold text-sm sm:text-base flex-shrink-0 ${selectedIndex === idx
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
                    className={`text-base sm:text-lg ${selectedIndex === idx
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
              className={`mt-6 p-4 rounded-lg ${isCorrect
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
                }`}
            >
              <p
                className={`font-semibold mb-2 ${isCorrect ? 'text-green-900' : 'text-red-900'
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
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-semibold transition-colors ${canGoNext
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