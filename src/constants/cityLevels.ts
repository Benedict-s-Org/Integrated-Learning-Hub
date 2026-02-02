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
        cityGridSize: 12,
        unlockCost: 1000,
        features: ["商店解鎖", "道路擴展"],
    },
    {
        level: 2,
        name: "發展中城市",
        maxBuildings: 16,
        cityGridSize: 16,
        unlockCost: 5000,
        features: ["學校與公共設施", "大型裝飾物"],
    },
    {
        level: 3,
        name: "大都會",
        maxBuildings: 32,
        cityGridSize: 24,
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
    }
];

export const INITIAL_CITY_LAYOUT: CityLayout = {
    id: "initial_city",
    userId: "default",
    buildings: [],
    streets: [],
    decorations: [],
    cityLevel: 0
};
