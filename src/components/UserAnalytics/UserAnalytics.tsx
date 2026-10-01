import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Users,
  Target,
  FileEdit,
  Clock,
  Search,
  TrendingUp,
  Activity,
  AlertCircle,
  Zap,
  Archive,
  Filter,
  CheckCircle2,
  RefreshCw,
  Download,
  GraduationCap,
  Sparkles,
  BookOpen,
  Eye,
  ArrowUpDown,
  CheckCircle,
  XCircle,
  HelpCircle,
  MinusCircle,
  Lightbulb
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { StudentActivityDetail } from './StudentActivityDetail';
import { StudentProofreadingDetailModal } from './StudentProofreadingDetailModal';
import { isArchivedClassName } from '../../utils/archiveClassExporter';
import * as XLSX from 'xlsx';

type TabType = 'overview' | 'students' | 'spelling' | 'proofreading' | 'memorization' | 'spaced_repetition' | 'activity';
type UserScope = 'active' | 'archived' | 'all';

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
  spaced_repetition: {
    total_practices: number;
    unique_students: number;
    average_accuracy: number;
    total_time_hours: number;
    avg_time_minutes: number;
  };
}

interface StudentPerformance {
  user_id: string;
  username: string;
  display_name: string;
  class: string;
  class_number: number;
  spelling_practices: number;
  spelling_avg_accuracy: number;
  proofreading_practices: number;
  proofreading_avg_accuracy: number;
  memorization_sessions: number;
  sr_attempts: number;
  sr_avg_accuracy: number;
  reading_attempts: number;
  reading_perfect_count: number;
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
  spaced_repetition_count: number;
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
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Scope and class filters
  const [userScope, setUserScope] = useState<UserScope>('active');
  const [selectedClass, setSelectedClass] = useState<string>('all');

