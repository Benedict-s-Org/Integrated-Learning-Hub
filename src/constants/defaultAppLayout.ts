import { AppLayoutConfig, LayoutRegion } from '@/types/ui-builder';

const createEmptyRegion = (id: string, name: string): LayoutRegion => ({
    id,
    name,
    type: 'slot',
    isEditable: true,
    children: [],
});

export const DEFAULT_APP_LAYOUT: AppLayoutConfig = {
    id: 'default-layout',
    name: '預設佈局',
    description: '系統預設的應用程式內部佈局',
    regions: {
        sidebar: {
            header: {
                id: 'sidebar-header',
                name: '側邊欄頂部',
                type: 'slot',
                isEditable: true,
                children: [
                    {
                        id: 'app-logo-text',
                        type: 'text',
                        order: 0,
                        props: {
                            content: 'ANTIGRAVITY',
                            fontSize: 20,
                            fontWeight: 700,
                            color: 'hsl(var(--primary))',
                            letterSpacing: 2,
                        }
                    }
                ],
            },
            tabs: {
                id: 'sidebar-tabs',
                name: '功能切換',
                type: 'slot',
                isEditable: true,
                children: [
                    {
                        id: 'nav-menu',
                        type: 'column',
                        order: 0,
                        props: { gap: 4, padding: 0 },
                        children: [
                            {
                                id: 'btn-room',
                                type: 'button',
                                order: 0,
                                props: { label: '我的房間', variant: 'primary', icon: 'Home' },
                                action: { type: 'navigate-tab', target: 'room' }
                            },
                            {
                                id: 'btn-map',
                                type: 'button',
                                order: 1,
                                props: { label: '城市地圖', variant: 'ghost', icon: 'Map' },
                                action: { type: 'navigate-tab', target: 'map' }
                            },
                            {
                                id: 'btn-inventory',
                                type: 'button',
                                order: 2,
                                props: { label: '資源背包', variant: 'ghost', icon: 'Package' },
                                action: { type: 'navigate-tab', target: 'inventory' }
                            }
                        ]
                    }
                ],
            },
            content: createEmptyRegion('sidebar-content', '側邊欄內容'),
            footer: {
                id: 'sidebar-footer',
                name: '側邊欄底部',
                type: 'slot',
                isEditable: true,
                children: [
                    {
                        id: 'user-profile-row',
                        type: 'row',
                        order: 0,
                        props: { gap: 12, alignItems: 'center', padding: 12, backgroundColor: 'hsl(var(--muted)/0.3)', borderRadius: 8 },
                        children: [
                            { id: 'user-avatar', type: 'icon', order: 0, props: { iconName: 'User', size: 32 } },
                            { id: 'user-name', type: 'text', order: 1, props: { content: '用戶名稱', fontSize: 14, fontWeight: 500 } }
                        ]
                    }
                ],
            },
        },
        main: {
            header: {
                id: 'main-header',
                name: '主畫面頂部',
                type: 'slot',
                isEditable: true,
                children: [
                    {
                        id: 'header-row',
                        type: 'row',
                        order: 0,
                        props: { justifyContent: 'between', alignItems: 'center' },
                        children: [
                            { id: 'header-title', type: 'text', order: 0, props: { content: '當前場景', fontSize: 18, fontWeight: 600 } },
                            {
                                id: 'header-actions',
                                type: 'row',
                                order: 1,
                                props: { gap: 8 },
                                children: [
                                    { id: 'btn-settings', type: 'button', order: 0, props: { label: '', variant: 'ghost', icon: 'Settings', size: 'sm' } },
                                    { id: 'btn-help', type: 'button', order: 1, props: { label: '', variant: 'ghost', icon: 'HelpCircle', size: 'sm' } }
                                ]
                            }
                        ]
                    }
                ],
            },
            content: {
                id: 'main-content',
                name: '主畫面內容 (3D)',
                type: 'fixed',
                isEditable: false,
                children: [],
                description: '此區域為等距 3D 房間預覽區，無法直接編輯。',
            },
            floatingElements: {
                id: 'main-floatingElements',
                name: '懸浮控制項',
                type: 'slot',
                isEditable: true,
                children: [
                    {
                        id: 'floating-controls',
                        type: 'column',
                        order: 0,
                        props: { gap: 8 },
                        children: [
                            { id: 'btn-zoom-in', type: 'button', order: 0, props: { label: '', variant: 'secondary', icon: 'ZoomIn', size: 'sm' } },
                            { id: 'btn-zoom-out', type: 'button', order: 1, props: { label: '', variant: 'secondary', icon: 'ZoomOut', size: 'sm' } }
                        ]
                    }
                ],
            },
        },
    },
    createdAt: new Date().toISOString(),
};
