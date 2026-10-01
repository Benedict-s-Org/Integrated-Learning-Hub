import React, { useState, useEffect } from 'react';
import { X, UserPlus, Calendar, CheckCircle, Search, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { isArchivedClassName } from '../../utils/archiveClassExporter';

interface User {
  id: string;
  username: string;
  display_name?: string;
  class?: string;
  class_number?: number;
}

interface Assignment {
  user_id: string;
  username: string;
  display_name?: string;
  class?: string;
  class_number?: number;
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
  const [classFilter, setClassFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, [contentId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching students for contentId:', contentId);
      const { data: studentsData, error: studentsError } = await (supabase
        .from('users')
        .select('id, username, display_name, class, class_number')
        .eq('role', 'user')
        .order('username') as any);

      if (studentsError) {
        console.error('Error fetching students:', studentsError);
        throw studentsError;
      }

      const studentsList = (studentsData || []).filter((s: User) => !isArchivedClassName(s.class));
      setStudents(studentsList);
      console.log('Fetched students count:', studentsList.length);

      console.log('Fetching assignments for contentId:', contentId);
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('memorization_assignments')
        .select('user_id, assigned_at, completed')
        .eq('content_id', contentId);

      if (assignmentsError) {
        console.error('Error fetching assignments:', assignmentsError);
        throw assignmentsError;
      }

      console.log('Raw assignments count:', assignmentsData?.length || 0);

      const formattedAssignments = (assignmentsData || [])
        .map((a: any) => {
          const student = studentsList.find((s: User) => s.id === a.user_id);
          if (!student) return null;
          return {
            user_id: a.user_id,
            username: student?.username || 'Unknown Student',
            display_name: student?.display_name,
            class: student?.class,
            class_number: student?.class_number,
            assigned_at: a.assigned_at,
            completed: a.completed,
          };
        })
        .filter(Boolean);

      console.log('Formatted assignments count:', formattedAssignments.length);
      setAssignments(formattedAssignments as Assignment[]);
    } catch (err) {
      console.error('loadData error:', err);
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

  const availableClasses = Array.from(
    new Set(students.map((s) => s.class).filter((c): c is string => Boolean(c) && c !== 'Unassigned' && !isArchivedClassName(c)))
  ).sort();

  const filteredAvailableStudents = availableStudents.filter((s) => {
    if (classFilter === 'unassigned') {
      if (s.class && s.class !== 'Unassigned') return false;
    } else if (classFilter !== 'all') {
      if (s.class !== classFilter) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        (s.display_name || '').toLowerCase().includes(q) ||
        (s.username || '').toLowerCase().includes(q) ||
        (s.class || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const allFilteredSelected =
    filteredAvailableStudents.length > 0 &&
    filteredAvailableStudents.every((s) => selectedStudents.has(s.id));

  const handleToggleSelectFiltered = () => {
    const newSelected = new Set(selectedStudents);
    if (allFilteredSelected) {
      filteredAvailableStudents.forEach((s) => newSelected.delete(s.id));
    } else {
      filteredAvailableStudents.forEach((s) => newSelected.add(s.id));
    }
    setSelectedStudents(newSelected);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-800">Assign Content <span className="text-[10px] font-normal text-gray-400">v1.0.1</span></h2>
            <p className="text-xs md:text-sm text-gray-600 mt-1 line-clamp-1">{contentTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-4 md:p-6 overflow-y-auto flex-1">
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

                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      <div className="flex-1 min-w-[180px] relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search students..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Filter size={16} className="text-gray-400 shrink-0" />
                        <select
                          value={classFilter}
                          onChange={(e) => setClassFilter(e.target.value)}
                          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none cursor-pointer"
                        >
                          <option value="all">All Classes</option>
                          <option value="unassigned">Unassigned</option>
                          {availableClasses.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleSelectFiltered}
                        className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        {allFilteredSelected ? 'Deselect All Filtered' : 'Select All Filtered'}
                      </button>
                    </div>

                    <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
                      {(() => {
                        const groups: Record<string, User[]> = {};
                        filteredAvailableStudents.forEach(u => {
                          const className = u.class || 'Unassigned';
                          if (!groups[className]) groups[className] = [];
                          groups[className].push(u);
                        });

                        const sortedClasses = Object.keys(groups).sort((a, b) => {
                          if (a === 'Unassigned') return 1;
                          if (b === 'Unassigned') return -1;
                          return a.localeCompare(b);
                        });

                        if (sortedClasses.length === 0) {
                          return (
                            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg text-sm">
                              No students match the current filter.
                            </div>
                          );
                        }

                        return sortedClasses.map(className => (
                          <div key={className} className="space-y-2">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">{className}</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {groups[className]
                                .sort((a, b) => (a.class_number || 99) - (b.class_number || 99))
                                .map((student) => (
                                  <label
                                    key={student.id}
                                    className={`flex items-center p-3 rounded-lg border transition-all cursor-pointer ${selectedStudents.has(student.id)
                                      ? 'bg-blue-50 border-blue-200'
                                      : 'bg-white border-gray-100 hover:border-gray-200'
                                      }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedStudents.has(student.id)}
                                      onChange={() => handleToggleStudent(student.id)}
                                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <div className="ml-3 min-w-0">
                                      <div className="flex items-baseline gap-2">
                                        {student.class_number && (
                                          <span className="text-[10px] font-bold text-gray-400">#{student.class_number}</span>
                                        )}
                                        <span className="text-sm font-bold text-gray-800 truncate">
                                          {student.display_name || student.username}
                                        </span>
                                      </div>
                                      <span className="text-[9px] text-gray-400 block truncate font-medium uppercase">{student.username}</span>
                                    </div>
                                  </label>
                                ))}
                            </div>
                          </div>
                        ));
                      })()}
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
