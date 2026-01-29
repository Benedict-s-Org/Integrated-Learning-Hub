import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Users,
  Target,
  FileEdit,
  Clock,
  Calendar,
  Search,
  TrendingUp,
  TrendingDown,
  Activity,
  Award,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

type TabType = 'overview' | 'students' | 'spelling' | 'proofreading' | 'memorization' | 'activity';

interface ClassAnalyticsSummary {
  total_students: number;
  active_students: number;
  inactive_students: number;
  spelling: {
    total_practices: number;
    unique_students: number;
    average_accuracy: number;
    median_accuracy: number;
    best_score: number;
    worst_score: number;
    total_time_hours: number;
    avg_time_minutes: number;
    score_distribution: {
      excellent: number;
      good: number;
      needs_improvement: number;
    };
  };
  proofreading: {
    total_practices: number;
    unique_students: number;
    average_accuracy: number;
    median_accuracy: number;
    best_score: number;
    worst_score: number;
    total_time_hours: number;
    avg_time_minutes: number;
    score_distribution: {
      excellent: number;
      good: number;
      needs_improvement: number;
    };
  };
  memorization: {
    total_sessions: number;
    unique_students: number;
    total_words_practiced: number;
    avg_words_per_session: number;
    total_time_hours: number;
    avg_time_minutes: number;
  };
}

interface StudentPerformance {
  user_id: string;
  username: string;
  display_name: string;
  spelling_practices: number;
  spelling_avg_accuracy: number;
  proofreading_practices: number;
  proofreading_avg_accuracy: number;
  memorization_sessions: number;
  total_practices: number;
  overall_avg_accuracy: number;
  last_activity: string;
  total_time_minutes: number;
}

interface ActivityTimelineEntry {
  activity_date: string;
  spelling_count: number;
  proofreading_count: number;
  memorization_count: number;
  total_count: number;
  unique_students: number;
}

interface RecentActivity {
  activity_type: string;
  user_id: string;
  username: string;
  display_name: string;
  title: string;
  accuracy_percentage: number | null;
  completed_at: string;
}

interface PerformanceDistribution {
  score_range: string;
  student_count: number;
  percentage: number;
}