  // Student detail modal state
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStudentName, setSelectedStudentName] = useState('');
  const [selectedStudentClass, setSelectedStudentClass] = useState('');
  const [selectedStudentIsArchived, setSelectedStudentIsArchived] = useState(false);

  // Proofreading Student Detail Modal state
  const [proofreadingDetailStudent, setProofreadingDetailStudent] = useState<{
    userId: string;
    studentName: string;
    className?: string;
    isArchived?: boolean;
  } | null>(null);

  // Proofreading Tab Filters
  const [prSearchQuery, setPrSearchQuery] = useState('');
  const [prStatusFilter, setPrStatusFilter] = useState<'all' | 'practiced' | 'needs_help' | 'excellent' | 'not_attempted'>('all');
  const [prSortOrder, setPrSortOrder] = useState<'practices_desc' | 'accuracy_asc' | 'accuracy_desc' | 'name'>('practices_desc');

  // Raw data from DB
  const [classSummary, setClassSummary] = useState<ClassAnalyticsSummary | null>(null);
  const [students, setStudents] = useState<StudentPerformance[]>([]);
  const [activityTimeline, setActivityTimeline] = useState<ActivityTimelineEntry[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [spellingDistribution, setSpellingDistribution] = useState<PerformanceDistribution[]>([]);
  const [proofreadingDistribution, setProofreadingDistribution] = useState<PerformanceDistribution[]>([]);
  const [srDistribution, setSrDistribution] = useState<PerformanceDistribution[]>([]);
  const [allDbClasses, setAllDbClasses] = useState<{ id?: string; name: string; is_archived: boolean }[]>([]);
  const [archivedClasses, setArchivedClasses] = useState<string[]>([]);

  useEffect(() => {
    if (user && user.role === 'admin') {
      loadAllAnalytics();
    }
  }, [user]);

  const loadAllAnalytics = async (isSilent = false) => {
    if (isSilent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const [
        summaryData, 
        studentsData, 
        timelineData, 
        recentData, 
        spellingDist, 
        proofreadingDist, 
        srDist,
        classesData
      ] = await Promise.all([
        (supabase as any).rpc('get_overall_analytics_summary'),
        (supabase as any).rpc('get_all_students_performance'),
        (supabase as any).rpc('get_practice_activity_timeline', { days_back: 30 }),
        (supabase as any).rpc('get_recent_activity', { limit_count: 50 }),
        (supabase as any).rpc('get_performance_distribution', { practice_type: 'spelling' }),
        (supabase as any).rpc('get_performance_distribution', { practice_type: 'proofreading' }),
        (supabase as any).rpc('get_performance_distribution', { practice_type: 'spaced_repetition' }),
        (supabase as any).from('classes').select('id, name, is_archived, academic_year, order_index').order('order_index')
      ]);

      if (summaryData.data) setClassSummary(summaryData.data);
      if (studentsData.data) setStudents(studentsData.data);
      if (timelineData.data) setActivityTimeline(timelineData.data);
      if (recentData.data) setRecentActivity(recentData.data);
      if (spellingDist.data) setSpellingDistribution(spellingDist.data);
      if (proofreadingDist.data) setProofreadingDistribution(proofreadingDist.data);
      if (srDist.data) setSrDistribution(srDist.data);

      if (classesData?.data) {
        const rawClasses = classesData.data || [];
        setAllDbClasses(rawClasses);
        const archivedList = rawClasses
          .filter((c: any) => c.is_archived || isArchivedClassName(c.name))
          .map((c: any) => c.name);
        setArchivedClasses(archivedList);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const isStudentArchived = (studentClass?: string | null) => {
    return isArchivedClassName(studentClass, archivedClasses);
  };

  // Split students into active (existing) vs archived
  const activeStudents = useMemo(() => {
    return students.filter(s => !isStudentArchived(s.class));
  }, [students, archivedClasses]);

  const archivedStudents = useMemo(() => {
    return students.filter(s => isStudentArchived(s.class));
  }, [students, archivedClasses]);

  // Distinct classes for dropdown filters
  const activeClasses = useMemo(() => {
    const set = new Set<string>();
    allDbClasses.forEach(c => {
      if (!c.is_archived && !isArchivedClassName(c.name, archivedClasses)) {
        if (c.name) set.add(c.name);
      }
    });
    activeStudents.forEach(s => {
      if (s.class && !isArchivedClassName(s.class, archivedClasses)) {
        set.add(s.class);
      }
    });
    return Array.from(set).sort();
  }, [allDbClasses, activeStudents, archivedClasses]);

  const archivedClassList = useMemo(() => {
    const set = new Set<string>();
    allDbClasses.forEach(c => {
      if (c.is_archived || isArchivedClassName(c.name, archivedClasses)) {
        if (c.name) set.add(c.name);
      }
    });
    archivedStudents.forEach(s => {
      if (s.class && isArchivedClassName(s.class, archivedClasses)) {
        set.add(s.class);
      }
    });
    return Array.from(set).sort();
  }, [allDbClasses, archivedStudents, archivedClasses]);

  const handleScopeChange = (newScope: UserScope) => {
    setUserScope(newScope);
    if (selectedClass !== 'all') {
      if (newScope === 'active' && !activeClasses.includes(selectedClass)) {
        setSelectedClass('all');
      } else if (newScope === 'archived' && !archivedClassList.includes(selectedClass)) {
        setSelectedClass('all');
      }
    }
  };

  // Scoped students based on current userScope (Filtered: Hide archived classes and students)
  const scopedStudents = useMemo(() => {
    return activeStudents;
  }, [activeStudents]);

  // Filter students based on class dropdown
  const classFilteredStudents = useMemo(() => {
    if (selectedClass === 'all') return scopedStudents;
    return scopedStudents.filter(s => (s.class || 'Unassigned') === selectedClass);
  }, [scopedStudents, selectedClass]);

  // Filter students by search text
  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return classFilteredStudents;
    return classFilteredStudents.filter(
      (student) =>
        (student.display_name?.toLowerCase() || '').includes(q) ||
        (student.username?.toLowerCase() || '').includes(q) ||
        (student.class?.toLowerCase() || '').includes(q)
    );
  }, [classFilteredStudents, searchQuery]);

  // Computed metrics for current scope & class
  const dynamicMetrics = useMemo(() => {
    const list = classFilteredStudents;
    const totalCount = list.length;
    const activeCount = list.filter(s => s.total_practices > 0).length;
    const inactiveCount = totalCount - activeCount;

    const totalPractices = list.reduce((sum, s) => sum + (s.total_practices || 0), 0);
    const totalTimeHours = (list.reduce((sum, s) => sum + (s.total_time_minutes || 0), 0) / 60).toFixed(1);

    // Spelling
    const spellingPractices = list.reduce((sum, s) => sum + (s.spelling_practices || 0), 0);
    const spellingStudents = list.filter(s => s.spelling_practices > 0);
    const spellingAvgAcc = spellingStudents.length > 0
      ? Math.round(spellingStudents.reduce((sum, s) => sum + (s.spelling_avg_accuracy || 0), 0) / spellingStudents.length)
      : 0;

    // Proofreading
    const proofreadingPractices = list.reduce((sum, s) => sum + (s.proofreading_practices || 0), 0);
    const proofreadingStudents = list.filter(s => s.proofreading_practices > 0);
    const proofreadingAvgAcc = proofreadingStudents.length > 0
      ? Math.round(proofreadingStudents.reduce((sum, s) => sum + (s.proofreading_avg_accuracy || 0), 0) / proofreadingStudents.length)
      : 0;

    // Memorization
    const memorizationSessions = list.reduce((sum, s) => sum + (s.memorization_sessions || 0), 0);
    const memorizationStudents = list.filter(s => s.memorization_sessions > 0);

    // Spaced Repetition
    const srAttempts = list.reduce((sum, s) => sum + (s.sr_attempts || 0), 0);
    const srStudents = list.filter(s => s.sr_attempts > 0);
    const srAvgAcc = srStudents.length > 0
      ? Math.round(srStudents.reduce((sum, s) => sum + (s.sr_avg_accuracy || 0), 0) / srStudents.length)
      : 0;

    // Reading
    const readingAttempts = list.reduce((sum, s) => sum + (s.reading_attempts || 0), 0);
    const readingPerfectCount = list.reduce((sum, s) => sum + (s.reading_perfect_count || 0), 0);

    // Overall accuracy
    const overallStudents = list.filter(s => s.overall_avg_accuracy > 0);
    const overallAvgAcc = overallStudents.length > 0
      ? Math.round(overallStudents.reduce((sum, s) => sum + (s.overall_avg_accuracy || 0), 0) / overallStudents.length)
      : 0;

    return {
      totalCount,
      activeCount,
      inactiveCount,
      totalPractices,
      totalTimeHours,
      spellingPractices,
      spellingAvgAcc,
      spellingUnique: spellingStudents.length,
      proofreadingPractices,
      proofreadingAvgAcc,
      proofreadingUnique: proofreadingStudents.length,
      memorizationSessions,
      memorizationUnique: memorizationStudents.length,
      srAttempts,
      srAvgAcc,
      srUnique: srStudents.length,
      readingAttempts,
      readingPerfectCount,
      overallAvgAcc
    };
  }, [classFilteredStudents]);

  // Dynamic distribution helper
  const getDynamicScoreDist = (extractor: (s: StudentPerformance) => { count: number; acc: number }) => {
    const practiced = classFilteredStudents.filter(s => extractor(s).count > 0);
    if (practiced.length === 0) {
      return [
        { score_range: '90-100', student_count: 0, percentage: 0 },
        { score_range: '80-89', student_count: 0, percentage: 0 },
        { score_range: '70-79', student_count: 0, percentage: 0 },
        { score_range: '<70', student_count: 0, percentage: 0 },
      ];
    }
    const r90 = practiced.filter(s => extractor(s).acc >= 90).length;
    const r80 = practiced.filter(s => extractor(s).acc >= 80 && extractor(s).acc < 90).length;
    const r70 = practiced.filter(s => extractor(s).acc >= 70 && extractor(s).acc < 80).length;
    const rBelow = practiced.filter(s => extractor(s).acc < 70).length;
    const total = practiced.length;

    return [
      { score_range: '90-100', student_count: r90, percentage: Math.round((r90 / total) * 100) },
      { score_range: '80-89', student_count: r80, percentage: Math.round((r80 / total) * 100) },
      { score_range: '70-79', student_count: r70, percentage: Math.round((r70 / total) * 100) },
      { score_range: '<70', student_count: rBelow, percentage: Math.round((rBelow / total) * 100) },
    ];
  };

  const dynamicSpellingDist = useMemo(() => getDynamicScoreDist(s => ({ count: s.spelling_practices, acc: s.spelling_avg_accuracy })), [classFilteredStudents]);
  const dynamicProofreadingDist = useMemo(() => getDynamicScoreDist(s => ({ count: s.proofreading_practices, acc: s.proofreading_avg_accuracy })), [classFilteredStudents]);
  const dynamicSrDist = useMemo(() => getDynamicScoreDist(s => ({ count: s.sr_attempts, acc: s.sr_avg_accuracy })), [classFilteredStudents]);

  // Filtered recent activity based on scope & class
  const filteredRecentActivity = useMemo(() => {
    return recentActivity.filter(activity => {
      const student = students.find(s => s.user_id === activity.user_id);
      const isArchived = student ? isStudentArchived(student.class) : false;
      if (userScope === 'active' && isArchived) return false;
      if (userScope === 'archived' && !isArchived) return false;
      if (selectedClass !== 'all') {
        if ((student?.class || 'Unassigned') !== selectedClass) return false;
      }
      return true;
    });
  }, [recentActivity, students, userScope, selectedClass, archivedClasses]);

  // Filtered students for Proofreading tab
  const filteredProofreadingStudents = useMemo(() => {
    let list = [...classFilteredStudents];

    if (prSearchQuery.trim()) {
      const q = prSearchQuery.toLowerCase();
      list = list.filter(s => 
        (s.display_name && s.display_name.toLowerCase().includes(q)) ||
        (s.username && s.username.toLowerCase().includes(q)) ||
        (s.class && s.class.toLowerCase().includes(q))
      );
    }

    if (prStatusFilter === 'practiced') {
      list = list.filter(s => (s.proofreading_practices || 0) > 0);
    } else if (prStatusFilter === 'needs_help') {
      list = list.filter(s => (s.proofreading_practices || 0) > 0 && (s.proofreading_avg_accuracy || 0) < 70);
    } else if (prStatusFilter === 'excellent') {
      list = list.filter(s => (s.proofreading_avg_accuracy || 0) >= 90);
    } else if (prStatusFilter === 'not_attempted') {
      list = list.filter(s => !(s.proofreading_practices || 0));
    }

    list.sort((a, b) => {
      if (prSortOrder === 'practices_desc') {
        return (b.proofreading_practices || 0) - (a.proofreading_practices || 0);
      }
      if (prSortOrder === 'accuracy_asc') {
        const aAcc = a.proofreading_practices > 0 ? (a.proofreading_avg_accuracy || 0) : 999;
        const bAcc = b.proofreading_practices > 0 ? (b.proofreading_avg_accuracy || 0) : 999;
        return aAcc - bAcc;
      }
      if (prSortOrder === 'accuracy_desc') {
        return (b.proofreading_avg_accuracy || 0) - (a.proofreading_avg_accuracy || 0);
      }
      return (a.display_name || '').localeCompare(b.display_name || '');
    });

    return list;
  }, [classFilteredStudents, prSearchQuery, prStatusFilter, prSortOrder]);

  const exportStudentsToExcel = () => {
    if (filteredStudents.length === 0) return;
    const rows = filteredStudents.map((s, idx) => ({
      'No.': idx + 1,
      'Student Name': s.display_name,
      'Username': s.username,
      'Class': s.class || 'No Class',
      'Class Number': s.class_number || '',
      'Class Status': isStudentArchived(s.class) ? 'Archived' : 'Active',
      'Spelling Practices': s.spelling_practices,
      'Spelling Avg Score': s.spelling_avg_accuracy ? `${s.spelling_avg_accuracy}%` : 'N/A',
      'Proofreading Practices': s.proofreading_practices,
      'Proofreading Avg Score': s.proofreading_avg_accuracy ? `${s.proofreading_avg_accuracy}%` : 'N/A',
      'Reading Attempts': s.reading_attempts,
      'Reading Perfect': s.reading_perfect_count,
      'Memorization Sessions': s.memorization_sessions,
      'SR Attempts': s.sr_attempts,
      'SR Avg Score': s.sr_avg_accuracy ? `${s.sr_avg_accuracy}%` : 'N/A',
      'Total Practices': s.total_practices,
      'Overall Avg Score': s.overall_avg_accuracy ? `${s.overall_avg_accuracy}%` : 'N/A',
      'Last Active': s.last_activity ? new Date(s.last_activity).toLocaleDateString('en-US') : 'Never'
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    const sheetName = userScope === 'active' ? 'Active Students' : userScope === 'archived' ? 'Archived Students' : 'All Students';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    const fileName = `User_Analytics_${sheetName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
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

  if (loading) {
    return (
      <div className="pt-20 min-h-screen bg-gray-50 pr-8">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center text-gray-600">Loading analytics data...</div>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="pt-20 min-h-screen bg-gray-50 pr-8">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center text-gray-600">Access denied. Admin privileges required.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 min-h-screen bg-gray-50 pr-8">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Top Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-800 tracking-tight">Student Analytics Dashboard</h1>
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-blue-100 text-blue-700">
                User Analytics
              </span>
            </div>
            <p className="text-gray-500 text-sm mt-1">Comprehensive performance data and learning history for active and archived class students</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadAllAnalytics(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin text-blue-600' : ''} />
              <span>Refresh</span>
            </button>
            <button
              onClick={exportStudentsToExcel}
              disabled={filteredStudents.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
              title="Export current student list to Excel"
            >
              <Download size={15} />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Scope & Class Filter Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Class Dropdown Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap flex items-center gap-1">
                <Filter size={14} />
                Class Filter:
              </span>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-gray-800 text-sm font-medium rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none min-w-[160px]"
              >
                <option value="all">All Classes</option>
                {activeClasses.map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Scope informative banner */}
          <div className={`text-xs px-3 py-2 rounded-lg flex items-center justify-between ${
            userScope === 'active' 
              ? 'bg-blue-50/80 text-blue-800 border border-blue-100'
              : userScope === 'archived'
              ? 'bg-amber-50/90 text-amber-900 border border-amber-200'
              : 'bg-indigo-50/80 text-indigo-900 border border-indigo-100'
          }`}>
            <div className="flex items-center gap-2">
              {userScope === 'active' ? (
                <>
                  <Sparkles size={14} className="text-blue-600 shrink-0" />
                  <span>
                    Viewing <strong>active students</strong> ({activeStudents.length} students). {archivedStudents.length} students from archived classes are hidden.
                  </span>
                </>
              ) : userScope === 'archived' ? (
                <>
                  <Archive size={14} className="text-amber-700 shrink-0" />
                  <span>
                    Viewing <strong>archived class students</strong> ({archivedStudents.length} students). These classes are hidden from the main teaching dashboard.
                  </span>
                </>
              ) : (
                <>
                  <Users size={14} className="text-indigo-600 shrink-0" />
                  <span>
                    Viewing <strong>all students</strong> ({students.length} total: {activeStudents.length} active, {archivedStudents.length} archived).
                  </span>
                </>
              )}
            </div>
            {userScope !== 'active' && (
              <button
                type="button"
                onClick={() => handleScopeChange('active')}
                className="underline font-semibold ml-2 hover:opacity-80 shrink-0"
              >
                Switch to Active Students
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'students', label: `Students (${classFilteredStudents.length})`, icon: Users },
            { id: 'spelling', label: 'Spelling', icon: Target },
            { id: 'proofreading', label: 'Proofreading', icon: FileEdit },
            { id: 'memorization', label: 'Memorization', icon: Clock },
            { id: 'spaced_repetition', label: 'Spaced Repetition', icon: Zap },
            { id: 'activity', label: 'Activity', icon: Activity },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as TabType)}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-lg font-medium transition-colors whitespace-nowrap text-sm ${activeTab === id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-800">Total Students</h3>
                  <Users className="text-blue-600" size={28} />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-2">{dynamicMetrics.totalCount}</div>
                <div className="flex items-center space-x-3 text-xs mb-2">
                  <div className="flex items-center space-x-1 text-emerald-600 font-medium">
                    <TrendingUp size={14} />
                    <span>{dynamicMetrics.activeCount} Active</span>
                  </div>
                  {dynamicMetrics.inactiveCount > 0 && (
                    <div className="flex items-center space-x-1 text-slate-400 font-medium">
                      <AlertCircle size={14} />
                      <span>{dynamicMetrics.inactiveCount} Not Started</span>
                    </div>
                  )}
                </div>
                <div className="text-[11px] text-gray-500 border-t border-gray-100 pt-2">
                  {userScope === 'active' ? (
                    <span className="text-blue-700">Excluding {archivedStudents.length} archived students</span>
                  ) : userScope === 'archived' ? (
                    <span className="text-amber-700 font-medium">Historical archived class records</span>
                  ) : (
                    <span>Active: {activeStudents.length} | Archived: {archivedStudents.length}</span>
                  )}
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-800">Total Practices</h3>
                  <BarChart3 className="text-emerald-600" size={28} />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  {dynamicMetrics.totalPractices} <span className="text-base font-normal text-gray-500">sessions</span>
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <div>Spelling: {dynamicMetrics.spellingPractices} · Proofreading: {dynamicMetrics.proofreadingPractices}</div>
                  <div>Memorization: {dynamicMetrics.memorizationSessions} · SR: {dynamicMetrics.srAttempts}</div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-800">Total Practice Time</h3>
                  <Clock className="text-amber-600" size={28} />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  {dynamicMetrics.totalTimeHours}<span className="text-base font-normal text-gray-500">h</span>
                </div>
                <div className="text-xs text-gray-500">
                  Avg per active student:{' '}
                  <span className="font-semibold text-gray-700">
                    {(Number(dynamicMetrics.totalTimeHours) * 60 / (dynamicMetrics.activeCount || 1)).toFixed(0)} min
                  </span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-800">Overall Avg Score</h3>
                  <Target className="text-indigo-600" size={28} />
                </div>
                <div className={`text-3xl font-bold mb-2 ${getScoreColor(dynamicMetrics.overallAvgAcc)}`}>
                  {dynamicMetrics.overallAvgAcc > 0 ? `${dynamicMetrics.overallAvgAcc}%` : 'N/A'}
                </div>
                <div className="text-xs text-gray-500">
                  Combined average across spelling, proofreading & spaced repetition
                </div>
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
                    <span className="text-sm text-gray-600">Total Practices:</span>
                    <span className="font-semibold text-gray-900">{dynamicMetrics.spellingPractices}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Avg Accuracy:</span>
                    <span className={`font-semibold ${getScoreColor(dynamicMetrics.spellingAvgAcc)}`}>
                      {dynamicMetrics.spellingAvgAcc}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Participating Students:</span>
                    <span className="font-semibold text-gray-700">{dynamicMetrics.spellingUnique}</span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-xs text-gray-500 mb-2">Score Distribution</div>
                    <div className="flex space-x-1">
                      {dynamicSpellingDist.map((item, idx) => (
                        <div
                          key={idx}
                          className={`h-2 rounded ${
                            item.score_range === '90-100' ? 'bg-green-500' :
                            item.score_range === '80-89' ? 'bg-blue-500' :
                            item.score_range === '70-79' ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${item.percentage}%` }}
                          title={`${item.score_range}%: ${item.student_count} students (${item.percentage}%)`}
                        />
                      ))}
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
                    <span className="text-sm text-gray-600">Total Practices:</span>
                    <span className="font-semibold text-gray-900">{dynamicMetrics.proofreadingPractices}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Avg Accuracy:</span>
                    <span className={`font-semibold ${getScoreColor(dynamicMetrics.proofreadingAvgAcc)}`}>
                      {dynamicMetrics.proofreadingAvgAcc}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Participating Students:</span>
                    <span className="font-semibold text-gray-700">{dynamicMetrics.proofreadingUnique}</span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-xs text-gray-500 mb-2">Score Distribution</div>
                    <div className="flex space-x-1">
                      {dynamicProofreadingDist.map((item, idx) => (
                        <div
                          key={idx}
                          className={`h-2 rounded ${
                            item.score_range === '90-100' ? 'bg-green-500' :
                            item.score_range === '80-89' ? 'bg-blue-500' :
                            item.score_range === '70-79' ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${item.percentage}%` }}
                          title={`${item.score_range}%: ${item.student_count} students (${item.percentage}%)`}
                        />
                      ))}
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
                    <span className="text-sm text-gray-600">Sessions Completed:</span>
                    <span className="font-semibold text-gray-900">{dynamicMetrics.memorizationSessions}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Participating Students:</span>
                    <span className="font-semibold text-gray-900">{dynamicMetrics.memorizationUnique}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Reading Questions:</span>
                    <span className="font-semibold text-gray-700">{dynamicMetrics.readingAttempts}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Perfect Scores:</span>
                    <span className="font-semibold text-emerald-600">{dynamicMetrics.readingPerfectCount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity Table */}
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800">Recent Activity</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {userScope === 'active' ? 'Live activity for active students' : userScope === 'archived' ? 'Historical activity for archived class students' : 'All students activity'}
                  </p>
                </div>
                <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
                  {filteredRecentActivity.length} entries
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Student</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Class</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Activity Type</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Title / Content</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Score</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Completed At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredRecentActivity.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                          No practice records found for the selected scope.
                        </td>
                      </tr>
                    ) : (
                      filteredRecentActivity.map((activity, index) => {
                        const student = students.find(s => s.user_id === activity.user_id);
                        const isArchived = student ? isStudentArchived(student.class) : false;
                        return (
                          <tr key={index} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedStudentId(activity.user_id);
                                  setSelectedStudentName(activity.display_name);
                                  setSelectedStudentClass(student?.class || '');
                                  setSelectedStudentIsArchived(isArchived);
                                }}
                                className="text-blue-600 hover:text-blue-800 hover:underline text-left font-medium"
                              >
                                {activity.display_name}
                              </button>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              {student?.class ? (
                                isArchived ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                    <Archive size={11} />
                                    {student.class}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                    {student.class}
                                  </span>
                                )
                              ) : (
                                <span className="text-xs text-gray-400">No Class</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                                  activity.activity_type === 'spelling'
                                    ? 'bg-blue-100 text-blue-700'
                                    : activity.activity_type === 'proofreading'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : activity.activity_type === 'spaced_repetition'
                                    ? 'bg-purple-100 text-purple-700'
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
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'students' && (
          <div className="space-y-6">
            {/* Quick KPI summary row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="text-xs text-gray-500 font-medium mb-1">Matching Students</div>
                <div className="text-2xl font-bold text-gray-900">{filteredStudents.length} <span className="text-sm font-normal text-gray-500">students</span></div>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="text-xs text-gray-500 font-medium mb-1">Students with Records</div>
                <div className="text-2xl font-bold text-emerald-600">
                  {filteredStudents.filter(s => s.total_practices > 0).length} <span className="text-sm font-normal text-gray-500">students</span>
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="text-xs text-gray-500 font-medium mb-1">Total Practices</div>
                <div className="text-2xl font-bold text-blue-600">
                  {filteredStudents.reduce((sum, s) => sum + (s.total_practices || 0), 0)} <span className="text-sm font-normal text-gray-500">sessions</span>
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="text-xs text-gray-500 font-medium mb-1">Group Avg Score</div>
                <div className={`text-2xl font-bold ${getScoreColor(dynamicMetrics.overallAvgAcc)}`}>
                  {dynamicMetrics.overallAvgAcc > 0 ? `${dynamicMetrics.overallAvgAcc}%` : 'N/A'}
                </div>
              </div>
            </div>

            {/* Search and Filter Strip */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search student name, username, or class..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Quick scope switcher buttons */}
              <div className="flex items-center gap-1.5 self-end md:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => handleScopeChange('active')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                    userScope === 'active'
                      ? 'bg-blue-50 text-blue-700 border-blue-300'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Active Students ({activeStudents.length})
                </button>
                <button
                  type="button"
                  onClick={() => handleScopeChange('archived')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                    userScope === 'archived'
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Archived Classes ({archivedStudents.length})
                </button>
                <button
                  type="button"
                  onClick={() => handleScopeChange('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                    userScope === 'all'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  All ({students.length})
                </button>
              </div>
            </div>

            {/* Student Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50/80 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Student Name</th>
                      <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Class / Status</th>
                      <th className="px-4 py-3.5 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Spelling</th>
                      <th className="px-4 py-3.5 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Proofreading</th>
                      <th className="px-4 py-3.5 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Reading</th>
                      <th className="px-4 py-3.5 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Memorization</th>
                      <th className="px-4 py-3.5 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Spaced Repetition</th>
                      <th className="px-4 py-3.5 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Total</th>
                      <th className="px-4 py-3.5 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Avg Score</th>
                      <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Last Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                          {searchQuery
                            ? 'No students match your search'
                            : userScope === 'archived'
                            ? 'No archived student records for the selected class'
                            : 'No active student records found'}
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((student) => {
                        const isArchived = isStudentArchived(student.class);
                        return (
                          <tr
                            key={student.user_id}
                            className={`transition-colors ${
                              isArchived 
                                ? 'bg-amber-50/20 hover:bg-amber-50/40' 
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <td className="px-6 py-4">
                              <div>
                                <div 
                                  className="text-sm font-semibold text-blue-600 hover:text-blue-800 cursor-pointer transition-colors"
                                  onClick={() => {
                                    setSelectedStudentId(student.user_id);
                                    setSelectedStudentName(student.display_name);
                                    setSelectedStudentClass(student.class || '');
                                    setSelectedStudentIsArchived(isArchived);
                                  }}
                                >
                                  {student.display_name}
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5">@{student.username}</div>
                              </div>
                            </td>

                            <td className="px-4 py-4 text-sm">
                              {student.class ? (
                                isArchived ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                    <Archive size={11} />
                                    <span>{student.class}</span>
                                    <span className="text-[10px] text-amber-600 font-normal">Archived</span>
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                    {student.class}
                                    {student.class_number ? ` (#${student.class_number})` : ''}
                                  </span>
                                )
                              ) : (
                                <span className="text-xs text-gray-400">No Class</span>
                              )}
                            </td>

                            <td className="px-4 py-4 text-center">
                              <div className="text-sm font-medium text-gray-900">{student.spelling_practices}</div>
                              {student.spelling_practices > 0 && (
                                <div className={`text-xs font-semibold ${getScoreColor(student.spelling_avg_accuracy)}`}>
                                  {student.spelling_avg_accuracy}%
                                </div>
                              )}
                            </td>

                            <td className="px-4 py-4 text-center">
                              <div className="text-sm font-medium text-gray-900">{student.proofreading_practices}</div>
                              {student.proofreading_practices > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setProofreadingDetailStudent({
                                      userId: student.user_id,
                                      studentName: student.display_name,
                                      className: student.class,
                                      isArchived
                                    });
                                  }}
                                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md hover:ring-2 hover:ring-indigo-400 transition-all ${getScoreColor(student.proofreading_avg_accuracy)}`}
                                  title="View proofreading weak area analysis and question-by-question breakdown"
                                >
                                  <span>{student.proofreading_avg_accuracy}%</span>
                                  <Sparkles size={11} className="text-amber-500" />
                                </button>
                              )}
                            </td>

                            <td className="px-4 py-4 text-center">
                              <div className="text-sm font-medium text-gray-900">{student.reading_attempts}</div>
                              {student.reading_attempts > 0 && (
                                <div className="text-xs text-emerald-600 font-medium">
                                  {student.reading_perfect_count} Perfect
                                </div>
                              )}
                            </td>

                            <td className="px-4 py-4 text-center">
                              <div className="text-sm font-medium text-gray-900">{student.memorization_sessions}</div>
                            </td>

                            <td className="px-4 py-4 text-center">
                              <div className="text-sm font-medium text-gray-900">{student.sr_attempts}</div>
                              {student.sr_attempts > 0 && (
                                <div className={`text-xs font-semibold ${getScoreColor(student.sr_avg_accuracy)}`}>
                                  {student.sr_avg_accuracy}%
                                </div>
                              )}
                            </td>

                            <td className="px-4 py-4 text-center">
                              <div className="text-sm font-bold text-gray-900">{student.total_practices}</div>
                            </td>

                            <td className="px-4 py-4 text-center">
                              {student.overall_avg_accuracy > 0 ? (
                                <span className={`text-sm font-bold px-2 py-0.5 rounded ${getScoreColor(student.overall_avg_accuracy)}`}>
                                  {student.overall_avg_accuracy}%
                                </span>
                              ) : (
                                <span className="text-sm text-gray-300">-</span>
                              )}
                            </td>

                            <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                              {student.last_activity ? formatDate(student.last_activity) : 'Never'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'spelling' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-blue-50/60 border border-blue-200 px-4 py-2.5 rounded-lg text-xs text-blue-900">
              <span className="font-medium">
                📊 Scope: {userScope === 'active' ? 'Active Students' : userScope === 'archived' ? 'Archived Class Students' : 'All Students'} · Class: {selectedClass === 'all' ? 'All Classes' : selectedClass}
              </span>
              <span>{dynamicMetrics.totalCount} students</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Total Practices</div>
                <div className="text-3xl font-bold text-gray-900">{dynamicMetrics.spellingPractices}</div>
                <div className="text-xs text-gray-400 mt-1">Spelling practices</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Avg Accuracy</div>
                <div className={`text-3xl font-bold ${getScoreColor(dynamicMetrics.spellingAvgAcc)}`}>
                  {dynamicMetrics.spellingAvgAcc}%
                </div>
                <div className="text-xs text-gray-400 mt-1">Average accuracy</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Participating Students</div>
                <div className="text-3xl font-bold text-blue-600">{dynamicMetrics.spellingUnique}</div>
                <div className="text-xs text-gray-400 mt-1">{dynamicMetrics.totalCount > 0 ? Math.round((dynamicMetrics.spellingUnique / dynamicMetrics.totalCount) * 100) : 0}% of selected students</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Excellence Rate (90%+)</div>
                <div className="text-3xl font-bold text-emerald-600">
                  {dynamicSpellingDist.find(d => d.score_range === '90-100')?.percentage || 0}%
                </div>
                <div className="text-xs text-gray-400 mt-1">{dynamicSpellingDist.find(d => d.score_range === '90-100')?.student_count || 0} students achieved excellence</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Score Distribution</h3>
              <div className="space-y-3">
                {dynamicSpellingDist.map((range) => (
                  <div key={range.score_range}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{range.score_range}%</span>
                      <span className="text-gray-600">
                        {range.student_count} students ({range.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-2.5 rounded-full transition-all ${
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

        {activeTab === 'proofreading' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-yellow-50/60 border border-yellow-200 px-4 py-2.5 rounded-lg text-xs text-yellow-900">
              <span className="font-medium">
                📊 Scope: {userScope === 'active' ? 'Active Students' : userScope === 'archived' ? 'Archived Class Students' : 'All Students'} · Class: {selectedClass === 'all' ? 'All Classes' : selectedClass}
              </span>
              <span>{dynamicMetrics.totalCount} students</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Total Practices</div>
                <div className="text-3xl font-bold text-gray-900">{dynamicMetrics.proofreadingPractices}</div>
                <div className="text-xs text-gray-400 mt-1">Proofreading practices</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Avg Accuracy</div>
                <div className={`text-3xl font-bold ${getScoreColor(dynamicMetrics.proofreadingAvgAcc)}`}>
                  {dynamicMetrics.proofreadingAvgAcc}%
                </div>
                <div className="text-xs text-gray-400 mt-1">Average accuracy</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Participating Students</div>
                <div className="text-3xl font-bold text-yellow-600">{dynamicMetrics.proofreadingUnique}</div>
                <div className="text-xs text-gray-400 mt-1">{dynamicMetrics.totalCount > 0 ? Math.round((dynamicMetrics.proofreadingUnique / dynamicMetrics.totalCount) * 100) : 0}% of selected students</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Excellence Rate (90%+)</div>
                <div className="text-3xl font-bold text-emerald-600">
                  {dynamicProofreadingDist.find(d => d.score_range === '90-100')?.percentage || 0}%
                </div>
                <div className="text-xs text-gray-400 mt-1">{dynamicProofreadingDist.find(d => d.score_range === '90-100')?.student_count || 0} students achieved excellence</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Score Distribution</h3>
              <div className="space-y-3">
                {dynamicProofreadingDist.map((range) => (
                  <div key={range.score_range}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{range.score_range}%</span>
                      <span className="text-gray-600">
                        {range.student_count} students ({range.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-2.5 rounded-full transition-all ${
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

            {/* Detailed Student Progress & Weakness Analysis Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-gray-200 bg-slate-50/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Sparkles className="text-indigo-600" size={20} />
                      Detailed Proofreading Progress & Diagnostics
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      View each student's proofreading practice records, see which questions were correct and incorrect, and diagnose common grammar errors (tenses, prepositions, singular/plural, etc.) and root causes.
                    </p>
                  </div>

                  {/* Filter & Sort Controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                      <input
                        type="text"
                        placeholder="Search student or class..."
                        value={prSearchQuery}
                        onChange={(e) => setPrSearchQuery(e.target.value)}
                        className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs w-44 sm:w-48 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <select
                      value={prSortOrder}
                      onChange={(e) => setPrSortOrder(e.target.value as any)}
                      className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    >
                      <option value="practices_desc">Most Practices First</option>
                      <option value="accuracy_asc">Lowest Accuracy (Priority Support)</option>
                      <option value="accuracy_desc">Highest Accuracy First</option>
                      <option value="name">Sort by Student Name</option>
                    </select>
                  </div>
                </div>

                {/* Filter Status Buttons */}
                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-200/80">
                  <button
                    onClick={() => setPrStatusFilter('all')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      prStatusFilter === 'all'
                        ? 'bg-slate-800 text-white font-semibold'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    All Students ({classFilteredStudents.length})
                  </button>
                  <button
                    onClick={() => setPrStatusFilter('practiced')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      prStatusFilter === 'practiced'
                        ? 'bg-indigo-600 text-white font-semibold'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    Practiced ({classFilteredStudents.filter(s => (s.proofreading_practices || 0) > 0).length})
                  </button>
                  <button
                    onClick={() => setPrStatusFilter('needs_help')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      prStatusFilter === 'needs_help'
                        ? 'bg-rose-600 text-white font-semibold'
                        : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
                    }`}
                  >
                    ⚠️ Needs Support (&lt;70%) ({classFilteredStudents.filter(s => (s.proofreading_practices || 0) > 0 && (s.proofreading_avg_accuracy || 0) < 70).length})
                  </button>
                  <button
                    onClick={() => setPrStatusFilter('excellent')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      prStatusFilter === 'excellent'
                        ? 'bg-emerald-600 text-white font-semibold'
                        : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                    }`}
                  >
                    🎯 Proficient (≥90%) ({classFilteredStudents.filter(s => (s.proofreading_avg_accuracy || 0) >= 90).length})
                  </button>
                  <button
                    onClick={() => setPrStatusFilter('not_attempted')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      prStatusFilter === 'not_attempted'
                        ? 'bg-gray-600 text-white font-semibold'
                        : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    ⚪ Not Attempted ({classFilteredStudents.filter(s => !(s.proofreading_practices || 0)).length})
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-semibold">
                    <tr>
                      <th className="px-6 py-3 text-left">Student</th>
                      <th className="px-4 py-3 text-center">Class</th>
                      <th className="px-4 py-3 text-center">Practice Count</th>
                      <th className="px-4 py-3 text-center">Avg Accuracy</th>
                      <th className="px-4 py-3 text-left">Proficiency & Diagnostic Tag</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredProofreadingStudents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-gray-400">
                          No matching student records found.
                        </td>
                      </tr>
                    ) : (
                      filteredProofreadingStudents.map((student) => {
                        const isArchived = isStudentArchived(student.class);
                        const hasPracticed = (student.proofreading_practices || 0) > 0;
                        const avgAcc = student.proofreading_avg_accuracy || 0;

                        return (
                          <tr
                            key={student.user_id}
                            className={`hover:bg-indigo-50/30 transition-colors ${
                              isArchived ? 'bg-amber-50/15' : ''
                            }`}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                                  {student.display_name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-gray-900">
                                    {student.display_name}
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    {student.username}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-4 whitespace-nowrap text-center">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                isArchived 
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}>
                                {isArchived ? `📦 ${student.class || 'Unassigned'}` : (student.class || 'Unassigned')}
                              </span>
                            </td>

                            <td className="px-4 py-4 whitespace-nowrap text-center">
                              {hasPracticed ? (
                                <span className="font-bold text-gray-800 text-sm">
                                  {student.proofreading_practices}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400 italic">Not Started</span>
                              )}
                            </td>

                            <td className="px-4 py-4 whitespace-nowrap text-center">
                              {hasPracticed ? (
                                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${getScoreColor(avgAcc)}`}>
                                  {avgAcc}%
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>

                            <td className="px-4 py-4 whitespace-nowrap text-left">
                              {!hasPracticed ? (
                                <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                                  <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
                                  Not Attempted
                                </span>
                              ) : avgAcc < 70 ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  <AlertCircle size={13} />
                                  Needs Priority Support (&lt;70%)
                                </span>
                              ) : avgAcc >= 90 ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <Sparkles size={13} />
                                  Proficient (≥90%)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                  <Target size={13} />
                                  Good Performance (70-89%)
                                </span>
                              )}
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                              <button
                                onClick={() => setProofreadingDetailStudent({
                                  userId: student.user_id,
                                  studentName: student.display_name,
                                  className: student.class,
                                  isArchived
                                })}
                                disabled={!hasPracticed}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                  hasPracticed
                                    ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 shadow-2xs hover:shadow-xs'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                                }`}
                                title={hasPracticed ? "View question-by-question progress and weakness analysis" : "No practice records for this student yet"}
                              >
                                <Eye size={14} />
                                Detailed Progress & Diagnostics
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'memorization' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-green-50/60 border border-green-200 px-4 py-2.5 rounded-lg text-xs text-green-900">
              <span className="font-medium">
                📊 Scope: {userScope === 'active' ? 'Active Students' : userScope === 'archived' ? 'Archived Class Students' : 'All Students'} · Class: {selectedClass === 'all' ? 'All Classes' : selectedClass}
              </span>
              <span>{dynamicMetrics.totalCount} students</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Sessions Completed</div>
                <div className="text-3xl font-bold text-gray-900">{dynamicMetrics.memorizationSessions}</div>
                <div className="text-xs text-gray-400 mt-1">Memorization sessions</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Participating Students</div>
                <div className="text-3xl font-bold text-green-600">{dynamicMetrics.memorizationUnique}</div>
                <div className="text-xs text-gray-400 mt-1">Active participants</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Reading / Comprehension</div>
                <div className="text-3xl font-bold text-indigo-600">{dynamicMetrics.readingAttempts}</div>
                <div className="text-xs text-gray-400 mt-1">Reading attempts</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Perfect Scores</div>
                <div className="text-3xl font-bold text-emerald-600">{dynamicMetrics.readingPerfectCount}</div>
                <div className="text-xs text-gray-400 mt-1">100% Accuracy passes</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'spaced_repetition' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-purple-50/60 border border-purple-200 px-4 py-2.5 rounded-lg text-xs text-purple-900">
              <span className="font-medium">
                📊 Scope: {userScope === 'active' ? 'Active Students' : userScope === 'archived' ? 'Archived Class Students' : 'All Students'} · Class: {selectedClass === 'all' ? 'All Classes' : selectedClass}
              </span>
              <span>{dynamicMetrics.totalCount} students</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Total Reviews</div>
                <div className="text-3xl font-bold text-gray-900">{dynamicMetrics.srAttempts}</div>
                <div className="text-xs text-gray-400 mt-1">Review attempts</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Avg Retention Rate</div>
                <div className={`text-3xl font-bold ${getScoreColor(dynamicMetrics.srAvgAcc)}`}>
                  {dynamicMetrics.srAvgAcc}%
                </div>
                <div className="text-xs text-gray-400 mt-1">Retention accuracy</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Participating Students</div>
                <div className="text-3xl font-bold text-blue-600">{dynamicMetrics.srUnique}</div>
                <div className="text-xs text-gray-400 mt-1">Unique review students</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Total Practice Time</div>
                <div className="text-3xl font-bold text-gray-900">{dynamicMetrics.totalTimeHours}h</div>
                <div className="text-xs text-gray-400 mt-1">Cumulative time</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="text-blue-600" size={24} />
                <h3 className="text-lg font-semibold text-gray-800">Score Distribution</h3>
              </div>
              <div className="space-y-3">
                {dynamicSrDist.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-sm italic">No spaced repetition data for the current scope.</div>
                ) : (
                  dynamicSrDist.map((range) => (
                    <div key={range.score_range}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{range.score_range}%</span>
                        <span className="text-gray-600">
                          {range.student_count} students ({range.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-2.5 rounded-full transition-all ${
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
                  ))
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="text-blue-600" size={22} />
                <h3 className="text-base font-semibold text-gray-800">Learning Reinforcement &amp; Memory Curve</h3>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                The Spaced Repetition System schedules optimal review times based on each student's memory curve.
                In the current scope, {dynamicMetrics.srUnique} students have completed {dynamicMetrics.srAttempts} review sessions.
              </p>
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
      {selectedStudentId && (
        <StudentActivityDetail
          userId={selectedStudentId}
          studentName={selectedStudentName}
          className={selectedStudentClass}
          isArchived={selectedStudentIsArchived}
          onClose={() => {
            setSelectedStudentId(null);
            setSelectedStudentName('');
            setSelectedStudentClass('');
            setSelectedStudentIsArchived(false);
          }}
        />
      )}
      {proofreadingDetailStudent && (
        <StudentProofreadingDetailModal
          userId={proofreadingDetailStudent.userId}
          studentName={proofreadingDetailStudent.studentName}
          className={proofreadingDetailStudent.className}
          isArchived={proofreadingDetailStudent.isArchived}
          onClose={() => setProofreadingDetailStudent(null)}
        />
      )}
    </div>
  );
};

export default UserAnalytics;
