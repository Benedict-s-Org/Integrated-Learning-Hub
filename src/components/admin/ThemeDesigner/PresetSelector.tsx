/**
 * Preset Selector Component
 * 
 * Displays theme presets as clickable cards
 */

import { useThemeContext } from '@/contexts/ThemeContext';
import { Theme } from '@/types/theme';
import { Check, Trash2 } from 'lucide-react';

interface PresetCardProps {
    theme: Theme;
    isActive: boolean;
    onSelect: () => void;
    onDelete?: () => void;
}

function PresetCard({ theme, isActive, onSelect, onDelete }: PresetCardProps) {
    const primaryColor = `hsl(${theme.colors.primary})`;
    const accentColor = `hsl(${theme.colors.accent})`;
    const bgColor = `hsl(${theme.colors.background})`;
    const borderColor = `hsl(${theme.colors.border})`;

    return (
        <div
            onClick={onSelect}
            className={`
                relative group cursor-pointer transition-all duration-200
                rounded-2xl p-4 border-2
                ${isActive
                    ? 'border-primary ring-2 ring-primary/20 scale-[1.02]'
                    : 'border-border hover:border-primary/30 hover:shadow-lg'
                }
            `}
            style={{ backgroundColor: bgColor }}
        >
            {/* Active indicator */}
            {isActive && (
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
                    <Check className="w-4 h-4 text-primary-foreground" />
                </div>
            )}

            {/* Delete button for custom themes */}
            {onDelete && !theme.isSystem && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-destructive rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <Trash2 className="w-3 h-3 text-destructive-foreground" />
                </button>
            )}

            {/* Color preview circles */}
            <div className="flex gap-2 mb-3">
                <div
                    className="w-8 h-8 rounded-full shadow-inner"
                    style={{ backgroundColor: primaryColor }}
                />
                <div
                    className="w-8 h-8 rounded-full shadow-inner"
                    style={{ backgroundColor: accentColor }}
                />
                <div
                    className="w-8 h-8 rounded-full border-2 shadow-inner"
                    style={{ backgroundColor: bgColor, borderColor }}
                />
            </div>

            {/* Theme name */}
            <h4
                className="font-bold text-sm"
                style={{ color: `hsl(${theme.colors.foreground})` }}
            >
                {theme.name}
            </h4>

            {/* Description */}
            {theme.description && (
                <p
                    className="text-xs mt-1 opacity-60"
                    style={{ color: `hsl(${theme.colors.foreground})` }}
                >
                    {theme.description}
                </p>
            )}

            {/* System badge */}
            {theme.isSystem && (
                <span
                    className="inline-block mt-2 px-2 py-0.5 text-[10px] font-bold rounded-full opacity-50"
                    style={{
                        backgroundColor: `hsl(${theme.colors.primary})`,
                        color: `hsl(${theme.colors.primaryForeground})`,
                    }}
                >
                    內建
                </span>
            )}
        </div>
    );
}

export function PresetSelector() {
    const { allThemes, currentTheme, setTheme, deleteCustomTheme } = useThemeContext();

    // Separate system presets and custom themes
    const systemThemes = allThemes.filter(t => t.isSystem);
    const customThemes = allThemes.filter(t => !t.isSystem);

    return (
        <div className="space-y-6">
            {/* System Presets */}
            <div>
                <h3 className="text-sm font-bold text-primary mb-3">內建主題</h3>
                <div className="grid grid-cols-2 gap-3">
                    {systemThemes.map(theme => (
                        <PresetCard
                            key={theme.id}
                            theme={theme}
                            isActive={currentTheme.id === theme.id}
                            onSelect={() => setTheme(theme)}
                        />
                    ))}
                </div>
            </div>

            {/* Custom Themes */}
            {customThemes.length > 0 && (
                <div>
                    <h3 className="text-sm font-bold text-primary mb-3">自訂主題</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {customThemes.map(theme => (
                            <PresetCard
                                key={theme.id}
                                theme={theme}
                                isActive={currentTheme.id === theme.id}
                                onSelect={() => setTheme(theme)}
                                onDelete={() => deleteCustomTheme(theme.id)}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
