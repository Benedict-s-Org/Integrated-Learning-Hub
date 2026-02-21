import React from 'react';
import { AVATAR_PALETTE } from '../palette';
import { PartProps } from './FaceParts';

export const LegsFixed = ({ color = AVATAR_PALETTE.skinPeach, outlineColor = AVATAR_PALETTE.outline }: PartProps) => (
    <g id="legs-layer">
        <path className="upper-leg" d="M 76 280 L 98 280 L 95 330 L 80 330 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        <path className="upper-leg" d="M 102 280 L 124 280 L 120 330 L 105 330 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        <path className="lower-leg" d="M 80 330 L 95 330 L 93 360 L 83 360 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        <path className="lower-leg" d="M 105 330 L 120 330 L 117 360 L 107 360 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
    </g>
);

export const BottomJeans = ({ color = AVATAR_PALETTE.navy, outlineColor = AVATAR_PALETTE.outline }: PartProps) => (
    <g>
        <path d="M 70 278 L 130 278 C 135 290, 140 310, 125 330 L 75 330 C 60 310, 65 290, 70 278 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        <path d="M 75 315 L 98 315 L 95 365 L 80 365 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        <path d="M 102 315 L 125 315 L 120 365 L 105 365 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
    </g>
);

export const BottomShorts = ({ color = '#81D4FA', outlineColor = AVATAR_PALETTE.outline }: PartProps) => (
    <g>
        <path d="M 70 278 L 130 278 C 135 290, 140 310, 125 330 L 75 330 C 60 310, 65 290, 70 278 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        <path d="M 75 315 L 98 315 L 97 335 L 77 335 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        <path d="M 102 315 L 125 315 L 123 335 L 103 335 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
    </g>
);

export const BottomSkirtALine = ({ color = AVATAR_PALETTE.forestGreen, outlineColor = AVATAR_PALETTE.outline }: PartProps) => (
    <g>
        <path d="M 70 278 L 130 278 C 145 300, 155 330, 140 340 C 135 345, 65 345, 60 340 C 45 330, 55 300, 70 278 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
    </g>
);

export const BottomSkirtPleated = ({ color = AVATAR_PALETTE.navy, outlineColor = AVATAR_PALETTE.outline }: PartProps) => (
    <g>
        <path d="M 70 278 L 130 278 L 145 335 C 120 345, 80 345, 55 335 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        <path d="M 85 278 L 72 335 M 100 278 L 100 340 M 115 278 L 128 335" fill="none" stroke={outlineColor} strokeWidth="3" strokeLinecap="round" />
    </g>
);
