import React, { useState } from 'react';
import { Trash2, Play, Calendar, Share, Copy, Check, UserPlus } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { SavedContent as SavedContentType, MemorizationState } from '../../types';
import { processText } from '../../utils/textProcessor';
import { useAuth } from '../../context/AuthContext';
import MemorizationTopNav from '../MemorizationTopNav/MemorizationTopNav';
import MemorizationAssignment from '../MemorizationAssignment/MemorizationAssignment';

interface SavedContentProps {
  onLoadContent: (content: MemorizationState) => void;
  onCreateNew: () => void;
}

const SavedContent: React.FC<SavedContentProps> = ({ onLoadContent, onCreateNew }) => {
  const { savedContents, deleteSavedContent, publishSavedContent, saveLimit, currentSaveCount } = useAppContext();
  const { user } = useAuth();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [assignModalContent, setAssignModalContent] = useState<{ id: string; title: string } | null>(null);

  const handleDelete = async (id: string) => {
    if (deleteConfirm === id) {
      setDeletingId(id);
      await deleteSavedContent(id);
      setDeletingId(null);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
      // Auto-cancel confirmation after 3 seconds
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const handlePublish = async (id: string) => {
    setPublishingId(id);
    const publicId = await publishSavedContent(id);
    setPublishingId(null);
    
    if (publicId) {
      alert('Content published successfully! You can now share the public link.');
    } else {
      alert('Failed to publish content. Please try again.');
    }
  };

  const handleCopyLink = async (publicId: string, contentId: string) => {
    const publicUrl = `${window.location.origin}${window.location.pathname}#/public/${publicId}`;
    
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopiedId(contentId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = publicUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedId(contentId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleLoad = (savedContent: SavedContentType) => {
    const words = processText(savedContent.originalText);
    // Mark selected words
    const wordsWithSelection = words.map(word => ({
      ...word,
      isMemorized: savedContent.selectedWordIndices.includes(word.index)
    }));

    const memorizationState: MemorizationState = {
      originalText: savedContent.originalText,
      words: wordsWithSelection,
      selectedWordIndices: savedContent.selectedWordIndices,
      hiddenWords: new Set(savedContent.selectedWordIndices),
    };

    onLoadContent(memorizationState);
  };

  return (
    <>
      <MemorizationTopNav
        onCreateNew={onCreateNew}
        onViewSaved={() => {}}
        currentView="saved"
      />
      <div
        className="pt-24 min-h-screen bg-gray-50 pr-8"
        style={{ fontFamily: 'Times New Roman, serif' }}
        data-source-tsx="SavedContent|src/components/SavedContent/SavedContent.tsx"
      >
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1
              className="text-3xl font-bold text-gray-800 mb-6 text-center"
              data-source-tsx="SavedContent Title|src/components/SavedContent/SavedContent.tsx"
            >
              Saved Contents ({currentSaveCount}/{saveLimit === null ? 'Unlimited' : saveLimit})
            </h1>
          
          {savedContents.length === 0 ? (
            <div 
              className="text-center text-gray-500 py-12"
              data-source-tsx="SavedContent Empty Message Container|src/components/SavedContent/SavedContent.tsx"
            >
              <p 
                className="text-xl"
                data-source-tsx="SavedContent Empty Message Text|src/components/SavedContent/SavedContent.tsx"
              >
                No saved contents yet.
              </p>
              <p 
                className="text-lg mt-2"
                data-source-tsx="SavedContent Empty Message Text|src/components/SavedContent/SavedContent.tsx"
              >
                Create your first memorization exercise!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {savedContents.map(content => (
                <div
                  key={content.id}
                  className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                  data-source-tsx="SavedContent Item Container|src/components/SavedContent/SavedContent.tsx"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 
                        className="text-lg font-semibold text-gray-800 mb-2 truncate"
                        data-source-tsx="SavedContent Item Title|src/components/SavedContent/SavedContent.tsx"
                      >
                        {content.title}
                      </h3>
                      <p 
                        className="text-gray-600 text-sm mb-3 line-clamp-2"
                        data-source-tsx="SavedContent Item Original Text|src/components/SavedContent/SavedContent.tsx"
                      >
                        {content.originalText}
                      </p>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span 
                          className="flex items-center space-x-1"
                          data-source-tsx="SavedContent Item Date|src/components/SavedContent/SavedContent.tsx"
                        >
                          <Calendar size={16} />
                          <span>{content.createdAt.toLocaleDateString()}</span>
                        </span>
                        <span data-source-tsx="SavedContent Item Word Count|src/components/SavedContent/SavedContent.tsx">
                          {content.selectedWordIndices.length} words selected
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4 flex-wrap">
                      <button
                        onClick={() => handleLoad(content)}
                        className="flex items-center space-x-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        data-source-tsx="SavedContent Practice Button|src/components/SavedContent/SavedContent.tsx"
                      >
                        <Play size={16} />
                        <span>Practice</span>
                      </button>

                      {user?.role === 'admin' && (
                        <button
                          onClick={() => setAssignModalContent({ id: content.id, title: content.title })}
                          className="flex items-center space-x-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                          data-source-tsx="SavedContent Assign Button|src/components/SavedContent/SavedContent.tsx"
                        >
                          <UserPlus size={16} />
                          <span>Assign</span>
                        </button>
                      )}

                      {content.isPublished && content.publicId ? (
                        <button
                          onClick={() => handleCopyLink(content.publicId!, content.id)}
                          className="flex items-center space-x-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                          data-source-tsx="SavedContent Copy Link Button|src/components/SavedContent/SavedContent.tsx"
                        >
                          {copiedId === content.id ? <Check size={16} /> : <Copy size={16} />}
                          <span>{copiedId === content.id ? 'Copied!' : 'Copy Link'}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePublish(content.id)}
                          disabled={publishingId === content.id}
                          className="flex items-center space-x-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                          data-source-tsx="SavedContent Publish Button|src/components/SavedContent/SavedContent.tsx"
                        >
                          <Share size={16} />
                          <span>{publishingId === content.id ? 'Publishing...' : 'Publish'}</span>
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleDelete(content.id)}
                        disabled={deletingId === content.id}
                        className={`flex items-center space-x-1 px-4 py-2 rounded-lg transition-colors ${
                          deleteConfirm === content.id
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        } ${deletingId === content.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        data-source-tsx="SavedContent Delete Button|src/components/SavedContent/SavedContent.tsx"
                      >
                        <Trash2 size={16} />
                        <span>
                          {deletingId === content.id 
                            ? 'Deleting...' 
                            : deleteConfirm === content.id 
                              ? 'Confirm?' 
                              : 'Delete'
                          }
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
      {assignModalContent && (
        <MemorizationAssignment
          contentId={assignModalContent.id}
          contentTitle={assignModalContent.title}
          onClose={() => setAssignModalContent(null)}
          onAssignmentChange={() => {}}
        />
      )}
    </>
  );
};

export default SavedContent;