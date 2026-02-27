import { useState, useEffect } from 'react';
import { Plus, BookOpen, BarChart3, Flame, Zap, Play, Trash2, Pencil, RotateCcw, Trash, AlertTriangle, Loader2, RefreshCw, Users, GraduationCap, Star } from 'lucide-react';
import { SetAssignmentModal } from './SetAssignmentModal';
import { SpacedRepetitionSet } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useSpacedRepetition } from '../../context/SpacedRepetitionContext';

interface SpacedRepetitionHubProps {
  onCreateNew: () => void;
  onStartLearning: (setId?: string, setTitle?: string) => void;
  onEditSet: (setId: string) => void;
  onViewAnalytics: () => void;
  onViewSettings: () => void;
  masterModeSetId: string | null;
  setMasterModeSetId: (val: string | null) => void;
}

export function SpacedRepetitionHub({
  onCreateNew,
  onStartLearning,
  onEditSet,
  onViewAnalytics,
  onViewSettings,
  masterModeSetId,
  setMasterModeSetId,
}: SpacedRepetitionHubProps) {
  const { user } = useAuth();
  const {
    sets,
    assignedSets,
    streak,
    cardsDueToday,
    loading: contextLoading,
    deleteSet,
    restoreSet,
    permanentlyDeleteSet,
    fetchRecycleBin,
    fetchAllData,
    setAssignmentMap
  } = useSpacedRepetition();
  const [recycleBin, setRecycleBin] = useState<SpacedRepetitionSet[]>([]);
  const [view, setView] = useState<'active' | 'assigned' | 'bin'>('active');
  const [confirmingSetId, setConfirmingSetId] = useState<string | null>(null);
  const [assigningSet, setAssigningSet] = useState<{ id: string, title: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchAllData();
    }
  }, [user?.id]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAllData();
    if (view === 'bin') {
      const bin = await fetchRecycleBin();
      setRecycleBin(bin);
    }
    setIsRefreshing(false);
  };

  const handleDelete = async (setId: string) => {
    setConfirmingSetId(setId);
  };

  const confirmDelete = async () => {
    if (!confirmingSetId) return;
    try {
      await deleteSet(confirmingSetId);
      // Context will update sets automatically
      setConfirmingSetId(null);
    } catch (error) {
      console.error('Failed to delete set:', error);
    }
  };

  const handleRestore = async (setId: string) => {
    try {
      const success = await restoreSet(setId);
      if (success) {
        setRecycleBin(recycleBin.filter((s: SpacedRepetitionSet) => s.id !== setId));
        fetchAllData(); // Refresh active sets via context
      }
    } catch (error) {
      console.error('Failed to restore set:', error);
    }
  };

  const handlePermanentDelete = async (setId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this set? This action cannot be undone.')) return;
    try {
      const success = await permanentlyDeleteSet(setId);
      if (success) {
        setRecycleBin(recycleBin.filter((s: SpacedRepetitionSet) => s.id !== setId));
      }
    } catch (error) {
      console.error('Failed to permanently delete set:', error);
    }
  };

  const toggleView = async (newView: 'active' | 'assigned' | 'bin') => {
    setView(newView);
    if (newView === 'bin') {
      const binData = await fetchRecycleBin();
      setRecycleBin(binData);
    }
  };

  const getDaysUntilDeletion = (deletedAt: string | undefined | null) => {
    if (!deletedAt) return 7;
    const deletedDate = new Date(deletedAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - deletedDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const remaining = 7 - diffDays;
    return remaining > 0 ? remaining : 0;
  };

  if (contextLoading && sets.length === 0) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-gray-500 font-medium">Loading Learning Hub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-blue-50 to-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-2">Spaced Repetition Learning</h1>
          <p className="text-sm md:text-base text-gray-600">Master material using scientifically-proven spacing intervals</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6 relative overflow-hidden">
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="text-sm text-gray-600 mb-1">Cards Due Today</p>
                <p className="text-3xl font-bold text-blue-600">{cardsDueToday}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl">
                <Play className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-blue-50/50 rounded-full blur-2xl" />
          </div>

          <div className="bg-white rounded-lg shadow p-6 relative overflow-hidden">
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="text-sm text-gray-600 mb-1">Current Streak</p>
                <p className="text-3xl font-bold text-orange-600">
                  {streak?.current_streak_days || 0} 🔥
                </p>
              </div>
              <div className="p-3 bg-orange-50 rounded-xl">
                <Flame className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-orange-50/50 rounded-full blur-2xl" />
          </div>

          <div className="bg-white rounded-lg shadow p-6 relative overflow-hidden">
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="text-sm text-gray-600 mb-1">Cards Mastered</p>
                <p className="text-3xl font-bold text-green-600">
                  {streak?.total_cards_mastered || 0}
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-xl">
                <Zap className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-green-50/50 rounded-full blur-2xl" />
          </div>

          <div className="bg-white rounded-lg shadow p-6 relative overflow-hidden">
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="text-sm text-gray-600 mb-1">Question Sets</p>
                <p className="text-3xl font-bold text-purple-600">{sets.length}</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-xl">
                <BookOpen className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-purple-50/50 rounded-full blur-2xl" />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <button
            onClick={onCreateNew}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors w-full sm:w-auto"
          >
            <Plus className="w-5 h-5" />
            Create New Set
          </button>

          <button
            onClick={onViewAnalytics}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors w-full sm:w-auto"
          >
            <BarChart3 className="w-5 h-5" />
            Analytics
          </button>

          <button
            onClick={onViewSettings}
            className="flex items-center justify-center px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors w-full sm:w-auto"
          >
            Settings
          </button>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`flex items-center justify-center px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors w-full sm:w-auto ${isRefreshing ? 'opacity-50' : ''}`}
          >
            <RefreshCw className={`w-5 h-5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {cardsDueToday > 0 && (
          <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
            <h3 className="font-bold text-gray-900 mb-2 font-display">Time to Review!</h3>
            <p className="text-gray-700 mb-4">
              You have {cardsDueToday} card{cardsDueToday !== 1 ? 's' : ''} ready for review today.
            </p>
            <button
              onClick={() => onStartLearning()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Start Review Session
            </button>
          </div>
        )}

        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => toggleView('active')}
            className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${view === 'active'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            My Sets
          </button>
          <button
            onClick={() => toggleView('assigned')}
            className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${view === 'assigned'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            <div className="flex items-center gap-2">
              Assigned to Me
              {assignedSets.length > 0 && (
                <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {assignedSets.length}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => toggleView('bin')}
            className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${view === 'bin'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            Recycle Bin
          </button>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {view === 'active' ? 'Your Question Sets' : view === 'assigned' ? 'Assigned to You' : 'Recycle Bin'}
          </h2>

          {view === 'active' ? (
            sets.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <BookOpen className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-4">No question sets yet.</p>
                <button
                  onClick={onCreateNew}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Create Your First Set
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sets.map((set: SpacedRepetitionSet) => (
                  <div
                    key={set.id}
                    className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 flex flex-col"
                  >
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 mb-2 line-clamp-2">{set.title}</h3>
                      {set.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{set.description}</p>
                      )}

                      <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                        <span>{set.total_questions} questions</span>
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                          {set.difficulty}
                        </span>
                      </div>

                      {/* Assigned Students */}
                      {user?.role === 'admin' && setAssignmentMap[set.id] && setAssignmentMap[set.id].students.length > 0 && (
                        <div className="mb-2 p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Users className="w-3.5 h-3.5 text-indigo-600" />
                            <span className="text-xs font-semibold text-indigo-700">
                              Assigned to {setAssignmentMap[set.id].students.length} student{setAssignmentMap[set.id].students.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {setAssignmentMap[set.id].students.map(s => (
                              <span
                                key={s.id}
                                className="text-[10px] px-1.5 py-0.5 bg-white border border-indigo-200 rounded-full text-indigo-700 font-medium truncate max-w-[120px]"
                                title={s.display_name}
                              >
                                {s.display_name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {user?.role === 'admin' && (
                      <div className="mb-4 p-2 bg-blue-50/50 rounded-lg border border-blue-100 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Star size={14} className={masterModeSetId === set.id ? "text-blue-600 fill-blue-600" : "text-gray-400"} />
                          <span className="text-[10px] font-bold text-gray-700 uppercase tracking-tight">Master Mode</span>
                        </div>
                        <button
                          onClick={() => setMasterModeSetId(masterModeSetId === set.id ? null : set.id)}
                          className={`relative inline-flex h-4 w-8 items-center rounded-full transition-all focus:outline-none ${masterModeSetId === set.id ? 'bg-blue-600' : 'bg-gray-200'
                            }`}
                        >
                          <span
                            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${masterModeSetId === set.id ? 'translate-x-4' : 'translate-x-1'
                              }`}
                          />
                        </button>
                      </div>
                    )}

                    <div className="flex gap-2 mt-auto">
                      <button
                        onClick={() => onStartLearning(set.id, set.title)}
                        className="flex-1 px-3 py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 transition-colors text-sm"
                      >
                        Practice
                      </button>
                      {user?.role === 'admin' && (
                        <button
                          onClick={() => setAssigningSet({ id: set.id, title: set.title })}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          title="Assign to Students"
                        >
                          <Users className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => onEditSet(set.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit Set"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(set.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete Set"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : view === 'assigned' ? (
            assignedSets.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center border-2 border-dashed border-gray-100">
                <GraduationCap className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No question sets assigned to you yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assignedSets.map((set: SpacedRepetitionSet) => (
                  <div
                    key={set.id}
                    className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 flex flex-col border-l-4 border-indigo-500"
                  >
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-gray-900 line-clamp-2">{set.title}</h3>
                        <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-100 uppercase tracking-tighter">
                          Assigned
                        </span>
                      </div>
                      {set.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{set.description}</p>
                      )}

                      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                        <span>{set.total_questions} questions</span>
                        <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-semibold">
                          {set.difficulty}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => onStartLearning(set.id, set.title)}
                      className="w-full px-3 py-2 bg-indigo-600 text-white rounded font-semibold hover:bg-indigo-700 transition-colors text-sm flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Practice Assigned Set
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : (
            recycleBin.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
                <Trash2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>Recycle bin is empty.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recycleBin.map((set: SpacedRepetitionSet) => (
                  <div key={set.id} className="bg-white rounded-lg shadow p-6 opacity-75 grayscale-[0.5]">
                    <h3 className="font-bold text-gray-900 mb-2 line-clamp-2">{set.title}</h3>
                    <div className="text-xs text-orange-600 font-medium mb-4 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Expires in {getDaysUntilDeletion(set.deleted_at)} days
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRestore(set.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded font-semibold hover:bg-green-700 transition-colors text-sm"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Restore
                      </button>
                      <button
                        onClick={() => handlePermanentDelete(set.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete Permanently"
                      >
                        <Trash className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {
        confirmingSetId && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete this set?</h3>
              <p className="text-gray-600 mb-6">
                This set will be moved to the Recycle Bin for 7 days before being permanently deleted.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmingSetId(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Assignment Modal */}
      {
        assigningSet && (
          <SetAssignmentModal
            setId={assigningSet.id}
            setTitle={assigningSet.title}
            onClose={() => setAssigningSet(null)}
          />
        )
      }
    </div >
  );
}