// Avatar Types - Interfaces for the Image-Based Database Architecture

export type AvatarCategory =
    | 'background'
    | 'body'
    | 'face'
    | 'bottoms'
    | 'shoes'
    | 'tops'
    | 'mouth'
    | 'eyes'
    | 'hair_back'
    | 'hair_front'
    | 'accessories';

// Represents a row in the public.avatar_items table
export interface AvatarImageItem {
    id: string;
    name: string;
    description: string | null;
    category: AvatarCategory;
    image_url: string; // The URL to the image in the 'avatar-assets' bucket
    layer_z_index: number;
    base_price: number;
    is_default: boolean;
    created_at: string;
    updated_at: string;
}

// Represents the manual offset a user applies to a specific part
export interface PartOffset {
    item_id: string;
    x: number;
    y: number;
    scale: number;
}

// Represents the JSONB 'equipped_items' column in public.user_avatar_config
// Keys are the category names, values are the user's specific item choices and offsets
export type UserAvatarConfig = Partial<Record<AvatarCategory, PartOffset>>;

export const DEFAULT_PART_OFFSET: Omit<PartOffset, 'item_id'> = {
    x: 0,
    y: 0,
    scale: 1.0
};

// Legacy SVG-based Avatar Types (Still used by some components)
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
    outlineColor?: string;
}

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
    face: 'face-oval',
    faceColor: '#FFDBAC',
    eyes: 'eyes-neutral',
    mouth: 'mouth-smile',
    hair: 'hair-short-1',
    hairColor: '#4B2C20',
    top: 'top-tshirt',
    topColor: '#3B82F6',
    bottom: 'bottom-pants',
    bottomColor: '#1F2937',
    shoes: 'shoes-sneakers',
    shoesColor: '#FFFFFF',
    accessory: null,
};

