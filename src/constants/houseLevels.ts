export interface HouseLevel {
    level: number;
    name: string;
    size: number;
    cost: number;
    maxItems: number;
}

export const HOUSE_LEVELS: HouseLevel[] = [
    { level: 1, name: "微型公寓", size: 10, cost: 0, maxItems: 20 },
    { level: 2, name: "舒適小居", size: 12, cost: 500, maxItems: 35 },
    { level: 3, name: "寬敞套房", size: 15, cost: 1500, maxItems: 50 },
    { level: 4, name: "豪華公寓", size: 18, cost: 3000, maxItems: 70 },
    { level: 5, name: "頂層豪宅", size: 24, cost: 6000, maxItems: 100 },
];
