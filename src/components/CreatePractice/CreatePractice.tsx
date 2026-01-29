import React, { useState } from 'react';
import { ArrowLeft, Plus, X, Save, BookOpen } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface CreatePracticeProps {
  onBack: () => void;
  onSaved: () => void;
}

export const CreatePractice: React.FC<CreatePracticeProps> = ({ onBack, onSaved }) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [words, setWords] = useState<string[]>(['']);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleAddWord = () => {
    setWords([...words, '']);
  };

  const handleRemoveWord = (index: number) => {
    if (words.length > 1) {
      setWords(words.filter((_, i) => i !== index));
    }
  };

  const handleWordChange = (index: number, value: string) => {
    const newWords = [...words];
    newWords[index] = value;
    setWords(newWords);
  };

  const handleSave = async () => {
    setError(null);

    if (!title.trim()) {
      setError('Please enter a title for the practice');
      return;
    }

    const filteredWords = words.filter((w) => w.trim() !== '');
    if (filteredWords.length === 0) {
      setError('Please add at least one word');
      return;
    }

    if (!user?.id) {
      setError('You must be logged in to save practices');
      return;
    }

    try {
      setSaving(true);

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/spelling-practices/create`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          words: filteredWords,
          userId: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save practice');
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save practice');
      setSaving(false);
    }
  };

  const handlePasteBulk = () => {
    const input = prompt('Paste your words (one per line):');
    if (input) {
      const lines = input.split('\n').map((line) => line.trim()).filter((line) => line !== '');
      if (lines.length > 0) {
        setWords(lines);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-8" style={{ fontFamily: 'Times New Roman, serif' }}>
      <div className="max-w-4xl mx-auto">
        <div className="fixed top-4 left-0 right-0 z-40 flex justify-center gap-4 px-8">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors shadow-lg"
          >
            <Plus size={20} />
            <span>Create New Practice</span>
          </button>
          <button
            onClick={onBack}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-lg"
          >
            <BookOpen size={20} />
            <span>Saved Practices</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8" style={{ marginTop: '80px' }}>
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Create Spelling Practice</h1>
            <p className="text-gray-600">Create a new practice that can be assigned to students</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          <div className="mb-6">
            <label htmlFor="practice-title" className="block text-lg font-semibold text-gray-700 mb-2">
              Practice Title
            </label>
            <input
              id="practice-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Week 1 Spelling Words"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg"
            />
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-lg font-semibold text-gray-700">
                Spelling Words
              </label>
              <button
                onClick={handlePasteBulk}
                className="text-sm px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                Paste Bulk Words
              </button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {words.map((word, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <span className="text-gray-500 font-semibold w-8">{index + 1}.</span>
                  <input
                    type="text"
                    value={word}
                    onChange={(e) => handleWordChange(index, e.target.value)}
                    placeholder="Enter word"
                    className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    onClick={() => handleRemoveWord(index)}
                    disabled={words.length === 1}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <X size={20} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={handleAddWord}
              className="mt-3 flex items-center space-x-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium"
            >
              <Plus size={20} />
              <span>Add Word</span>
            </button>
          </div>

          <div className="flex justify-between items-center pt-6 border-t border-gray-200">
            <button
              onClick={onBack}
              className="flex items-center space-x-2 px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
            >
              <ArrowLeft size={20} />
              <span>Cancel</span>
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center space-x-2 px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
            >
              <Save size={20} />
              <span>{saving ? 'Saving...' : 'Save Practice'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePractice;
