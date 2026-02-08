import { useState, useEffect } from 'react';
import { X, User as UserIcon, Award, Activity, Settings, TrendingUp, ChevronRight } from 'lucide-react';
import { StudentOverview } from './tabs/StudentOverview';
import { StudentProgress } from './tabs/StudentProgress';

interface UserWithCoins {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    coins: number;
    class?: string | null;
}

interface StudentProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    student: UserWithCoins | null;
    onUpdateCoins: () => void; // Callback to refresh parent list
}

type TabType = 'overview' | 'progress' | 'assignments' | 'settings';

export function StudentProfileModal({ isOpen, onClose, student, onUpdateCoins }: StudentProfileModalProps) {
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
        <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto ${isClosing ? 'opacity-0' : 'opacity-100'}`}
                onClick={handleClose}
            />

            {/* Slide-over Panel */}
            <div
                className={`
                    relative w-full max-w-4xl h-full bg-white shadow-2xl flex flex-col pointer-events-auto
                    transform transition-transform duration-300 ease-in-out
                    ${isClosing ? 'translate-x-full' : 'translate-x-0'}
                `}
            >
                {/* Header / Sidebar Layout */}
                <div className="flex h-full overflow-hidden">
                    {/* Left Sidebar */}
                    <div className="w-64 bg-slate-50 border-r border-slate-200 flex-shrink-0 flex flex-col">
                        {/* Profile Header */}
                        <div className="p-6 flex flex-col items-center border-b border-slate-200 bg-white">
                            <div className="relative mb-4">
                                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg bg-slate-200">
                                    {student.avatar_url ? (
                                        <img src={student.avatar_url} alt={student.display_name || ''} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                                            <UserIcon size={48} />
                                        </div>
                                    )}
                                </div>
                                <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full shadow-sm border-2 border-white flex items-center gap-1">
                                    <span>🪙</span>
                                    <span>{student.coins}</span>
                                </div>
                            </div>

                            <h2 className="text-lg font-bold text-slate-900 text-center truncate w-full">
                                {student.display_name || 'Student'}
                            </h2>
                            <p className="text-sm text-slate-500 font-medium">
                                {student.class || 'No Class'}
                            </p>
                        </div>

                        {/* Navigation Menu */}
                        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                            <NavItem
                                icon={Activity}
                                label="Overview"
                                active={activeTab === 'overview'}
                                onClick={() => setActiveTab('overview')}
                            />
                            <NavItem
                                icon={TrendingUp}
                                label="Progress"
                                active={activeTab === 'progress'}
                                onClick={() => setActiveTab('progress')}
                            />
                            <NavItem
                                icon={Award}
                                label="Assignments"
                                active={activeTab === 'assignments'}
                                onClick={() => setActiveTab('assignments')}
                            />
                            <div className="my-4 border-t border-slate-200 mx-2" />
                            <NavItem
                                icon={Settings}
                                label="Settings"
                                active={activeTab === 'settings'}
                                onClick={() => setActiveTab('settings')}
                            />
                        </nav>

                        {/* Footer Info */}
                        <div className="p-4 border-t border-slate-200 bg-slate-50 text-xs text-slate-400 text-center">
                            ID: {student.id.slice(0, 8)}
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col bg-slate-50/50 h-full overflow-hidden">
                        {/* Mobile/Tablet Header (Simplified) */}
                        <div className="h-16 flex items-center justify-between px-6 bg-white border-b border-slate-200 flex-shrink-0">
                            <h3 className="text-xl font-bold text-slate-800 capitalize">
                                {activeTab}
                            </h3>
                            <button
                                onClick={handleClose}
                                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Content Body */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {activeTab === 'overview' && (
                                <StudentOverview
                                    student={student}
                                    onUpdateCoins={onUpdateCoins}
                                />
                            )}
                            {activeTab === 'progress' && (
                                <StudentProgress studentId={student.id} />
                            )}
                            {activeTab === 'assignments' && (
                                <div className="p-8 text-center text-slate-400">
                                    Coming soon: Assignment history
                                </div>
                            )}
                            {activeTab === 'settings' && (
                                <div className="p-8 text-center text-slate-400">
                                    Coming soon: Individual student settings
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function NavItem({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                ${active
                    ? 'bg-blue-50 text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }
            `}
        >
            <Icon size={18} className={active ? 'text-blue-500' : 'text-slate-400'} />
            <span className="flex-1 text-left">{label}</span>
            {active && <ChevronRight size={16} className="text-blue-400" />}
        </button>
    );
}
