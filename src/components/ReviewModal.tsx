import React, { useState } from 'react';
import { X, Brain, Eye, RotateCcw, Check, Zap, Star, Coins, AlertCircle } from 'lucide-react';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: {
    id: string;
    front: string;
    back: string;
  };
  targetName: string;
  onReview: (rating: 1 | 2 | 3 | 4) => Promise<void>;
}

export function ReviewModal({ 
  isOpen, 
  onClose, 
  card,
  targetName,
  onReview
}: ReviewModalProps) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [coinsEarned, setCoinsEarned] = useState(0);

  if (!isOpen) return null;

  const handleShowAnswer = () => {
    setShowAnswer(true);
  };

  const handleRating = async (rating: 1 | 2 | 3 | 4) => {
    setIsSubmitting(true);
    try {
      await onReview(rating);
      
      // Calculate coins based on rating
      const coins = rating === 4 ? 15 : rating === 3 ? 10 : rating === 2 ? 5 : 2;
      setCoinsEarned(coins);
      setShowSuccess(true);
      
      // Auto close after success animation
      setTimeout(() => {
        setShowSuccess(false);
        setShowAnswer(false);
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Review failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const ratingButtons = [
    { rating: 1 as const, label: '再來一次', color: 'bg-red-500 hover:bg-red-600', icon: RotateCcw, desc: '完全忘記' },
    { rating: 2 as const, label: '困難', color: 'bg-orange-500 hover:bg-orange-600', icon: AlertCircle, desc: '想了很久' },
    { rating: 3 as const, label: '良好', color: 'bg-green-500 hover:bg-green-600', icon: Check, desc: '順利回憶' },
    { rating: 4 as const, label: '簡單', color: 'bg-blue-500 hover:bg-blue-600', icon: Zap, desc: '輕鬆記得' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      {/* Success Animation Overlay */}
      {showSuccess && (
        <div className="absolute inset-0 flex items-center justify-center z-60 pointer-events-none">
          <div className="animate-bounce flex flex-col items-center">
            <div className="bg-yellow-400 text-yellow-900 px-6 py-3 rounded-full shadow-lg flex items-center gap-2 text-xl font-bold">
              <Coins size={24} />
              <span>+{coinsEarned} 金幣!</span>
            </div>
            <Star className="text-yellow-400 mt-2 animate-pulse" size={48} />
          </div>
        </div>
      )}

      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all"
        style={{ opacity: showSuccess ? 0.3 : 1 }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500 to-orange-500 p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Brain size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold">複習時間！</h2>
                <p className="text-white/80 text-sm">{targetName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Card Content */}
        <div className="p-6">
          {/* Question */}
          <div className="mb-6">
            <div className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-2">
              <Eye size={14} />
              問題
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="text-lg text-slate-800 whitespace-pre-wrap">{card.front}</p>
            </div>
          </div>

          {/* Answer Section */}
          {!showAnswer ? (
            <button
              onClick={handleShowAnswer}
              className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold text-lg hover:from-indigo-600 hover:to-purple-600 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              <Eye size={20} />
              顯示答案
            </button>
          ) : (
            <>
              {/* Answer */}
              <div className="mb-6">
                <div className="text-sm font-medium text-green-600 mb-2 flex items-center gap-2">
                  <Check size={14} />
                  答案
                </div>
                <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                  <p className="text-lg text-slate-800 whitespace-pre-wrap">{card.back}</p>
                </div>
              </div>

              {/* Rating Buttons */}
              <div className="space-y-2">
                <p className="text-sm text-slate-500 text-center mb-3">你記得多清楚？</p>
                <div className="grid grid-cols-2 gap-3">
                  {ratingButtons.map(({ rating, label, color, icon: Icon, desc }) => (
                    <button
                      key={rating}
                      onClick={() => handleRating(rating)}
                      disabled={isSubmitting}
                      className={`${color} text-white rounded-xl p-3 font-medium transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center gap-1`}
                    >
                      <Icon size={20} />
                      <span className="font-semibold">{label}</span>
                      <span className="text-xs opacity-80">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-6 pb-4">
          <p className="text-xs text-slate-400 text-center">
            根據 FSRS 算法，系統會智能安排下次複習時間
          </p>
        </div>
      </div>
    </div>
  );
}
