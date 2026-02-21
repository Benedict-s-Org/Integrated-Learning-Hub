import React from 'react';
import { AVATAR_PALETTE } from '../palette';
import { PartProps } from './FaceParts';

// From the reference:
// - Eyes are large, tall ovals with a slight inward tilt.
// - Placed wide apart (close to the ears).
// - They sit around y=120 to y=150.
export const EyesNeutralOpen = ({ color = AVATAR_PALETTE.outline }: PartProps) => (
    <g>
        {/* Left Eye */}
        <g transform="translate(45, 125) rotate(5)">
            {/* Eyebrow - slightly curved, thin */}
            <path d="M -8 -20 Q 5 -25 18 -18" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />

            {/* Upper lash line (thicker) */}
            <path d="M -12 0 C -5 -15, 15 -15, 22 2" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" />

            {/* Lower lash line (thinner, detached) */}
            <path d="M -5 18 Q 5 22 15 18" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />

            {/* Sclera & Iris inside a clip path (pseudo-clipped via circles) */}
            <ellipse cx="4" cy="4" rx="14" ry="18" fill={AVATAR_PALETTE.offWhite} />
            <ellipse cx="6" cy="6" rx="12" ry="16" fill={AVATAR_PALETTE.hairBrown} />
            <ellipse cx="5" cy="8" rx="8" ry="12" fill={color} />

            {/* Highlights */}
            <circle cx="0" cy="-2" r="5" fill="#FFFFFF" />
            <ellipse cx="12" cy="14" rx="4" ry="2" fill="#FFFFFF" opacity="0.8" transform="rotate(-30, 12, 14)" />
        </g>

        {/* Right Eye */}
        <g transform="translate(155, 125) rotate(-5)">
            <path d="M -18 -18 Q -5 -25 8 -20" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
            <path d="M -22 2 C -15 -15, 5 -15, 12 0" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" />
            <path d="M -15 18 Q -5 22 5 18" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />

            <ellipse cx="-4" cy="4" rx="14" ry="18" fill={AVATAR_PALETTE.offWhite} />
            <ellipse cx="-6" cy="6" rx="12" ry="16" fill={AVATAR_PALETTE.hairBrown} />
            <ellipse cx="-5" cy="8" rx="8" ry="12" fill={color} />

            <circle cx="0" cy="-2" r="5" fill="#FFFFFF" />
            <ellipse cx="-12" cy="14" rx="4" ry="2" fill="#FFFFFF" opacity="0.8" transform="rotate(30, -12, 14)" />
        </g>
    </g>
);

// Placeholders for now
export const EyesHappySparkle = EyesNeutralOpen;
export const EyesSmileClosed = EyesNeutralOpen;
export const EyesSoftWink = EyesNeutralOpen;
