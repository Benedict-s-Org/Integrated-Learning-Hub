import React, { useMemo, useState } from 'react';
import { Trash2, Play, Calendar, Share, Copy, Check, UserPlus, Edit2, X, Loader2, RotateCcw, Layers } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { SavedContent as SavedContentType, MemorizationState, PracticeMode } from '../../types';
import { processText } from '../../utils/textProcessor';
import { PRACTICE_MODE_ORDER, parsePracticeModes } from '../../utils/practiceModes';
import { useAuth } from '../../context/AuthContext';
import MemorizationTopNav from '../MemorizationTopNav/MemorizationTopNav';
import MemorizationAssignment from '../MemorizationAssignment/MemorizationAssignment';

interface SavedContentProps {
  onLoadContent: (content: MemorizationState) => void;
  onCreateNew: () => void;
  onEditContent: (content: SavedContentType) => void;
}

interface PracticeGroup {
  key: string;
  primary: SavedContentType;
  items: SavedContentType[];
  modes: PracticeMode[];
}

const contentFingerprint = (content: SavedContentType) => {
  const indices = [...content.selectedWordIndices].sort((a, b) => a - b).join(',');
  return `${content.title}\u0000${content.originalText}\u0000${indices}`;
};

const modesForContent = (content: SavedContentType): PracticeMode[] =>
  content.practiceModes?.length
    ? PRACTICE_MODE_ORDER.filter(mode => content.practiceModes!.includes(mode))
    : parsePracticeModes(content.practiceMode);

