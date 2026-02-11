// Avatar Parts Library - Programmatic SVG definitions for chibi avatar system
// Each part is an SVG path/shape that gets composited by AvatarRenderer

export type AvatarCategory = 'body' | 'skin' | 'eyes' | 'nose' | 'mouth' | 'hair' | 'outfit' | 'accessory';

export interface AvatarPart {
    id: string;
    name: string;
    category: AvatarCategory;
    isFree: boolean;
    price: number;
    rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
    colorOptions?: string[]; // If the part supports color swaps
}

export interface AvatarConfig {
    body: string;       // part id
    skinColor: string;  // hex color
    eyes: string;
    eyeColor: string;
    nose: string;
    mouth: string;
    hair: string;
    hairColor: string;
    outfit: string;
    outfitColor: string;
    accessory: string | null;
}

// ─── SKIN TONES ─────────────────────────────────
export const SKIN_TONES = [
    { id: 'skin-1', name: 'Porcelain', color: '#FDEBD0' },
    { id: 'skin-2', name: 'Light', color: '#F5CBA7' },
    { id: 'skin-3', name: 'Warm', color: '#E8B88A' },
    { id: 'skin-4', name: 'Tan', color: '#D4A574' },
    { id: 'skin-5', name: 'Medium', color: '#C49A6C' },
    { id: 'skin-6', name: 'Olive', color: '#B8860B' },
    { id: 'skin-7', name: 'Brown', color: '#8B6914' },
    { id: 'skin-8', name: 'Dark', color: '#6B4226' },
];

// ─── HAIR COLORS ────────────────────────────────
export const HAIR_COLORS = [
    { id: 'hc-1', name: 'Black', color: '#1a1a2e' },
    { id: 'hc-2', name: 'Dark Brown', color: '#3d2b1f' },
    { id: 'hc-3', name: 'Brown', color: '#6b4423' },
    { id: 'hc-4', name: 'Auburn', color: '#922724' },
    { id: 'hc-5', name: 'Ginger', color: '#c45628' },
    { id: 'hc-6', name: 'Blonde', color: '#d4a843' },
    { id: 'hc-7', name: 'Platinum', color: '#e8dcc8' },
    { id: 'hc-8', name: 'Blue', color: '#4a90d9', isFree: false, price: 30 },
    { id: 'hc-9', name: 'Pink', color: '#e991b8', isFree: false, price: 30 },
    { id: 'hc-10', name: 'Purple', color: '#8b5cf6', isFree: false, price: 30 },
];

// ─── EYE COLORS ─────────────────────────────────
export const EYE_COLORS = [
    { id: 'ec-1', name: 'Brown', color: '#654321' },
    { id: 'ec-2', name: 'Hazel', color: '#8B7355' },
    { id: 'ec-3', name: 'Green', color: '#2E8B57' },
    { id: 'ec-4', name: 'Blue', color: '#4169E1' },
    { id: 'ec-5', name: 'Grey', color: '#708090' },
    { id: 'ec-6', name: 'Amber', color: '#FFBF00' },
];

// ─── OUTFIT COLORS ──────────────────────────────
export const OUTFIT_COLORS = [
    { id: 'oc-1', name: 'Navy', color: '#1e3a5f' },
    { id: 'oc-2', name: 'Red', color: '#c0392b' },
    { id: 'oc-3', name: 'Forest', color: '#27ae60' },
    { id: 'oc-4', name: 'Purple', color: '#8e44ad' },
    { id: 'oc-5', name: 'Sky', color: '#3498db' },
    { id: 'oc-6', name: 'Orange', color: '#e67e22' },
    { id: 'oc-7', name: 'Pink', color: '#e84393' },
    { id: 'oc-8', name: 'Charcoal', color: '#2c3e50' },
];

// ─── BODY SHAPES ────────────────────────────────
export const BODIES: AvatarPart[] = [
    { id: 'body-round', name: 'Round', category: 'body', isFree: true, price: 0, rarity: 'common' },
    { id: 'body-oval', name: 'Oval', category: 'body', isFree: true, price: 0, rarity: 'common' },
    { id: 'body-slim', name: 'Slim', category: 'body', isFree: true, price: 0, rarity: 'common' },
    { id: 'body-square', name: 'Square', category: 'body', isFree: false, price: 40, rarity: 'uncommon' },
    { id: 'body-pear', name: 'Pear', category: 'body', isFree: false, price: 40, rarity: 'uncommon' },
];

// ─── EYES ───────────────────────────────────────
export const EYES: AvatarPart[] = [
    { id: 'eyes-dot', name: 'Dot', category: 'eyes', isFree: true, price: 0, rarity: 'common' },
    { id: 'eyes-round', name: 'Round', category: 'eyes', isFree: true, price: 0, rarity: 'common' },
    { id: 'eyes-happy', name: 'Happy', category: 'eyes', isFree: true, price: 0, rarity: 'common' },
    { id: 'eyes-sparkle', name: 'Sparkle', category: 'eyes', isFree: true, price: 0, rarity: 'common' },
    { id: 'eyes-cool', name: 'Cool', category: 'eyes', isFree: false, price: 50, rarity: 'uncommon' },
    { id: 'eyes-wink', name: 'Wink', category: 'eyes', isFree: false, price: 50, rarity: 'uncommon' },
    { id: 'eyes-cat', name: 'Cat', category: 'eyes', isFree: false, price: 80, rarity: 'rare' },
    { id: 'eyes-star', name: 'Star', category: 'eyes', isFree: false, price: 120, rarity: 'rare' },
];

