import React from "react";
import { WallRendererProps } from "./IsometricRoom.types";
import { findBackCorner } from "@/utils/isometricTransforms";

export const WallRenderer: React.FC<WallRendererProps> = ({
  gridSize,
  wallHeight,
  toIso,
  activeWall,
}) => {

  const { backCorner, prevCorner, nextCorner } = findBackCorner(gridSize, toIso);

  const hasCustomWallLight = activeWall?.lightSide || activeWall?.lightImage;
  const hasCustomWallDark = activeWall?.darkSide || activeWall?.darkImage;
  const hasCustomColor = activeWall?.color;

  return (
    <g style={{ pointerEvents: "none" }}>
      {/* Gradient and pattern definitions */}
      <defs>
        {/* Wall color gradients */}
        {hasCustomColor ? (
          <>
            <linearGradient id="wall-left-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={hasCustomColor} style={{ filter: 'brightness(1.1)' }} />
              <stop offset="30%" stopColor={hasCustomColor} />
              <stop offset="100%" stopColor={hasCustomColor} style={{ filter: 'brightness(0.9)' }} />
            </linearGradient>
            <linearGradient id="wall-right-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={hasCustomColor} />
              <stop offset="30%" stopColor={hasCustomColor} style={{ filter: 'brightness(0.9)' }} />
              <stop offset="100%" stopColor={hasCustomColor} style={{ filter: 'brightness(0.8)' }} />
            </linearGradient>
          </>
        ) : (
          <>
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
          </>
        )}
        {/* Custom wall patterns */}
        {hasCustomWallLight && (
          <pattern id="custom-wall-light-pattern" patternUnits="userSpaceOnUse" width="100" height="100">
            <image href={activeWall?.lightSide || activeWall?.lightImage} width="100" height="100" preserveAspectRatio="xMidYMid slice" />
          </pattern>
        )}
        {hasCustomWallDark && (
          <pattern id="custom-wall-dark-pattern" patternUnits="userSpaceOnUse" width="100" height="100">
            <image href={activeWall?.darkSide || activeWall?.darkImage} width="100" height="100" preserveAspectRatio="xMidYMid slice" />
          </pattern>
        )}
        {/* Ambient occlusion */}
        <linearGradient id="ao-shadow" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="rgba(45, 80, 75, 0.4)" />
          <stop offset="40%" stopColor="rgba(45, 80, 75, 0)" />
        </linearGradient>
      </defs>

      {/* Left wall - uses lightSide texture if available */}
      <path
        d={`M${backCorner.pos.x} ${backCorner.pos.y} L${prevCorner.pos.x} ${prevCorner.pos.y} L${prevCorner.pos.x} ${prevCorner.pos.y - wallHeight} L${backCorner.pos.x} ${backCorner.pos.y - wallHeight} Z`}
        fill={hasCustomWallLight ? "url(#custom-wall-light-pattern)" : "url(#wall-left-gradient)"}
      />
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
        stroke={hasCustomColor || "#7DD4CA"}
        strokeWidth="1"
        opacity={0.3}
      />
    </g>
  );
};