const SavedContent: React.FC<SavedContentProps> = ({ onLoadContent, onCreateNew, onEditContent }) => {
  const { savedContents, updateSavedContentTitle, deleteSavedContent, publishSavedContent, saveLimit, currentSaveCount } = useAppContext();
  const { user } = useAuth();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [assignModalContent, setAssignModalContent] = useState<{ id: string; title: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  const practiceGroups = useMemo(() => {
    const map = new Map<string, PracticeGroup>();
    for (const content of savedContents) {
      const key = contentFingerprint(content);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          primary: content,
          items: [content],
          modes: modesForContent(content),
        });
        continue;
      }
      existing.items.push(content);
      const merged = new Set([...existing.modes, ...modesForContent(content)]);
      existing.modes = PRACTICE_MODE_ORDER.filter(mode => merged.has(mode));
      // Prefer the newest published / earliest created as primary for actions
      if (content.createdAt > existing.primary.createdAt) {
        existing.primary = content;
      }
    }
    return Array.from(map.values());
  }, [savedContents]);

  const handleStartEdit = (content: SavedContentType) => {
    setEditingId(content.id);
    setEditingTitle(content.title);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  const handleSaveTitle = async (group: PracticeGroup) => {
    const trimmed = editingTitle.trim();
    if (!trimmed) {
      alert('Title cannot be empty');
      return;
    }

    setIsSavingTitle(true);
    const results = await Promise.all(group.items.map(item => updateSavedContentTitle(item.id, trimmed)));
    setIsSavingTitle(false);

    if (results.every(Boolean)) {
      setEditingId(null);
      setEditingTitle('');
    } else {
      alert('Failed to update title. Please try again.');
    }
  };

  const handleDelete = async (group: PracticeGroup) => {
    const confirmId = group.primary.id;
    if (deleteConfirm === confirmId) {
      setDeletingId(confirmId);
      await Promise.all(group.items.map(item => deleteSavedContent(item.id)));
      setDeletingId(null);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(confirmId);
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

  const handleLoad = (savedContent: SavedContentType, practiceMode: PracticeMode) => {
    const words = processText(savedContent.originalText);
    const wordsWithSelection = words.map(word => ({
      ...word,
      isMemorized: savedContent.selectedWordIndices.includes(word.index)
    }));

    const memorizationState: MemorizationState = {
      title: savedContent.title,
      originalText: savedContent.originalText,
      words: wordsWithSelection,
      selectedWordIndices: savedContent.selectedWordIndices,
      hiddenWords: new Set(savedContent.selectedWordIndices),
      practiceMode,
    };

    onLoadContent(memorizationState);
  };

  const modeBadge = (mode: PracticeMode) => {
    if (mode === 'dictation') {
      return (
        <span key={mode} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded uppercase">
          Dictation
        </span>
      );
    }
    if (mode === 'shuffledGame') {
      return (
        <span key={mode} className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded uppercase">
          Game
        </span>
      );
    }
    return (
      <span key={mode} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase">
        Classic
      </span>
    );
  };

  return (
    <>
      <MemorizationTopNav
        onCreateNew={onCreateNew}
        onViewSaved={() => { }}
        currentView="saved"
      />
      <div
        className="pt-24 min-h-full bg-gray-50 pr-8"
        data-ui="PAGE-MEMORIZATION"
        data-source-tsx="SavedContent|src/components/SavedContent/SavedContent.tsx"
      >
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-lg p-8" data-ui="PANEL-PRACTICE-STAGE">
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
              <div className="space-y-4" data-ui="LIST-SAVED-CONTENT">
                {practiceGroups.map(group => {
                  const content = group.primary;
                  return (
                  <div
                    key={group.key}
                    className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                    data-ui="CARD-SAVED-ITEM"
                    data-source-tsx="SavedContent Item Container|src/components/SavedContent/SavedContent.tsx"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {editingId === content.id ? (
                          <div className="flex items-center gap-2 mb-2 w-full max-w-md">
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveTitle(group);
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                              className="flex-1 px-3 py-1.5 text-base border-2 border-blue-500 rounded-lg focus:outline-none font-semibold text-gray-800"
                              autoFocus
                              disabled={isSavingTitle}
                              placeholder="Enter title..."
                            />
                            <button
                              onClick={() => handleSaveTitle(group)}
                              disabled={isSavingTitle || !editingTitle.trim()}
                              className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                              title="Save title"
                              aria-label="Save title"
                            >
                              {isSavingTitle ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              disabled={isSavingTitle}
                              className="p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors"
                              title="Cancel"
                              aria-label="Cancel"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h3
                              className="text-lg font-semibold text-gray-800 truncate max-w-xs sm:max-w-md md:max-w-lg"
                              data-source-tsx="SavedContent Item Title|src/components/SavedContent/SavedContent.tsx"
                            >
                              {content.title}
                            </h3>
                            <button
                              onClick={() => handleStartEdit(content)}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit title"
                              aria-label="Edit title"
                            >
                              <Edit2 size={16} />
                            </button>
                            {group.modes.map(mode => modeBadge(mode))}
                          </div>
                        )}
                        <p
                          className="text-gray-600 text-sm mb-3 line-clamp-2"
                          data-source-tsx="SavedContent Item Original Text|src/components/SavedContent/SavedContent.tsx"
                        >
                          {content.originalText}
                        </p>
                        <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
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
                        <div className="flex flex-wrap items-center gap-2">
                          {group.modes.includes('memorization') && (
                            <button
                              onClick={() => handleLoad(content, 'memorization')}
                              data-ui="BTN-PREVIEW-CLASSIC"
                              className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                              title="Open Classic Mode"
                            >
                              <Play size={14} />
                              <span>Classic</span>
                            </button>
                          )}
                          {group.modes.includes('shuffledGame') && (
                            <button
                              onClick={() => handleLoad(content, 'shuffledGame')}
                              data-ui="BTN-PREVIEW-GAME"
                              className="flex items-center space-x-1 px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                              title="Open Game Mode"
                            >
                              <RotateCcw size={14} />
                              <span>Game</span>
                            </button>
                          )}
                          {group.modes.includes('dictation') && (
                            <button
                              onClick={() => handleLoad(content, 'dictation')}
                              data-ui="BTN-PREVIEW-DICTATION"
                              className="flex items-center space-x-1 px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                              title="Open Dictation Mode"
                            >
                              <Layers size={14} />
                              <span>Dictation</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 ml-4 flex-wrap">
                        <button
                          onClick={() => onEditContent(content)}
                          className="flex items-center space-x-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                          data-source-tsx="SavedContent Edit Button|src/components/SavedContent/SavedContent.tsx"
                        >
                          <Edit2 size={16} />
                          <span>Edit</span>
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
                          onClick={() => handleDelete(group)}
                          disabled={deletingId === content.id}
                          className={`flex items-center space-x-1 px-4 py-2 rounded-lg transition-colors ${deleteConfirm === content.id
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
                  );
                })}
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
          onAssignmentChange={() => { }}
        />
      )}
    </>
  );
};

export default SavedContent;