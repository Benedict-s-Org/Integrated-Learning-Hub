import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import MemorizationTopNav from '../MemorizationTopNav/MemorizationTopNav';

interface TextInputProps {
  onNext: (text: string) => void;
  initialText?: string;
  onViewSaved?: () => void;
}

const TextInput: React.FC<TextInputProps> = ({ onNext, initialText, onViewSaved }) => {
  const [text, setText] = useState(initialText || '');
  const { user } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onNext(text.trim());
    }
  };

  const handleCreateNew = () => {
    setText('');
  };

  return (
    <>
      {user && onViewSaved && (
        <MemorizationTopNav
          onCreateNew={handleCreateNew}
          onViewSaved={onViewSaved}
          currentView="create"
        />
      )}
      <div
        className={`min-h-screen bg-gray-50 pr-8 ${user && onViewSaved ? 'pt-24' : 'pt-20'}`}
        style={{ fontFamily: 'Times New Roman, serif' }}
        data-source-tsx="TextInput|src/components/TextInput/TextInput.tsx"
      >
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 
            className="text-3xl font-bold text-gray-800 mb-6 text-center"
            data-source-tsx="TextInput Title|src/components/TextInput/TextInput.tsx"
          >
            Enter Your Text
          </h1>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label 
                htmlFor="text-input" 
                className="block text-lg font-medium text-gray-700 mb-2"
                data-source-tsx="TextInput Label|src/components/TextInput/TextInput.tsx"
              >
                Paste or type the paragraph you want to memorize:
              </label>
              <textarea
                id="text-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full h-64 p-4 border-2 border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg leading-relaxed"
                placeholder="Enter your paragraph here..."
                style={{ fontFamily: 'Times New Roman, serif' }}
                data-source-tsx="TextInput Textarea|src/components/TextInput/TextInput.tsx"
              />
            </div>
            
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!text.trim()}
                className="flex items-center space-x-2 px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                data-source-tsx="TextInput Next Button|src/components/TextInput/TextInput.tsx"
              >
                <span>Next</span>
                <ArrowRight size={20} />
              </button>
            </div>
          </form>
        </div>
      </div>
      </div>
    </>
  );
};

export default TextInput;