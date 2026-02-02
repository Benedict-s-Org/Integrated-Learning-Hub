import React from "react";
import { WallRendererProps } from "./IsometricRoom.types";
import { findBackCorner } from "@/utils/isometricTransforms";

export const WallRenderer: React.FC<WallRendererProps> = ({
  gridSize,
  wallHeight,
  toIso,
  activeWall,
}) => {
  const baseboardHeight = 12;
  const frameThickness = 8;

  const { backCorner, prevCorner, nextCorner } = findBackCorner(gridSize, toIso);

  const hasCustomWallLight = activeWall?.lightSide;
  const hasCustomWallDark = activeWall?.darkSide;

  return (
    <g style={{ pointerEvents: "none" }}>
      {/* Gradient and pattern definitions */}
      <defs>
        {/* Teal wall gradients (fallback) */}
        <linearGradient id="wall-left-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#5DC9BF" />
          <stop offset="30%" stopColor="#4DB6AC" />
          <stop offset="100%" stopColor="#3D9B91" />
        </linearGradient>
        <linearGradient id="wall-right-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#4DB6AC" />
          <stop offset="30%" stopColor="#3D9B91" />
          <stop offset="100%" stopColor="#2D8B81" />
        </linearGradient>
        {/* Custom wall patterns */}
        {hasCustomWallLight && (
          <pattern id="custom-wall-light-pattern" patternUnits="userSpaceOnUse" width="100" height="100">
            <image href={activeWall.lightSide} width="100" height="100" preserveAspectRatio="xMidYMid slice" />
          </pattern>
        )}
        {hasCustomWallDark && (
          <pattern id="custom-wall-dark-pattern" patternUnits="userSpaceOnUse" width="100" height="100">
            <image href={activeWall.darkSide} width="100" height="100" preserveAspectRatio="xMidYMid slice" />
          </pattern>
        )}
        {/* Brown wood frame gradients */}
        <linearGradient id="wood-frame-light" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#A1887F" />
          <stop offset="50%" stopColor="#8D6E63" />
          <stop offset="100%" stopColor="#6D4C41" />
        </linearGradient>
        <linearGradient id="wood-frame-dark" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#8D6E63" />
          <stop offset="50%" stopColor="#6D4C41" />
          <stop offset="100%" stopColor="#5D4037" />
        </linearGradient>
        <linearGradient id="wood-baseboard" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#8D6E63" />
          <stop offset="100%" stopColor="#5D4037" />
        </linearGradient>
        {/* Ambient occlusion */}
        <linearGradient id="ao-shadow" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="rgba(45, 80, 75, 0.5)" />
          <stop offset="40%" stopColor="rgba(45, 80, 75, 0)" />
        </linearGradient>
      </defs>

      {/* Left wall - uses lightSide texture if available */}
      <path
        d={`M${backCorner.pos.x} ${backCorner.pos.y} L${prevCorner.pos.x} ${prevCorner.pos.y} L${prevCorner.pos.x} ${prevCorner.pos.y - wallHeight} L${backCorner.pos.x} ${backCorner.pos.y - wallHeight} Z`}
        fill={hasCustomWallLight ? "url(#custom-wall-light-pattern)" : "url(#wall-left-gradient)"}
      />
      {/* Left wall top highlight - only show if no custom texture */}
      {!hasCustomWallLight && (
        <path
          d={`M${backCorner.pos.x} ${backCorner.pos.y - wallHeight} L${prevCorner.pos.x} ${prevCorner.pos.y - wallHeight} L${prevCorner.pos.x + 2} ${prevCorner.pos.y - wallHeight + 3} L${backCorner.pos.x - 2} ${backCorner.pos.y - wallHeight + 3} Z`}
          fill="#7DD4CA"
          opacity={0.7}
        />
      )}
      {/* Left wall AO at floor */}
      <path
        d={`M${backCorner.pos.x} ${backCorner.pos.y} L${prevCorner.pos.x} ${prevCorner.pos.y} L${prevCorner.pos.x} ${prevCorner.pos.y - 40} L${backCorner.pos.x} ${backCorner.pos.y - 40} Z`}
        fill="url(#ao-shadow)"
      />

      {/* Right wall - uses darkSide texture if available */}
      <path
        d={`M${backCorner.pos.x} ${backCorner.pos.y} L${nextCorner.pos.x} ${nextCorner.pos.y} L${nextCorner.pos.x} ${nextCorner.pos.y - wallHeight} L${backCorner.pos.x} ${backCorner.pos.y - wallHeight} Z`}
        fill={hasCustomWallDark ? "url(#custom-wall-dark-pattern)" : "url(#wall-right-gradient)"}
      />
      {/* Right wall top highlight - only show if no custom texture */}
      {!hasCustomWallDark && (
        <path
          d={`M${backCorner.pos.x} ${backCorner.pos.y - wallHeight} L${nextCorner.pos.x} ${nextCorner.pos.y - wallHeight} L${nextCorner.pos.x - 2} ${nextCorner.pos.y - wallHeight + 3} L${backCorner.pos.x + 2} ${backCorner.pos.y - wallHeight + 3} Z`}
          fill="#5DC9BF"
          opacity={0.5}
        />
      )}
      {/* Right wall AO at floor */}
      <path
        d={`M${backCorner.pos.x} ${backCorner.pos.y} L${nextCorner.pos.x} ${nextCorner.pos.y} L${nextCorner.pos.x} ${nextCorner.pos.y - 40} L${backCorner.pos.x} ${backCorner.pos.y - 40} Z`}
        fill="url(#ao-shadow)"
      />

      {/* Corner highlight line */}
      <line
        x1={backCorner.pos.x}
        y1={backCorner.pos.y}
        x2={backCorner.pos.x}
        y2={backCorner.pos.y - wallHeight}
        stroke="#7DD4CA"
        strokeWidth="2"
        opacity={0.8}
      />

      {/* Brown wooden baseboard - left wall */}
      <path
        d={`M${backCorner.pos.x} ${backCorner.pos.y} L${prevCorner.pos.x} ${prevCorner.pos.y} L${prevCorner.pos.x} ${prevCorner.pos.y - baseboardHeight} L${backCorner.pos.x} ${backCorner.pos.y - baseboardHeight} Z`}
        fill="url(#wood-baseboard)"
      />
      <path
        d={`M${backCorner.pos.x} ${backCorner.pos.y - baseboardHeight} L${prevCorner.pos.x} ${prevCorner.pos.y - baseboardHeight} L${prevCorner.pos.x + 1} ${prevCorner.pos.y - baseboardHeight + 2} L${backCorner.pos.x - 1} ${backCorner.pos.y - baseboardHeight + 2} Z`}
        fill="#A1887F"
        opacity={0.8}
      />

      {/* Brown wooden baseboard - right wall */}
      <path
        d={`M${backCorner.pos.x} ${backCorner.pos.y} L${nextCorner.pos.x} ${nextCorner.pos.y} L${nextCorner.pos.x} ${nextCorner.pos.y - baseboardHeight} L${backCorner.pos.x} ${backCorner.pos.y - baseboardHeight} Z`}
        fill="url(#wood-frame-dark)"
      />
      <path
        d={`M${backCorner.pos.x} ${backCorner.pos.y - baseboardHeight} L${nextCorner.pos.x} ${nextCorner.pos.y - baseboardHeight} L${nextCorner.pos.x - 1} ${nextCorner.pos.y - baseboardHeight + 2} L${backCorner.pos.x + 1} ${backCorner.pos.y - baseboardHeight + 2} Z`}
        fill="#8D6E63"
        opacity={0.6}
      />

      {/* Brown wooden frame - top edge left wall */}
      <path
        d={`M${backCorner.pos.x} ${backCorner.pos.y - wallHeight} L${prevCorner.pos.x} ${prevCorner.pos.y - wallHeight} L${prevCorner.pos.x} ${prevCorner.pos.y - wallHeight - frameThickness} L${backCorner.pos.x} ${backCorner.pos.y - wallHeight - frameThickness} Z`}
        fill="url(#wood-frame-light)"
      />
      <path
        d={`M${backCorner.pos.x} ${backCorner.pos.y - wallHeight - frameThickness} L${prevCorner.pos.x} ${prevCorner.pos.y - wallHeight - frameThickness} L${prevCorner.pos.x + 2} ${prevCorner.pos.y - wallHeight - frameThickness + 3} L${backCorner.pos.x - 2} ${backCorner.pos.y - wallHeight - frameThickness + 3} Z`}
        fill="#BCAAA4"
        opacity={0.8}
      />

      {/* Brown wooden frame - top edge right wall */}
      <path
        d={`M${backCorner.pos.x} ${backCorner.pos.y - wallHeight} L${nextCorner.pos.x} ${nextCorner.pos.y - wallHeight} L${nextCorner.pos.x} ${nextCorner.pos.y - wallHeight - frameThickness} L${backCorner.pos.x} ${backCorner.pos.y - wallHeight - frameThickness} Z`}
        fill="url(#wood-frame-dark)"
      />
      <path
        d={`M${backCorner.pos.x} ${backCorner.pos.y - wallHeight - frameThickness} L${nextCorner.pos.x} ${nextCorner.pos.y - wallHeight - frameThickness} L${nextCorner.pos.x - 2} ${nextCorner.pos.y - wallHeight - frameThickness + 3} L${backCorner.pos.x + 2} ${backCorner.pos.y - wallHeight - frameThickness + 3} Z`}
        fill="#A1887F"
        opacity={0.6}
      />

      {/* Corner post at back corner */}
      <rect
        x={backCorner.pos.x - 6}
        y={backCorner.pos.y - wallHeight - frameThickness}
        width={12}
        height={wallHeight + frameThickness}
        fill="url(#wood-frame-light)"
      />
      <rect
        x={backCorner.pos.x - 6}
        y={backCorner.pos.y - wallHeight - frameThickness}
        width={3}
        height={wallHeight + frameThickness}
        fill="#BCAAA4"
        opacity={0.5}
      />

      {/* Corner post at left corner */}
      <rect
        x={prevCorner.pos.x - 6}
        y={prevCorner.pos.y - wallHeight - frameThickness}
        width={12}
        height={wallHeight + frameThickness}
        fill="url(#wood-frame-dark)"
      />

      {/* Corner post at right corner */}
      <rect
        x={nextCorner.pos.x - 6}
        y={nextCorner.pos.y - wallHeight - frameThickness}
        width={12}
        height={wallHeight + frameThickness}
        fill="url(#wood-frame-dark)"
      />
    </g>
  );
};
