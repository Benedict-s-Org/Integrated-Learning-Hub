import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import SpellingTopNav from '../SpellingTopNav/SpellingTopNav';
import { useAuth } from '../../context/AuthContext';

interface SpellingInputProps {
  onNext: (title: string, words: string[]) => void;
  onBack?: () => void;
  onViewSaved?: () => void;
}

const SpellingInput: React.FC<SpellingInputProps> = ({ onNext, onBack, onViewSaved }) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [wordsInput, setWordsInput] = useState('');
  const [error, setError] = useState('');

  const parseWords = (input: string): string[] => {
    // Split by spaces, commas, numbers, and newlines
    const rawWords = input.split(/[\s,\d\n]+/).map(word => word.trim()).filter(word => word.length > 0);

    // Filter to only include English words (letters, hyphens, apostrophes)
    return rawWords.filter(word => /^[a-zA-Z'-]+$/.test(word));
  };

  const handleSubmit = () => {
    setError('');

    if (!title.trim()) {
      setError('Please enter a title for your word list');
      return;
    }

    const words = parseWords(wordsInput);

    if (words.length === 0) {
      setError('Please enter at least one word');
      return;
    }

    if (words.length > 100) {
      setError('Maximum 100 words allowed per list');
      return;
    }

    // Just proceed to preview, don't save yet
    onNext(title.trim(), words);
  };

  const wordCount = parseWords(wordsInput).length;

  useEffect(() => {
    if (user && user.role !== 'admin' && onViewSaved) {
      onViewSaved();
    }
  }, [user, onViewSaved]);

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <>
      {onViewSaved && (
        <SpellingTopNav
          onCreateNew={() => {}}
          onViewSaved={onViewSaved}
          currentView="create"
        />
      )}
      <div
        className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8"
        style={{ fontFamily: 'Times New Roman, serif', paddingTop: onViewSaved ? '100px' : '32px' }}
      >
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Spelling Practice</h1>
            <p className="text-gray-600">Create a new word list for spelling practice</p>
          </div>

          <div className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-lg font-semibold text-gray-700 mb-2">
                List Title
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Week 5 Vocabulary"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg"
                maxLength={100}
              />
            </div>

            <div>
              <label htmlFor="words" className="block text-lg font-semibold text-gray-700 mb-2">
                Words
              </label>
              <p className="text-sm text-gray-500 mb-2">
                Enter words separated by spaces, commas, or numbers. Only English words will be recognized.
              </p>
              <textarea
                id="words"
                value={wordsInput}
                onChange={(e) => setWordsInput(e.target.value)}
                placeholder="Type your words here...&#10;e.g., beautiful necessary accommodate&#10;or: 1. calendar 2. definite 3. embarrass&#10;or: apple, banana, cherry"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg h-64 resize-none"
              />
              <div className="mt-2 text-sm text-gray-600">
                Word count: <span className="font-semibold">{wordCount}</span>
                {wordCount > 100 && <span className="text-red-600 ml-2">(Maximum 100 words)</span>}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                <p className="text-red-700 font-medium">{error}</p>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center mt-8">
            {onBack ? (
              <button
                onClick={onBack}
                className="flex items-center space-x-2 px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                <ArrowLeft size={20} />
                <span>Back</span>
              </button>
            ) : (
              <div></div>
            )}

            <button
              onClick={handleSubmit}
              disabled={wordCount === 0}
              className="flex items-center space-x-2 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
            >
              <span>Next</span>
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default SpellingInput;
