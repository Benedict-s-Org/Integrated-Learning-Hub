import React, { useState, useEffect } from 'react';
import { ArrowLeft, Users, CheckCircle, BookOpen, Plus, Play, Search, Filter } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import SpellingPreview from '../SpellingPreview/SpellingPreview';
import SpellingPractice from '../SpellingPractice/SpellingPractice';
import { isArchivedClassName } from '../../utils/archiveClassExporter';

interface User {
  id: string;
  username: string;
  display_name: string | null;
  role: string | null;
  spelling_level?: number;
  class?: string | null;
  class_number?: number | null;
}

interface Practice {
  id: string;
  title: string;
  words: string[];
  is_phrase_mode?: boolean;
  created_at: string;
}

interface PracticeAssignmentProps {
  practice: Practice;
  onBack: () => void;
}

export const PracticeAssignment: React.FC<PracticeAssignmentProps> = ({ practice, onBack }) => {
  const { user: currentUser, isAdmin, session } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<Set<string>>(new Set());
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [view, setView] = useState<'assign' | 'preview' | 'practice'>('assign');
  const [classFilter, setClassFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

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

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/user-management/list-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
          'apikey': anonKey
        },
        body: JSON.stringify({ adminUserId: currentUser?.id })
      });

      if (!response.ok) {
        throw new Error('Failed to load users');
      }

      const data = await response.json();

      const nonAdminUsers = (data.users || []).filter((u: User) => u.role !== 'admin' && !isArchivedClassName(u.class));
      setUsers(nonAdminUsers);

      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('practice_assignments')
        .select('user_id')
        .eq('practice_id', practice.id);

      if (assignmentsError) throw assignmentsError;

      const assignedUserIds = new Set(assignmentsData?.map((a) => a.user_id) || []);
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

  const availableClasses = Array.from(
    new Set(users.map((u) => u.class).filter((c): c is string => Boolean(c) && c !== 'Unassigned' && !isArchivedClassName(c)))
  ).sort();

  const filteredUsers = users.filter((u) => {
    if (classFilter === 'unassigned') {
      if (u.class && u.class !== 'Unassigned') return false;
    } else if (classFilter !== 'all') {
      if (u.class !== classFilter) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        (u.display_name || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q) ||
        (u.class || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const allFilteredSelected =
    filteredUsers.length > 0 && filteredUsers.every((u) => selectedUsers.has(u.id));

  const toggleSelectAll = () => {
    const newSelected = new Set(selectedUsers);
    if (allFilteredSelected) {
      filteredUsers.forEach((u) => newSelected.delete(u.id));
    } else {
      filteredUsers.forEach((u) => newSelected.add(u.id));
    }
    setSelectedUsers(newSelected);
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
        setError('You must be logged in to assign practices');
        return;
      }

      const insertData = usersToAssign.map(userId => {
        const targetUser = users.find(u => u.id === userId);
        return {
          practice_id: practice.id,
          user_id: userId,
          assigned_by: currentUser.id,
          level: targetUser?.spelling_level || 1
        };
      });

      const { error: insertError } = await supabase
        .from('practice_assignments')
        .insert(insertData);

      if (insertError) throw insertError;

      const newAssignments = new Set(assignments);
      usersToAssign.forEach(userId => newAssignments.add(userId));
      setAssignments(newAssignments);
      setSelectedUsers(new Set());
      setSuccess(`Successfully assigned practice to ${usersToAssign.length} student${usersToAssign.length !== 1 ? 's' : ''}`);

      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Error assigning practice:', err);
      setError('Failed to assign practice to selected students');
    } finally {
      setAssigning(false);
    }
  };

  if (view === 'preview') {
    return (
      <SpellingPreview
        title={practice.title}
        words={practice.words}
        isPhraseMode={practice.is_phrase_mode}
        onNext={() => setView('practice')}
        onBack={() => isAdmin ? setView('assign') : onBack()}
      />
    );
  }

  if (view === 'practice') {
    return (
      <SpellingPractice
        title={practice.title}
        words={practice.words}
        isPhraseMode={practice.is_phrase_mode}
        onBack={onBack}
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-8">
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
            <p className="text-gray-600">{practice.words.length} words</p>
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
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center space-x-2">
                <Users size={24} />
                <span>Assign to Students</span>
              </h2>
              {filteredUsers.length > 0 && (
                <label className="flex items-center space-x-2 cursor-pointer text-gray-700 hover:text-gray-900">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected && filteredUsers.length > 0}
                    onChange={toggleSelectAll}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="font-medium">
                    {allFilteredSelected ? 'Deselect Filtered' : 'Select All Filtered'}
                  </span>
                </label>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex-1 min-w-[200px] relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-gray-400 shrink-0" />
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none cursor-pointer"
                >
                  <option value="all">All Classes</option>
                  <option value="unassigned">Unassigned</option>
                  {availableClasses.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {users.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-600">No students found. Create student accounts first.</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg text-sm text-gray-500">
                No students match the current filter.
              </div>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  {filteredUsers.map((user) => {
                    const isAssigned = assignments.has(user.id);
                    const isSelected = selectedUsers.has(user.id);
                    return (
                      <div
                        key={user.id}
                        onClick={() => toggleUserSelection(user.id)}
                        className={`flex items-center p-4 rounded-lg border-2 transition-all cursor-pointer ${isAssigned
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
                        <div className="flex items-center flex-1 ml-3 space-x-3 min-w-0">
                          {isAssigned && <CheckCircle size={20} className="text-green-600 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              {user.class_number && (
                                <span className="text-xs font-bold text-gray-400">#{user.class_number}</span>
                              )}
                              <p className="font-semibold text-gray-800 truncate">{user.display_name || user.username}</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span className="truncate">@{user.username}</span>
                              <span className="w-1 h-1 rounded-full bg-gray-300" />
                              <span className="text-blue-600 font-medium">{user.class || 'Unassigned'}</span>
                            </div>
                          </div>
                          {isAssigned && (
                            <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded shrink-0">
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

export default PracticeAssignment;
