import React from 'react';
import { AVATAR_PALETTE } from '../palette';
import { PartProps } from './FaceParts';

export const ShoesSneakers = ({ color = AVATAR_PALETTE.offWhite, outlineColor = AVATAR_PALETTE.outline }: PartProps) => (
    <g>
        <path d="M 83 360 C 65 360, 60 375, 75 385 L 93 385 L 93 360 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        <path d="M 117 360 C 135 360, 140 375, 125 385 L 107 385 L 107 360 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        <path d="M 70 375 C 78 375, 85 378, 93 378 M 130 375 C 122 375, 115 378, 107 378" fill="none" stroke={outlineColor} strokeWidth="3" strokeLinecap="round" />
    </g>
);

export const ShoesDress = ({ color = AVATAR_PALETTE.navy, outlineColor = AVATAR_PALETTE.outline }: PartProps) => (
    <g>
        <path d="M 83 360 C 72 365, 65 375, 76 385 L 94 385 L 94 360 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        <path d="M 117 360 C 128 365, 135 375, 124 385 L 106 385 L 106 360 Z" fill={color} stroke={outlineColor} strokeWidth="5" strokeLinejoin="round" />
        <path d="M 86 385 L 94 385 L 94 392 L 86 392 Z" fill={color} stroke={outlineColor} strokeWidth="3" strokeLinejoin="round" />
        <path d="M 114 385 L 106 385 L 106 392 L 114 392 Z" fill={color} stroke={outlineColor} strokeWidth="3" strokeLinejoin="round" />
    </g>
);
