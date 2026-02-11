import React from 'react';

// Common types
export type AvatarAssetProps = {
    color: string;
    className?: string;
    style?: React.CSSProperties;
};

// ─── BODY SHAPES ────────────────────────────────
// Chibi proportions: 
// Head is huge (approx 50% of height).
// Body is a small trapezoid/A-line shape.

const RoundBody: React.FC<AvatarAssetProps> = ({ color }) => (
    <g>
        {/* Continuous Head+Neck+Shoulders base to ensure no gaps */}

        {/* 1. Neck/Body Base */}
        <path
            d="M85 130 L115 130 L120 160 L80 160 Z"
            fill={color}
        />

        {/* 2. Hands (Simple round nubs, positioned low) */}
        <circle cx="70" cy="165" r="9" fill={color} stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
        <circle cx="130" cy="165" r="9" fill={color} stroke="rgba(0,0,0,0.1)" strokeWidth="1" />

        {/* 3. Head Shape - Soft Squircle */}
        <path
            d="M50 70 
               C 50 20, 150 20, 150 70 
               C 152 110, 110 120, 100 120 
               C 90 120, 48 110, 50 70 Z"
            fill={color}
        />

        {/* 4. Ears - Attached to side of head */}
        <path d="M48 75 Q42 80 48 90" fill={color} />
        <path d="M152 75 Q158 80 152 90" fill={color} />
    </g>
);

export const BodyAssets: Record<string, React.FC<AvatarAssetProps>> = {
    'body-round': RoundBody,
    'body-oval': RoundBody, // Standardization
    'body-slim': RoundBody,
};

// ─── EYES ───────────────────────────────────────
// Sticker style: Large, wide, expressive

export const EyeAssets: Record<string, React.FC<AvatarAssetProps>> = {
    'eyes-dot': ({ color }) => (
        <g fill="#2c2c2c">
            <circle cx="80" cy="85" r="7" />
            <circle cx="120" cy="85" r="7" />
        </g>
    ),
    'eyes-round': ({ color }) => (
        <g>
            {/* White Sclera - Large Oval */}
            <ellipse cx="80" cy="82" rx="12" ry="14" fill="white" stroke="#333" strokeWidth="2" />
            <ellipse cx="120" cy="82" rx="12" ry="14" fill="white" stroke="#333" strokeWidth="2" />

            {/* Iris - Large */}
            <circle cx="80" cy="82" r="7" fill={color} />
            <circle cx="120" cy="82" r="7" fill={color} />

            {/* Pupil */}
            <circle cx="80" cy="82" r="3" fill="#222" />
            <circle cx="120" cy="82" r="3" fill="#222" />

            {/* Highlights - Vital for cute look */}
            <circle cx="76" cy="78" r="3" fill="white" />
            <circle cx="116" cy="78" r="3" fill="white" />
        </g>
    ),
    'eyes-happy': ({ color }) => (
        <g fill="none" stroke="#2c2c2c" strokeWidth="3" strokeLinecap="round">
            <path d="M70 85 Q80 75 90 85" />
            <path d="M110 85 Q120 75 130 85" />
        </g>
    )
};

// ─── NOSES ──────────────────────────────────────
export const NoseAssets: Record<string, React.FC<AvatarAssetProps>> = {
    'nose-dot': ({ color }) => (
        <circle cx="100" cy="95" r="1.5" fill="rgba(0,0,0,0.2)" />
    ),
    'nose-button': ({ color }) => (
        <path d="M97 95 Q100 97 103 95" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="2" strokeLinecap="round" />
    ),
    'nose-none': () => null,
};

// ─── MOUTHS ─────────────────────────────────────
export const MouthAssets: Record<string, React.FC<AvatarAssetProps>> = {
    'mouth-smile': ({ color }) => (
        <path d="M92 105 Q100 110 108 105" fill="none" stroke="#444" strokeWidth="2.5" strokeLinecap="round" />
    ),
    'mouth-grin': ({ color }) => (
        <path d="M90 105 Q100 115 110 105 Z" fill="white" stroke="#444" strokeWidth="2" strokeLinejoin="round" />
    ),
    'mouth-neutral': ({ color }) => (
        <line x1="95" y1="108" x2="105" y2="108" stroke="#444" strokeWidth="2" strokeLinecap="round" />
    )
};

// ─── HAIR ──────────────────────────────────────
// "Helmet" style construction to avoid gaps.
// Front Hair includes the top of the skull.

const HAIR_SHADOW = 'rgba(0,0,0,0.15)';

export const HairBackAssets: Record<string, React.FC<AvatarAssetProps>> = {
    'hair-short': () => null, // Short hair doesn't show behind head usually

    'hair-bob': ({ color }) => (
        <path d="M60 70 Q50 120 60 140 L140 140 Q150 120 140 70 Z" fill={color} />
    ),

    'hair-long': ({ color }) => (
        <path d="M50 70 Q40 150 50 180 L150 180 Q160 150 150 70 Z" fill={color} />
    ),

    'hair-ponytail': ({ color }) => (
        <path d="M120 70 Q160 90 150 150" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" />
    )
};

