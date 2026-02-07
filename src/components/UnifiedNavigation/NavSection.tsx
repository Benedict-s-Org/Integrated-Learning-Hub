import React, { useState } from 'react';
import { ChevronDown, ChevronRight, LucideIcon } from 'lucide-react';

interface NavSectionProps {
    title: string;
    icon: LucideIcon;
    iconColor?: string;
    bgColor?: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    isCollapsed?: boolean;
}

export const NavSection: React.FC<NavSectionProps> = ({
    title,
    icon: Icon,
    iconColor = 'text-amber-500',
    bgColor = 'bg-amber-50',
    children,
    defaultOpen = true,
    isCollapsed = false,
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    if (isCollapsed) {
        return (
            <div className="py-2">
                <div className={`mx-auto w-10 h-10 ${bgColor} rounded-xl flex items-center justify-center`}>
                    <Icon size={20} className={iconColor} />
                </div>
            </div>
        );
    }

    return (
        <div className="mb-2">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 hover:bg-gray-50 group`}
            >
                <div className={`w-8 h-8 ${bgColor} rounded-lg flex items-center justify-center transition-transform duration-200 ${isOpen ? 'scale-105' : ''}`}>
                    <Icon size={16} className={iconColor} />
                </div>
                <span className="flex-1 text-left font-semibold text-gray-700 text-sm">{title}</span>
                <div className="text-gray-400 transition-transform duration-200">
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
            </button>

            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="pl-4 pr-2 py-1 space-y-1">
                    {children}
                </div>
            </div>
        </div>
    );
};

interface NavItemProps {
    icon: LucideIcon;
    label: string;
    isActive?: boolean;
    onClick?: () => void;
    badge?: number;
    disabled?: boolean;
}

export const NavItem: React.FC<NavItemProps> = ({
    icon: Icon,
    label,
    isActive = false,
    onClick,
    badge,
    disabled = false,
}) => {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group
        ${isActive
                    ? 'bg-gradient-to-r from-pink-100 to-orange-100 text-orange-600 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
        >
            <Icon size={18} className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} />
            <span className="flex-1 text-left text-sm font-medium">{label}</span>
            {badge !== undefined && badge > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold bg-red-100 text-red-500 rounded-full animate-pulse">
                    {badge}
                </span>
            )}
        </button>
    );
};
