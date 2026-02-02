import React from 'react';
import { X, Users, Star, Gift, ArrowRight } from 'lucide-react';
import type { PublicFacility } from '@/types/region';
import { FACILITY_DISPLAY_INFO } from '@/types/region';
import { DEFAULT_FACILITY_CONFIGS } from '@/constants/regionConfig';

interface FacilityModalProps {
  facility: PublicFacility;
  onClose: () => void;
  onVisit: () => void;
}

export function FacilityModal({ facility, onClose, onVisit }: FacilityModalProps) {
  const displayInfo = FACILITY_DISPLAY_INFO[facility.facilityType];
  const defaultConfig = DEFAULT_FACILITY_CONFIGS[facility.facilityType];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden border">
        {/* Header */}
        <div 
          className="p-6 text-white relative"
          style={{ backgroundColor: displayInfo.color }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-4">
            <span className="text-5xl">{displayInfo.icon}</span>
            <div>
              <h2 className="text-2xl font-bold">{facility.name}</h2>
              <p className="text-white/80">{displayInfo.label} · 等級 {facility.level}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-muted-foreground">{displayInfo.description}</p>

          {/* Features */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Star className="w-4 h-4 text-primary" />
              設施特色
            </h3>
            <div className="flex flex-wrap gap-2">
              {defaultConfig.features.map((feature) => (
                <span
                  key={feature}
                  className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm"
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>

          {/* Rewards */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Gift className="w-4 h-4 text-primary" />
              訪問獎勵
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(defaultConfig.rewards).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-2 rounded-lg bg-secondary/50"
                >
                  <span className="text-sm text-muted-foreground capitalize">
                    {key.replace('_', ' ')}
                  </span>
                  <span className="font-semibold text-primary">+{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Capacity */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>容納人數: {defaultConfig.capacity} 人</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-secondary/20">
          <button
            onClick={onVisit}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg px-4 py-3 font-semibold hover:bg-primary/90 transition-colors"
          >
            <span>進入設施</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
