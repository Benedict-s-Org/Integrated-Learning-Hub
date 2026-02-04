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
        ground: '#e6f3d9', // Light green
        road: '#d8ccb9',   // Dirt road color
        water: '#a5d6f5',
        highlight: '#8bc34a',
        text: '#33691e',
    },
    suburban: {
        ground: '#f0f4f8', // Light blue-grey
        road: '#cfd8dc',   // Paved road
        water: '#90caf9',
        highlight: '#2196f3',
        text: '#263238',
    },
    urban: {
        ground: '#eceff1', // Concrete/grey
        road: '#b0bec5',   // Darker paved road
        water: '#81d4fa',
        highlight: '#607d8b',
        text: '#37474f',
    },
};

export const PLOT_TYPE_COLORS = {
    city: '#4CAF50',
    public_facility: '#2196F3',
    empty: '#9E9E9E',
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
