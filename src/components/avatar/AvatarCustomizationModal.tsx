import React, { useState, useEffect } from 'react';
import { AvatarEditor } from './AvatarEditor';
import { AvatarConfig, DEFAULT_AVATAR_CONFIG } from './avatarParts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Loader2, X } from 'lucide-react';

interface AvatarCustomizationModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId?: string; // Optional: Admin editing another user
    currentConfig?: AvatarConfig | null;
    onConfigSave?: (newConfig: AvatarConfig) => void;
}

export const AvatarCustomizationModal: React.FC<AvatarCustomizationModalProps> = ({
    isOpen,
    onClose,
    userId,
    currentConfig,
    onConfigSave
}) => {
    const { user } = useAuth();
    const targetUserId = userId || user?.id;
    const [loading, setLoading] = useState(false);
    const [initialConfig, setInitialConfig] = useState<AvatarConfig>(DEFAULT_AVATAR_CONFIG);

    useEffect(() => {
        if (isOpen && targetUserId) {
            if (currentConfig) {
                setInitialConfig(currentConfig);
            } else {
                fetchConfig();
            }
        }
    }, [isOpen, targetUserId, currentConfig]);

    const fetchConfig = async () => {
        if (!targetUserId) return;
        setLoading(true);
        const { data, error } = await (supabase
            .from('user_avatar_config' as any)
            .select('config')
            .eq('user_id', targetUserId)
            .single() as any);

        if (data && data.config) {
            // Cast the JSON to AvatarConfig, ensuring defaults for missing keys
            setInitialConfig({ ...DEFAULT_AVATAR_CONFIG, ...data.config as any });
        }
        setLoading(false);
    };

    const handleSave = async (newConfig: AvatarConfig) => {
        if (!targetUserId) return;
        setLoading(true);

        const { error } = await (supabase
            .from('user_avatar_config' as any)
            .upsert({
                user_id: targetUserId,
                config: newConfig as any,
                updated_at: new Date().toISOString()
            }) as any);

        setLoading(false);

        if (error) {
            console.error('Error saving avatar:', error);
            alert('Failed to save avatar');
        } else {
            alert('Avatar updated! ✨');
            onConfigSave?.(newConfig);
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
                            initialConfig={initialConfig}
                            onSave={handleSave}
                            onCancel={onClose}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
