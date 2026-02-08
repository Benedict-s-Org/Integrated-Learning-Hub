/**
 * Theme Designer - Main Component
 * 
 * Admin panel for customizing the platform's visual theme
 */

import { useState } from 'react';
import { useThemeContext } from '@/contexts/ThemeContext';
import { ColorPicker } from './ColorPicker';
import { ThemePreview } from './ThemePreview';
import { PresetSelector } from './PresetSelector';
import {
    Palette,
    Layers,
    Save,
    RotateCcw,
    Download,
    Upload,
    Sliders,
    Eye,
    X,
    Check
} from 'lucide-react';

type TabId = 'presets' | 'colors' | 'styles';

interface ThemeDesignerProps {
    onClose?: () => void;
}

export function ThemeDesigner({ onClose }: ThemeDesignerProps) {
    const {
        currentTheme,
        updateColors,
        updateStyles,
        resetToDefault,
        saveAsCustom,
        exportTheme,
        importTheme,
        applyToPlatform,
    } = useThemeContext();

    const [activeTab, setActiveTab] = useState<TabId>('presets');
    const [saveModalOpen, setSaveModalOpen] = useState(false);
    const [themeName, setThemeName] = useState('');
    const [themeDescription, setThemeDescription] = useState('');
    const [isApplying, setIsApplying] = useState(false);

    const handleApply = () => {
        setIsApplying(true);
        applyToPlatform();
        setTimeout(() => setIsApplying(false), 2000);
    };

    const handleSave = () => {
        if (themeName.trim()) {
            saveAsCustom(themeName.trim(), themeDescription.trim() || undefined);
            setSaveModalOpen(false);
            setThemeName('');
            setThemeDescription('');
        }
    };

    const handleImport = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const text = await file.text();
                const result = importTheme(text);
                if (!result.success) {
                    alert('匯入失敗：' + result.error);
                }
            }
        };
        input.click();
    };

    const tabs = [
        { id: 'presets' as TabId, label: '主題預設', icon: <Layers className="w-4 h-4" /> },
        { id: 'colors' as TabId, label: '顏色設定', icon: <Palette className="w-4 h-4" /> },
        { id: 'styles' as TabId, label: '樣式設定', icon: <Sliders className="w-4 h-4" /> },
    ];

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Header */}
            <div className="shrink-0 px-6 py-4 border-b border-border bg-card">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                            <Palette className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-foreground">主題設計</h1>
                            <div className="flex items-center gap-2">
                                <p className="text-xs text-muted-foreground">自訂平台的顏色與樣式</p>
                                <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-bold animate-pulse">
                                    即時生效
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleApply}
                            disabled={isApplying}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all
                                ${isApplying
                                    ? 'bg-green-500 text-white animate-pulse'
                                    : 'bg-primary/20 text-primary hover:bg-primary/30'
                                }
                            `}
                        >
                            <Check className={`w-4 h-4 ${isApplying ? 'animate-bounce' : ''}`} />
                            {isApplying ? '套用中...' : '套用變更'}
                        </button>

                        <button
                            onClick={() => setSaveModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
                        >
                            <Save className="w-4 h-4" />
                            儲存主題
                        </button>
                        <button
                            onClick={exportTheme}
                            className="w-10 h-10 bg-secondary text-secondary-foreground rounded-xl flex items-center justify-center hover:bg-secondary/80 transition-colors"
                            title="匯出主題"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleImport}
                            className="w-10 h-10 bg-secondary text-secondary-foreground rounded-xl flex items-center justify-center hover:bg-secondary/80 transition-colors"
                            title="匯入主題"
                        >
                            <Upload className="w-4 h-4" />
                        </button>
                        <button
                            onClick={resetToDefault}
                            className="w-10 h-10 bg-muted text-muted-foreground rounded-xl flex items-center justify-center hover:bg-muted/80 transition-colors"
                            title="重設為預設"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>

                        {onClose && (
                            <>
                                <div className="w-px h-6 bg-border mx-1" />
                                <button
                                    onClick={onClose}
                                    className="w-10 h-10 bg-muted text-muted-foreground rounded-xl flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-all"
                                    title="關閉"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex min-h-0 overflow-hidden">
                {/* Left panel - Controls */}
                <div className="w-[400px] shrink-0 border-r border-border flex flex-col bg-card">
                    {/* Tabs */}
                    <div className="shrink-0 flex border-b border-border">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition-colors
                                    ${activeTab === tab.id
                                        ? 'text-primary border-b-2 border-primary bg-primary/5'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }
                                `}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {activeTab === 'presets' && <PresetSelector />}

                        {activeTab === 'colors' && (
                            <div className="space-y-6">
                                <ColorPicker
                                    label="主要顏色"
                                    description="按鈕、連結、重點元素"
                                    value={currentTheme.colors.primary}
                                    onChange={(v) => updateColors({ primary: v })}
                                />
                                <ColorPicker
                                    label="強調顏色"
                                    description="特殊按鈕、標籤、徽章"
                                    value={currentTheme.colors.accent}
                                    onChange={(v) => updateColors({ accent: v })}
                                />
                                <ColorPicker
                                    label="背景顏色"
                                    description="頁面背景"
                                    value={currentTheme.colors.background}
                                    onChange={(v) => updateColors({ background: v })}
                                />
                                <ColorPicker
                                    label="文字顏色"
                                    description="主要文字"
                                    value={currentTheme.colors.foreground}
                                    onChange={(v) => updateColors({ foreground: v })}
                                />
                                <ColorPicker
                                    label="次要背景"
                                    description="卡片、面板背景"
                                    value={currentTheme.colors.secondary}
                                    onChange={(v) => updateColors({ secondary: v })}
                                />
                                <ColorPicker
                                    label="邊框顏色"
                                    description="分隔線、邊框"
                                    value={currentTheme.colors.border}
                                    onChange={(v) => updateColors({ border: v })}
                                />
                            </div>
                        )}

                        {activeTab === 'styles' && (
                            <div className="space-y-6">
                                {/* Border Radius */}
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-primary">圓角大小</label>
                                    <p className="text-xs text-muted-foreground">調整元素的圓角程度</p>
                                    <input
                                        type="range"
                                        min="0"
                                        max="2"
                                        step="0.125"
                                        value={parseFloat(currentTheme.styles.borderRadius) || 1}
                                        onChange={(e) => updateStyles({ borderRadius: `${e.target.value}rem` })}
                                        className="w-full h-2 rounded-full appearance-none cursor-pointer bg-secondary"
                                    />
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>方正</span>
                                        <span className="font-mono">{currentTheme.styles.borderRadius}</span>
                                        <span>圓潤</span>
                                    </div>

                                    {/* Preview shapes */}
                                    <div className="flex gap-4 pt-2">
                                        <div
                                            className="w-16 h-16 bg-primary"
                                            style={{ borderRadius: currentTheme.styles.borderRadius }}
                                        />
                                        <div
                                            className="w-24 h-10 bg-accent"
                                            style={{ borderRadius: currentTheme.styles.borderRadius }}
                                        />
                                        <div
                                            className="w-32 h-8 bg-secondary border-2 border-border"
                                            style={{ borderRadius: currentTheme.styles.borderRadius }}
                                        />
                                    </div>
                                </div>

                                {/* Font Family */}
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-primary">字體</label>
                                    <p className="text-xs text-muted-foreground">選擇平台使用的字體</p>
                                    <select
                                        value={currentTheme.styles.fontFamily}
                                        onChange={(e) => updateStyles({ fontFamily: e.target.value })}
                                        className="w-full px-4 py-3 bg-input border-2 border-border rounded-xl text-foreground focus:border-ring focus:outline-none transition-colors cursor-pointer"
                                    >
                                        <option value="Outfit">Outfit (預設)</option>
                                        <option value="Inter">Inter</option>
                                        <option value="Roboto">Roboto</option>
                                        <option value="Noto Sans TC">Noto Sans TC (思源黑體)</option>
                                        <option value="system-ui">系統字體</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right panel - Preview */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-muted/30">
                    <div className="shrink-0 px-6 py-3 border-b border-border bg-card flex items-center gap-2">
                        <Eye className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-bold text-muted-foreground">即時預覽</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6">
                        <ThemePreview />
                    </div>
                </div>
            </div>

            {/* Save Modal */}
            {saveModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-card rounded-3xl p-6 w-[400px] shadow-2xl">
                        <h2 className="text-xl font-black text-foreground mb-4">儲存主題</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-bold text-primary mb-2 block">主題名稱</label>
                                <input
                                    type="text"
                                    value={themeName}
                                    onChange={(e) => setThemeName(e.target.value)}
                                    placeholder="例如：我的自訂主題"
                                    className="w-full px-4 py-3 bg-input border-2 border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none transition-colors"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-bold text-primary mb-2 block">說明（選填）</label>
                                <textarea
                                    value={themeDescription}
                                    onChange={(e) => setThemeDescription(e.target.value)}
                                    placeholder="描述這個主題的風格..."
                                    rows={3}
                                    className="w-full px-4 py-3 bg-input border-2 border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none transition-colors resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setSaveModalOpen(false)}
                                className="flex-1 px-4 py-3 bg-muted text-muted-foreground rounded-xl font-bold hover:bg-muted/80 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!themeName.trim()}
                                className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                儲存
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
