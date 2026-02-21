import React from 'react';
import { AVATAR_PALETTE } from '../palette';
import { PartProps } from './FaceParts';

export const HairShortNeat = ({ color = AVATAR_PALETTE.hairBrown, outlineColor = AVATAR_PALETTE.outline }: PartProps) => (
    <g>
        {/* Base back volume */}
        <path d="M 20 150 C -10 90, 30 15, 100 15 C 170 15, 210 90, 180 150 C 190 180, 160 190, 140 190 L 60 190 C 40 190, 10 180, 20 150 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        {/* Front clean sweep */}
        <path d="M 15 120 C 25 50, 90 40, 110 70 L 115 130 C 125 100, 140 70, 185 120 C 170 70, 130 50, 100 50 C 60 50, 25 80, 15 120 Z" fill={color} stroke={outlineColor} strokeWidth="4" />
        <path d="M 115 130 C 112 140, 108 150, 100 150 C 110 150, 115 140, 120 130" fill={color} stroke={outlineColor} strokeWidth="2" />
    </g>
);

export const HairMessyBangs = ({ color = AVATAR_PALETTE.hairBrown, outlineColor = AVATAR_PALETTE.outline }: PartProps) => (
    <g>
        <path d="M 10 140 C -5 70, 40 10, 100 10 C 160 10, 205 70, 190 140 C 200 180, 170 190, 140 190 L 60 190 C 30 190, 0 180, 10 140 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        <path d="M 15 120 C 20 80, 50 60, 70 90 L 75 120 L 80 80 L 105 120 L 115 80 L 140 120 L 145 80 C 160 70, 180 90, 185 120 C 170 50, 30 50, 15 120 Z" fill={color} stroke={outlineColor} strokeWidth="4" />
    </g>
);

export const HairSidePart = ({ color = AVATAR_PALETTE.hairBrown, outlineColor = AVATAR_PALETTE.outline }: PartProps) => (
    <g>
        <path d="M 15 140 C 0 50, 40 10, 100 10 C 160 10, 200 50, 185 140 C 200 190, 170 200, 140 200 L 60 200 C 30 200, 0 190, 15 140 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        <path d="M 15 130 C 20 60, 80 30, 130 50 C 130 50, 160 55, 180 80 C 190 130, 170 170, 160 180 C 140 120, 100 80, 50 100 C 40 130, 30 150, 25 180 C 10 160, 10 140, 15 130 Z" fill={color} stroke={outlineColor} strokeWidth="4" />
        <path d="M 125 50 C 150 70, 170 120, 155 180 C 135 140, 110 100, 80 80" fill="none" stroke={outlineColor} strokeWidth="4" opacity="0.6" />
    </g>
);

export const HairPonytail = ({ color = AVATAR_PALETTE.hairBrown, outlineColor = AVATAR_PALETTE.outline }: PartProps) => (
    <g>
        <path d="M 20 140 C 10 70, 40 20, 100 20 C 160 20, 190 70, 180 140 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        <path d="M 180 60 C 250 50, 240 160, 190 200 C 220 140, 200 80, 180 60 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        <rect x="175" y="55" width="12" height="25" rx="5" fill="#D32F2F" stroke={outlineColor} strokeWidth="3" transform="rotate(-25, 175, 55)" />
        <path d="M 15 120 C 25 50, 150 40, 185 110 C 160 80, 100 70, 15 120 Z" fill={color} stroke={outlineColor} strokeWidth="4" />
    </g>
);