const UserAnalytics: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  const [classSummary, setClassSummary] = useState<ClassAnalyticsSummary | null>(null);
  const [students, setStudents] = useState<StudentPerformance[]>([]);
  const [activityTimeline, setActivityTimeline] = useState<ActivityTimelineEntry[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [spellingDistribution, setSpellingDistribution] = useState<PerformanceDistribution[]>([]);
  const [proofreadingDistribution, setProofreadingDistribution] = useState<PerformanceDistribution[]>([]);

  useEffect(() => {
    if (user && user.role === 'admin') {
      loadAllAnalytics();
    }
  }, [user]);

  const loadAllAnalytics = async () => {
    setLoading(true);
    try {
      const [summaryData, studentsData, timelineData, recentData, spellingDist, proofreadingDist] = await Promise.all([
        supabase.rpc('get_class_analytics_summary'),
        supabase.rpc('get_all_students_performance'),
        supabase.rpc('get_practice_activity_timeline', { days_back: 30 }),
        supabase.rpc('get_recent_activity', { limit_count: 20 }),
        supabase.rpc('get_performance_distribution', { practice_type: 'spelling' }),
        supabase.rpc('get_performance_distribution', { practice_type: 'proofreading' }),
      ]);

      if (summaryData.data) setClassSummary(summaryData.data);
      if (studentsData.data) setStudents(studentsData.data);
      if (timelineData.data) setActivityTimeline(timelineData.data);
      if (recentData.data) setRecentActivity(recentData.data);
      if (spellingDist.data) setSpellingDistribution(spellingDist.data);
      if (proofreadingDist.data) setProofreadingDistribution(proofreadingDist.data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 90) return 'bg-green-100';
    if (score >= 70) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const filteredStudents = students.filter(
    (student) =>
      student.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="pt-20 min-h-screen bg-gray-50 pr-8" style={{ fontFamily: 'Times New Roman, serif' }}>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center text-gray-600">Loading analytics data...</div>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="pt-20 min-h-screen bg-gray-50 pr-8" style={{ fontFamily: 'Times New Roman, serif' }}>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center text-gray-600">Access denied. Admin privileges required.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 min-h-screen bg-gray-50 pr-8" style={{ fontFamily: 'Times New Roman, serif' }}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">User Analytics Dashboard</h1>
          <p className="text-gray-600">Comprehensive performance insights across all students</p>
        </div>

        <div className="flex space-x-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'students', label: 'Students', icon: Users },
            { id: 'spelling', label: 'Spelling', icon: Target },
            { id: 'proofreading', label: 'Proofreading', icon: FileEdit },
            { id: 'memorization', label: 'Memorization', icon: Clock },
            { id: 'activity', label: 'Activity', icon: Activity },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as TabType)}
              className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {activeTab === 'overview' && classSummary && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Class Size</h3>
                  <Users className="text-blue-600" size={32} />
                </div>
                <div className="text-4xl font-bold text-gray-900 mb-2">{classSummary.total_students}</div>
                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center space-x-1 text-green-600">
                    <TrendingUp size={16} />
                    <span>{classSummary.active_students} active</span>
                  </div>
                  {classSummary.inactive_students > 0 && (
                    <div className="flex items-center space-x-1 text-red-600">
                      <AlertCircle size={16} />
                      <span>{classSummary.inactive_students} inactive</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Total Practices</h3>
                  <BarChart3 className="text-green-600" size={32} />
                </div>
                <div className="text-4xl font-bold text-gray-900 mb-2">
                  {classSummary.spelling.total_practices +
                    classSummary.proofreading.total_practices +
                    classSummary.memorization.total_sessions}
                </div>
                <div className="text-sm text-gray-600">
                  Across {classSummary.spelling.total_practices + classSummary.proofreading.total_practices + classSummary.memorization.total_sessions > 0 ? 'all' : 'no'} practice types
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Total Time</h3>
                  <Clock className="text-yellow-600" size={32} />
                </div>
                <div className="text-4xl font-bold text-gray-900 mb-2">
                  {(classSummary.spelling.total_time_hours +
                    classSummary.proofreading.total_time_hours +
                    classSummary.memorization.total_time_hours).toFixed(1)}h
                </div>
                <div className="text-sm text-gray-600">Combined practice time</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Spelling</h3>
                  <Target className="text-blue-600" size={28} />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Practices:</span>
                    <span className="font-semibold text-gray-900">{classSummary.spelling.total_practices}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Avg Accuracy:</span>
                    <span className={`font-semibold ${getScoreColor(classSummary.spelling.average_accuracy)}`}>
                      {classSummary.spelling.average_accuracy}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Median:</span>
                    <span className="font-semibold text-gray-700">{classSummary.spelling.median_accuracy}%</span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-xs text-gray-500 mb-2">Score Distribution</div>
                    <div className="flex space-x-1">
                      <div
                        className="bg-green-500 h-2 rounded"
                        style={{ width: `${(classSummary.spelling.score_distribution.excellent / classSummary.spelling.total_practices) * 100}%` }}
                        title="Excellent (90+)"
                      />
                      <div
                        className="bg-yellow-500 h-2 rounded"
                        style={{ width: `${(classSummary.spelling.score_distribution.good / classSummary.spelling.total_practices) * 100}%` }}
                        title="Good (70-89)"
                      />
                      <div
                        className="bg-red-500 h-2 rounded"
                        style={{ width: `${(classSummary.spelling.score_distribution.needs_improvement / classSummary.spelling.total_practices) * 100}%` }}
                        title="Needs Improvement (<70)"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Proofreading</h3>
                  <FileEdit className="text-yellow-600" size={28} />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Practices:</span>
                    <span className="font-semibold text-gray-900">{classSummary.proofreading.total_practices}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Avg Accuracy:</span>
                    <span className={`font-semibold ${getScoreColor(classSummary.proofreading.average_accuracy)}`}>
                      {classSummary.proofreading.average_accuracy}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Median:</span>
                    <span className="font-semibold text-gray-700">{classSummary.proofreading.median_accuracy}%</span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-xs text-gray-500 mb-2">Score Distribution</div>
                    <div className="flex space-x-1">
                      <div
                        className="bg-green-500 h-2 rounded"
                        style={{ width: `${(classSummary.proofreading.score_distribution.excellent / classSummary.proofreading.total_practices) * 100}%` }}
                        title="Excellent (90+)"
                      />
                      <div
                        className="bg-yellow-500 h-2 rounded"
                        style={{ width: `${(classSummary.proofreading.score_distribution.good / classSummary.proofreading.total_practices) * 100}%` }}
                        title="Good (70-89)"
                      />
                      <div
                        className="bg-red-500 h-2 rounded"
                        style={{ width: `${(classSummary.proofreading.score_distribution.needs_improvement / classSummary.proofreading.total_practices) * 100}%` }}
                        title="Needs Improvement (<70)"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Memorization</h3>
                  <Clock className="text-green-600" size={28} />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Sessions:</span>
                    <span className="font-semibold text-gray-900">{classSummary.memorization.total_sessions}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Words Practiced:</span>
                    <span className="font-semibold text-gray-900">{classSummary.memorization.total_words_practiced}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Avg Words/Session:</span>
                    <span className="font-semibold text-gray-700">{classSummary.memorization.avg_words_per_session}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Time:</span>
                    <span className="font-semibold text-gray-700">{classSummary.memorization.total_time_hours}h</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-semibold text-gray-800">Recent Activity</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Student</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Title</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Score</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {recentActivity.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                          No recent activity
                        </td>
                      </tr>
                    ) : (
                      recentActivity.map((activity, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">{activity.display_name}</td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                                activity.activity_type === 'spelling'
                                  ? 'bg-blue-100 text-blue-700'
                                  : activity.activity_type === 'proofreading'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-green-100 text-green-700'
                              }`}
                            >
                              {activity.activity_type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{activity.title}</td>
                          <td className="px-6 py-4">
                            {activity.accuracy_percentage !== null ? (
                              <span className={`text-sm font-semibold ${getScoreColor(activity.accuracy_percentage)}`}>
                                {activity.accuracy_percentage}%
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">N/A</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{formatDateTime(activity.completed_at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'students' && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search students by name or username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Student</th>
                      <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Spelling</th>
                      <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Proofreading</th>
                      <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Memorization</th>
                      <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Total</th>
                      <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Avg Score</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Last Activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                          {searchQuery ? 'No students found matching your search' : 'No students yet'}
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((student) => (
                        <tr key={student.user_id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{student.display_name}</div>
                              <div className="text-xs text-gray-500">@{student.username}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="text-sm text-gray-900">{student.spelling_practices}</div>
                            {student.spelling_practices > 0 && (
                              <div className={`text-xs font-medium ${getScoreColor(student.spelling_avg_accuracy)}`}>
                                {student.spelling_avg_accuracy}%
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="text-sm text-gray-900">{student.proofreading_practices}</div>
                            {student.proofreading_practices > 0 && (
                              <div className={`text-xs font-medium ${getScoreColor(student.proofreading_avg_accuracy)}`}>
                                {student.proofreading_avg_accuracy}%
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="text-sm text-gray-900">{student.memorization_sessions}</div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="text-sm font-semibold text-gray-900">{student.total_practices}</div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {student.overall_avg_accuracy > 0 ? (
                              <span className={`text-sm font-semibold ${getScoreColor(student.overall_avg_accuracy)}`}>
                                {student.overall_avg_accuracy}%
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">N/A</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {student.last_activity ? formatDate(student.last_activity) : 'Never'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'spelling' && classSummary && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Total Practices</div>
                <div className="text-3xl font-bold text-gray-900">{classSummary.spelling.total_practices}</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Average Score</div>
                <div className={`text-3xl font-bold ${getScoreColor(classSummary.spelling.average_accuracy)}`}>
                  {classSummary.spelling.average_accuracy}%
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Best Score</div>
                <div className="text-3xl font-bold text-green-600">{classSummary.spelling.best_score}%</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Total Time</div>
                <div className="text-3xl font-bold text-gray-900">{classSummary.spelling.total_time_hours}h</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Performance Distribution</h3>
              <div className="space-y-3">
                {spellingDistribution.map((range) => (
                  <div key={range.score_range}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{range.score_range}%</span>
                      <span className="text-gray-600">
                        {range.student_count} students ({range.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          range.score_range === '90-100'
                            ? 'bg-green-500'
                            : range.score_range === '80-89'
                            ? 'bg-blue-500'
                            : range.score_range === '70-79'
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${range.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'proofreading' && classSummary && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Total Practices</div>
                <div className="text-3xl font-bold text-gray-900">{classSummary.proofreading.total_practices}</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Average Score</div>
                <div className={`text-3xl font-bold ${getScoreColor(classSummary.proofreading.average_accuracy)}`}>
                  {classSummary.proofreading.average_accuracy}%
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Best Score</div>
                <div className="text-3xl font-bold text-green-600">{classSummary.proofreading.best_score}%</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Total Time</div>
                <div className="text-3xl font-bold text-gray-900">{classSummary.proofreading.total_time_hours}h</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Performance Distribution</h3>
              <div className="space-y-3">
                {proofreadingDistribution.map((range) => (
                  <div key={range.score_range}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{range.score_range}%</span>
                      <span className="text-gray-600">
                        {range.student_count} students ({range.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          range.score_range === '90-100'
                            ? 'bg-green-500'
                            : range.score_range === '80-89'
                            ? 'bg-blue-500'
                            : range.score_range === '70-79'
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${range.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'memorization' && classSummary && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Total Sessions</div>
                <div className="text-3xl font-bold text-gray-900">{classSummary.memorization.total_sessions}</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Words Practiced</div>
                <div className="text-3xl font-bold text-gray-900">{classSummary.memorization.total_words_practiced}</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Avg Words/Session</div>
                <div className="text-3xl font-bold text-gray-900">{classSummary.memorization.avg_words_per_session}</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Total Time</div>
                <div className="text-3xl font-bold text-gray-900">{classSummary.memorization.total_time_hours}h</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Last 30 Days Activity</h3>
              <div className="h-64 flex items-end space-x-1">
                {activityTimeline.map((day, index) => {
                  const maxCount = Math.max(...activityTimeline.map((d) => d.total_count), 1);
                  const height = (day.total_count / maxCount) * 100;
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div className="relative w-full flex flex-col-reverse items-center">
                        {day.spelling_count > 0 && (
                          <div
                            className="w-full bg-blue-500 hover:bg-blue-600 transition-colors"
                            style={{ height: `${(day.spelling_count / maxCount) * 200}px` }}
                            title={`Spelling: ${day.spelling_count}`}
                          />
                        )}
                        {day.proofreading_count > 0 && (
                          <div
                            className="w-full bg-yellow-500 hover:bg-yellow-600 transition-colors"
                            style={{ height: `${(day.proofreading_count / maxCount) * 200}px` }}
                            title={`Proofreading: ${day.proofreading_count}`}
                          />
                        )}
                        {day.memorization_count > 0 && (
                          <div
                            className="w-full bg-green-500 hover:bg-green-600 transition-colors"
                            style={{ height: `${(day.memorization_count / maxCount) * 200}px` }}
                            title={`Memorization: ${day.memorization_count}`}
                          />
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-2 transform -rotate-45 origin-left whitespace-nowrap">
                        {new Date(day.activity_date).getMonth() + 1}/{new Date(day.activity_date).getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-center space-x-6 mt-6 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-blue-500 rounded" />
                  <span>Spelling</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-yellow-500 rounded" />
                  <span>Proofreading</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-green-500 rounded" />
                  <span>Memorization</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserAnalytics;
