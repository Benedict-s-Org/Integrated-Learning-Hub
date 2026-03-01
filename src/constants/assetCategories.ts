export type AssetContext = 'user' | 'city' | 'room' | 'house_exterior' | 'general';

export interface AssetCategory {
    id: string;
    label: string;
    icon?: string;
}

export const ASSET_CONTEXTS: { id: AssetContext; label: string }[] = [
    { id: 'general', label: '一般' },
    { id: 'user', label: '使用者' },
    { id: 'city', label: '城市' },
    { id: 'room', label: '房間' },
    { id: 'house_exterior', label: '建築外觀' },
];

export const ASSET_CATEGORIES: Record<AssetContext, AssetCategory[]> = {
    general: [
        { id: 'general', label: '未分類' },
    ],
    user: [
        { id: 'avatar', label: '頭像' },
        { id: 'character', label: 'Avatar' },
        { id: 'profile', label: '個人檔案背景' },
    ],
    city: [
        { id: 'building', label: '建築' },
        { id: 'infrastructure', label: '公共設施' },
        { id: 'decoration', label: '裝飾' },
        { id: 'ground', label: '地面/道路' },
    ],
    room: [
        { id: 'wall', label: '牆面樣式' },
        { id: 'floor', label: '地板樣式' },
        { id: 'stairs', label: '樓梯' },
        { id: 'furniture', label: '家具' },
        { id: 'decoration', label: '裝飾品' },
    ],
    house_exterior: [
        { id: 'roof', label: '屋頂' },
        { id: 'wall', label: '牆面' },
        { id: 'window', label: '窗戶' },
        { id: 'door', label: '大門' },
        { id: 'garden', label: '庭院/景觀' },
    ],
};
