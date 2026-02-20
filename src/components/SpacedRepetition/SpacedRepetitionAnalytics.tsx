import React, { useState, useEffect } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import {
    TrendingUp,
    Clock,
    Target,
    Calendar,
    Zap,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useSpacedRepetition } from '../../context/SpacedRepetitionContext';

export const SpacedRepetitionAnalytics: React.FC = () => {
    const { user } = useAuth();
    const { streak } = useSpacedRepetition();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);
    const [distribution, setDistribution] = useState<any[]>([]);
    const [forecast, setForecast] = useState<any[]>([]);

    useEffect(() => {
        if (user) {
            fetchAnalytics();
        }
    }, [user]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            // 1. Fetch overall stats for the current student
            const { data: studentData, error: studentError } = await (supabase as any).rpc('get_student_detailed_analytics', {
                target_user_id: user?.id
            });

            if (studentError) throw studentError;

            if (studentData && studentData.spaced_repetition) {
                const srData = studentData.spaced_repetition;
                setStats(srData);
            } else {
                setStats({
                    average_accuracy: 0,
                    total_time_minutes: 0,
                    recent_attempts: []
                });
            }

            // 2. Fetch Card Maturity Distribution
            // Since we don't have a specific RPC for this in the new migration (it was mostly aggregated)
            // We can query the schedules directly for the current user
            const { data: schedules, error: scheduleError } = await (supabase as any)
                .from('spaced_repetition_schedules')
                .select('ease_factor, interval_days, repetitions')
                .eq('user_id', user?.id);

            if (!scheduleError && schedules) {
                const dist = [
                    { name: 'New', value: schedules.filter((s: any) => s.repetitions === 0).length, color: '#94a3b8' },
                    { name: 'Learning', value: schedules.filter((s: any) => s.repetitions > 0 && s.interval_days < 21).length, color: '#3b82f6' },
                    { name: 'Mastered', value: schedules.filter((s: any) => s.repetitions > 0 && s.interval_days >= 21).length, color: '#10b981' },
                    { name: 'Struggling', value: schedules.filter((s: any) => s.ease_factor < 2.0).length, color: '#f43f5e' },
                ].filter(d => d.value > 0);
                setDistribution(dist);
            }

            // 3. Generate a 7-day Review Forecast
            const { data: dueData } = await (supabase as any)
                .from('spaced_repetition_schedules')
                .select('next_review_date')
                .eq('user_id', user?.id);

            if (dueData) {
                const forecastMap: Record<string, number> = {};
                const now = new Date();
                for (let i = 0; i < 7; i++) {
                    const d = new Date(now);
                    d.setDate(d.getDate() + i);
                    const dateStr = d.toISOString().split('T')[0];
                    forecastMap[dateStr] = 0;
                }

                dueData.forEach((s: any) => {
                    const reviewDate = s.next_review_date.split('T')[0];
                    if (forecastMap[reviewDate] !== undefined) {
                        forecastMap[reviewDate]++;
                    }
                });

                const forecastArray = Object.entries(forecastMap).map(([date, count]) => ({
                    date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
                    count
                }));
                setForecast(forecastArray);
            }

        } catch (err) {
            console.error('Failed to fetch SR analytics:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <Zap className="w-5 h-5 text-blue-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Current Streak</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-gray-900">{streak?.current_streak_days || 0}</span>
                        <span className="text-sm text-gray-500">days</span>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-green-50 rounded-lg">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Cards Mastered</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-gray-900">{distribution.find(d => d.name === 'Mastered')?.value || 0}</span>
                        <span className="text-sm text-gray-500">cards</span>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-purple-50 rounded-lg">
                            <Target className="w-5 h-5 text-purple-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Avg Accuracy</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-gray-900">{stats?.average_accuracy || 0}%</span>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-orange-50 rounded-lg">
                            <Clock className="w-5 h-5 text-orange-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Study Time</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-gray-900">{stats?.total_time_minutes || 0}</span>
                        <span className="text-sm text-gray-500">mins</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Review Forecast */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-blue-600" />
                            Review Forecast
                        </h3>
                        <span className="text-xs text-gray-400 capitalize">Next 7 days</span>
                    </div>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={forecast}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Mastery Progress */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-green-600" />
                            Card Maturity
                        </h3>
                    </div>
                    <div className="h-64 w-full flex items-center">
                        <div className="w-1/2 h-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={distribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {distribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-1/2 space-y-4">
                            {distribution.map((item, index) => (
                                <div key={index} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="text-sm text-gray-600">{item.name}</span>
                                    </div>
                                    <span className="text-sm font-bold text-gray-900">{item.value}</span>
                                </div>
                            ))}
                            {distribution.length === 0 && (
                                <div className="text-center text-gray-400 text-sm mt-8">
                                    No data yet. Start learning!
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Activity List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900">Recent Review Activity</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Question</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Result</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {stats?.recent_attempts?.map((attempt: any, idx: number) => (
                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-900 font-medium max-w-xs truncate">
                                            {attempt.question_text}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {attempt.is_correct ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                Correct
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                Missed
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {(attempt.response_time / 1000).toFixed(1)}s
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {new Date(attempt.completed_at).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                            {(!stats?.recent_attempts || stats.recent_attempts.length === 0) && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <AlertCircle className="w-8 h-8 opacity-20" />
                                            <span>No recent reviews found</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
