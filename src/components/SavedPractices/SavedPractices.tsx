import React, { useState, useEffect } from 'react';
import { BookOpen, Trash2, Users, Plus, PlayCircle, Edit, UserPlus, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import SpellingTopNav from '../SpellingTopNav/SpellingTopNav';

interface Practice {
  id: string;
  title: string;
  words: string[];
  created_at: string;
  assignment_count?: number;
  assignment_id?: string;
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
  const { user, isAdmin } = useAuth();
  const [practices, setPractices] = useState<Practice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPractice, setSelectedPractice] = useState<Practice | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<Set<string>>(new Set());
  const [pendingAssignments, setPendingAssignments] = useState<Set<string>>(new Set());
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentSuccess, setAssignmentSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchPractices();
  }, [user]);

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

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/spelling-practices/list`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load practices');
      }

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

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/spelling-practices/delete`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          practiceId,
          userId: user!.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete practice');
      }

      setPractices(practices.filter((p) => p.id !== practiceId));
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete practice');
    }
  };

  const openAssignModal = async (practice: Practice) => {
    setSelectedPractice(practice);
    setShowAssignModal(true);
    setAssignmentLoading(true);
    setAssignmentSuccess(null);

    try {
      const usersApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth/list-users`;
      const usersResponse = await fetch(usersApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminUserId: user?.id,
        }),
      });

      const usersData = await usersResponse.json();
      if (!usersResponse.ok) throw new Error(usersData.error);

      const nonAdminUsers = (usersData.users || []).filter((u: User) => u.role !== 'admin');
      setUsers(nonAdminUsers);

      const assignmentsApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/spelling-practices/get-assignments`;
      const assignmentsResponse = await fetch(assignmentsApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          practiceId: practice.id,
          userId: user?.id,
        }),
      });

      const assignmentsData = await assignmentsResponse.json();
      if (!assignmentsResponse.ok) throw new Error(assignmentsData.error);

      const assignedUserIds = new Set(assignmentsData.assignments || []);
      setAssignments(assignedUserIds);
      setPendingAssignments(new Set(assignedUserIds));
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
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/spelling-practices/update-assignments`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          practiceId: selectedPractice.id,
          userId: user!.id,
          userIds: Array.from(pendingAssignments),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Assignment error response:', data);
        const errorMessage = data.details || data.error || 'Failed to update assignments';
        throw new Error(errorMessage);
      }

      setAssignments(new Set(pendingAssignments));
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
    setAssignments(new Set());
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
          onViewSaved={() => {}}
          currentView="saved"
        />
      )}
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-8" style={{ fontFamily: 'Times New Roman, serif', paddingTop: isAdmin ? '100px' : '32px' }}>
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
                                onClick={() => onPractice(practice)}
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
                            onClick={() => onSelectPractice(practice)}
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
                        className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all cursor-pointer ${
                          isPending
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
    </>
  );
};

export default SavedPractices;
