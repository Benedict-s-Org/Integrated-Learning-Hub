import React, { useState, useEffect } from 'react';
import { AvatarEditor } from './AvatarEditor';
import { AvatarImageItem, UserAvatarConfig } from './avatarParts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Loader2, X } from 'lucide-react';

interface AvatarCustomizationModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId?: string;
    initialEquipped?: AvatarImageItem[];
    initialConfig?: UserAvatarConfig;
    onSave?: (equippedIds: string[], config: UserAvatarConfig) => void;
}

export const AvatarCustomizationModal: React.FC<AvatarCustomizationModalProps> = ({
    isOpen,
    onClose,
    userId,
}) => {
    const { user } = useAuth();
    const targetUserId = userId || user?.id;
    const [loading, setLoading] = useState(false);
    const [availableItems, setAvailableItems] = useState<AvatarImageItem[]>([]);
    const [equippedItems, setEquippedItems] = useState<AvatarImageItem[]>([]);
    const [userConfig, setUserConfig] = useState<UserAvatarConfig>({});

    useEffect(() => {
        if (isOpen && targetUserId) {
            fetchAvatarData();
        }
    }, [isOpen, targetUserId]);

    const fetchAvatarData = async () => {
        setLoading(true);
        try {
            // 1. Fetch catalog
            const { data: itemsData } = await supabase
                .from('avatar_items')
                .select('*')
                .order('layer_z_index', { ascending: true });

            const items = (itemsData || []) as AvatarImageItem[];
            setAvailableItems(items);

            if (!targetUserId) {
                setLoading(false);
                return;
            }

            // 2. Fetch user config
            const { data: configData } = await supabase
                .from('user_avatar_config')
                .select('equipped_items, custom_offsets')
                .eq('user_id', targetUserId)
                .maybeSingle();

            if (configData) {
                const equippedIds = configData.equipped_items as string[] || [];
                const offsets = configData.custom_offsets as UserAvatarConfig || {};

                const equipped = items.filter(item => equippedIds.includes(item.id));
                setEquippedItems(equipped);
                setUserConfig(offsets);
            } else {
                // Default items
                setEquippedItems(items.filter(i => i.is_default));
            }
        } catch (err) {
            console.error("Error fetching avatar data:", err);
        } finally {
            setLoading(true); // Wait, should be false
            setLoading(false);
        }
    };

    const handleSave = async (equippedIds: string[], config: UserAvatarConfig) => {
        if (!targetUserId) return;
        setLoading(true);

        const { error } = await supabase
            .from('user_avatar_config')
            .upsert({
                user_id: targetUserId,
                equipped_items: equippedIds,
                custom_offsets: config as any,
                updated_at: new Date().toISOString()
            });

        setLoading(false);

        if (error) {
            console.error('Error saving avatar:', error);
            alert('Failed to save avatar');
        } else {
            alert('Avatar updated! ✨');
            onSave?.(equippedIds, config);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-300 border-4 border-amber-100">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors z-[110] bg-white/80 backdrop-blur-sm"
                >
                    <X size={24} />
                </button>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center bg-white">
                            <Loader2 className="w-12 h-12 animate-spin text-amber-500" />
                            <p className="mt-4 text-amber-600 font-bold animate-pulse font-fredoka">Loading your Chibi...</p>
                        </div>
                    ) : (
                        <AvatarEditor
                            availableItems={availableItems}
                            initialEquipped={equippedItems}
                            initialConfig={userConfig}
                            onSave={handleSave}
                            onCancel={onClose}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