export const HairFrontAssets: Record<string, React.FC<AvatarAssetProps>> = {
    'hair-short': ({ color }) => (
        <g>
            {/* Main Helmet (Top of head) */}
            <path
                d="M48 70 
                   C 48 20, 152 20, 152 70 
                   L 152 75 L 142 65
                   L 130 75 L 115 65
                   L 100 78 L 85 65
                   L 70 75 L 58 65
                   L 48 75 Z"
                fill={color}
            />
        </g>
    ),

    'hair-bob': ({ color }) => (
        <g>
            {/* Full helmet with sides */}
            <path
                d="M48 70 
                   C 48 10, 152 10, 152 70 
                   L 155 110 Q 155 125 140 120 
                   L 142 65 
                   Q 100 60 58 65 
                   L 60 120 Q 45 125 45 110 Z"
                fill={color}
            />
        </g>
    ),
    'hair-ponytail': ({ color }) => (
        <g>
            {/* Similar to short but smoother */}
            <path
                d="M48 70 
                   C 48 20, 152 20, 152 70 
                   L 152 85 Q 100 40 48 85 Z"
                fill={color}
            />
        </g>
    )
};

// ─── OUTFITS ────────────────────────────────────
// Rendered ON TOP of the body
// Must cover the neck/body connection naturally

export const OutfitAssets: Record<string, React.FC<AvatarAssetProps>> = {
    'outfit-tshirt': ({ color }) => (
        <g transform="translate(0, 0)">
            {/* Jeans/Legs */}
            <path d="M88 160 L85 195 L98 195 L100 160 Z" fill="#4B6A88" />
            <path d="M112 160 L115 195 L102 195 L100 160 Z" fill="#4B6A88" />

            {/* Shoes */}
            <ellipse cx="90" cy="198" rx="8" ry="4" fill="#333" />
            <ellipse cx="110" cy="198" rx="8" ry="4" fill="#333" />

            {/* Inner Shirt (Green) */}
            <path d="M85 135 L115 135 L115 165 L85 165 Z" fill="#7A9A88" />

            {/* Cardigan/Jacket (Charcoal) - Open Style */}
            <path
                d="M75 135 
                   Q 70 140, 75 170 
                   L 125 170 
                   Q 130 140, 125 135 
                   L 115 135 L 115 170 L 85 170 L 85 135 Z"
                fill={color}
            />

            {/* Sleeves - Arms down */}
            <path d="M75 138 L65 155 Q 62 160, 68 160 L 78 145" fill={color} />
            <path d="M125 138 L135 155 Q 138 160, 132 160 L 122 145" fill={color} />

            {/* Collar Detail */}
            <path d="M85 135 L 95 150 L 105 150 L 115 135" fill="none" stroke={color} strokeWidth="2" />
        </g>
    ),

    'outfit-uniform': ({ color }) => (
        <g transform="translate(0, 0)">
            {/* Pants */}
            <rect x="88" y="160" width="24" height="35" fill="#334155" rx="2" />

            {/* Blazer Body */}
            <path
                d="M75 135 L 125 135 L 128 170 L 72 170 Z"
                fill={color}
            />

            {/* White Collar Area */}
            <path d="M90 135 L 100 145 L 110 135" fill="white" />

            {/* Tie */}
            <path d="M100 135 L 100 150" stroke="#ef4444" strokeWidth="4" />
        </g>
    ),

    'outfit-hoodie': ({ color }) => (
        <g transform="translate(0, 0)">
            {/* Pants */}
            <rect x="88" y="160" width="24" height="35" fill="#475569" rx="2" />

            {/* Hoodie Body - Oversized */}
            <rect x="70" y="135" width="60" height="40" rx="4" fill={color} />

            {/* Kangaroo Pocket */}
            <path d="M85 155 L115 155 L110 165 L90 165 Z" fill="rgba(0,0,0,0.1)" />
        </g>
    )
};

// ─── ACCESSORIES ────────────────────────────────
export const AccessoryAssets: Record<string, React.FC<AvatarAssetProps>> = {
    'acc-none': () => null,
    'acc-glasses': ({ color }) => (
        <g stroke="#222" strokeWidth="2.5" fill="rgba(255,255,255,0.2)">
            {/* Large Square frames */}
            <rect x="68" y="75" width="26" height="18" rx="4" />
            <rect x="106" y="75" width="26" height="18" rx="4" />
            {/* Bridge */}
            <line x1="94" y1="84" x2="106" y2="84" />
        </g>
    ),
    'acc-bow': ({ color }) => (
        <g transform="translate(135, 45) rotate(15)">
            <path d="M0 0 L-12 -10 L-12 10 Z" fill="pink" stroke="hotpink" strokeWidth="1" />
            <path d="M0 0 L12 -10 L12 10 Z" fill="pink" stroke="hotpink" strokeWidth="1" />
            <circle cx="0" cy="0" r="4" fill="hotpink" />
        </g>
    ),
    'acc-crown': ({ color }) => (
        <g transform="translate(100, 30)">
            <path d="M-22 0 L-11 -18 L0 0 L11 -18 L22 0 L22 8 L-22 8 Z" fill="#FFD700" stroke="#B8860B" strokeWidth="2" />
        </g>
    )
};
