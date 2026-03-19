import React, { useState, useEffect } from 'react';
import { BookOpen, Trash2, Users, Plus, PlayCircle, Edit, UserPlus, Clock, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSpellingSrs } from '../../context/SpellingSrsContext';
import SpellingTopNav from '../SpellingTopNav/SpellingTopNav';

interface Practice {
  id: string;
  title: string;
  words: string[];
  created_at: string;
  assignment_count?: number;
  assignment_id?: string;
  level?: number;
  metadata?: {
    wordLimit?: number;
  };
}

interface User {
  id: string;
  username: string;
  role: string;
}

interface SavedPracticesProps {
  onCreateNew: () => void;
  onSelectPractice: (practice: Practice) => void;
  onPractice?: (practice: Practice) => void;
}

export const SavedPractices: React.FC<SavedPracticesProps> = ({ onCreateNew, onSelectPractice, onPractice }) => {
  const { user, isAdmin, session } = useAuth();
  const [practices, setPractices] = useState<Practice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPractice, setSelectedPractice] = useState<Practice | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [pendingAssignments, setPendingAssignments] = useState<Set<string>>(new Set());
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentSuccess, setAssignmentSuccess] = useState<string | null>(null);
  const [assignmentLevel, setAssignmentLevel] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const { getWordsDueForReview } = useSpellingSrs();
  const [dueWords, setDueWords] = useState<string[]>([]);
  const [prepSession, setPrepSession] = useState<{
    practice: Practice;
    isSRS?: boolean;
    isAdminPractice?: boolean;
  } | null>(null);
  const [selectedSize, setSelectedSize] = useState<number | 'all'>(20);

  useEffect(() => {
    fetchPractices();
    if (user && !isAdmin) {
      loadDueWords();
    }
  }, [user, isAdmin]);

  const loadDueWords = async () => {
    const words = await getWordsDueForReview();
    setDueWords(words);
  };

  if (!user) {
    return null;
  }

  const fetchPractices = async () => {
    if (!user?.id) {
      setPractices([]);
      setLoading(false);
      return;
    }

    try {
      setError(null);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/spelling-practices/list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
          'apikey': anonKey
        },
        body: JSON.stringify({ userId: user.id })
      });

      if (!response.ok) {
        throw new Error('Failed to load practices');
      }

      const data = await response.json();
      setPractices(data.practices || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load practices');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (practiceId: string) => {
    try {
      setError(null);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/spelling-practices/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
          'apikey': anonKey
        },
        body: JSON.stringify({
          practiceId,
          userId: user!.id,
        })
      });

      if (!response.ok) {
        throw new Error('Failed to delete practice');
      }

      // Successfully deleted
      setPractices(practices.filter((p) => p.id !== practiceId));
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete practice');
    }
  };

  const openAssignModal = async (practice: Practice) => {
    setSelectedPractice(practice);
    setShowAssignModal(true);
    setAssignmentLevel(1); // Default to Level 1
    setAssignmentLoading(true);
    setAssignmentSuccess(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const usersResponse = await fetch(`${supabaseUrl}/functions/v1/user-management/list-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
          'apikey': anonKey
        },
        body: JSON.stringify({ adminUserId: user?.id })
      });

      if (!usersResponse.ok) {
        throw new Error('Failed to load users');
      }

      const usersData = await usersResponse.json();

      const nonAdminUsers = (usersData.users || []).filter((u: User) => u.role !== 'admin');
      setUsers(nonAdminUsers);

      const assignmentsResponse = await fetch(`${supabaseUrl}/functions/v1/spelling-practices/get-assignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
          'apikey': anonKey
        },
        body: JSON.stringify({
          practiceId: practice.id,
          userId: user?.id,
        })
      });

      if (!assignmentsResponse.ok) {
        throw new Error('Failed to load assignments');
      }

      const assignmentsData = await assignmentsResponse.json();

      const assignedUserIds = new Set<string>(assignmentsData.assignments || []);
      setPendingAssignments(new Set<string>(assignedUserIds));
    } catch (err) {
      console.error('Error fetching assignment data:', err);
      setError('Failed to load assignment data');
    } finally {
      setAssignmentLoading(false);
    }
  };

  const togglePendingAssignment = (userId: string) => {
    const newPending = new Set(pendingAssignments);
    if (newPending.has(userId)) {
      newPending.delete(userId);
    } else {
      newPending.add(userId);
    }
    setPendingAssignments(newPending);
  };

  const applyAssignments = async () => {
    if (!selectedPractice) return;

    setIsProcessing(true);
    setAssignmentSuccess(null);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/spelling-practices/update-assignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
          'apikey': anonKey
        },
        body: JSON.stringify({
          practiceId: selectedPractice.id,
          userId: user!.id,
          userIds: Array.from(pendingAssignments),
          level: assignmentLevel,
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update assignments');
      }

      setAssignmentSuccess(`Successfully updated assignments for ${selectedPractice.title}`);
      await fetchPractices();
      setTimeout(() => setAssignmentSuccess(null), 3000);
    } catch (err) {
      console.error('Error updating assignments:', err);
      setError(err instanceof Error ? err.message : 'Failed to update assignments');
    } finally {
      setIsProcessing(false);
    }
  };

  const closeAssignModal = () => {
    setShowAssignModal(false);
    setSelectedPractice(null);
    setUsers([]);
    setPendingAssignments(new Set());
    setAssignmentSuccess(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <p className="text-center text-gray-600">Loading practices...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {isAdmin && (
        <SpellingTopNav
          onCreateNew={onCreateNew}
          onViewSaved={() => { }}
          currentView="saved"
        />
      )}
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-8" style={{ paddingTop: isAdmin ? '100px' : '32px' }}>
        <div className="max-w-6xl mx-auto">

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                {isAdmin ? 'Manage Spelling Practices' : 'My Assigned Practices'}
              </h1>
              <p className="text-gray-600">
                {isAdmin
                  ? 'Create and manage spelling practices for your students'
                  : 'View practices assigned to you by your teacher'
                }
              </p>
            </div>

            {!isAdmin && dueWords.length > 0 && (
              <div className="mb-8 p-6 bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-orange-100 rounded-xl">
                      <Clock className="w-8 h-8 text-orange-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-800">Review Flashcards</h2>
                      <p className="text-gray-600">
                        You have <span className="font-bold text-orange-600">{dueWords.length}</span> {dueWords.length === 1 ? 'word' : 'words'} due for review!
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setPrepSession({
                        practice: {
                          id: 'srs-review',
                          title: `Daily Review (${new Date().toLocaleDateString()})`,
                          words: dueWords,
                          created_at: new Date().toISOString(),
                          level: 2,
                          metadata: { wordLimit: undefined }
                        },
                        isSRS: true
                      });
                      setSelectedSize(20); // Default for SRS
                    }}
                    className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 font-bold shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                  >
                    Start Review
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                <p className="text-red-700">{error}</p>
              </div>
            )}

            {practices.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen size={64} className="mx-auto text-gray-400 mb-4" />
                <p className="text-xl text-gray-600 mb-4">
                  {isAdmin ? 'No practices created yet' : 'No practices assigned yet'}
                </p>
                {isAdmin && (
                  <button
                    onClick={onCreateNew}
                    className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                  >
                    <Plus size={20} />
                    <span>Create Your First Practice</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Title and Info</th>
                      {isAdmin && (
                        <>
                          <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Manage</th>
                          <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Assign</th>
                          <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Practice</th>
                          <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Delete</th>
                        </>
                      )}
                      {!isAdmin && (
                        <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Practice</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {practices.map((practice) => (
                      <tr key={practice.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4">
                          <div className="text-left">
                            <h3 className="text-lg font-bold text-gray-800 mb-1">{practice.title}</h3>
                            <div className="flex flex-col space-y-1 text-sm text-gray-600">
                              <span>{practice.words.length} words</span>
                              {isAdmin && (
                                <span className="flex items-center space-x-1">
                                  <Users size={14} />
                                  <span>{practice.assignment_count || 0} assigned</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        {isAdmin && (
                          <>
                            <td className="px-4 py-4 text-right">
                                <button
                                  onClick={() => onSelectPractice(practice)}
                                  className="inline-flex items-center space-x-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                                >
                                  <Edit size={16} />
                                  <span>Manage</span>
                                </button>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <button
                                onClick={() => openAssignModal(practice)}
                                className="inline-flex items-center space-x-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium transition-colors"
                              >
                                <UserPlus size={16} />
                                <span>Assign</span>
                              </button>
                            </td>
                            <td className="px-4 py-4 text-right">
                              {onPractice && (
                                <button
                                  onClick={() => {
                                    setPrepSession({ practice, isAdminPractice: true });
                                    setSelectedSize(practice.metadata?.wordLimit || 'all');
                                  }}
                                  className="inline-flex items-center space-x-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
                                >
                                  <PlayCircle size={16} />
                                  <span>Practice</span>
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-4 text-right">
                              {deleteConfirm === practice.id ? (
                                <div className="inline-flex space-x-2">
                                  <button
                                    onClick={() => handleDelete(practice.id)}
                                    className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors text-sm"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="px-3 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium transition-colors text-sm"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeleteConfirm(practice.id)}
                                  className="inline-flex items-center space-x-1 px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                                >
                                  <Trash2 size={16} />
                                  <span>Delete</span>
                                </button>
                              )}
                            </td>
                          </>
                        )}
                        {!isAdmin && (
                          <td className="px-4 py-4 text-right">
                              <button
                                onClick={() => {
                                  setPrepSession({ practice });
                                  setSelectedSize(practice.metadata?.wordLimit || 'all');
                                }}
                                className="inline-flex items-center space-x-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
                              >
                                <PlayCircle size={16} />
                                <span>Start</span>
                              </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAssignModal && selectedPractice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Assign Practice to Students</h2>
            <p className="text-gray-600 mb-6">
              Practice: <span className="font-semibold">{selectedPractice.title}</span>
            </p>

            {/* Level Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Difficulty Level
              </label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setAssignmentLevel(1)}
                  className={`flex-1 py-3 px-4 rounded-xl border-2 font-bold transition-all ${assignmentLevel === 1
                    ? "bg-blue-600 text-white border-blue-600 shadow-lg"
                    : "bg-white text-gray-400 border-gray-200 hover:border-blue-300"
                    }`}
                >
                  Level 1 (Basic)
                </button>
                <button
                  type="button"
                  onClick={() => setAssignmentLevel(2)}
                  className={`flex-1 py-3 px-4 rounded-xl border-2 font-bold transition-all ${assignmentLevel === 2
                    ? "bg-purple-600 text-white border-purple-600 shadow-lg"
                    : "bg-white text-gray-400 border-gray-200 hover:border-purple-300"
                    }`}
                >
                  Level 2 (Advanced)
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Level 1 students can see Level 1 and 2 practices. Level 2 students can only see Level 2 practices.
              </p>
            </div>

            {assignmentSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
                {assignmentSuccess}
              </div>
            )}

            {assignmentLoading ? (
              <div className="py-8 text-center text-gray-600">Loading students...</div>
            ) : users.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-gray-600">No students found. Create student accounts first.</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto mb-6">
                <div className="space-y-2">
                  {users.map((user) => {
                    const isPending = pendingAssignments.has(user.id);
                    return (
                      <div
                        key={user.id}
                        className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all cursor-pointer ${isPending
                          ? 'bg-green-50 border-green-300'
                          : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                          }`}
                        onClick={() => togglePendingAssignment(user.id)}
                      >
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={isPending}
                            onChange={() => togglePendingAssignment(user.id)}
                            className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-500 cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div>
                            <p className="font-semibold text-gray-800">{user.username}</p>
                            <p className="text-sm text-gray-500 capitalize">{user.role}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={applyAssignments}
                disabled={isProcessing}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Assigning...' : 'Assign'}
              </button>
              <button
                onClick={closeAssignModal}
                disabled={isProcessing}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition-colors disabled:cursor-not-allowed"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {prepSession && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-8 shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <PlayCircle className="w-6 h-6 text-blue-600" />
              </div>
              <button onClick={() => setPrepSession(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <h3 className="text-2xl font-bold text-gray-900 mb-2 font-display">Spelling Practice</h3>
            <p className="text-gray-500 mb-8 text-sm leading-relaxed">
              Choose how many words you would like to practice in this session.
            </p>

            <div className="space-y-4 mb-8">
              <div className="grid grid-cols-3 gap-2">
                {[10, 20, 40].map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`py-3 rounded-xl text-sm font-bold transition-all border ${selectedSize === size
                      ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200'
                      : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-white hover:border-blue-200'
                      }`}
                  >
                    {size}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setSelectedSize('all')}
                className={`w-full py-4 rounded-xl text-sm font-bold transition-all border ${selectedSize === 'all'
                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200'
                  : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-white hover:border-blue-200'
                  }`}
              >
                All Words ({prepSession.practice.words.length})
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  const limit = selectedSize === 'all' ? undefined : selectedSize;
                  const practiceWithLimit = {
                    ...prepSession.practice,
                    metadata: {
                      ...prepSession.practice.metadata,
                      wordLimit: limit
                    }
                  };

                  if (prepSession.isAdminPractice && onPractice) {
                    onPractice(practiceWithLimit);
                  } else {
                    onSelectPractice(practiceWithLimit);
                  }
                  setPrepSession(null);
                }}
                className="w-full px-4 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95 flex items-center justify-center gap-2"
              >
                <span>Start Practice</span>
                <PlayCircle className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPrepSession(null)}
                className="w-full px-4 py-2 text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SavedPractices;
