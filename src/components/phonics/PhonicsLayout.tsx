import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Volume2, Layers, Gamepad2, Hammer } from 'lucide-react';

export const PhonicsLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const tabs = [
        { id: 'wall', label: 'Sound Wall', icon: Volume2, path: '/phonics/wall' },
        { id: 'blending', label: 'Blending Board', icon: Layers, path: '/phonics/blending' },
        { id: 'games', label: 'Game Hub', icon: Gamepad2, path: '/phonics/games' },
        { id: 'builder', label: 'Word Builder', icon: Hammer, path: '/phonics/builder' },
    ];

    const currentTab = tabs.find(tab => location.pathname.startsWith(tab.path))?.id || 'wall';

    return (
        <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-amber-100 font-fredoka">
            <div className="max-w-7xl mx-auto px-4 py-4">
                {/* Top Navigation Bar */}
                <div className="bg-white/80 backdrop-blur-md rounded-2xl p-2 shadow-sm mb-6 flex flex-wrap gap-2">
                    {tabs.map((tab) => {
                        const isActive = currentTab === tab.id;
                        const Icon = tab.icon;

                        return (
                            <button
                                key={tab.id}
                                onClick={() => navigate(tab.path)}
                                className={`
                  flex items-center gap-2 px-4 py-3 rounded-xl transition-all duration-200
                  font-medium text-sm sm:text-base flex-1 sm:flex-none justify-center
                  ${isActive
                                        ? 'bg-amber-500 text-white shadow-md transform scale-105'
                                        : 'text-amber-700 hover:bg-amber-100'
                                    }
                `}
                            >
                                <Icon className={`w-5 h-5 ${isActive ? 'animate-bounce' : ''}`} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Content Area */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Outlet />
                </div>
            </div>
        </div>
    );
};
