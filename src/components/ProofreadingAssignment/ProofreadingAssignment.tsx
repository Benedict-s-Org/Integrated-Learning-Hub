import React, { useState, useEffect } from 'react';
import { ArrowLeft, Users, CheckCircle, BookOpen, Plus, Play } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ProofreadingPractice } from '../../types';
import ProofreadingPracticeComponent from '../ProofreadingPractice/ProofreadingPractice';

interface User {
  id: string;
  username: string;
  role: string;
}

interface ProofreadingAssignmentProps {
  practice: ProofreadingPractice;
  onBack: () => void;
}

export const ProofreadingAssignment: React.FC<ProofreadingAssignmentProps> = ({ practice, onBack }) => {
  const { user: currentUser, isAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<Set<string>>(new Set());
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [view, setView] = useState<'assign' | 'preview'>('assign');

  useEffect(() => {
    if (isAdmin) {
      fetchUsersAndAssignments();
    } else {
      setView('preview');
      setLoading(false);
    }
  }, [isAdmin]);

  const fetchUsersAndAssignments = async () => {
    try {
      setError(null);

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth/list-users`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminUserId: currentUser?.id,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      const nonAdminUsers = (data.users || []).filter((u: User) => u.role !== 'admin');
      setUsers(nonAdminUsers);

      const assignmentsResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proofreading-assignments/list`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            practiceId: practice.id,
            adminUserId: currentUser?.id,
          }),
        }
      );

      const assignmentsResult = await assignmentsResponse.json();
      if (!assignmentsResponse.ok) throw new Error(assignmentsResult.error);

      const assignedUserIds = new Set(assignmentsResult.assignments?.map((a: { user_id: string }) => a.user_id) || []);
      setAssignments(assignedUserIds);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load users and assignments');
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map(u => u.id)));
    }
  };

  const handleBulkAssign = async () => {
    if (selectedUsers.size === 0) return;

    const usersToAssign = Array.from(selectedUsers).filter(userId => !assignments.has(userId));

    if (usersToAssign.length === 0) {
      setError('Selected users are already assigned to this practice');
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (usersToAssign.length > 5) {
      const confirmed = window.confirm(
        `Are you sure you want to assign this practice to ${usersToAssign.length} students?`
      );
      if (!confirmed) return;
    }

    try {
      setAssigning(true);
      setError(null);
      setSuccess(null);

      if (!currentUser?.id) {
        setError('User not authenticated');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proofreading-assignments/assign`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            practiceId: practice.id,
            userIds: usersToAssign,
            assignedBy: currentUser.id,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'Failed to assign practice');
        return;
      }

      const newAssignments = new Set(assignments);
      usersToAssign.forEach(userId => newAssignments.add(userId));
      setAssignments(newAssignments);
      setSelectedUsers(new Set());
      setSuccess(`Successfully assigned practice to ${usersToAssign.length} student${usersToAssign.length !== 1 ? 's' : ''}`);

      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Error assigning practice:', err);
      setError(err instanceof Error ? err.message : 'Failed to assign practice');
    } finally {
      setAssigning(false);
    }
  };

  if (view === 'preview') {
    return (
      <ProofreadingPracticeComponent
        sentences={practice.sentences}
        answers={practice.answers}
        onBack={() => isAdmin ? setView('assign') : onBack()}
        isPreview={true}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <p className="text-center text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-8"
      style={{ fontFamily: 'Times New Roman, serif' }}
      data-source-tsx="ProofreadingAssignment|src/components/ProofreadingAssignment/ProofreadingAssignment.tsx"
    >
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
            <h1 className="text-3xl font-bold text-gray-800 mb-2">{practice.title}</h1>
            <p className="text-gray-600">{practice.sentences.length} sentences</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
              <p className="text-green-700">{success}</p>
            </div>
          )}

          <div className="mb-6">
            <button
              onClick={() => setView('preview')}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
            >
              <Play size={20} />
              <span>Preview Practice</span>
            </button>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center space-x-2">
                <Users size={24} />
                <span>Assign to Students</span>
              </h2>
              {users.length > 0 && (
                <label className="flex items-center space-x-2 cursor-pointer text-gray-700 hover:text-gray-900">
                  <input
                    type="checkbox"
                    checked={selectedUsers.size === users.length && users.length > 0}
                    onChange={toggleSelectAll}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="font-medium">Select All</span>
                </label>
              )}
            </div>

            {users.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-600">No students found. Create student accounts first.</p>
              </div>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  {users.map((user) => {
                    const isAssigned = assignments.has(user.id);
                    const isSelected = selectedUsers.has(user.id);
                    return (
                      <div
                        key={user.id}
                        onClick={() => toggleUserSelection(user.id)}
                        className={`flex items-center p-4 rounded-lg border-2 transition-all cursor-pointer ${
                          isAssigned
                            ? 'bg-green-50 border-green-300'
                            : isSelected
                            ? 'bg-blue-50 border-blue-300'
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleUserSelection(user.id)}
                          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex items-center flex-1 ml-3 space-x-3">
                          {isAssigned && <CheckCircle size={20} className="text-green-600" />}
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800">{user.username}</p>
                            <p className="text-sm text-gray-500 capitalize">{user.role}</p>
                          </div>
                          {isAssigned && (
                            <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded">
                              Already Assigned
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedUsers.size > 0 && (
                  <div className="flex items-center justify-between p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                    <p className="text-blue-800 font-medium">
                      {selectedUsers.size} student{selectedUsers.size !== 1 ? 's' : ''} selected
                    </p>
                    <button
                      onClick={handleBulkAssign}
                      disabled={assigning}
                      className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                      data-source-tsx="ProofreadingAssignment Assign Button|src/components/ProofreadingAssignment/ProofreadingAssignment.tsx"
                    >
                      {assigning ? (
                        <>
                          <span>Assigning...</span>
                        </>
                      ) : (
                        <>
                          <Users size={20} />
                          <span>Assign to Selected</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex justify-start items-center pt-6 border-t border-gray-200">
            <button
              onClick={onBack}
              className="flex items-center space-x-2 px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
            >
              <ArrowLeft size={20} />
              <span>Back to Practices</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProofreadingAssignment;
