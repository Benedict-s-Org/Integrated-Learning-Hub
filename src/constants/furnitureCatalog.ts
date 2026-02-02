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

export const FURNITURE_CATALOG = INITIAL_FURNITURE_CATALOG;
export const FURNITURE_MODELS: FurnitureModels = {};
