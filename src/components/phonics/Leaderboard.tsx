import React, { useEffect, useState } from 'react';
import { usePhonicsGameHub } from '../../context/PhonicsGameHubContext';
import { Trophy, Medal } from 'lucide-react';

export const Leaderboard = () => {
    const { getLeaderboard } = usePhonicsGameHub();
    const [leaders, setLeaders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            const data = await getLeaderboard();
            setLeaders(data);
            setLoading(false);
        };
        fetch();
    }, [getLeaderboard]);

    if (loading) return <div className="animate-pulse h-48 bg-slate-100 rounded-2xl"></div>;

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                <Medal className="w-5 h-5 text-amber-500" />
                Class Leaders
            </h3>

            <div className="space-y-3">
                {leaders.length === 0 && (
                    <div className="text-center py-4 text-slate-400 text-sm">Be the first to join the leaderboard!</div>
                )}

                {leaders.map((student, index) => (
                    <div key={index} className="flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                            <span className={`
                                w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                                ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                    index === 1 ? 'bg-slate-100 text-slate-700' :
                                        index === 2 ? 'bg-amber-50 text-amber-700' : 'text-slate-400'}
                            `}>
                                {index + 1}
                            </span>
                            <span className="text-slate-700 font-medium text-sm">
                                {student.username?.username || 'Student'}
                            </span>
                        </div>
                        <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-full">
                            {student.xp_total} XP
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};
