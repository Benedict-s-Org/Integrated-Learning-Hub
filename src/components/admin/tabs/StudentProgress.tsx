import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, Clock, Target, FileEdit } from 'lucide-react';

interface StudentProgressProps {
    studentId: string;
}

interface PerformanceStats {
    spelling_practices: number;
    spelling_avg: number;
    proofreading_practices: number;
    proofreading_avg: number;
    memorization_sessions: number;
    total_time_minutes: number;
}

export function StudentProgress({ studentId }: StudentProgressProps) {
    const [stats, setStats] = useState<PerformanceStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (studentId) {
            fetchStats();
        }
    }, [studentId]);

    const fetchStats = async () => {
        setIsLoading(true);
        try {
            // We can fetch from correct tables or use existing RPCs.
            // For now, let's just aggregate manually for accuracy on this specific user

            // 1. Spelling
            const { data: spelling, error: sErr } = await (supabase
                .from('spelling_practice_results' as any)
                .select('score_percentage')
                .eq('user_id', studentId) as any);

            // 2. Proofreading
            const { data: proofreading, error: pErr } = await (supabase
                .from('proofreading_practice_results' as any)
                .select('score_percentage')
                .eq('user_id', studentId) as any);

            // 3. Memorization
            const { count: memorizationCount, error: mErr } = await (supabase
                .from('memorization_sessions' as any)
                .select('*', { count: 'exact', head: true })
                .eq('user_id', studentId) as any);

            // Handle errors or missing tables gracefully
            if (sErr || pErr || mErr) {
                console.warn('Some tables might be missing', { sErr, pErr, mErr });
            }

            const safeSpelling: any[] = spelling || [];
            const safeProofreading: any[] = proofreading || [];

            const spellingCount = safeSpelling.length;
            const spellingSum = safeSpelling.reduce((acc, curr) => acc + (curr.score_percentage || 0), 0);

            const proofreadingCount = safeProofreading.length;
            const proofreadingSum = safeProofreading.reduce((acc, curr) => acc + (curr.score_percentage || 0), 0);

            setStats({
                spelling_practices: spellingCount,
                spelling_avg: spellingCount ? Math.round(spellingSum / spellingCount) : 0,
                proofreading_practices: proofreadingCount,
                proofreading_avg: proofreadingCount ? Math.round(proofreadingSum / proofreadingCount) : 0,
                memorization_sessions: memorizationCount || 0,
                total_time_minutes: 0 // Would need more complex query for time
            });

        } catch (err) {
            console.error('Error fetching student stats:', err);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return <div className="text-center py-10 text-slate-400">Loading progress...</div>;
    if (!stats) return <div className="text-center py-10 text-slate-400">No data available</div>;

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800">Learning Stats</h3>

            <div className="grid grid-cols-2 gap-4">
                <StatCard
                    icon={Target}
                    label="Spelling Accuracy"
                    value={`${stats.spelling_avg}%`}
                    subtext={`${stats.spelling_practices} practices`}
                    color="text-blue-500"
                    bgColor="bg-blue-50"
                />
                <StatCard
                    icon={FileEdit}
                    label="Proofreading Avg"
                    value={`${stats.proofreading_avg}%`}
                    subtext={`${stats.proofreading_practices} practices`}
                    color="text-yellow-500"
                    bgColor="bg-yellow-50"
                />
                <StatCard
                    icon={Clock}
                    label="Memorization"
                    value={stats.memorization_sessions.toString()}
                    subtext="Sessions completed"
                    color="text-green-500"
                    bgColor="bg-green-50"
                />
                <StatCard
                    icon={BarChart3}
                    label="Total Activities"
                    value={(stats.spelling_practices + stats.proofreading_practices + stats.memorization_sessions).toString()}
                    subtext="Combined learning count"
                    color="text-purple-500"
                    bgColor="bg-purple-50"
                />
            </div>

            {/* Add chart later */}
            <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 mt-8">
                Detailed charts coming soon
            </div>
        </div>
    );
}

function StatCard({ icon: Icon, label, value, subtext, color, bgColor }: any) {
    return (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
            <div className={`p-3 rounded-lg ${bgColor} ${color}`}>
                <Icon size={24} />
            </div>
            <div>
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <p className="text-2xl font-bold text-slate-900 my-1">{value}</p>
                <p className="text-xs text-slate-400">{subtext}</p>
            </div>
        </div>
    );
}
