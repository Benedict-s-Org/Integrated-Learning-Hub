import React, { useEffect } from 'react';
import { usePhonicsGameHub } from '../../context/PhonicsGameHubContext';
import { Trophy, Star, Crown, Zap, Grid, Layers, ArrowRight } from 'lucide-react';
import { LEVEL_COLORS, LEVEL_LABELS, LEVEL_THRESHOLDS, GameLevel } from '../../types/phonicsGame';
import { GameModeCard } from './GameModeCard';
import { AchievementBadges } from './AchievementBadges';
import { Leaderboard } from './Leaderboard';

export const PhonicsGameHub = () => {
    const { progress, loading, fetchProgress } = usePhonicsGameHub();

    useEffect(() => {
        fetchProgress();
    }, [fetchProgress]);

    if (loading) {
        return <div className="p-8 text-center text-amber-600">Loading Game Hub...</div>;
    }

    const currentLevel = progress?.level || 'bronze';
    const currentXP = progress?.xp_total || 0;

    // Calculate progress to next level
    const getNextLevelThreshold = (level: GameLevel) => {
        if (level === 'bronze') return LEVEL_THRESHOLDS.silver;
        if (level === 'silver') return LEVEL_THRESHOLDS.gold;
        if (level === 'gold') return LEVEL_THRESHOLDS.platinum;
        if (level === 'platinum') return LEVEL_THRESHOLDS.diamond;
        return LEVEL_THRESHOLDS.diamond * 1.5; // Cap for diamond
    };

    const nextThreshold = getNextLevelThreshold(currentLevel);
    const prevThreshold = LEVEL_THRESHOLDS[currentLevel];
    const progressPercent = Math.min(100, Math.max(0, ((currentXP - prevThreshold) / (nextThreshold - prevThreshold)) * 100));

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header / Stats Section */}
            <div className={`relative overflow-hidden rounded-3xl p-8 text-white shadow-xl ${LEVEL_COLORS[currentLevel]}`}>
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Trophy className="w-64 h-64" />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider backdrop-blur-sm">
                                {LEVEL_LABELS[currentLevel]} Level
                            </span>
                            <span className="flex items-center gap-1 text-white/90 text-sm">
                                <Star className="w-4 h-4 fill-white" /> {currentXP} XP
                            </span>
                        </div>
                        <h1 className="text-4xl font-black mb-2">Game Hub</h1>
                        <p className="text-white/80 max-w-md">
                            Play games, master sounds, and unlock achievements to level up!
                        </p>
                    </div>

                    <div className="w-full md:w-1/3 bg-black/20 rounded-2xl p-4 backdrop-blur-sm">
                        <div className="flex justify-between text-sm mb-2 font-bold">
                            <span>Level Progress</span>
                            <span>{Math.floor(progressPercent)}%</span>
                        </div>
                        <div className="h-4 bg-black/20 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-white transition-all duration-1000 ease-out rounded-full"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs mt-2 opacity-70">
                            <span>{currentXP} XP</span>
                            <span>Next: {nextThreshold} XP</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content: Game Modes */}
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-2xl font-bold text-slate-700 flex items-center gap-2">
                        <Zap className="w-6 h-6 text-amber-500" />
                        Game Modes
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <GameModeCard
                            mode="sound_match"
                            title="Sound Match"
                            description="Listen and pick the correct sound code."
                            icon={Grid}
                            color="bg-blue-500"
                            unlocked={true}
                            route="/phonics/quiz"
                        // Note: Assuming we route to quiz for now, or a specfic game route
                        />
                        <GameModeCard
                            mode="speed_round"
                            title="Speed Round"
                            description="Race against the clock!"
                            icon={Zap}
                            color="bg-amber-500"
                            unlocked={currentLevel !== 'bronze'}
                            minLevel="Silver"
                        />
                        <GameModeCard
                            mode="pattern_hunt"
                            title="Pattern Hunt"
                            description="Find sounds hidden in words."
                            icon={Layers}
                            color="bg-emerald-500"
                            unlocked={currentLevel === 'gold' || currentLevel === 'platinum' || currentLevel === 'diamond'}
                            minLevel="Gold"
                        />
                        <GameModeCard
                            mode="sound_sort"
                            title="Sound Sort"
                            description="Organize sounds by category."
                            icon={Grid}
                            color="bg-purple-500"
                            unlocked={currentLevel === 'platinum' || currentLevel === 'diamond'}
                            minLevel="Platinum"
                        />
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-slate-700">Recent Achievements</h3>
                            <button className="text-sm text-blue-500 hover:underline flex items-center gap-1">
                                View All <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                        <AchievementBadges limit={3} />
                    </div>
                </div>

                {/* Sidebar: Leaderboard & Stats */}
                <div className="space-y-6">
                    <Leaderboard />

                    <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100">
                        <h3 className="font-bold text-amber-900 mb-4 flex items-center gap-2">
                            <Crown className="w-5 h-5" /> Your Stats
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-amber-700 text-sm">Games Played</span>
                                <span className="font-bold text-amber-900">{progress?.games_played || 0}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-amber-700 text-sm">Best Streak</span>
                                <span className="font-bold text-amber-900">{progress?.best_streak || 0}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-amber-700 text-sm">Total Correct</span>
                                <span className="font-bold text-amber-900">{progress?.total_correct || 0}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
