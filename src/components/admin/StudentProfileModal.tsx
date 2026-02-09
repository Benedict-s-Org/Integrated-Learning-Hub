import { useState, useEffect } from 'react';
import { X, User as UserIcon, Award, Activity, Settings, TrendingUp, Bell } from 'lucide-react';
import { StudentOverview } from './tabs/StudentOverview';
import { StudentProgress } from './tabs/StudentProgress';
import { StudentHistory } from './tabs/StudentHistory';

interface UserWithCoins {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    coins: number;
    virtual_coins?: number;
    daily_real_earned?: number;
    class?: string | null;
}

interface StudentProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    student: UserWithCoins | null;
    onUpdateCoins: () => void;
    isGuestMode?: boolean;
    guestToken?: string;
}

type TabType = 'overview' | 'progress' | 'notifications' | 'settings';

export function StudentProfileModal({
    isOpen,
    onClose,
    student,
    onUpdateCoins,
    isGuestMode = false,
    guestToken
}: StudentProfileModalProps) {
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [isClosing, setIsClosing] = useState(false);

    // Reset tab when modal opens for a new student
    useEffect(() => {
        if (isOpen) {
            setActiveTab('overview');
            setIsClosing(false);
        }
    }, [isOpen, student?.id]);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
            setIsClosing(false);
        }, 300); // Animation duration
    };

    if (!isOpen || !student) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6 pointer-events-none">
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto ${isClosing ? 'opacity-0' : 'opacity-100'}`}
                onClick={handleClose}
            />

            {/* Floating Window */}
            <div
                className={`
                    relative w-full max-w-4xl max-h-[90vh] bg-slate-50 rounded-[2.5rem] shadow-2xl flex flex-col pointer-events-auto overflow-hidden
                    transform transition-all duration-300 ease-out border border-white/20
                    ${isClosing ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'}
                `}
            >
                {/* Horizontal Top Header & Navigation */}
                <div className="bg-white border-b border-slate-100 px-4 py-3 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-slate-100 shadow-sm bg-slate-100">
                                    {student.avatar_url ? (
                                        <img src={student.avatar_url} alt={student.display_name || ''} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                                            <UserIcon size={18} />
                                        </div>
                                    )}
                                </div>
                                <div className="absolute -bottom-1 -right-1 flex items-center gap-1.5 px-3 py-1 bg-yellow-100 text-yellow-700 font-bold rounded-full text-xs border border-yellow-200 shadow-sm">
                                    <span className="text-sm">🪙</span>
                                    <span>{student.coins - (student.daily_real_earned || 0)}+{student.daily_real_earned || 0}</span>
                                    <span className="text-[10px] opacity-75">({student.virtual_coins || 0})</span>
                                </div>
                            </div>
                            <div>
                                <h3 className="font-black text-slate-900 text-sm leading-tight">
                                    {student.display_name || 'Student'}
                                </h3>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                                    {student.class || 'No Class'}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={handleClose}
                            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Horizontal Chips Navigation */}
                    <nav className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                        <NavChip
                            icon={Activity}
                            label="Overview"
                            active={activeTab === 'overview'}
                            onClick={() => setActiveTab('overview')}
                        />
                        <NavChip
                            icon={TrendingUp}
                            label="Progress"
                            active={activeTab === 'progress'}
                            onClick={() => setActiveTab('progress')}
                        />
                        <NavChip
                            icon={Bell}
                            label="Notifications"
                            active={activeTab === 'notifications'}
                            onClick={() => setActiveTab('notifications')}
                        />
                        <NavChip
                            icon={Settings}
                            label="Settings"
                            active={activeTab === 'settings'}
                            onClick={() => setActiveTab('settings')}
                        />
                    </nav>
                </div>

                {/* Content Body - Scrollable */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar">
                    {activeTab === 'overview' && (
                        <StudentOverview
                            student={student}
                            onUpdateCoins={onUpdateCoins}
                            onSuccess={handleClose}
                            isGuestMode={isGuestMode}
                            guestToken={guestToken}
                        />
                    )}
                    {activeTab === 'progress' && (
                        <StudentProgress studentId={student.id} />
                    )}
                    {activeTab === 'notifications' && (
                        <StudentHistory studentId={student.id} />
                    )}
                    {activeTab === 'settings' && (
                        <div className="p-8 text-center text-slate-400 font-medium italic">
                            Individual settings coming soon...
                        </div>
                    )}
                </div>

                {/* Footer ID Badge */}
                <div className="px-6 py-2 bg-slate-100/50 text-[10px] text-slate-300 text-center font-bold uppercase tracking-widest border-t border-slate-200/40">
                    Student ID: {student.id.slice(0, 12)}...
                </div>
            </div>
        </div>
    );
}

function NavChip({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`
                flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition-all duration-200 border-2
                ${active
                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/25 scale-105'
                    : 'bg-white border-slate-100 text-slate-500 hover:border-blue-200 hover:text-blue-600'
                }
            `}
        >
            <Icon size={14} className={active ? 'text-white' : 'text-slate-400'} />
            <span className="uppercase tracking-widest text-[10px]">{label}</span>
        </button>
    );
}
