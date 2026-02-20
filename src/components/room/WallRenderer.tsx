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

  // Helper to adjust hex color brightness
  const adjustBrightness = (hex: string, percent: number) => {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? (R < 0 ? 0 : R) : 255) * 0x10000 + (G < 255 ? (G < 0 ? 0 : G) : 255) * 0x100 + (B < 255 ? (B < 0 ? 0 : B) : 255)).toString(16).slice(1);
  };

  const wallColor = hasCustomColor || "#4DB6AC";
  const leftColorTop = adjustBrightness(wallColor, 10);
  const leftColorMid = wallColor;
  const leftColorBot = adjustBrightness(wallColor, -10);

  const rightColorTop = adjustBrightness(wallColor, -5);
  const rightColorMid = adjustBrightness(wallColor, -15);
  const rightColorBot = adjustBrightness(wallColor, -25);

  return (
    <g style={{ pointerEvents: "none" }}>
      {/* Gradient and pattern definitions */}
      <defs>
        {/* Wall color gradients */}
        <linearGradient id="wall-left-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={leftColorTop} />
          <stop offset="30%" stopColor={leftColorMid} />
          <stop offset="100%" stopColor={leftColorBot} />
        </linearGradient>
        <linearGradient id="wall-right-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={rightColorTop} />
          <stop offset="30%" stopColor={rightColorMid} />
          <stop offset="100%" stopColor={rightColorBot} />
        </linearGradient>
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

      </defs>

      {/* Left wall - uses lightSide texture if available */}
      <path
        d={`M${backCorner.pos.x} ${backCorner.pos.y} L${prevCorner.pos.x} ${prevCorner.pos.y} L${prevCorner.pos.x} ${prevCorner.pos.y - wallHeight} L${backCorner.pos.x} ${backCorner.pos.y - wallHeight} Z`}
        fill={hasCustomWallLight ? "url(#custom-wall-light-pattern)" : "url(#wall-left-gradient)"}
      />


      {/* Right wall - uses darkSide texture if available */}
      <path
        d={`M${backCorner.pos.x} ${backCorner.pos.y} L${nextCorner.pos.x} ${nextCorner.pos.y} L${nextCorner.pos.x} ${nextCorner.pos.y - wallHeight} L${backCorner.pos.x} ${backCorner.pos.y - wallHeight} Z`}
        fill={hasCustomWallDark ? "url(#custom-wall-dark-pattern)" : "url(#wall-right-gradient)"}
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
