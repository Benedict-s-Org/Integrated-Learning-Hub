import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  Search,
  FileText,
  Mic,
  BookOpen,
  Calendar,
  User,
  TrendingUp,
  XCircle,
} from 'lucide-react';

interface AssignmentOverview {
  memorization: {
    total: number;
    completed: number;
    in_progress: number;
    overdue: number;
    completion_rate: number;
  };
  spelling: {
    total: number;
    completed: number;
    in_progress: number;
    overdue: number;
    completion_rate: number;
  };
  proofreading: {
    total: number;
    completed: number;
    in_progress: number;
    overdue: number;
    completion_rate: number;
  };
  total_across_all_types: {
    total: number;
    completed: number;
    in_progress: number;
    overdue: number;
  };
}

interface Assignment {
  assignment_id: string;
  assignment_type: 'memorization' | 'spelling' | 'proofreading';
  student_id: string;
  student_username: string;
  student_display_name: string;
  title: string;
  assigned_at: string;
  assigned_by_username: string;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  is_overdue: boolean;
}

interface Student {
  id: string;
  username: string;
  display_name: string;
}

export const AssignmentManagement: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [overview, setOverview] = useState<AssignmentOverview | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterStudent, setFilterStudent] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>('assigned_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchAssignments();
    }
  }, [filterType, filterStatus, filterStudent, sortBy, sortOrder]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchOverview(),
        fetchAssignments(),
        fetchStudents(),
      ]);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load assignment data');
    } finally {
      setLoading(false);
    }
  };

  const fetchOverview = async () => {
    const { data, error } = await supabase.rpc('get_all_assignments_overview');

    if (error) {
      console.error('Error fetching overview:', error);
      throw error;
    }

    setOverview(data);
  };

  const fetchAssignments = async () => {
    const { data, error } = await supabase.rpc('get_all_assignments_admin_view', {
      filter_type: filterType === 'all' ? null : filterType,
      filter_status: filterStatus === 'all' ? null : filterStatus,
      filter_student_id: filterStudent === 'all' ? null : filterStudent,
      sort_by: sortBy,
      sort_order: sortOrder,
    });

    if (error) {
      console.error('Error fetching assignments:', error);
      throw error;
    }

    setAssignments(data || []);
  };

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, display_name')
      .eq('role', 'user')
      .order('display_name');

    if (error) {
      console.error('Error fetching students:', error);
      throw error;
    }

    setStudents(data || []);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'memorization':
        return <BookOpen size={16} />;
      case 'spelling':
        return <Mic size={16} />;
      case 'proofreading':
        return <FileText size={16} />;
      default:
        return <ClipboardList size={16} />;
    }
  };

  const getStatusBadge = (assignment: Assignment) => {
    if (assignment.completed) {
      return (
        <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <CheckCircle2 size={14} />
          <span>Completed</span>
        </span>
      );
    }

    if (assignment.is_overdue) {
      return (
        <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <AlertCircle size={14} />
          <span>Overdue</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
        <Clock size={14} />
        <span>In Progress</span>
      </span>
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No due date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getDaysUntilDue = (dueDate: string | null) => {
    if (!dueDate) return null;
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const filteredAssignments = assignments.filter((assignment) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        assignment.title.toLowerCase().includes(query) ||
        assignment.student_display_name.toLowerCase().includes(query) ||
        assignment.student_username.toLowerCase().includes(query)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Denied</h2>
          <p className="text-slate-600">You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8"
      data-source-tsx="AssignmentManagement|src/components/AssignmentManagement/AssignmentManagement.tsx"
    >
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Assignment Management</h1>
          <p className="text-slate-600">Track and manage all student assignments</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {overview && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-600">Total Assignments</h3>
                <ClipboardList className="text-blue-600" size={24} />
              </div>
              <p className="text-3xl font-bold text-slate-800">
                {overview.total_across_all_types.total}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {overview.total_across_all_types.completed} completed
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-600">In Progress</h3>
                <Clock className="text-blue-600" size={24} />
              </div>
              <p className="text-3xl font-bold text-slate-800">
                {overview.total_across_all_types.in_progress}
              </p>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-slate-500">Memorization: {overview.memorization.in_progress}</p>
                <p className="text-xs text-slate-500">Spelling: {overview.spelling.in_progress}</p>
                <p className="text-xs text-slate-500">Proofreading: {overview.proofreading.in_progress}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-600">Overdue</h3>
                <AlertCircle className="text-red-600" size={24} />
              </div>
              <p className="text-3xl font-bold text-red-600">
                {overview.total_across_all_types.overdue}
              </p>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-slate-500">Memorization: {overview.memorization.overdue}</p>
                <p className="text-xs text-slate-500">Spelling: {overview.spelling.overdue}</p>
                <p className="text-xs text-slate-500">Proofreading: {overview.proofreading.overdue}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-600">Completion Rate</h3>
                <TrendingUp className="text-green-600" size={24} />
              </div>
              <p className="text-3xl font-bold text-slate-800">
                {overview.total_across_all_types.total > 0
                  ? Math.round((overview.total_across_all_types.completed / overview.total_across_all_types.total) * 100)
                  : 0}%
              </p>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-slate-500">Memorization: {overview.memorization.completion_rate}%</p>
                <p className="text-xs text-slate-500">Spelling: {overview.spelling.completion_rate}%</p>
                <p className="text-xs text-slate-500">Proofreading: {overview.proofreading.completion_rate}%</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="text"
                  placeholder="Search by title or student name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                >
                  <option value="all">All Types</option>
                  <option value="memorization">Memorization</option>
                  <option value="spelling">Spelling</option>
                  <option value="proofreading">Proofreading</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                >
                  <option value="all">All Status</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="overdue">Overdue</option>
                </select>

                <select
                  value={filterStudent}
                  onChange={(e) => setFilterStudent(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                >
                  <option value="all">All Students</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.display_name || student.username}
                    </option>
                  ))}
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                >
                  <option value="assigned_at">Sort by Assigned Date</option>
                  <option value="due_date">Sort by Due Date</option>
                  <option value="student_name">Sort by Student</option>
                </select>

                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                  title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>
          </div>

          {filteredAssignments.length === 0 ? (
            <div className="p-12 text-center">
              <ClipboardList className="mx-auto text-slate-300 mb-4" size={64} />
              <p className="text-slate-500 text-lg">No assignments found</p>
              <p className="text-slate-400 text-sm mt-2">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Student</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Assignment</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Type</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Assigned</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Due Date</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Status</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssignments.map((assignment) => {
                    const daysUntilDue = getDaysUntilDue(assignment.due_date);

                    return (
                      <tr key={assignment.assignment_id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <User size={16} className="text-slate-400" />
                            <div>
                              <div className="font-medium text-slate-800">{assignment.student_display_name}</div>
                              <div className="text-xs text-slate-500">@{assignment.student_username}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-800">{assignment.title}</div>
                          {assignment.assigned_by_username && (
                            <div className="text-xs text-slate-500">by {assignment.assigned_by_username}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                            {getTypeIcon(assignment.assignment_type)}
                            <span className="capitalize">{assignment.assignment_type}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          <div className="flex items-center space-x-1">
                            <Calendar size={14} />
                            <span>{formatDate(assignment.assigned_at)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {assignment.due_date ? (
                            <div>
                              <div className="flex items-center space-x-1">
                                <Calendar size={14} />
                                <span>{formatDate(assignment.due_date)}</span>
                              </div>
                              {daysUntilDue !== null && !assignment.completed && (
                                <div className={`text-xs mt-1 ${
                                  daysUntilDue < 0 ? 'text-red-600' : daysUntilDue <= 3 ? 'text-orange-600' : 'text-slate-500'
                                }`}>
                                  {daysUntilDue < 0
                                    ? `${Math.abs(daysUntilDue)} days overdue`
                                    : daysUntilDue === 0
                                    ? 'Due today'
                                    : `Due in ${daysUntilDue} days`}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">No due date</span>
                          )}
                        </td>
                        <td className="px-6 py-4">{getStatusBadge(assignment)}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {assignment.completed_at ? formatDate(assignment.completed_at) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
            <p className="text-sm text-slate-600">
              Showing {filteredAssignments.length} of {assignments.length} assignments
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignmentManagement;
