import React from 'react';
export interface PartProps {
    color?: string;
    outlineColor?: string;
}

// User requested ONLY the thick black outline of the face shape on transparent background.
// NO internal details.
// Make it vector-like, clean, and smooth.
// 1. Male glasses character face outline only (Wide, slight jaw definition)
export const FaceOutlineMaleGlasses = ({ color = 'transparent', outlineColor = '#000000' }: PartProps) => (
    <g>
        <path
            d="M 25 110 
               C 5 140, 5 175, 25 195 
               C 45 210, 75 220, 100 222 
               C 125 220, 155 210, 175 195 
               C 195 175, 195 140, 175 110"
            fill={color}
            stroke={outlineColor}
            strokeWidth="6"
            strokeLinecap="round"
        />
    </g>
);

// 2. Female beret/fries character face outline only (Extremely round, puffy cheeks)
export const FaceOutlineFemaleBeret = ({ color = 'transparent', outlineColor = '#000000' }: PartProps) => (
    <g>
        <path
            d="M 28 115 
               C -5 150, 0 190, 30 205 
               C 55 220, 80 228, 100 228 
               C 120 228, 145 220, 170 205 
               C 200 190, 205 150, 172 115"
            fill={color}
            stroke={outlineColor}
            strokeWidth="6"
            strokeLinecap="round"
        />
    </g>
);

// 3. Female kimono character face outline only (Soft oval but wide)
export const FaceOutlineFemaleKimono = ({ color = 'transparent', outlineColor = '#000000' }: PartProps) => (
    <g>
        <path
            d="M 30 110 
               C 10 140, 10 170, 35 195 
               C 55 210, 75 215, 100 216 
               C 125 215, 145 210, 165 195 
               C 190 170, 190 140, 170 110"
            fill={color}
            stroke={outlineColor}
            strokeWidth="6"
            strokeLinecap="round"
        />
    </g>
);

// Keeping the original exports to not break AvatarAssetRegistry for now,
// but they point to the outlines.
export const FaceRoundSoft = FaceOutlineFemaleKimono;
export const FaceOvalSoft = FaceOutlineMaleGlasses;
export const FaceRoundedSquare = FaceOutlineFemaleBeret;
export const FaceHeartSoft = FaceOutlineFemaleKimono;
