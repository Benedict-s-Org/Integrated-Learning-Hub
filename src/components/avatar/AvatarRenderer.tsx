import React from 'react';
import { AvatarConfig, DEFAULT_AVATAR_CONFIG } from './avatarParts';
import {
    BodyAssets,
    EyeAssets,
    NoseAssets,
    MouthAssets,
    HairBackAssets,
    HairFrontAssets,
    OutfitAssets,
    AccessoryAssets
} from './AvatarAssets';

interface AvatarRendererProps {
    config: AvatarConfig;
    size?: number | string;
    className?: string;
    showBackground?: boolean;
}

export const AvatarRenderer: React.FC<AvatarRendererProps> = ({
    config = DEFAULT_AVATAR_CONFIG,
    size = 200,
    className = '',
    showBackground = false
}) => {
    // Safe fallbacks for missing parts
    const BodyComp = BodyAssets[config.body] || BodyAssets['body-round'];
    const EyesComp = EyeAssets[config.eyes] || EyeAssets['eyes-dot'];
    const NoseComp = NoseAssets[config.nose] || NoseAssets['nose-dot'];
    const MouthComp = MouthAssets[config.mouth] || MouthAssets['mouth-smile'];
    const HairBackComp = HairBackAssets[config.hair] || HairBackAssets['hair-short'];
    const HairFrontComp = HairFrontAssets[config.hair] || HairFrontAssets['hair-short'];
    const OutfitComp = OutfitAssets[config.outfit] || OutfitAssets['outfit-tshirt'];
    const AccessoryComp = config.accessory ? AccessoryAssets[config.accessory] : null;

    return (
        <div
            className={`relative inline-block ${className}`}
            style={{ width: size, height: size }}
        >
            <svg
                viewBox="0 0 200 200"
                width="100%"
                height="100%"
                xmlns="http://www.w3.org/2000/svg"
                className="filter drop-shadow-sm"
            >
                {/* Background Circle if requested */}
                {showBackground && (
                    <circle cx="100" cy="100" r="95" fill="#f0f9ff" stroke="#bae6fd" strokeWidth="2" />
                )}

                {/* 1. Hair Back */}
                <g id="layer-hair-back">
                    <HairBackComp color={config.hairColor} />
                </g>

                {/* 2. Body Base (Color comes from skin tone) */}
                <g id="layer-body">
                    <BodyComp color={config.skinColor} />
                </g>

                {/* 3. Clothing */}
                <g id="layer-outfit">
                    <OutfitComp color={config.outfitColor} />
                </g>

                {/* 4. Facial Features */}
                <g id="layer-face">
                    <EyesComp color={config.eyeColor} />
                    <NoseComp color={config.skinColor} /> {/* Nose often matches skin or slightly darker, passing skin for now, assets handle opacity */}
                    <MouthComp color="#000000" /> {/* Mouths usually outlined in black/dark */}
                </g>

                {/* 5. Hair Front */}
                <g id="layer-hair-front">
                    <HairFrontComp color={config.hairColor} />
                </g>

                {/* 6. Accessory */}
                {AccessoryComp && (
                    <g id="layer-accessory">
                        <AccessoryComp color={config.outfitColor /* Defaulting to outfit color for generic accs, specific assets might ignore */} />
                    </g>
                )}
            </svg>
        </div>
    );
};
