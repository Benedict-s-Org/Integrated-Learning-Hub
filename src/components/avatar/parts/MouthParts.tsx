import React from 'react';
import { AVATAR_PALETTE } from '../palette';
import { PartProps } from './FaceParts';

// Mouth is tiny, cute, placed right in the middle between the eyes, slightly above the blush line.
// y=155.
export const MouthNeutralLine = ({ color = AVATAR_PALETTE.outline }: PartProps) => (
    <g fill="none" stroke={color} strokeWidth="3" strokeLinecap="round">
        <path d="M 94 158 Q 100 162 106 158" />
    </g>
);

export const MouthSmallSmile = MouthNeutralLine;
export const MouthOpenLaugh = MouthNeutralLine;
export const MouthSmileTeeth = MouthNeutralLine;
