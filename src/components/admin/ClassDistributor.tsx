import React, { useState } from 'react';
import { User } from 'lucide-react';

interface UserWithCoins {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    coins: number;
}

interface ClassDistributorProps {
    users: UserWithCoins[];
    isLoading: boolean;
    onAwardCoins: (userIds: string[], amount: number, reason: string) => Promise<void>;
}

export function ClassDistributor({ users, isLoading, onAwardCoins }: ClassDistributorProps) {
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

    const toggleUser = (id: string) => {
        const newSelected = new Set(selectedUserIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedUserIds(newSelected);
    };

    const handleSelectAll = () => {
        if (selectedUserIds.size === users.length) {
            setSelectedUserIds(new Set());
        } else {
            setSelectedUserIds(new Set(users.map(u => u.id)));
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Classroom</h2>
                    <p className="text-gray-500">Reward students with coins</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleSelectAll}
                        className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        {selectedUserIds.size === users.length ? 'Deselect All' : 'Select All'}
                    </button>
                    {selectedUserIds.size > 0 && (
                        <button
                            onClick={() => onAwardCoins(Array.from(selectedUserIds), 0, '')}
                            className="px-6 py-2 text-sm font-bold text-white bg-blue-500 rounded-lg shadow-lg hover:bg-blue-600 hover:scale-105 transition-all animate-in fade-in zoom-in"
                        >
                            Give Feedback ({selectedUserIds.size})
                        </button>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {users.map(user => {
                        const isSelected = selectedUserIds.has(user.id);
                        return (
                            <div
                                key={user.id}
                                onClick={() => toggleUser(user.id)}
                                className={`
                                    relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 flex flex-col items-center gap-3
                                    ${isSelected
                                        ? 'border-blue-500 bg-blue-50 shadow-md transform scale-[1.02]'
                                        : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
                                    }
                                `}
                            >
                                {/* Checkmark for selection */}
                                {isSelected && (
                                    <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs shadow-sm">
                                        ✓
                                    </div>
                                )}

                                {/* Avatar */}
                                <div className="w-20 h-20 rounded-2xl bg-gray-100 overflow-hidden shadow-inner">
                                    {user.avatar_url ? (
                                        <img src={user.avatar_url} alt={user.display_name || ''} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                                            <User size={40} />
                                        </div>
                                    )}
                                </div>

                                {/* Name */}
                                <span className="font-bold text-gray-700 text-center truncate w-full px-2">
                                    {user.display_name || 'Unnamed Student'}
                                </span>

                                {/* Coin Bubble */}
                                <div className="px-3 py-1 bg-green-100 text-green-700 font-bold rounded-full text-sm flex items-center gap-1 border border-green-200">
                                    <span className="text-lg">🪙</span>
                                    {user.coins}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
