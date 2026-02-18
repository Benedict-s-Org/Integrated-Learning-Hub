import React from 'react';
import { LucideIcon, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface GameModeCardProps {
    mode: string;
    title: string;
    description: string;
    icon: LucideIcon;
    color: string;
    unlocked: boolean;
    minLevel?: string;
    route?: string;
}

export const GameModeCard: React.FC<GameModeCardProps> = ({
    title, description, icon: Icon, color, unlocked, minLevel, route
}) => {
    const navigate = useNavigate();

    return (
        <button
            disabled={!unlocked}
            onClick={() => route && navigate(route)}
            className={`
                relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 group
                ${unlocked
                    ? 'bg-white hover:shadow-lg hover:-translate-y-1 cursor-pointer border border-transparent hover:border-slate-200'
                    : 'bg-slate-50 cursor-not-allowed border border-slate-100 opacity-80'}
            `}
        >
            <div className={`
                w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-white shadow-sm
                ${unlocked ? color : 'bg-slate-300'}
            `}>
                <Icon className="w-6 h-6" />
            </div>

            <h3 className={`font-bold text-lg mb-1 ${unlocked ? 'text-slate-800' : 'text-slate-400'}`}>
                {title}
            </h3>
            <p className={`text-sm ${unlocked ? 'text-slate-500' : 'text-slate-400'}`}>
                {description}
            </p>

            {!unlocked && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex flex-col items-center justify-center text-slate-500">
                    <Lock className="w-8 h-8 mb-2 opacity-50" />
                    <span className="text-xs font-bold uppercase tracking-wider bg-slate-100 px-3 py-1 rounded-full">
                        Unlock at {minLevel}
                    </span>
                </div>
            )}
        </button>
    );
};
