import React from 'react';
import { AVATAR_PALETTE } from '../palette';
import { PartProps } from './FaceParts';

export const AccGlassesThick = ({ outlineColor = AVATAR_PALETTE.outline }: PartProps) => (
    <g>
        <rect x="52" y="150" width="36" height="30" rx="8" fill="none" stroke={outlineColor} strokeWidth="6" strokeLinejoin="round" />
        <rect x="112" y="150" width="36" height="30" rx="8" fill="none" stroke={outlineColor} strokeWidth="6" strokeLinejoin="round" />
        <path d="M 88 160 L 112 160" fill="none" stroke={outlineColor} strokeWidth="6" strokeLinecap="round" />
    </g>
);

export const AccBeret = ({ color = AVATAR_PALETTE.forestGreen, outlineColor = AVATAR_PALETTE.outline }: PartProps) => (
    <g>
        <path d="M 50 100 C 50 60, 150 60, 150 100 C 150 110, 100 115, 50 100 Z" fill={color} stroke={outlineColor} strokeWidth="6" strokeLinejoin="round" transform="rotate(-10, 100, 100)" />
        <circle cx="100" cy="70" r="5" fill={color} stroke={outlineColor} strokeWidth="4" transform="rotate(-10, 100, 100)" />
    </g>
);

export const AccBackpackSmall = ({ color = '#D32F2F', outlineColor = AVATAR_PALETTE.outline }: PartProps) => (
    <g>
        {/* Backpack body visible behind left shoulder */}
        <path d="M 35 230 C 25 230, 20 280, 35 290 L 55 230 Z" fill={color} stroke={outlineColor} strokeWidth="6" strokeLinejoin="round" />
        {/* Backpack straps */}
        <path d="M 60 230 L 55 290" fill="none" stroke={outlineColor} strokeWidth="4" strokeLinecap="round" opacity="0.8" />
        <path d="M 140 230 L 145 290" fill="none" stroke={outlineColor} strokeWidth="4" strokeLinecap="round" opacity="0.8" />
    </g>
);
