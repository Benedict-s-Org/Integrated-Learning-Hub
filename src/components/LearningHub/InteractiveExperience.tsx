import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, CheckCircle, XCircle, Trophy, Lightbulb, HelpCircle } from 'lucide-react';
import { LearningActivity, LearningQuestion } from '../../types';

interface InteractiveExperienceProps {
  activity: LearningActivity;
  onClose: () => void;
}

interface QuestionResult {
  questionIndex: number;
  userAnswer: string | string[] | boolean;
  isCorrect: boolean;
}

const InteractiveExperience: React.FC<InteractiveExperienceProps> = ({ activity, onClose }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState<string | string[] | boolean>('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [matchingPairs, setMatchingPairs] = useState<Record<string, string>>({});

  const questions = activity.questionsJson || [];
  const currentQuestion = questions[currentQuestionIndex] as LearningQuestion | undefined;

  useEffect(() => {
    setUserAnswer('');
    setShowFeedback(false);
    setShowHint(false);
    setMatchingPairs({});
  }, [currentQuestionIndex]);

  if (!questions.length) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">{activity.name}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={24} className="text-gray-600" />
            </button>
          </div>
          <div className="text-center py-8">
            <HelpCircle size={64} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 text-lg">No questions available for this activity</p>
          </div>
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const checkAnswer = () => {
    if (!currentQuestion) return;

    let correct = false;
    const correctAnswer = currentQuestion.correctAnswer;

    if (currentQuestion.type === 'true_false') {
      correct = userAnswer === correctAnswer;
    } else if (currentQuestion.type === 'multiple_choice') {
      correct = userAnswer === correctAnswer;
    } else if (currentQuestion.type === 'fill_blank' || currentQuestion.type === 'short_answer') {
      const userStr = String(userAnswer).trim().toLowerCase();
      if (Array.isArray(correctAnswer)) {
        correct = correctAnswer.some((ans) => String(ans).trim().toLowerCase() === userStr);
      } else {
        correct = userStr === String(correctAnswer).trim().toLowerCase();
      }
    } else if (currentQuestion.type === 'matching') {
      const pairs = currentQuestion.pairs || [];
      correct = pairs.every((pair) => matchingPairs[pair.left] === pair.right);
    } else {
      const userStr = String(userAnswer).trim().toLowerCase();
      correct = userStr === String(correctAnswer).trim().toLowerCase();
    }

    setIsCorrect(correct);
    setShowFeedback(true);

    setResults([
      ...results,
      {
        questionIndex: currentQuestionIndex,
        userAnswer: currentQuestion.type === 'matching' ? matchingPairs as unknown as string : userAnswer,
        isCorrect: correct,
      },
    ]);
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setIsCompleted(true);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      const prevResult = results.find((r) => r.questionIndex === currentQuestionIndex - 1);
      if (prevResult) {
        setUserAnswer(prevResult.userAnswer);
        setShowFeedback(true);
        setIsCorrect(prevResult.isCorrect);
      }
    }
  };

  const correctCount = results.filter((r) => r.isCorrect).length;
  const accuracy = results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0;

  if (isCompleted) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8 max-h-[90vh] overflow-y-auto"
          style={{ fontFamily: 'Times New Roman, serif' }}
        >
          <div className="text-center mb-8">
            <Trophy size={80} className="mx-auto text-yellow-500 mb-4" />
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Activity Complete!</h2>
            <p className="text-gray-600">{activity.name}</p>
          </div>

          <div className="bg-blue-50 rounded-xl p-6 mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Your Results</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold text-green-600">{correctCount}</p>
                <p className="text-gray-600">Correct</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-red-600">{results.length - correctCount}</p>
                <p className="text-gray-600">Incorrect</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-blue-600">{accuracy}%</p>
                <p className="text-gray-600">Accuracy</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 mb-6 max-h-64 overflow-y-auto">
            {questions.map((q, index) => {
              const result = results.find((r) => r.questionIndex === index);
              const question = q as LearningQuestion;
              return (
                <div
                  key={index}
                  className={`p-4 rounded-lg flex items-start space-x-3 ${
                    result?.isCorrect ? 'bg-green-50' : 'bg-red-50'
                  }`}
                >
                  {result?.isCorrect ? (
                    <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-gray-800 text-sm">{question.question}</p>
                    {!result?.isCorrect && question.correctAnswer && (
                      <p className="text-sm text-gray-600 mt-1">
                        Correct answer: <span className="font-medium">{String(question.correctAnswer)}</span>
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const renderQuestionContent = () => {
    if (!currentQuestion) return null;

    switch (currentQuestion.type) {
      case 'multiple_choice':
        return (
          <div className="space-y-3">
            {(currentQuestion.options || []).map((option, index) => (
              <button
                key={index}
                onClick={() => !showFeedback && setUserAnswer(option)}
                disabled={showFeedback}
                className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                  userAnswer === option
                    ? showFeedback
                      ? option === currentQuestion.correctAnswer
                        ? 'border-green-500 bg-green-50'
                        : 'border-red-500 bg-red-50'
                      : 'border-blue-500 bg-blue-50'
                    : showFeedback && option === currentQuestion.correctAnswer
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                } ${showFeedback ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span className="font-medium">{option}</span>
              </button>
            ))}
          </div>
        );

      case 'true_false':
        return (
          <div className="flex space-x-4">
            <button
              onClick={() => !showFeedback && setUserAnswer(true)}
              disabled={showFeedback}
              className={`flex-1 p-6 rounded-lg border-2 font-bold text-lg transition-all ${
                userAnswer === true
                  ? showFeedback
                    ? currentQuestion.correctAnswer === true
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-red-500 bg-red-50 text-red-700'
                    : 'border-blue-500 bg-blue-50 text-blue-700'
                  : showFeedback && currentQuestion.correctAnswer === true
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
              } ${showFeedback ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              True
            </button>
            <button
              onClick={() => !showFeedback && setUserAnswer(false)}
              disabled={showFeedback}
              className={`flex-1 p-6 rounded-lg border-2 font-bold text-lg transition-all ${
                userAnswer === false
                  ? showFeedback
                    ? currentQuestion.correctAnswer === false
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-red-500 bg-red-50 text-red-700'
                    : 'border-blue-500 bg-blue-50 text-blue-700'
                  : showFeedback && currentQuestion.correctAnswer === false
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
              } ${showFeedback ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              False
            </button>
          </div>
        );

      case 'fill_blank':
      case 'short_answer':
        return (
          <div>
            <input
              type="text"
              value={String(userAnswer)}
              onChange={(e) => setUserAnswer(e.target.value)}
              disabled={showFeedback}
              placeholder="Type your answer..."
              className={`w-full px-4 py-3 border-2 rounded-lg text-lg focus:outline-none ${
                showFeedback
                  ? isCorrect
                    ? 'border-green-500 bg-green-50'
                    : 'border-red-500 bg-red-50'
                  : 'border-gray-300 focus:border-blue-500'
              }`}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !showFeedback && String(userAnswer).trim()) {
                  checkAnswer();
                }
              }}
            />
          </div>
        );

      case 'matching':
        const pairs = currentQuestion.pairs || [];
        const rightOptions = pairs.map((p) => p.right);
        return (
          <div className="space-y-3">
            {pairs.map((pair, index) => (
              <div key={index} className="flex items-center space-x-4">
                <div className="flex-1 p-3 bg-gray-100 rounded-lg font-medium">{pair.left}</div>
                <span className="text-gray-400">-</span>
                <select
                  value={matchingPairs[pair.left] || ''}
                  onChange={(e) =>
                    setMatchingPairs({ ...matchingPairs, [pair.left]: e.target.value })
                  }
                  disabled={showFeedback}
                  className={`flex-1 p-3 border-2 rounded-lg ${
                    showFeedback
                      ? matchingPairs[pair.left] === pair.right
                        ? 'border-green-500 bg-green-50'
                        : 'border-red-500 bg-red-50'
                      : 'border-gray-300'
                  }`}
                >
                  <option value="">Select match...</option>
                  {rightOptions.map((opt, i) => (
                    <option key={i} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        );

      default:
        return (
          <div>
            <input
              type="text"
              value={String(userAnswer)}
              onChange={(e) => setUserAnswer(e.target.value)}
              disabled={showFeedback}
              placeholder="Type your answer..."
              className={`w-full px-4 py-3 border-2 rounded-lg text-lg focus:outline-none ${
                showFeedback
                  ? isCorrect
                    ? 'border-green-500 bg-green-50'
                    : 'border-red-500 bg-red-50'
                  : 'border-gray-300 focus:border-blue-500'
              }`}
            />
          </div>
        );
    }
  };

  const canCheck = () => {
    if (!currentQuestion) return false;
    if (currentQuestion.type === 'matching') {
      const pairs = currentQuestion.pairs || [];
      return pairs.every((p) => matchingPairs[p.left]);
    }
    return userAnswer !== '' && userAnswer !== undefined;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        style={{ fontFamily: 'Times New Roman, serif' }}
      >
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{activity.name}</h2>
            <p className="text-sm text-gray-500">
              Question {currentQuestionIndex + 1} of {questions.length}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} className="text-gray-600" />
          </button>
        </div>

        <div className="w-full bg-gray-200 h-2">
          <div
            className="bg-blue-600 h-2 transition-all duration-300"
            style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {currentQuestion && (
            <>
              <p className="text-lg font-medium text-gray-800 mb-6">{currentQuestion.question}</p>

              {renderQuestionContent()}

              {currentQuestion.hint && !showFeedback && (
                <div className="mt-4">
                  <button
                    onClick={() => setShowHint(!showHint)}
                    className="flex items-center space-x-2 text-amber-600 hover:text-amber-700 text-sm font-medium"
                  >
                    <Lightbulb size={16} />
                    <span>{showHint ? 'Hide hint' : 'Show hint'}</span>
                  </button>
                  {showHint && (
                    <p className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                      {currentQuestion.hint}
                    </p>
                  )}
                </div>
              )}

              {showFeedback && (
                <div
                  className={`mt-6 p-4 rounded-lg ${
                    isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    {isCorrect ? (
                      <CheckCircle size={24} className="text-green-600" />
                    ) : (
                      <XCircle size={24} className="text-red-600" />
                    )}
                    <span className={`font-bold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                      {isCorrect ? 'Correct!' : 'Incorrect'}
                    </span>
                  </div>
                  {!isCorrect && currentQuestion.correctAnswer && (
                    <p className="text-gray-700">
                      The correct answer is:{' '}
                      <span className="font-medium">{String(currentQuestion.correctAnswer)}</span>
                    </p>
                  )}
                  {currentQuestion.explanation && (
                    <p className="mt-2 text-gray-600 text-sm">{currentQuestion.explanation}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-between items-center">
          <button
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={20} />
            <span>Previous</span>
          </button>

          <div className="text-sm text-gray-500">
            {results.filter((r) => r.isCorrect).length} / {results.length} correct
          </div>

          {!showFeedback ? (
            <button
              onClick={checkAnswer}
              disabled={!canCheck()}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
            >
              Check Answer
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
            >
              <span>{currentQuestionIndex < questions.length - 1 ? 'Next' : 'Finish'}</span>
              <ChevronRight size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default InteractiveExperience;
