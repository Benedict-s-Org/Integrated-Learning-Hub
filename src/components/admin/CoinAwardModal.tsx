import React from 'react';
import { X, Heart, Star, Zap, Trophy, BookOpen, Users } from 'lucide-react';

interface CoinAwardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAward: (amount: number, reason: string) => void;
    selectedCount: number;
}

const SKILLS = [
    { id: 'helping', name: 'Helping Others', amount: 1, icon: Heart, color: 'text-pink-500', bg: 'bg-pink-100' },
    { id: 'ontask', name: 'On Task', amount: 1, icon: Star, color: 'text-yellow-500', bg: 'bg-yellow-100' },
    { id: 'participating', name: 'Participating', amount: 1, icon: Zap, color: 'text-purple-500', bg: 'bg-purple-100' },
    { id: 'teamwork', name: 'Teamwork', amount: 2, icon: Users, color: 'text-blue-500', bg: 'bg-blue-100' },
    { id: 'persistence', name: 'Working Hard', amount: 2, icon: Trophy, color: 'text-orange-500', bg: 'bg-orange-100' },
    { id: 'homework', name: 'Homework', amount: 5, icon: BookOpen, color: 'text-green-500', bg: 'bg-green-100' },
];

export function CoinAwardModal({ isOpen, onClose, onAward, selectedCount }: CoinAwardModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Give Feedback</h2>
                        <p className="text-sm text-gray-500">Awarding {selectedCount} student{selectedCount !== 1 ? 's' : ''}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Skills Grid */}
                <div className="p-8">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6">Positive Skills</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                        {SKILLS.map(skill => (
                            <button
                                key={skill.id}
                                onClick={() => onAward(skill.amount, skill.name)}
                                className="group flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-gray-50 transition-all duration-200 hover:-translate-y-1"
                            >
                                <div className={`w-16 h-16 rounded-2xl ${skill.bg} ${skill.color} flex items-center justify-center text-3xl shadow-sm group-hover:shadow-md transition-shadow`}>
                                    <skill.icon size={32} />
                                </div>
                                <div className="text-center">
                                    <div className="font-bold text-gray-700">{skill.name}</div>
                                    <div className="text-xs font-bold text-gray-400 bg-gray-100 inline-block px-2 py-0.5 rounded-full mt-1">
                                        +{skill.amount}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Footer (Custom amount could go here later) */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 text-center text-sm text-gray-400">
                    Click a skill to award points instantly
                </div>
            </div>
        </div>
    );
}
