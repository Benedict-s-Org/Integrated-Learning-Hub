import React from 'react';
import { usePhonicsGameHub } from '../../context/PhonicsGameHubContext';
import { icons } from 'lucide-react';

interface AchievementBadgesProps {
    limit?: number;
}

export const AchievementBadges: React.FC<AchievementBadgesProps> = ({ limit }) => {
    const { badges } = usePhonicsGameHub();

    if (badges.length === 0) {
        return (
            <div className="text-center py-6 text-slate-400 italic text-sm">
                No badges earned yet. Keep playing!
            </div>
        );
    }

    const displayBadges = limit ? badges.slice(0, limit) : badges;

    return (
        <div className="flex flex-wrap gap-4">
            {displayBadges.map((userBadge) => {
                const badge = userBadge.badge;
                if (!badge) return null;

                // Dynamic Icon Loading
                const IconComponent = (icons as any)[badge.icon_name] || (icons as any)['Trophy'];

                return (
                    <div
                        key={badge.id}
                        className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100 pr-4 animate-in zoom-in duration-300"
                        title={badge.description}
                    >
                        <div className={`
                            w-10 h-10 rounded-full flex items-center justify-center text-white
                            ${badge.tier === 'bronze' ? 'bg-amber-600' : ''}
                            ${badge.tier === 'silver' ? 'bg-slate-400' : ''}
                            ${badge.tier === 'gold' ? 'bg-yellow-500' : ''}
                            ${badge.tier === 'platinum' ? 'bg-cyan-400' : ''}
                             ${badge.tier === 'diamond' ? 'bg-purple-500' : ''}
                            ${!['bronze', 'silver', 'gold', 'platinum', 'diamond'].includes(badge.tier) ? 'bg-slate-300' : ''}
                        `}>
                            <IconComponent className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="font-bold text-slate-700 text-sm leading-tight">{badge.badge_name}</div>
                            <div className="text-xs text-slate-500">{new Date(userBadge.earned_at).toLocaleDateString()}</div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