// ─── NOSES ──────────────────────────────────────
export const NOSES: AvatarPart[] = [
    { id: 'nose-dot', name: 'Dot', category: 'nose', isFree: true, price: 0, rarity: 'common' },
    { id: 'nose-button', name: 'Button', category: 'nose', isFree: true, price: 0, rarity: 'common' },
    { id: 'nose-triangle', name: 'Triangle', category: 'nose', isFree: true, price: 0, rarity: 'common' },
    { id: 'nose-line', name: 'Line', category: 'nose', isFree: false, price: 20, rarity: 'common' },
    { id: 'nose-none', name: 'None', category: 'nose', isFree: true, price: 0, rarity: 'common' },
];

// ─── MOUTHS ─────────────────────────────────────
export const MOUTHS: AvatarPart[] = [
    { id: 'mouth-smile', name: 'Smile', category: 'mouth', isFree: true, price: 0, rarity: 'common' },
    { id: 'mouth-grin', name: 'Grin', category: 'mouth', isFree: true, price: 0, rarity: 'common' },
    { id: 'mouth-cat', name: 'Cat', category: 'mouth', isFree: true, price: 0, rarity: 'common' },
    { id: 'mouth-open', name: 'Open', category: 'mouth', isFree: false, price: 30, rarity: 'common' },
    { id: 'mouth-tongue', name: 'Tongue Out', category: 'mouth', isFree: false, price: 40, rarity: 'uncommon' },
    { id: 'mouth-neutral', name: 'Neutral', category: 'mouth', isFree: true, price: 0, rarity: 'common' },
];

// ─── HAIRSTYLES ─────────────────────────────────
export const HAIRS: AvatarPart[] = [
    { id: 'hair-short', name: 'Short', category: 'hair', isFree: true, price: 0, rarity: 'common' },
    { id: 'hair-messy', name: 'Messy', category: 'hair', isFree: true, price: 0, rarity: 'common' },
    { id: 'hair-bob', name: 'Bob', category: 'hair', isFree: true, price: 0, rarity: 'common' },
    { id: 'hair-ponytail', name: 'Ponytail', category: 'hair', isFree: true, price: 0, rarity: 'common' },
    { id: 'hair-long', name: 'Long', category: 'hair', isFree: false, price: 60, rarity: 'uncommon' },
    { id: 'hair-spiky', name: 'Spiky', category: 'hair', isFree: false, price: 60, rarity: 'uncommon' },
    { id: 'hair-buns', name: 'Double Buns', category: 'hair', isFree: false, price: 80, rarity: 'rare' },
    { id: 'hair-wavy', name: 'Wavy', category: 'hair', isFree: false, price: 80, rarity: 'rare' },
];

// ─── OUTFITS ────────────────────────────────────
export const OUTFITS: AvatarPart[] = [
    { id: 'outfit-tshirt', name: 'T-Shirt', category: 'outfit', isFree: true, price: 0, rarity: 'common' },
    { id: 'outfit-uniform', name: 'School Uniform', category: 'outfit', isFree: true, price: 0, rarity: 'common' },
    { id: 'outfit-hoodie', name: 'Hoodie', category: 'outfit', isFree: false, price: 60, rarity: 'uncommon' },
    { id: 'outfit-dress', name: 'Dress', category: 'outfit', isFree: false, price: 60, rarity: 'uncommon' },
    { id: 'outfit-vest', name: 'Vest', category: 'outfit', isFree: false, price: 80, rarity: 'rare' },
    { id: 'outfit-jacket', name: 'Jacket', category: 'outfit', isFree: false, price: 100, rarity: 'rare' },
];

// ─── ACCESSORIES ────────────────────────────────
export const ACCESSORIES: AvatarPart[] = [
    { id: 'acc-none', name: 'None', category: 'accessory', isFree: true, price: 0, rarity: 'common' },
    { id: 'acc-glasses', name: 'Glasses', category: 'accessory', isFree: true, price: 0, rarity: 'common' },
    { id: 'acc-bow', name: 'Hair Bow', category: 'accessory', isFree: true, price: 0, rarity: 'common' },
    { id: 'acc-headband', name: 'Headband', category: 'accessory', isFree: false, price: 40, rarity: 'uncommon' },
    { id: 'acc-cap', name: 'Cap', category: 'accessory', isFree: false, price: 50, rarity: 'uncommon' },
    { id: 'acc-crown', name: 'Crown', category: 'accessory', isFree: false, price: 150, rarity: 'legendary' },
];

// ─── ALL PARTS ──────────────────────────────────
export const ALL_PARTS: Record<AvatarCategory, AvatarPart[]> = {
    body: BODIES,
    skin: [], // Handled by SKIN_TONES
    eyes: EYES,
    nose: NOSES,
    mouth: MOUTHS,
    hair: HAIRS,
    outfit: OUTFITS,
    accessory: ACCESSORIES,
};

// ─── DEFAULT CONFIG ─────────────────────────────
export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
    body: 'body-round',
    skinColor: '#F5CBA7', // Light
    eyes: 'eyes-round',
    eyeColor: '#3d2b1f', // Dark Brown
    nose: 'nose-dot',
    mouth: 'mouth-smile',
    hair: 'hair-short',
    hairColor: '#1a1a2e', // Black
    outfit: 'outfit-tshirt',
    outfitColor: '#2c3e50', // Charcoal (Cardigan color)
    accessory: 'acc-glasses', // Reference has glasses
};
