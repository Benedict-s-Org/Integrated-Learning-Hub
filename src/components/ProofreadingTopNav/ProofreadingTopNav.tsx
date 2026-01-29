import React from 'react';
import { Plus, BookOpen } from 'lucide-react';

interface ProofreadingTopNavProps {
  onCreateNew: () => void;
  onViewSaved: () => void;
  currentView?: 'create' | 'saved';
}

const ProofreadingTopNav: React.FC<ProofreadingTopNavProps> = ({ onCreateNew, onViewSaved, currentView = 'create' }) => {
  return (
    <div className="fixed top-0 left-64 right-0 z-40 bg-white border-b-2 border-gray-200 shadow-md">
      <div className="flex justify-center gap-4 px-8 py-4">
        <button
          onClick={onCreateNew}
          className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors shadow-lg ${
            currentView === 'create'
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          style={{ fontFamily: 'Times New Roman, serif' }}
        >
          <Plus size={20} />
          <span>New Practice</span>
        </button>
        <button
          onClick={onViewSaved}
          className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors shadow-lg ${
            currentView === 'saved'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          style={{ fontFamily: 'Times New Roman, serif' }}
        >
          <BookOpen size={20} />
          <span>Saved Practices</span>
        </button>
      </div>
    </div>
  );
};

export default ProofreadingTopNav;
