import { CityLevel, BuildingCatalogItem, CityLayout } from "@/types/city";

export const CITY_LEVELS: CityLevel[] = [
    {
        level: 0,
        name: "安靜小鎮",
        maxBuildings: 4,
        cityGridSize: 8,
        unlockCost: 0,
        features: ["基礎住宅", "小公園"],
    },
    {
        level: 1,
        name: "繁榮村莊",
        maxBuildings: 8,
        cityGridSize: 8,
        unlockCost: 1000,
        features: ["商店解鎖", "道路擴展"],
    },
    {
        level: 2,
        name: "發展中城市",
        maxBuildings: 16,
        cityGridSize: 8,
        unlockCost: 5000,
        features: ["學校與公共設施", "大型裝飾物"],
    },
    {
        level: 3,
        name: "大都會",
        maxBuildings: 32,
        cityGridSize: 8,
        unlockCost: 20000,
        features: ["地標建築", "自定義素材上傳"],
    }
];

export const BUILDING_CATALOG: BuildingCatalogItem[] = [
    {
        id: "cottage_basic",
        name: "溫馨小屋",
        type: "house",
        cost: 500,
        description: "一座簡單而溫馨的小屋，適合初學者。",
        size: { width: 2, depth: 2 },
        defaultStyle: {
            roofColor: "#ef4444",
            wallColor: "#ffffff",
            accentColor: "#3b82f6",
            windowStyle: "classic",
            stories: 1
        },
        requiredCityLevel: 0
    },
    {
        id: "shop_bakery",
        name: "美味烘焙坊",
        type: "shop",
        cost: 1200,
        description: "香氣四溢的麵包店，能為城市帶來活力。",
        size: { width: 2, depth: 2 },
        defaultStyle: {
            roofColor: "#f97316",
            wallColor: "#fff7ed",
            accentColor: "#fbbf24",
            windowStyle: "modern",
            stories: 1
        },
        requiredCityLevel: 1
    },
    {
        id: "school_primary",
        name: "陽光小學",
        type: "school",
        cost: 3000,
        description: "孩子們學習與成長的地方。",
        size: { width: 4, depth: 3 },
        defaultStyle: {
            roofColor: "#3b82f6",
            wallColor: "#f1f5f9",
            accentColor: "#ef4444",
            windowStyle: "classic",
            stories: 2
        },
        requiredCityLevel: 2
    },
    {
        id: "lab_crystal",
        name: "水晶實驗室",
        type: "landmark",
        cost: 5000,
        description: "充滿高科技與神秘色彩的實驗室，適合存放科學知識。",
        size: { width: 3, depth: 3 },
        defaultStyle: {
            roofColor: "#38bdf8",
            wallColor: "#e0f2fe",
            accentColor: "#0ea5e9",
            windowStyle: "modern",
            stories: 3
        },
        requiredCityLevel: 2
    },
    {
        id: "library_ancient",
        name: "古老圖書館",
        type: "landmark",
        cost: 8000,
        description: "收藏著無窮智慧與古老智慧的宏偉建築。",
        size: { width: 4, depth: 4 },
        defaultStyle: {
            roofColor: "#78350f",
            wallColor: "#fef3c7",
            accentColor: "#d97706",
            windowStyle: "classic",
            stories: 2
        },
        requiredCityLevel: 3
    },
    {
        id: "garden_botanical",
        name: "景觀多目標植物園",
        type: "park",
        cost: 4000,
        description: "寧靜而富有詩意的空間，適合整理與沉思。",
        size: { width: 5, depth: 5 },
        defaultStyle: {
            roofColor: "#10b981",
            wallColor: "#ecfdf5",
            accentColor: "#059669",
            windowStyle: "minimal",
            stories: 1
        },
        requiredCityLevel: 2
    }
];

export const INITIAL_CITY_LAYOUT: CityLayout = {
    id: "initial_city",
    userId: "default",
    buildings: [
        {
            id: "initial_home",
            name: "我的小屋",
            type: "house",
            level: 1,
            position: { x: 3, y: 3 },
            size: { width: 2, depth: 2 },
            exteriorStyle: {
                roofColor: "#ef4444",
                wallColor: "#ffffff",
                accentColor: "#3b82f6",
                windowStyle: "classic",
                stories: 1
            },
            isUnlocked: true
        }
    ],
    streets: [],
    decorations: [
        {
            id: "initial_tree_1",
            type: "tree",
            position: { x: 5, y: 2 }
        },
        {
            id: "initial_tree_2",
            type: "tree",
            position: { x: 2, y: 5 }
        }
    ],
    cityLevel: 0,
    cameraSettings: {
        zoom: 1.2,
        offset: { x: 0, y: -80 }
    }
};
