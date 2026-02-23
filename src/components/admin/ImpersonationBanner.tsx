import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface ImpersonationBannerProps {
    name: string;
    onExit: () => void;
}

export const ImpersonationBanner: React.FC<ImpersonationBannerProps> = ({ name, onExit }) => {
    return (
        <div className="sticky top-0 z-[100] bg-indigo-600 text-white px-6 py-3 flex items-center justify-between shadow-xl backdrop-blur-md bg-indigo-600/90 whitespace-nowrap overflow-hidden min-h-[56px] w-full">
            <div className="flex items-center gap-4">
                <div className="p-2 bg-white/20 rounded-xl animate-pulse">
                    <Eye className="w-5 h-5 text-white" />
                </div>
                <div className="flex items-center gap-2">
                    <span className="font-black tracking-tight text-sm md:text-base border-r border-white/20 pr-3 mr-1 hidden sm:inline">
                        Admin Impersonation Mode
                    </span>
                    <span className="text-xs md:text-sm font-medium opacity-80">Viewing as:</span>
                    <span className="font-bold truncate max-w-[150px] md:max-w-none inline-block align-bottom">{name}</span>
                </div>
            </div>

            <button
                onClick={onExit}
                className="bg-white text-indigo-600 hover:bg-indigo-50 px-4 md:px-6 py-2 rounded-xl font-black text-sm transition-all shadow-lg active:scale-95 flex items-center gap-2 shrink-0"
            >
                <EyeOff className="w-4 h-4" />
                <span className="hidden xs:inline">Exit View</span>
                <span className="xs:hidden">Exit</span>
            </button>
        </div>
    );
};
