import { RegionTheme } from '@/types/region';

export const REGION_CONFIG = {
    tileWidth: 100, // Width of a single plot in the isometric grid
    tileHeight: 50, // Height of a single plot in the isometric grid
    minZoom: 0.5,
    maxZoom: 2.0,
    defaultZoom: 1.0,
    gridColor: 'rgba(255, 255, 255, 0.2)',
};

export interface ThemeColors {
    ground: string;
    road: string;
    water: string;
    highlight: string;
    text: string;
}

export const REGION_THEME_COLORS: Record<RegionTheme, ThemeColors> = {
    countryside: {
        ground: '#E3F2DA', // Soft Sage
        road: '#FDF6E3',   // Warm Cream
        water: '#C7CEEA',  // Periwinkle
        highlight: '#FFDAC1', // Soft Peach
        text: '#5D4037',   // Warm Brown
    },
    suburban: {
        ground: '#F0F4F8', // Cool Mist
        road: '#E2E8F0',   // Soft Grey
        water: '#B5EAD7',  // Mint
        highlight: '#FFB7B2', // Pastel Red
        text: '#4A5568',   // Slate
    },
    urban: {
        ground: '#FAFAFA', // Almost White
        road: '#CBD5E0',   // Cool Grey
        water: '#A0CED9',  // Soft Blue
        highlight: '#E2F0CB', // Pale Lime
        text: '#2D3748',   // Dark Slate
    },
};

export const PLOT_TYPE_COLORS = {
    city: '#B5EAD7',      // Mint (friendly green)
    public_facility: '#FFB7B2', // Pastel Red (standout but soft)
    empty: '#E2E8F0',     // Light Grey (neutral)
};

export const CITY_LEVEL_COLORS = {
    1: '#8D6E63', // Small village
    2: '#795548', // Town
    3: '#5D4037', // City
    4: '#4E342E', // Metropolis
    5: '#3E2723', // Capital
};

import { FacilityType, FacilityConfig } from '@/types/region';

export const DEFAULT_FACILITY_CONFIGS: Record<FacilityType, FacilityConfig> = {
    park: {
        description: 'A peaceful place for relaxation.',
        features: ['Resting Bench', 'Fountain'],
        rewards: { coins: 10 },
        schedule: { open: '06:00', close: '22:00' },
    },
    school: {
        description: 'A place for learning and growth.',
        features: ['Classroom', 'Library'],
        rewards: { exp: 50 },
        schedule: { open: '08:00', close: '16:00' },
    },
    library: {
        description: 'Access to shared knowledge.',
        features: ['Reading Room', 'Archives'],
        rewards: { exp: 20 },
        schedule: { open: '09:00', close: '20:00' },
    },
    town_hall: {
        description: 'The administrative heart of the district.',
        features: ['Bulletin Board', 'Council Chamber'],
        schedule: { open: '09:00', close: '17:00' },
    },
    train_station: {
        description: 'Transport hub connecting to other regions.',
        features: ['Ticket Office', 'Platform'],
        schedule: { open: '05:00', close: '23:00' },
    },
    marketplace: {
        description: 'Trade goods and resources.',
        features: ['Stalls', 'Auction House'],
        schedule: { open: '07:00', close: '19:00' },
    },
};
