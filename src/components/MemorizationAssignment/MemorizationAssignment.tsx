import React, { useState, useEffect } from 'react';
import { X, UserPlus, Calendar, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface User {
  id: string;
  username: string;
}

interface Assignment {
  user_id: string;
  username: string;
  assigned_at: string;
  completed: boolean;
}

interface MemorizationAssignmentProps {
  contentId: string;
  contentTitle: string;
  onClose: () => void;
  onAssignmentChange: () => void;
}

const MemorizationAssignment: React.FC<MemorizationAssignmentProps> = ({
  contentId,
  contentTitle,
  onClose,
  onAssignmentChange,
}) => {
  const { user } = useAuth();
  const [students, setStudents] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [contentId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: studentsData, error: studentsError } = await supabase
        .from('users')
        .select('id, username')
        .eq('role', 'user')
        .order('username');

      if (studentsError) throw studentsError;
      setStudents(studentsData || []);

      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('memorization_assignments')
        .select(`
          user_id,
          assigned_at,
          completed,
          users!memorization_assignments_user_id_fkey(username)
        `)
        .eq('content_id', contentId);

      if (assignmentsError) throw assignmentsError;

      const formattedAssignments = (assignmentsData || []).map((a: any) => ({
        user_id: a.user_id,
        username: a.users?.username || 'Unknown',
        assigned_at: a.assigned_at,
        completed: a.completed,
      }));

      setAssignments(formattedAssignments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStudent = (studentId: string) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
  };

  const handleAssign = async () => {
    if (selectedStudents.size === 0) {
      setError('Please select at least one student');
      return;
    }

    if (!user) {
      setError('You must be logged in');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const assignmentData = Array.from(selectedStudents).map((studentId) => ({
        content_id: contentId,
        user_id: studentId,
        assigned_by: user.id,
        due_date: dueDate || null,
      }));

      const { error: insertError } = await supabase
        .from('memorization_assignments')
        .insert(assignmentData);

      if (insertError) throw insertError;

      setSelectedStudents(new Set());
      setDueDate('');
      await loadData();
      onAssignmentChange();
    } catch (err: any) {
      if (err.code === '23505') {
        setError('One or more students are already assigned this content');
      } else {
        setError(err.message || 'Failed to assign content');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async (studentId: string) => {
    if (!confirm('Remove this assignment?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('memorization_assignments')
        .delete()
        .eq('content_id', contentId)
        .eq('user_id', studentId);

      if (deleteError) throw deleteError;

      await loadData();
      onAssignmentChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove assignment');
    }
  };

  const assignedStudentIds = new Set(assignments.map((a) => a.user_id));
  const availableStudents = students.filter((s) => !assignedStudentIds.has(s.id));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Assign Content</h2>
            <p className="text-sm text-gray-600 mt-1">{contentTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-gray-600">Loading...</div>
          ) : (
            <>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                  <UserPlus size={20} className="mr-2" />
                  Assign to Students
                </h3>

                {availableStudents.length === 0 ? (
                  <div className="text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
                    All students have been assigned this content
                  </div>
                ) : (
                  <>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Calendar size={16} className="inline mr-1" />
                        Due Date (Optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-64 overflow-y-auto">
                      {availableStudents.map((student) => (
                        <label
                          key={student.id}
                          className="flex items-center p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedStudents.has(student.id)}
                            onChange={() => handleToggleStudent(student.id)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="ml-3 text-gray-800">{student.username}</span>
                        </label>
                      ))}
                    </div>

                    <button
                      onClick={handleAssign}
                      disabled={saving || selectedStudents.size === 0}
                      className="mt-4 w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
                    >
                      {saving ? 'Assigning...' : `Assign to ${selectedStudents.size} Student${selectedStudents.size !== 1 ? 's' : ''}`}
                    </button>
                  </>
                )}
              </div>

              <div className="mt-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Current Assignments ({assignments.length})
                </h3>

                {assignments.length === 0 ? (
                  <div className="text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
                    No students assigned yet
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
                    {assignments.map((assignment) => (
                      <div
                        key={assignment.user_id}
                        className="flex items-center justify-between p-3 hover:bg-gray-50"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-gray-800 font-medium">{assignment.username}</span>
                          {assignment.completed && (
                            <span className="flex items-center text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                              <CheckCircle size={14} className="mr-1" />
                              Completed
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleUnassign(assignment.user_id)}
                          className="text-sm text-red-600 hover:text-red-700 font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default MemorizationAssignment;
