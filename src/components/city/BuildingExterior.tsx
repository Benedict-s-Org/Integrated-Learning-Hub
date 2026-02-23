import React from "react";
import type { Building } from "@/types/city";
import { CARTOON_PALETTE, CARTOON_BUILDING_STYLES } from "@/constants/cityStyleGuide";

interface BuildingExteriorProps {
  building: Building;
  isoX: number;
  isoY: number;
  tileWidth: number;
  tileHeight: number;
  isHovered: boolean;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

// Custom image building renderer
function CustomImageBuilding({
  building,
  isoX,
  isoY,
  tileWidth,
  tileHeight,
  isHovered,
  isSelected,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: BuildingExteriorProps) {
  const { size, isUnlocked, customImageUrl, transform } = building;

  // Get transform parameters with defaults
  const {
    offsetX = 0,
    offsetY = 0,
    scale = 1,
    scaleX = 100,
    scaleY = 100,
    rotation = 0,
  } = transform || {};

  // Calculate base dimensions
  const baseWidth = size.width * tileWidth;
  const baseHeight = size.depth * tileHeight * 2; // Taller for isometric perspective

  // Apply transform scaling
  const finalWidth = baseWidth * scale * (scaleX / 100);
  const finalHeight = baseHeight * scale * (scaleY / 100);

  // Isometric wall dimensions for selection highlight
  const leftWallWidth = size.depth * (tileWidth / 2);
  const rightWallWidth = size.width * (tileWidth / 2);

  return (
    <g
      transform={`translate(${isoX + offsetX}, ${isoY + offsetY})`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ cursor: isUnlocked ? "pointer" : "not-allowed" }}
      opacity={isUnlocked ? 1 : 0.65}
    >
      {/* Soft shadow */}
      <ellipse
        cx={0}
        cy={size.depth * tileHeight / 4 + 8}
        rx={leftWallWidth + rightWallWidth / 2 + 8}
        ry={size.depth * tileHeight / 4 + 4}
        fill={CARTOON_PALETTE.shadows.medium}
      />

      {/* Custom image with transform */}
      <image
        href={customImageUrl}
        x={-finalWidth / 2}
        y={-finalHeight}
        width={finalWidth}
        height={finalHeight}
        preserveAspectRatio="xMidYMax meet"
        transform={rotation !== 0 ? `rotate(${rotation}, 0, ${-finalHeight / 2})` : undefined}
      />

      {/* Hover/Selection highlight */}
      {(isHovered || isSelected) && (
        <polygon
          points={`
            ${-leftWallWidth},0
            0,${-size.depth * tileHeight / 2}
            ${rightWallWidth},0
            0,${size.width * tileHeight / 2}
          `}
          fill="none"
          stroke={isSelected ? "hsl(45, 90%, 60%)" : "hsl(45, 85%, 70%)"}
          strokeWidth={3}
          opacity={0.9}
          transform={`translate(0, ${size.depth * tileHeight / 4})`}
          strokeLinejoin="round"
        />
      )}

      {/* Lock icon for locked buildings */}
      {!isUnlocked && (
        <g transform={`translate(-14, ${-baseHeight / 2})`}>
          <circle r={18} fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth={2} />
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={18}
          >
            🔒
          </text>
        </g>
      )}

      {/* Building name label - Always visible for identified Memory Palaces */}
      <g transform={`translate(0, ${-finalHeight - 20})`}>
        <rect
          x={-55}
          y={-14}
          width={110}
          height={28}
          fill="white"
          stroke={isSelected ? "hsl(45, 90%, 60%)" : "hsl(30, 40%, 80%)"}
          strokeWidth={2}
          rx={8}
          opacity={0.95}
        />
        <text
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={12}
          fill="hsl(30, 50%, 35%)"
          fontWeight="700"
        >
          {building.name}
        </text>
      </g>

      {/* Review Badge */}
      {building.reviewCount && building.reviewCount > 0 && (
        <g transform={`translate(50, ${-finalHeight - 25})`}>
          <circle r={12} fill="#ef4444" stroke="white" strokeWidth={2} className="animate-pulse" />
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={10}
            fill="white"
            fontWeight="bold"
          >
            {building.reviewCount}
          </text>
        </g>
      )}
    </g>
  );
}

export function BuildingExterior({
  building,
  isoX,
  isoY,
  tileWidth,
  tileHeight,
  isHovered,
  isSelected,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: BuildingExteriorProps) {
  // If building has custom image, use the custom renderer
  if (building.customImageUrl) {
    return (
      <CustomImageBuilding
        building={building}
        isoX={isoX}
        isoY={isoY}
        tileWidth={tileWidth}
        tileHeight={tileHeight}
        isHovered={isHovered}
        isSelected={isSelected}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
    );
  }

  const { size, type, isUnlocked } = building;

  // Get cartoon style for building type
  const cartoonStyle = CARTOON_BUILDING_STYLES[type as keyof typeof CARTOON_BUILDING_STYLES] || CARTOON_BUILDING_STYLES.house;
  const stories = building.exteriorStyle?.stories || 1;

  // Calculate building dimensions in pixels
  const storyHeight = 32;
  const buildingHeight = stories * storyHeight;

  // Isometric wall dimensions
  const leftWallWidth = size.depth * (tileWidth / 2);
  const rightWallWidth = size.width * (tileWidth / 2);

  // Darken/lighten helper for HSL colors
  const adjustLightness = (color: string, amount: number) => {
    const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (match) {
      const [, h, s, l] = match;
      const newL = Math.max(0, Math.min(100, parseInt(l) + amount));
      return `hsl(${h}, ${s}%, ${newL}%)`;
    }
    return color;
  };

  // Generate cute rounded windows
  const generateCuteWindows = (wallWidth: number) => {
    const windows: React.ReactNode[] = [];
    const windowCount = Math.max(1, Math.floor(wallWidth / 28));
    const windowSpacing = wallWidth / (windowCount + 1);

    for (let s = 0; s < stories; s++) {
      for (let w = 0; w < windowCount; w++) {
        const wx = windowSpacing * (w + 1);
        const wy = buildingHeight - (s + 1) * storyHeight + 10;
        windows.push(
          <g key={`window-${s}-${w}`} transform={`translate(${wx - 7}, ${wy})`}>
            {/* Window frame */}
            <rect
              width={14}
              height={16}
              fill={CARTOON_PALETTE.windows.frame}
              rx={3}
              stroke={adjustLightness(cartoonStyle.wallColor, -15)}
              strokeWidth={1}
            />
            {/* Window glass */}
            <rect
              x={2}
              y={2}
              width={10}
              height={12}
              fill={CARTOON_PALETTE.windows.glass}
              rx={2}
            />
            {/* Window reflection */}
            <rect
              x={3}
              y={3}
              width={4}
              height={5}
              fill={CARTOON_PALETTE.windows.reflection}
              rx={1}
              opacity={0.7}
            />
            {/* Window cross */}
            <line x1={7} y1={2} x2={7} y2={14} stroke={CARTOON_PALETTE.windows.frame} strokeWidth={1.5} />
            <line x1={2} y1={8} x2={12} y2={8} stroke={CARTOON_PALETTE.windows.frame} strokeWidth={1.5} />
          </g>
        );
      }
    }
    return windows;
  };

  // Cute door component
  const renderCuteDoor = () => {
    const doorWidth = 18;
    const doorHeight = 28;
    return (
      <g transform={`translate(${rightWallWidth / 2 - doorWidth / 2}, ${buildingHeight - doorHeight})`}>
        {/* Door frame */}
        <rect
          width={doorWidth}
          height={doorHeight}
          fill={CARTOON_PALETTE.door.wood}
          rx={4}
          stroke={adjustLightness(CARTOON_PALETTE.door.wood, -15)}
          strokeWidth={1}
        />
        {/* Door panel detail */}
        <rect
          x={3}
          y={3}
          width={12}
          height={10}
          fill={adjustLightness(CARTOON_PALETTE.door.wood, 8)}
          rx={2}
        />
        <rect
          x={3}
          y={15}
          width={12}
          height={10}
          fill={adjustLightness(CARTOON_PALETTE.door.wood, 8)}
          rx={2}
        />
        {/* Door handle */}
        <circle cx={doorWidth - 5} cy={doorHeight / 2} r={2.5} fill={CARTOON_PALETTE.door.handle} />
        <circle cx={doorWidth - 5} cy={doorHeight / 2} r={1.2} fill={adjustLightness(CARTOON_PALETTE.door.handle, 15)} />
      </g>
    );
  };

  // Roof dimensions
  const roofOverhang = 8;
  const roofHeight = 22;

  return (
    <g
      transform={`translate(${isoX}, ${isoY})`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ cursor: isUnlocked ? "pointer" : "not-allowed" }}
      opacity={isUnlocked ? 1 : 0.65}
      className={isHovered ? "transition-transform" : ""}
    >
      {/* Soft shadow */}
      <ellipse
        cx={0}
        cy={size.depth * tileHeight / 4 + 8}
        rx={leftWallWidth + rightWallWidth / 2 + 8}
        ry={size.depth * tileHeight / 4 + 4}
        fill={CARTOON_PALETTE.shadows.medium}
        transform={`translate(0, ${buildingHeight - 5})`}
      />

      {/* Left wall (slightly darker) */}
      <g transform={`skewY(26.565deg) translate(${-leftWallWidth}, ${-buildingHeight})`}>
        <rect
          width={leftWallWidth}
          height={buildingHeight}
          fill={adjustLightness(cartoonStyle.wallColor, -8)}
          rx={2}
        />
        {/* Wall outline */}
        <rect
          width={leftWallWidth}
          height={buildingHeight}
          fill="none"
          stroke={adjustLightness(cartoonStyle.wallColor, -20)}
          strokeWidth={1}
          rx={2}
        />
        {generateCuteWindows(leftWallWidth)}
      </g>

      {/* Right wall (main, brighter) */}
      <g transform={`skewY(-26.565deg) translate(0, ${-buildingHeight})`}>
        <rect
          width={rightWallWidth}
          height={buildingHeight}
          fill={cartoonStyle.wallColor}
          rx={2}
        />
        {/* Wall outline */}
        <rect
          width={rightWallWidth}
          height={buildingHeight}
          fill="none"
          stroke={adjustLightness(cartoonStyle.wallColor, -15)}
          strokeWidth={1}
          rx={2}
        />
        {generateCuteWindows(rightWallWidth)}
        {renderCuteDoor()}
      </g>

      {/* Cute roof */}
      <g transform={`translate(0, ${-buildingHeight - roofHeight})`}>
        {/* Roof top surface */}
        <polygon
          points={`
            ${-leftWallWidth - roofOverhang},${roofHeight}
            0,${roofHeight - (size.depth * tileHeight / 4) - roofOverhang}
            ${rightWallWidth + roofOverhang},${roofHeight}
            0,${roofHeight + (size.width * tileHeight / 4) + roofOverhang}
          `}
          fill={cartoonStyle.roofColor}
          stroke={adjustLightness(cartoonStyle.roofColor, -15)}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        {/* Roof left edge */}
        <polygon
          points={`
            ${-leftWallWidth - roofOverhang},${roofHeight}
            0,${roofHeight + (size.width * tileHeight / 4) + roofOverhang}
            0,${roofHeight + (size.width * tileHeight / 4) + roofOverhang + 6}
            ${-leftWallWidth - roofOverhang},${roofHeight + 6}
          `}
          fill={adjustLightness(cartoonStyle.roofColor, -18)}
        />
        {/* Roof right edge */}
        <polygon
          points={`
            ${rightWallWidth + roofOverhang},${roofHeight}
            0,${roofHeight + (size.width * tileHeight / 4) + roofOverhang}
            0,${roofHeight + (size.width * tileHeight / 4) + roofOverhang + 6}
            ${rightWallWidth + roofOverhang},${roofHeight + 6}
          `}
          fill={adjustLightness(cartoonStyle.roofColor, -10)}
        />
        {/* Roof highlight */}
        <polygon
          points={`
            ${-leftWallWidth - roofOverhang + 5},${roofHeight + 2}
            0,${roofHeight - (size.depth * tileHeight / 4) - roofOverhang + 5}
            ${rightWallWidth / 3},${roofHeight - (size.depth * tileHeight / 6)}
            ${-leftWallWidth / 2},${roofHeight + 5}
          `}
          fill={adjustLightness(cartoonStyle.roofColor, 12)}
          opacity={0.5}
        />
      </g>

      {/* Cute chimney */}
      {building.exteriorStyle?.hasChimney && (
        <g transform={`translate(${rightWallWidth / 3}, ${-buildingHeight - roofHeight - 18})`}>
          <rect width={12} height={22} fill={adjustLightness(cartoonStyle.wallColor, -20)} rx={2} />
          <rect y={-4} width={16} height={6} x={-2} fill={adjustLightness(cartoonStyle.wallColor, -25)} rx={2} />
          {/* Smoke puffs */}
          <circle cx={6} cy={-12} r={4} fill="white" opacity={0.6} className="animate-float" />
          <circle cx={10} cy={-20} r={3} fill="white" opacity={0.4} className="animate-float" style={{ animationDelay: '0.5s' }} />
        </g>
      )}

      {/* Hover/Selection highlight */}
      {(isHovered || isSelected) && (
        <polygon
          points={`
            ${-leftWallWidth},0
            0,${-size.depth * tileHeight / 2}
            ${rightWallWidth},0
            0,${size.width * tileHeight / 2}
          `}
          fill="none"
          stroke={isSelected ? "hsl(45, 90%, 60%)" : "hsl(45, 85%, 70%)"}
          strokeWidth={3}
          opacity={0.9}
          transform={`translate(0, ${size.depth * tileHeight / 4})`}
          strokeLinejoin="round"
        />
      )}

      {/* Lock icon for locked buildings */}
      {!isUnlocked && (
        <g transform={`translate(-14, ${-buildingHeight / 2 - 22})`}>
          <circle r={18} fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth={2} />
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={18}
          >
            🔒
          </text>
        </g>
      )}

      {/* Building name label - Always visible */}
      <g transform={`translate(0, ${-buildingHeight - roofHeight - 35})`}>
        <rect
          x={-55}
          y={-14}
          width={110}
          height={28}
          fill="white"
          stroke={isSelected ? "hsl(45, 90%, 60%)" : "hsl(30, 40%, 80%)"}
          strokeWidth={2}
          rx={8}
          opacity={0.95}
        />
        <text
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={12}
          fill="hsl(30, 50%, 35%)"
          fontWeight="700"
        >
          {building.name}
        </text>
      </g>

      {/* Review Badge */}
      {building.reviewCount && building.reviewCount > 0 && (
        <g transform={`translate(50, ${-buildingHeight - roofHeight - 40})`}>
          <circle r={12} fill="#ef4444" stroke="white" strokeWidth={2} className="animate-pulse" />
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={10}
            fill="white"
            fontWeight="bold"
          >
            {building.reviewCount}
          </text>
        </g>
      )}

      {/* Building type icon */}
      <g transform={`translate(${rightWallWidth / 2}, ${-buildingHeight - 8})`}>
        <circle r={14} fill="white" opacity={0.9} />
        <text fontSize={18} textAnchor="middle" dominantBaseline="middle">
          {type === "house" && "🏠"}
          {type === "shop" && "🏪"}
          {type === "school" && "🏫"}
          {type === "park" && "🌳"}
          {type === "landmark" && "🏛️"}
        </text>
      </g>
    </g>
  );
}
