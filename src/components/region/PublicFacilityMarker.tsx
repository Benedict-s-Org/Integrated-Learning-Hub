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
      {/* Background glow when selected - Soft Mint/Pink */}
      {(isSelected || isHovered) && (
        <circle
          r={halfSize + 12}
          fill={displayInfo.color}
          opacity={0.2}
          filter="blur(4px)"
        />
      )}

      {/* Main marker circle - Chunky stroke & Pastel Fill */}
      <circle
        r={halfSize}
        fill={displayInfo.color}
        stroke={isSelected ? '#5D4037' : 'white'}
        strokeWidth={isSelected ? 3 : 3}
        filter="drop-shadow(0 4px 6px rgba(93, 64, 55, 0.15))"
      />

      {/* Icon - Slightly playful placement */}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={26}
        y={-1}
        filter="drop-shadow(0 2px 0 rgba(0,0,0,0.1))"
      >
        {displayInfo.icon}
      </text>

      {/* Level badge - Cute floating bubble */}
      {facility.level > 1 && (
        <g transform={`translate(${halfSize - 2}, ${-halfSize + 2})`}>
          <circle r={11} fill="#FFB7B2" stroke="#ffffff" strokeWidth={2} />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fill="#5D4037"
            fontSize={11}
            fontWeight="800"
          >
            {facility.level}
          </text>
        </g>
      )}

      {/* Facility name label - Morandi Brown */}
      <text
        y={halfSize + 18}
        textAnchor="middle"
        fill="#5D4037"
        fontSize={12}
        fontWeight="bold"
        style={{ textShadow: '0 2px 0 #FFF' }}
      >
        {facility.name}
      </text>

      {/* Hover tooltip - Glassmorphism card */}
      {isHovered && (
        <g transform={`translate(0, ${-halfSize - 55})`}>
          <rect
            x={-85}
            y={-30}
            width={170}
            height={60}
            rx={12}
            fill="rgba(255, 255, 255, 0.95)"
            stroke="#E2F0CB" // Pale Lime border
            strokeWidth={2}
            filter="drop-shadow(0 8px 16px rgba(93, 64, 55, 0.1))"
          />
          <text
            textAnchor="middle"
            y={-8}
            fill="#5D4037"
            fontSize={13}
            fontWeight="800"
          >
            {displayInfo.label} - {facility.name}
          </text>
          <text
            textAnchor="middle"
            y={12}
            fill="#8D6E63"
            fontSize={11}
          >
            {displayInfo.description}
          </text>
        </g>
      )}
    </g>
  );
}
