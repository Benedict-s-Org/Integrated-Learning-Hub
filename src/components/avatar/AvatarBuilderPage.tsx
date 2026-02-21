import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AvatarEditor } from './AvatarEditor';
import { AvatarImageItem, UserAvatarConfig } from './avatarParts';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useInventory } from '@/hooks/useInventory';

export const AvatarBuilderPage: React.FC = () => {
    const { user } = useAuth();
    const { inventory, buyItem } = useInventory();
    const [availableItems, setAvailableItems] = useState<AvatarImageItem[]>([]);
    const [equippedItems, setEquippedItems] = useState<AvatarImageItem[]>([]);
    const [userConfig, setUserConfig] = useState<UserAvatarConfig>({});
    const [isLoading, setIsLoading] = useState(true);

    const unlockedAvatarItemIds = inventory;

    useEffect(() => {
        const fetchAvatarData = async () => {
            setIsLoading(true);
            try {
                // 1. Fetch all available catalog items
                const { data: itemsData, error: itemsError } = await supabase
                    .from('avatar_items')
                    .select('*')
                    .order('layer_z_index', { ascending: true });

                if (itemsError) throw itemsError;

                const items = (itemsData || []) as AvatarImageItem[];
                setAvailableItems(items);

                // 2. If user is logged in, fetch their saved config
                if (user) {
                    const { data: configData, error: configError } = await supabase
                        .from('user_avatar_config')
                        .select('equipped_items, custom_offsets')
                        .eq('user_id', user.id)
                        .maybeSingle();

                    if (configError && configError.code !== 'PGRST116') {
                        console.error("Error fetching user avatar config:", configError);
                    }

                    if (configData) {
                        const equippedIds = configData.equipped_items as string[] || [];
                        const offsets = configData.custom_offsets as UserAvatarConfig || {};

                        // Map IDs back to full items
                        const equipped = items.filter(item => equippedIds.includes(item.id));
                        setEquippedItems(equipped);
                        setUserConfig(offsets);
                    } else {
                        // Fallback: equip default items if no config exists
                        const defaults = items.filter(item => item.is_default);
                        setEquippedItems(defaults);
                    }
                } else {
                    // Not logged in: simply show default items
                    const defaults = items.filter(item => item.is_default);
                    setEquippedItems(defaults);
                }

            } catch (error) {
                console.error("Error loading avatar data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAvatarData();
    }, [user]);

    const handleSave = async (equippedItemIds: string[], config: UserAvatarConfig) => {
        if (!user) {
            alert("Please log in to save your avatar.");
            return;
        }

        try {
            const { error } = await supabase
                .from('user_avatar_config')
                .upsert({
                    user_id: user.id,
                    equipped_items: equippedItemIds,
                    custom_offsets: config as any, // Cast to any to bypass strict JSON type checks
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
            alert("Avatar saved successfully!");
        } catch (error) {
            console.error("Error saving avatar:", error);
            alert("Failed to save avatar.");
        }
    };

    const handleBuyItem = async (item: AvatarImageItem) => {
        if (!user) {
            alert("Please log in to purchase items.");
            return;
        }

        if (window.confirm(`Buy ${item.name} for ${item.base_price} coins?`)) {
            const success = buyItem({ id: item.id, name: item.name, cost: item.base_price });
            if (success) {
                alert(`Successfully purchased ${item.name}!`);
            } else {
                alert("Purchase failed. Check your coin balance.");
            }
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-6xl p-4 h-[calc(100vh-100px)]">
            <h1 className="text-3xl font-bold font-fredoka text-amber-900 mb-6 drop-shadow-sm flex items-center gap-3">
                <span className="bg-amber-100 p-2 rounded-xl text-2xl">🎨</span>
                Avatar Studio
            </h1>
            <div className="h-[calc(100%-80px)]">
                <AvatarEditor
                    availableItems={availableItems}
                    initialEquipped={equippedItems}
                    initialConfig={userConfig}
                    unlockedItemIds={unlockedAvatarItemIds}
                    onSave={handleSave}
                    onBuyItem={handleBuyItem}
                    onCancel={() => {
                        if (window.confirm("Discard unsaved changes?")) {
                            window.location.reload();
                        }
                    }}
                />
            </div>
        </div>
    );
};
