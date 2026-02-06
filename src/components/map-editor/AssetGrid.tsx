import React from "react";
import { Loader2, Trash2 } from "lucide-react";

export interface AssetGridItem {
    id: string;
    name: string;
    imageUrl?: string;
    icon?: React.ReactNode;
    subtitle?: string;
    onClick?: () => void;
    onDelete?: () => void;
    isActive?: boolean;
}

interface AssetGridProps {
    items: AssetGridItem[];
    isLoading?: boolean;
    emptyMessage?: string;
    columns?: 2 | 3 | 4;
}

export const AssetGrid: React.FC<AssetGridProps> = ({
    items,
    isLoading = false,
    emptyMessage = "沒有數據",
    columns = 3
}) => {
    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="text-center p-8 text-slate-500 text-sm">
                {emptyMessage}
            </div>
        );
    }

    const gridCols = {
        2: "grid-cols-2",
        3: "grid-cols-3",
        4: "grid-cols-4",
    };

    return (
        <div className={`grid ${gridCols[columns]} gap-2`}>
            {items.map((item) => (
                <div
                    key={item.id}
                    onClick={item.onClick}
                    className={`
            relative group rounded-lg p-2 transition-all cursor-pointer border border-transparent
            ${item.isActive
                            ? "bg-emerald-600/20 border-emerald-500/50"
                            : "bg-slate-800 hover:bg-slate-700"
                        }
          `}
                >
                    {/* Image or Icon */}
                    <div className="aspect-square mb-2 rounded bg-slate-900/50 flex items-center justify-center overflow-hidden">
                        {item.imageUrl ? (
                            <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-full h-full object-contain"
                            />
                        ) : (
                            <div className="text-slate-400">
                                {item.icon}
                            </div>
                        )}
                    </div>

                    {/* Label */}
                    <div className="text-center">
                        <div className={`text-xs font-medium truncate ${item.isActive ? "text-emerald-300" : "text-slate-300"}`}>
                            {item.name}
                        </div>
                        {item.subtitle && (
                            <div className="text-[10px] text-slate-500 truncate">
                                {item.subtitle}
                            </div>
                        )}
                    </div>

                    {/* Delete Button */}
                    {item.onDelete && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                item.onDelete?.();
                            }}
                            className="absolute top-1 right-1 p-1 bg-red-600/80 hover:bg-red-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Trash2 className="w-3 h-3 text-white" />
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
};
