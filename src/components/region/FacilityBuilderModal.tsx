import React, { useState } from 'react';
import { X, Building2, Check } from 'lucide-react';
import type { FacilityType } from '@/types/region';
import { FACILITY_DISPLAY_INFO } from '@/types/region';

interface FacilityBuilderModalProps {
    onClose: () => void;
    onBuild: (type: FacilityType, name: string) => void;
}

export function FacilityBuilderModal({ onClose, onBuild }: FacilityBuilderModalProps) {
    const [selectedType, setSelectedType] = useState<FacilityType>('park');
    const [name, setName] = useState('');

    const handleBuild = () => {
        if (!name.trim()) return;
        onBuild(selectedType, name);
    };

    const facilityTypes = Object.entries(FACILITY_DISPLAY_INFO).map(([key, info]) => ({
        type: key as FacilityType,
        ...info
    }));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-card rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden border">
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between bg-secondary/20">
                    <div className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-bold">建設公共設施</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-secondary transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Facility Type Selection */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-muted-foreground">設施類型</label>
                        <div className="grid grid-cols-2 gap-3">
                            {facilityTypes.map((info) => (
                                <button
                                    key={info.type}
                                    onClick={() => setSelectedType(info.type)}
                                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${selectedType === info.type
                                            ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                                            : 'hover:border-primary/50 hover:bg-secondary/50'
                                        }`}
                                >
                                    <span className="text-2xl">{info.icon}</span>
                                    <div>
                                        <div className="font-semibold">{info.label}</div>
                                        <div className="text-xs text-muted-foreground truncate max-w-[120px]">
                                            {info.description}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Name Input */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-muted-foreground">設施名稱</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={`輸入${FACILITY_DISPLAY_INFO[selectedType].label}名稱...`}
                            className="w-full px-4 py-2 rounded-lg bg-background border focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-secondary/20 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg hover:bg-secondary transition-colors text-sm font-medium"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleBuild}
                        disabled={!name.trim()}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Check className="w-4 h-4" />
                        開始建設
                    </button>
                </div>
            </div>
        </div>
    );
}
