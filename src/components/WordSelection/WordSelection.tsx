import React, { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { Word } from '../../types';
import { processText, getSelectedWordIndices } from '../../utils/textProcessor';
import { useAuth } from '../../context/AuthContext';
import MemorizationTopNav from '../MemorizationTopNav/MemorizationTopNav';

const selectablePunctuations = new Set<string>();

interface WordSelectionProps {
  text: string;
  initialWords?: Word[];
  onNext: (words: Word[], selectedIndices: number[]) => void;
  onBack: () => void;
  onViewSaved?: () => void;
}

const WordSelection: React.FC<WordSelectionProps> = ({ text, initialWords, onNext, onBack, onViewSaved }) => {
  const [words, setWords] = useState<Word[]>([]);
  const [historyStack, setHistoryStack] = useState<Word[][]>([]);
  const { user } = useAuth();

  // Selection mode drag states
  const [isSelectionDragging, setIsSelectionDragging] = useState(false);
  const [selectionDragStartIndex, setSelectionDragStartIndex] = useState<number | null>(null);
  const [tempSelectionIndices, setTempSelectionIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (initialWords) {
      setWords(initialWords);
      setHistoryStack([]);
    } else {
      const processed = processText(text);
      setWords(processed);
      setHistoryStack([]);
    }
  }, [text, initialWords]);

  const pushHistory = (currentWords: Word[]) => {
    setHistoryStack(prev => [
      ...prev,
      currentWords.map(word => ({ ...word })),
    ]);
  };

const handleWordClick = (index: number) => {
  pushHistory(words);

  setWords(prevWords => {
    const updatedWords = prevWords.map(word =>
      word.index === index ? { ...word, isMemorized: !word.isMemorized } : word
    );
    return updatedWords;
  });
};

  const handleSelectionMouseDown = (index: number) => {
    if (words[index]?.isPunctuation) return;
    setIsSelectionDragging(true);
    setSelectionDragStartIndex(index);
    setTempSelectionIndices(new Set([index]));
  };

  const handleSelectionMouseEnter = (index: number) => {
    if (!isSelectionDragging || selectionDragStartIndex === null) return;
    const start = Math.min(selectionDragStartIndex, index);
    const end = Math.max(selectionDragStartIndex, index);
    const rangeIndices = new Set<number>();

    // Collect all word indices in the range
    words.forEach(word => {
      if (!word.isPunctuation && word.index >= start && word.index <= end) {
        rangeIndices.add(word.index);
      }
    });

    setTempSelectionIndices(rangeIndices);
  };

const handleSelectionMouseUp = () => {
  if (!isSelectionDragging || tempSelectionIndices.size === 0) {
    setIsSelectionDragging(false);
    setSelectionDragStartIndex(null);
    setTempSelectionIndices(new Set());
    return;
  }

  const isSingleClick = tempSelectionIndices.size === 1 &&
                       selectionDragStartIndex !== null &&
                       tempSelectionIndices.has(selectionDragStartIndex);

  if (!isSingleClick) {
    pushHistory(words);

    setWords(prevWords => {
      const updatedWords = prevWords.map(word =>
        tempSelectionIndices.has(word.index) ? { ...word, isMemorized: true } : word
      );
      return updatedWords;
    });
  }

  setIsSelectionDragging(false);
  setSelectionDragStartIndex(null);
  setTempSelectionIndices(new Set());
};

const handleSelectAll = () => {
  pushHistory(words);

  setWords(prevWords => {
    const notSelectedIndices = prevWords.filter(word => !word.isPunctuation && !word.isMemorized).map(word => word.index);
    if (notSelectedIndices.length === 0) return prevWords;

    const updatedWords = prevWords.map(word =>
      notSelectedIndices.includes(word.index) ? { ...word, isMemorized: true } : word
    );

    return updatedWords;
  });
};

const handleUndo = () => {
  setHistoryStack(prev => {
    if (prev.length === 0) return prev;

    const newStack = [...prev];
    const prevState = newStack.pop();

    if (prevState) {
      setWords(prevState);
    }

    return newStack;
  });
};

  const handleNext = () => {
    const selectedIndices = getSelectedWordIndices(words);
    if (selectedIndices.length > 0) {
      onNext(words, selectedIndices);
    }
  };

  const selectedCount = words.filter(word => word.isMemorized).length;

  return (
    <>
      {user && onViewSaved && (
        <MemorizationTopNav
          onCreateNew={onBack}
          onViewSaved={onViewSaved}
          currentView="create"
        />
      )}
      <div className={`min-h-screen bg-gray-50 pr-8 ${user && onViewSaved ? 'pt-24' : 'pt-20'}`} style={{ fontFamily: 'Times New Roman, serif' }}>
        <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Select Words to Memorize</h1>
            <p className="text-gray-600 mb-4">
              Click and drag to select multiple words to memorize.
              <br />
              Selected: {selectedCount} words
            </p>

            <div className="flex justify-end items-center space-x-4">
              <button
                onClick={handleUndo}
                disabled={historyStack.length === 0}
                className="px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed transition-colors"
              >
                Undo
              </button>
              <button
                onClick={handleSelectAll}
                className="px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                Select All Words
              </button>
            </div>
          </div>

          <div
            className="bg-gray-50 p-6 rounded-lg mb-6 min-h-64"
            onMouseUp={handleSelectionMouseUp}
          >
            <div className="text-xl leading-relaxed">
              {words.map((word, idx) =>
                word.isParagraphBreak ? (
                  // Render paragraph breaks as vertical spacing divs
                  <div key={`para-break-${idx}`} className="mb-6" />
                ) : word.text === '\n' || word.text === '\r\n' ? (
                  // Render single newlines as line breaks
                  <br key={`br-${idx}`} />
                ) : word.isPunctuation && !selectablePunctuations.has(word.text) ? (
                  // Render punctuation normally
                  <span key={`punct-${idx}`} className="text-gray-800">
                    {word.text}
                  </span>
                ) : (
                  // Render selectable words as buttons
                  <button
                    key={`word-${idx}`}
                    onClick={() => handleWordClick(word.index)}
                    onMouseDown={() => handleSelectionMouseDown(word.index)}
                    onMouseEnter={() => handleSelectionMouseEnter(word.index)}
                    className={(() => {
                      let baseClasses = 'inline-block px-1 py-1 rounded transition-colors select-none';

                      if (tempSelectionIndices.has(word.index)) {
                        return `${baseClasses} bg-green-100 text-gray-800`;
                      } else if (word.isMemorized) {
                        return `${baseClasses} bg-green-300 text-gray-800`;
                      } else {
                        return `${baseClasses} cursor-pointer hover:bg-green-100 text-gray-800`;
                      }
                    })()}
                                      >
                                        {word.text}
                                      </button>
                )
              )}
            </div>
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={onBack}
              className="flex items-center space-x-2 px-8 py-3 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft size={20} />
              <span>Back</span>
            </button>

            <button
              onClick={handleNext}
              disabled={selectedCount === 0}
              className="flex items-center space-x-2 px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
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

export default WordSelection;