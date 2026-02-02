import React from 'react';
import type { PublicFacility } from '@/types/region';
import { FACILITY_DISPLAY_INFO } from '@/types/region';
import { REGION_CONFIG } from '@/constants/regionConfig';

interface PublicFacilityMarkerProps {
  facility: PublicFacility;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: (facilityId: string) => void;
  onHover: (facilityId: string | null) => void;
}

export function PublicFacilityMarker({ 
  facility, 
  isSelected, 
  isHovered, 
  onSelect, 
  onHover 
}: PublicFacilityMarkerProps) {
  const { tileWidth, tileHeight } = REGION_CONFIG;
  const displayInfo = FACILITY_DISPLAY_INFO[facility.facilityType];
  
  // Calculate isometric position
  const isoX = (facility.position.x - facility.position.y) * (tileWidth / 2);
  const isoY = (facility.position.x + facility.position.y) * (tileHeight / 2);

  const markerSize = 50;
  const halfSize = markerSize / 2;

  return (
    <g
      transform={`translate(${isoX}, ${isoY})`}
      onClick={() => onSelect(facility.id)}
      onMouseEnter={() => onHover(facility.id)}
      onMouseLeave={() => onHover(null)}
      style={{ cursor: 'pointer' }}
    >
      {/* Background glow when selected */}
      {(isSelected || isHovered) && (
        <circle
          r={halfSize + 10}
          fill={displayInfo.color}
          opacity={0.3}
        />
      )}

      {/* Main marker circle */}
      <circle
        r={halfSize}
        fill={displayInfo.color}
        stroke={isSelected ? 'hsl(var(--primary))' : 'white'}
        strokeWidth={isSelected ? 4 : 2}
        filter={isHovered ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' : undefined}
      />

      {/* Icon */}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={24}
        y={-2}
      >
        {displayInfo.icon}
      </text>

      {/* Level badge */}
      {facility.level > 1 && (
        <g transform={`translate(${halfSize - 5}, ${-halfSize + 5})`}>
          <circle r={10} fill="hsl(var(--primary))" />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fill="white"
            fontSize={10}
            fontWeight="bold"
          >
            {facility.level}
          </text>
        </g>
      )}

      {/* Facility name label */}
      <text
        y={halfSize + 15}
        textAnchor="middle"
        fill="hsl(var(--foreground))"
        fontSize={11}
        fontWeight="600"
      >
        {facility.name}
      </text>

      {/* Hover tooltip */}
      {isHovered && (
        <g transform={`translate(0, ${-halfSize - 50})`}>
          <rect
            x={-80}
            y={-25}
            width={160}
            height={50}
            rx={6}
            fill="hsl(var(--popover))"
            stroke="hsl(var(--border))"
          />
          <text
            textAnchor="middle"
            y={-8}
            fill="hsl(var(--popover-foreground))"
            fontSize={12}
            fontWeight="bold"
          >
            {displayInfo.label} - {facility.name}
          </text>
          <text
            textAnchor="middle"
            y={10}
            fill="hsl(var(--muted-foreground))"
            fontSize={10}
          >
            {displayInfo.description}
          </text>
        </g>
      )}
    </g>
  );
}
