import React from 'react';
import { AvatarAssetRegistry } from './AssetRegistry';
import { AVATAR_PALETTE } from './palette';

export interface AvatarConfig {
    face: string;
    faceColor: string;
    eyes: string;
    mouth: string;
    hair: string;
    hairColor: string;
    top: string;
    topColor: string;
    bottom: string;
    bottomColor: string;
    shoes: string;
    shoesColor: string;
    accessory: string | null;
    accessoryColor?: string;

    // Custom specific colors (optional, will default to outlines)
    outlineColor?: string;
}

export interface AvatarPreviewProps {
    config: AvatarConfig;
    className?: string;
    mode?: 'full' | 'headshot'; // 'full' for map token, 'headshot' for profile pic
}

export const AvatarPreview: React.FC<AvatarPreviewProps> = ({ config, className = '', mode = 'full' }) => {
    // Get components from registry
    const LegsPart = AvatarAssetRegistry['legs-fixed'];
    const ShoesPart = AvatarAssetRegistry[config.shoes];
    const BottomPart = AvatarAssetRegistry[config.bottom];
    const TopPart = AvatarAssetRegistry[config.top];
    const FacePart = AvatarAssetRegistry[config.face];
    const EyesPart = AvatarAssetRegistry[config.eyes];
    const MouthPart = AvatarAssetRegistry[config.mouth];
    const HairPart = AvatarAssetRegistry[config.hair];
    const AccPart = config.accessory ? AvatarAssetRegistry[config.accessory] : null;

    // ViewBox based on mode
    // The golden reference is 0 0 200 400.
    // Full body shows all.
    // Headshot might crop to head + shoulders: "20 50 160 160" roughly (since head is down lower now)
    const viewBox = mode === 'full' ? '0 0 200 400' : '20 50 160 170';

    // Determine if we need skirt occlusion (dynamic based on bottom item type)
    // For MVP, if it contains 'skirt', we occlude upper legs
    const isSkirt = config.bottom.includes('skirt');

    return (
        <svg
            viewBox={viewBox}
            className={`w-full h-full ${className}`}
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* 
        Legs layer wrapper 
        If it's a skirt, we use a clipPath or just CSS class masking.
        Wait, we added 'upper-leg' and 'lower-leg' classes to LegsFixed.
        We can use CSS to hide upper-leg if isSkirt is true.
      */}
            <style>
                {`
          ${isSkirt ? `
            #avatar-legs-wrapper .upper-leg {
              display: none;
            }
          ` : ''}
        `}
            </style>

            {/* Layer 0: Legs */}
            <g id="avatar-legs-wrapper">
                {LegsPart && <LegsPart color={config.faceColor} outlineColor={config.outlineColor} />}
            </g>

            {/* Layer 1: Shoes */}
            <g id="avatar-shoes">
                {ShoesPart && <ShoesPart color={config.shoesColor} outlineColor={config.outlineColor} />}
            </g>

            {/* Layer 2: Bottoms */}
            <g id="avatar-bottom">
                {BottomPart && <BottomPart color={config.bottomColor} outlineColor={config.outlineColor} />}
            </g>

            {/* Layer 3: Tops */}
            <g id="avatar-top">
                {TopPart && <TopPart color={config.topColor} outlineColor={config.outlineColor} />}
            </g>

            {/* Layer 4: Face */}
            <g id="avatar-face">
                {FacePart && <FacePart color={config.faceColor} outlineColor={config.outlineColor} />}
            </g>

            {/* Layer 5: Mouth */}
            <g id="avatar-mouth">
                {MouthPart && <MouthPart color={AVATAR_PALETTE.outline} outlineColor={config.outlineColor} />}
            </g>

            {/* Layer 6: Eyes */}
            <g id="avatar-eyes">
                {EyesPart && <EyesPart color={AVATAR_PALETTE.outline} outlineColor={config.outlineColor} />}
            </g>

            {/* Layer 7: Hair */}
            <g id="avatar-hair">
                {HairPart && <HairPart color={config.hairColor} outlineColor={config.outlineColor} />}
            </g>

            {/* Layer 8: Accessories */}
            <g id="avatar-accessory">
                {AccPart && <AccPart color={config.accessoryColor || AVATAR_PALETTE.outline} outlineColor={config.outlineColor} />}
            </g>
        </svg>
    );
};
