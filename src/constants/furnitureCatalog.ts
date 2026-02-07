import { FurnitureItem, FurnitureCategory, FurnitureModels } from "@/types/furniture";

export const FURNITURE_CATEGORIES: FurnitureCategory[] = [
    { id: "all", label: "全部" },
    { id: "seating", label: "座椅" },
    { id: "tables", label: "桌子" },
    { id: "storage", label: "收納" },
    { id: "lighting", label: "照明" },
    { id: "decor", label: "裝飾" },
    { id: "plants", label: "植物" },
    { id: "rugs", label: "地毯" },
    { id: "electronics", label: "電器" },
    { id: "ai", label: "AI 創作" },
];

export const INITIAL_FURNITURE_CATALOG: FurnitureItem[] = [
    {
        id: "chair_basic",
        name: "基本木椅",
        category: "seating",
        size: [1, 1],
        price: 100,
        modelUrl: "chair_basic",
        canSit: true,
    },
    {
        id: "table_basic",
        name: "基本木桌",
        category: "tables",
        size: [2, 1],
        price: 200,
        modelUrl: "table_basic",
        surfaceHeight: 10,
    },
    // Add more items as needed or load from DB
];

// Auto-discover processed AI-generated images
// Drop images in src/assets/upload, run `npm run process-images`, 
// and they'll appear here after background removal and edge smoothing
const aiImages: any = import.meta.glob('../assets/processed/*.{png,jpg,jpeg,webp}', {
    eager: true,
    query: '?url',
    import: 'default'
});

export const LOCAL_AI_ASSETS = Object.entries(aiImages).map(([path, url]) => {
    const filename = path.split('/').pop()?.split('.')[0] || 'Local AI Item';
    return {
        id: `local_ai_${filename}`,
        name: filename.replace(/_/g, ' ').replace(/-/g, ' '),
        category: "ai",
        size: [1, 1] as [number, number],
        price: 0,
        spriteImages: [url as string],
        type: "sprite",
        isSpecial: true,
        desc: "本地 AI 生成的物件"
    };
});

export const FURNITURE_CATALOG = [...INITIAL_FURNITURE_CATALOG, ...LOCAL_AI_ASSETS];
export const FURNITURE_MODELS: FurnitureModels = {};
