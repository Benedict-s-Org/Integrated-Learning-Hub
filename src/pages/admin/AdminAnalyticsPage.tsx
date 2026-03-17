import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer
} from 'recharts';
import { Trophy, Activity, Users, Clock, Loader2, RefreshCw } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

interface ClassSummary {
  class_name: string;
  spelling: {
    total_practices: number;
    average_accuracy: number;
    total_time_minutes: number;
  };
  proofreading: {
    total_practices: number;
    average_accuracy: number;
    total_time_minutes: number;
  };
  memorization: {
    total_sessions: number;
    total_time_minutes: number;
  };
}

interface StudentPerformance {
  user_id: string;
  display_name: string;
  class: string;
  class_number: number;
  spelling_avg_accuracy: number;
  spelling_practices: number;
  proofreading_avg_accuracy: number;
  proofreading_practices: number;
  memorization_sessions: number;
  total_practices: number;
  overall_avg_accuracy: number;
}

interface ActivityItem {
  activity_type: string;
  user_id: string;
  display_name: string;
  title: string;
  accuracy_percentage: number | null;
  completed_at: string;
}

export function AdminAnalyticsPage() {
  const { isStaff, isLoading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [classSummaries, setClassSummaries] = useState<ClassSummary[]>([]);
  const [studentPerformance, setStudentPerformance] = useState<StudentPerformance[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  
  const [selectedClass, setSelectedClass] = useState<string>('all');

  const fetchAnalytics = async (silently = false) => {
    if (!silently) setLoading(true);
    setError(null);
    try {
      // 1. Fetch Class Summaries
      const { data: summaryData, error: summaryError } = await supabase.rpc('get_class_analytics_summary');
      if (summaryError) throw summaryError;
      
      const parsedSummaries = Array.isArray(summaryData) ? summaryData.map((d: any) => ({
        class_name: d.class_name || 'Unassigned',
        spelling: d.spelling || { total_practices: 0, average_accuracy: 0, total_time_minutes: 0 },
        proofreading: d.proofreading || { total_practices: 0, average_accuracy: 0, total_time_minutes: 0 },
        memorization: d.memorization || { total_sessions: 0, total_time_minutes: 0 }
      })) : [];
      
      const validSummaries = parsedSummaries.filter((c: any) => 
        c.class_name !== 'Unassigned' || 
        c.spelling.total_practices > 0 || 
        c.proofreading.total_practices > 0 || 
        c.memorization.total_sessions > 0
      );
      setClassSummaries(validSummaries.sort((a: any, b: any) => a.class_name.localeCompare(b.class_name)));
      
      if (selectedClass !== 'all' && !validSummaries.find((s: any) => s.class_name === selectedClass)) {
          setSelectedClass('all');
      }

      // 2. Fetch All Students Performance
      const { data: performanceData, error: performanceError } = await supabase.rpc('get_all_students_performance', { 
        p_class_name: selectedClass === 'all' ? null : selectedClass 
      });
      if (performanceError) throw performanceError;
      setStudentPerformance(performanceData || []);

      // 3. Fetch Recent Activity
      const { data: activityData, error: activityError } = await supabase.rpc('get_recent_activity', { 
        limit_count: 50 
      });
      if (activityError) throw activityError;
      setRecentActivity(activityData || []);

    } catch (err: any) {
      console.error("Error fetching analytics:", err);
      setError(err.message || 'Failed to load analytics data.');
    } finally {
      if (!silently) setLoading(false);
    }
  };

  useEffect(() => {
    if (isStaff) {
      fetchAnalytics();
    }
  }, [isStaff, selectedClass]);

  if (authLoading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="animate-spin text-blue-500" size={48} />
    </div>
  );

  if (!isStaff) return <div className="p-8 text-center text-red-500">Access Denied</div>;

  // Chart Data Preparation
  const chartData = classSummaries.map(c => ({
    name: c.class_name,
    Spelling: c.spelling.total_practices,
    Proofreading: c.proofreading.total_practices,
    Memorization: c.memorization.total_sessions,
  }));

  const accuracyData = classSummaries.map(c => ({
    name: c.class_name,
    'Spelling Acc %': Math.round(c.spelling.average_accuracy),
    'Proofreading Acc %': Math.round(c.proofreading.average_accuracy),
  }));

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
      <div className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Activity className="text-blue-500" />
              Foundational Analytics Dashboard
            </h1>
            <p className="text-slate-500 text-sm mt-1">Metrics for Spelling, Proofreading, and Memorization</p>
          </div>
          
          <div className="flex items-center gap-4">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="bg-white border border-slate-300 rounded-md px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Classes</option>
              {classSummaries.map(c => (
                <option key={c.class_name} value={c.class_name}>{c.class_name}</option>
              ))}
            </select>
            <button 
              onClick={() => fetchAnalytics(false)}
              disabled={loading}
              className="p-2 bg-white rounded-md shadow-sm border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        {loading && !classSummaries.length ? (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-blue-500" size={48} />
            </div>
        ) : (
            <>
                {/* Global KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                      <Users className="text-blue-600" size={24} />
                    </div>
                    <p className="text-sm font-medium text-slate-500">Active Students</p>
                    <h3 className="text-3xl font-bold text-slate-800 mt-1">{studentPerformance.length}</h3>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-3">
                      <Trophy className="text-emerald-600" size={24} />
                    </div>
                    <p className="text-sm font-medium text-slate-500">Spelling Avg Acc.</p>
                    <h3 className="text-3xl font-bold text-slate-800 mt-1">
                      {Math.round(studentPerformance.reduce((acc, curr) => acc + (curr.spelling_avg_accuracy || 0), 0) / (studentPerformance.filter(s => s.spelling_avg_accuracy > 0).length || 1))}%
                    </h3>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-3">
                      <Activity className="text-purple-600" size={24} />
                    </div>
                    <p className="text-sm font-medium text-slate-500">Proofreading Avg Acc.</p>
                    <h3 className="text-3xl font-bold text-slate-800 mt-1">
                       {Math.round(studentPerformance.reduce((acc, curr) => acc + (curr.proofreading_avg_accuracy || 0), 0) / (studentPerformance.filter(s => s.proofreading_avg_accuracy > 0).length || 1))}%
                    </h3>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-3">
                      <Clock className="text-orange-600" size={24} />
                    </div>
                    <p className="text-sm font-medium text-slate-500">Total Practice Sessions</p>
                    <h3 className="text-3xl font-bold text-slate-800 mt-1">
                      {studentPerformance.reduce((acc, curr) => acc + (curr.spelling_practices || 0) + (curr.proofreading_practices || 0) + (curr.memorization_sessions || 0), 0)}
                    </h3>
                  </div>
                </div>

                {/* Charts Area */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Volume Chart */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Practice Volume by Class</h3>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} />
                          <YAxis axisLine={false} tickLine={false} />
                          <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                          <Legend wrapperStyle={{ paddingTop: '20px' }} />
                          <Bar dataKey="Spelling" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Proofreading" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Memorization" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Accuracy Chart */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Average Accuracy by Class (%)</h3>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={accuracyData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} />
                          <YAxis axisLine={false} tickLine={false} domain={[0, 100]} />
                          <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                          <Legend wrapperStyle={{ paddingTop: '20px' }} />
                          <Bar dataKey="Spelling Acc %" fill="#10B981" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Proofreading Acc %" fill="#6366F1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Bottom Section: Leaderboard & Feed */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Leaderboard */}
                  <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                      <h3 className="text-lg font-bold text-slate-800">Student Leaderboard</h3>
                      <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Top Performers</span>
                    </div>
                    <div className="overflow-x-auto flex-1 h-[400px]">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-white sticky top-0 shadow-sm z-10 text-slate-500 uppercase text-xs font-semibold">
                          <tr>
                            <th className="px-4 py-3">Student</th>
                            <th className="px-4 py-3 text-center">Spell Acc</th>
                            <th className="px-4 py-3 text-center">Spell Vol</th>
                            <th className="px-4 py-3 text-center">Proof Acc</th>
                            <th className="px-4 py-3 text-center">Proof Vol</th>
                            <th className="px-4 py-3 text-center">Mem Vol</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {studentPerformance
                              .sort((a,b) => (b.spelling_practices + b.proofreading_practices) - (a.spelling_practices + a.proofreading_practices))
                              .map((student, idx) => (
                            <tr key={student.user_id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 font-medium text-slate-800">
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-400 font-normal w-4">{idx + 1}.</span>
                                  {student.display_name} 
                                  <span className="text-xs text-slate-400">({student.class})</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-block px-2 py-1 rounded-md text-xs font-bold ${student.spelling_avg_accuracy >= 90 ? 'bg-emerald-100 text-emerald-700' : student.spelling_avg_accuracy >= 70 ? 'bg-amber-100 text-amber-700' : student.spelling_practices > 0 ? 'bg-red-100 text-red-700' : 'text-slate-400'}`}>
                                  {student.spelling_practices > 0 ? `${Math.round(student.spelling_avg_accuracy)}%` : '-'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center text-slate-600">{student.spelling_practices || '-'}</td>
                              <td className="px-4 py-3 text-center">
                                 <span className={`inline-block px-2 py-1 rounded-md text-xs font-bold ${student.proofreading_avg_accuracy >= 90 ? 'bg-emerald-100 text-emerald-700' : student.proofreading_avg_accuracy >= 70 ? 'bg-amber-100 text-amber-700' : student.proofreading_practices > 0 ? 'bg-red-100 text-red-700' : 'text-slate-400'}`}>
                                  {student.proofreading_practices > 0 ? `${Math.round(student.proofreading_avg_accuracy)}%` : '-'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center text-slate-600">{student.proofreading_practices || '-'}</td>
                              <td className="px-4 py-3 text-center text-slate-600">{student.memorization_sessions || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Recent Activity Feed */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                      <h3 className="text-lg font-bold text-slate-800">Live Activity feed</h3>
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    </div>
                    <div className="p-4 flex-1 h-[400px] overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-slate-200">
                      {recentActivity.length === 0 ? (
                        <div className="text-center text-slate-500 py-8">No recent activity found.</div>
                      ) : (
                        recentActivity.map((activity, i) => {
                          const isSpelling = activity.activity_type === 'spelling';
                          const isProofreading = activity.activity_type === 'proofreading';
                          
                          let dateLabel = "Recent";
                          try {
                            if (activity.completed_at) {
                              dateLabel = formatDistanceToNow(parseISO(activity.completed_at), { addSuffix: true });
                            }
                          } catch (e) {
                            console.error("Date parsing error:", e);
                          }

                          return (
                            <div key={i} className="flex gap-3 items-start group">
                              <div className={`mt-1 p-2 rounded-full flex-shrink-0 ${isSpelling ? 'bg-blue-100 text-blue-600' : isProofreading ? 'bg-purple-100 text-purple-600' : 'bg-orange-100 text-orange-600'}`}>
                                <Activity size={16} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-800 capitalize truncate">
                                  {activity.display_name} <span className="font-normal text-slate-500">completed {activity.activity_type}</span>
                                </p>
                                <p className="text-xs text-slate-500 truncate mt-0.5">{activity.title}</p>
                                {activity.accuracy_percentage !== null && activity.accuracy_percentage !== undefined && (
                                   <p className="text-xs font-bold text-emerald-600 mt-1">Score: {Math.round(activity.accuracy_percentage)}%</p>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 whitespace-nowrap pt-1">
                                {dateLabel}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                </div>
            </>
        )}
      </div>
    </div>
  );
}
