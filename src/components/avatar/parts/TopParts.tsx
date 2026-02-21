import React from 'react';
import { AVATAR_PALETTE } from '../palette';
import { PartProps } from './FaceParts';

export const TopCardigan = ({ color = AVATAR_PALETTE.navy, outlineColor = AVATAR_PALETTE.outline }: PartProps) => (
    <g>
        {/* Body */}
        <path d="M 85 220 L 115 220 L 122 280 L 78 280 Z" fill={AVATAR_PALETTE.offWhite} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        {/* V Neck */}
        <path d="M 78 280 L 122 280 L 100 240 Z" fill={AVATAR_PALETTE.offWhite} />
        {/* Left Arm */}
        <path d="M 65 220 C 40 230, 35 280, 45 295 C 55 305, 65 300, 70 280 L 85 220 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        {/* Right Arm */}
        <path d="M 135 220 C 160 230, 165 280, 155 295 C 145 305, 135 300, 130 280 L 115 220 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        {/* Cardigan Left Flap */}
        <path d="M 85 220 L 65 220 L 78 280 L 98 280 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        {/* Cardigan Right Flap */}
        <path d="M 115 220 L 135 220 L 122 280 L 102 280 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
    </g>
);

export const TopHoodie = ({ color = AVATAR_PALETTE.forestGreen, outlineColor = AVATAR_PALETTE.outline }: PartProps) => (
    <g>
        <path d="M 40 210 C 40 180, 160 180, 160 210 L 150 240 L 50 240 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        <path d="M 65 220 C 35 230, 25 280, 35 295 L 165 295 C 175 280, 165 230, 135 220 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        <path d="M 80 260 L 120 260 L 125 285 L 75 285 Z" fill={color} opacity="0.8" stroke={outlineColor} strokeWidth="3" strokeLinejoin="round" />
        <path d="M 85 230 L 85 255 M 115 230 L 115 255" fill="none" stroke={outlineColor} strokeWidth="3" strokeLinecap="round" />
    </g>
);

export const TopTShirt = ({ color = AVATAR_PALETTE.calmBlue, outlineColor = AVATAR_PALETTE.outline }: PartProps) => (
    <g>
        <path d="M 65 220 C 35 230, 30 250, 35 265 L 60 265 L 75 240 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        <path d="M 135 220 C 165 230, 170 250, 165 265 L 140 265 L 125 240 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        <path d="M 85 220 C 95 235, 105 235, 115 220 L 135 225 L 122 280 L 78 280 L 65 225 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        <path d="M 40 265 L 55 265 L 60 300 C 50 305, 40 300, 35 295 Z" fill={AVATAR_PALETTE.skinPeach} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        <path d="M 160 265 L 145 265 L 140 300 C 150 305, 160 300, 165 295 Z" fill={AVATAR_PALETTE.skinPeach} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
    </g>
);

export const TopJacket = ({ color = AVATAR_PALETTE.softYellow, outlineColor = AVATAR_PALETTE.outline }: PartProps) => (
    <g>
        <path d="M 90 220 C 100 230, 100 230, 110 220 L 122 280 L 78 280 Z" fill={AVATAR_PALETTE.offWhite} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        <path d="M 65 220 C 40 230, 25 280, 35 295 C 45 300, 55 300, 60 295 L 75 260 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        <path d="M 135 220 C 160 230, 175 280, 165 295 C 155 300, 145 300, 140 295 L 125 260 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        <path d="M 85 220 L 65 220 L 78 280 L 98 280 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        <path d="M 115 220 L 135 220 L 122 280 L 102 280 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
    </g>
);
