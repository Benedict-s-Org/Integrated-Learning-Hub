/**
 * Theme Preview Component
 * 
 * Shows a live preview of the current theme with sample UI elements
 */

import { useThemeContext } from '@/contexts/ThemeContext';
import {
    Home,
    Settings,
    Bell,
    Search,
    Heart,
    Star,
    Check,
    AlertCircle,
    ArrowRight
} from 'lucide-react';

export function ThemePreview() {
    const { currentTheme } = useThemeContext();

    return (
        <div className="bg-background rounded-3xl border-2 border-border overflow-hidden">
            {/* Header */}
            <div className="bg-card px-6 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                        <Home className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div>
                        <h3 className="font-bold text-foreground">預覽標題</h3>
                        <p className="text-xs text-muted-foreground">這是副標題文字</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
                        <Search className="w-4 h-4 text-secondary-foreground" />
                    </button>
                    <button className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
                        <Bell className="w-4 h-4 text-secondary-foreground" />
                    </button>
                    <button className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
                        <Settings className="w-4 h-4 text-secondary-foreground" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
                {/* Cards */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-card rounded-2xl p-4 border border-border">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                            <Star className="w-5 h-5 text-primary" />
                        </div>
                        <h4 className="font-bold text-foreground text-sm">功能卡片</h4>
                        <p className="text-xs text-muted-foreground mt-1">說明文字</p>
                    </div>
                    <div className="bg-card rounded-2xl p-4 border border-border">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-3">
                            <Heart className="w-5 h-5 text-accent" />
                        </div>
                        <h4 className="font-bold text-foreground text-sm">強調卡片</h4>
                        <p className="text-xs text-muted-foreground mt-1">說明文字</p>
                    </div>
                    <div className="bg-secondary rounded-2xl p-4">
                        <div className="w-10 h-10 rounded-xl bg-white/50 flex items-center justify-center mb-3">
                            <Check className="w-5 h-5 text-secondary-foreground" />
                        </div>
                        <h4 className="font-bold text-secondary-foreground text-sm">次要卡片</h4>
                        <p className="text-xs text-secondary-foreground/70 mt-1">說明文字</p>
                    </div>
                </div>

                {/* Buttons */}
                <div className="space-y-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase">按鈕樣式</p>
                    <div className="flex flex-wrap gap-3">
                        <button className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 transition-opacity flex items-center gap-2">
                            主要按鈕
                            <ArrowRight className="w-4 h-4" />
                        </button>
                        <button className="px-4 py-2 bg-accent text-accent-foreground rounded-xl font-bold text-sm hover:opacity-90 transition-opacity">
                            強調按鈕
                        </button>
                        <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded-xl font-bold text-sm hover:bg-secondary/80 transition-colors">
                            次要按鈕
                        </button>
                        <button className="px-4 py-2 bg-muted text-muted-foreground rounded-xl font-bold text-sm hover:bg-muted/80 transition-colors">
                            靜音按鈕
                        </button>
                        <button className="px-4 py-2 bg-destructive text-destructive-foreground rounded-xl font-bold text-sm hover:opacity-90 transition-opacity">
                            危險按鈕
                        </button>
                    </div>
                </div>

                {/* Input */}
                <div className="space-y-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase">輸入框</p>
                    <div className="flex gap-4">
                        <input
                            type="text"
                            placeholder="請輸入文字..."
                            className="flex-1 px-4 py-3 bg-input border-2 border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none transition-colors"
                        />
                        <button className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm">
                            送出
                        </button>
                    </div>
                </div>

                {/* Alerts */}
                <div className="space-y-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase">提示訊息</p>
                    <div className="flex items-start gap-3 p-4 bg-primary/10 rounded-xl">
                        <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-foreground text-sm">資訊提示</p>
                            <p className="text-xs text-muted-foreground mt-1">這是一則資訊提示訊息，用於顯示一般資訊。</p>
                        </div>
                    </div>
                </div>

                {/* Theme Info */}
                <div className="pt-4 border-t border-border">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                            目前主題：<span className="font-bold text-foreground">{currentTheme.name}</span>
                        </span>
                        {currentTheme.isDark && (
                            <span className="px-2 py-1 bg-foreground/10 rounded-lg text-foreground">
                                深色模式
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
