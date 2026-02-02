import React from "react";
import { AvatarRendererProps } from "./IsometricRoom.types";

export const AvatarRenderer: React.FC<AvatarRendererProps> = ({
  gridSize,
  toIso,
}) => {
  const avatarX = Math.floor(gridSize / 2);
  const avatarY = Math.floor(gridSize / 2);
  const avatarPos = toIso(avatarX, avatarY);

  return (
    <g
      transform={`translate(${avatarPos.x}, ${avatarPos.y - 10})`}
      style={{ pointerEvents: "none" }}
    >
      {/* Shadow */}
      <ellipse cx="0" cy="0" rx="20" ry="10" fill="rgba(0,0,0,0.15)" />
      
      {/* Body */}
      <rect x="-12" y="-45" width="24" height="35" rx="12" fill="#6366f1" />
      
      {/* Shirt detail */}
      <rect x="-6" y="-35" width="12" height="15" rx="6" fill="#818cf8" />
      
      {/* Legs */}
      <path d="M-8 -15 L-8 0" stroke="#4f46e5" strokeWidth="8" strokeLinecap="round" />
      <path d="M8 -15 L8 0" stroke="#4f46e5" strokeWidth="8" strokeLinecap="round" />
      
      {/* Head */}
      <circle cx="0" cy="-55" r="22" fill="#fda4af" stroke="#f43f5e" strokeWidth="2" />
      
      {/* Eyes */}
      <circle cx="-6" cy="-55" r="2" fill="#333" />
      <circle cx="6" cy="-55" r="2" fill="#333" />
    </g>
  );
};
