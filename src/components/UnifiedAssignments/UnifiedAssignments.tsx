import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertCircle,
  BookOpen,
  Mic,
  FileText,
  Calendar,
  Filter,
} from 'lucide-react';

interface UnifiedAssignment {
  assignment_id: string;
  assignment_type: 'memorization' | 'spelling' | 'proofreading';
  title: string;
  assigned_at: string;
  assigned_by_username: string;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  is_overdue: boolean;
  content_data: any;
}

type FilterType = 'all' | 'memorization' | 'spelling' | 'proofreading';
type FilterStatus = 'all' | 'completed' | 'in_progress' | 'overdue';

interface UnifiedAssignmentsProps {
  onLoadMemorization: (state: any) => void;
  onLoadSpelling: (practice: any) => void;
  onLoadProofreading: (assignment: any) => void;
}

export const UnifiedAssignments: React.FC<UnifiedAssignmentsProps> = ({
  onLoadMemorization,
  onLoadSpelling,
  onLoadProofreading,
}) => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<UnifiedAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  useEffect(() => {
    if (user?.id) {
      fetchAssignments();
    }
  }, [user?.id]);

  const fetchAssignments = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase.rpc('get_student_assignments_unified', {
        target_user_id: user.id,
      });

      if (fetchError) throw fetchError;

      setAssignments(data || []);
    } catch (err) {
      console.error('Error fetching assignments:', err);
      setError('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'memorization':
        return <BookOpen size={20} className="text-purple-600" />;
      case 'spelling':
        return <Mic size={20} className="text-blue-600" />;
      case 'proofreading':
        return <FileText size={20} className="text-green-600" />;
      default:
        return <ClipboardList size={20} />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'memorization':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'spelling':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'proofreading':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusInfo = (assignment: UnifiedAssignment) => {
    if (assignment.completed) {
      return {
        icon: <CheckCircle2 size={18} />,
        text: 'Completed',
        className: 'bg-green-50 text-green-700 border-green-200',
      };
    }

    if (assignment.is_overdue) {
      return {
        icon: <AlertCircle size={18} />,
        text: 'Overdue',
        className: 'bg-red-50 text-red-700 border-red-200',
      };
    }

    return {
      icon: <Clock size={18} />,
      text: 'In Progress',
      className: 'bg-blue-50 text-blue-700 border-blue-200',
    };
  };

  const getDaysUntilDue = (dueDate: string | null) => {
    if (!dueDate) return null;
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleAssignmentClick = (assignment: UnifiedAssignment) => {
    if (assignment.assignment_type === 'memorization') {
      const memorizationState = {
        id: assignment.content_data.content_id,
        originalText: assignment.content_data.original_text,
        selectedWordIndices: assignment.content_data.selected_word_indices,
        words: [],
        title: assignment.title,
        assignmentId: assignment.assignment_id,
      };
      onLoadMemorization(memorizationState);
    } else if (assignment.assignment_type === 'spelling') {
      const spellingPractice = {
        id: assignment.content_data.practice_id,
        practiceId: assignment.content_data.practice_id,
        assignmentId: assignment.assignment_id,
        title: assignment.title,
        words: assignment.content_data.words,
      };
      onLoadSpelling(spellingPractice);
    } else if (assignment.assignment_type === 'proofreading') {
      const proofreadingAssignment = {
        id: assignment.assignment_id,
        practice_id: assignment.content_data.practice_id,
        title: assignment.title,
        sentences: assignment.content_data.sentences,
        answers: assignment.content_data.answers,
      };
      onLoadProofreading(proofreadingAssignment);
    }
  };

  const filteredAssignments = assignments.filter((assignment) => {
    if (filterType !== 'all' && assignment.assignment_type !== filterType) {
      return false;
    }

    if (filterStatus === 'completed' && !assignment.completed) {
      return false;
    }

    if (filterStatus === 'in_progress' && (assignment.completed || assignment.is_overdue)) {
      return false;
    }

    if (filterStatus === 'overdue' && !assignment.is_overdue) {
      return false;
    }

    return true;
  });

  const stats = {
    total: assignments.length,
    completed: assignments.filter((a) => a.completed).length,
    inProgress: assignments.filter((a) => !a.completed && !a.is_overdue).length,
    overdue: assignments.filter((a) => a.is_overdue).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Loading assignments...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">My Assignments</h1>
          <p className="text-slate-600">View and manage all your assignments in one place</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-blue-600">
            <p className="text-sm font-semibold text-slate-600 mb-1">Total</p>
            <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-green-600">
            <p className="text-sm font-semibold text-slate-600 mb-1">Completed</p>
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-yellow-600">
            <p className="text-sm font-semibold text-slate-600 mb-1">In Progress</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.inProgress}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-red-600">
            <p className="text-sm font-semibold text-slate-600 mb-1">Overdue</p>
            <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-8">
          <div className="p-6 border-b border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
              <div className="flex items-center space-x-2">
                <Filter size={20} className="text-slate-400" />
                <span className="font-semibold text-slate-700">Filter Assignments</span>
              </div>
              <div className="flex flex-wrap gap-3">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as FilterType)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                >
                  <option value="all">All Types</option>
                  <option value="memorization">Memorization</option>
                  <option value="spelling">Spelling</option>
                  <option value="proofreading">Proofreading</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                >
                  <option value="all">All Status</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
            </div>
          </div>

          {filteredAssignments.length === 0 ? (
            <div className="p-12 text-center">
              <ClipboardList className="mx-auto text-slate-300 mb-4" size={64} />
              <p className="text-slate-500 text-lg">No assignments found</p>
              <p className="text-slate-400 text-sm mt-2">
                {filterType !== 'all' || filterStatus !== 'all'
                  ? 'Try adjusting your filters'
                  : 'You have no assignments yet'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredAssignments.map((assignment) => {
                const statusInfo = getStatusInfo(assignment);
                const daysUntilDue = getDaysUntilDue(assignment.due_date);

                return (
                  <div
                    key={assignment.assignment_id}
                    onClick={() => handleAssignmentClick(assignment)}
                    className="p-6 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className={`p-2 rounded-lg border ${getTypeColor(assignment.assignment_type)}`}>
                            {getTypeIcon(assignment.assignment_type)}
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-slate-800">{assignment.title}</h3>
                            <p className="text-sm text-slate-500 capitalize">{assignment.assignment_type}</p>
                          </div>
                        </div>

                        <div className="ml-14 space-y-2">
                          {assignment.assigned_by_username && (
                            <p className="text-sm text-slate-600">
                              Assigned by <span className="font-medium">{assignment.assigned_by_username}</span>
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                            <div className="flex items-center space-x-1">
                              <Calendar size={14} />
                              <span>Assigned: {formatDate(assignment.assigned_at)}</span>
                            </div>

                            {assignment.due_date && (
                              <div className="flex items-center space-x-1">
                                <Calendar size={14} />
                                <span>Due: {formatDate(assignment.due_date)}</span>
                                {daysUntilDue !== null && !assignment.completed && (
                                  <span
                                    className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                                      daysUntilDue < 0
                                        ? 'bg-red-100 text-red-700'
                                        : daysUntilDue <= 3
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {daysUntilDue < 0
                                      ? `${Math.abs(daysUntilDue)}d overdue`
                                      : daysUntilDue === 0
                                      ? 'Due today'
                                      : `${daysUntilDue}d left`}
                                  </span>
                                )}
                              </div>
                            )}

                            {assignment.completed_at && (
                              <div className="flex items-center space-x-1 text-green-600">
                                <CheckCircle2 size={14} />
                                <span>Completed: {formatDate(assignment.completed_at)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg border ${statusInfo.className}`}>
                        {statusInfo.icon}
                        <span className="font-medium">{statusInfo.text}</span>
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
  );
};

export default UnifiedAssignments;
