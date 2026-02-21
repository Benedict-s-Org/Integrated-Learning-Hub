import React, { useMemo } from 'react';
import { AvatarImageItem, UserAvatarConfig, DEFAULT_PART_OFFSET } from './avatarParts';

interface AvatarRendererProps {
    equippedItems: AvatarImageItem[];
    userConfig: UserAvatarConfig;
    size?: number | string;
    className?: string;
    showBackground?: boolean;
}

export const AvatarRenderer: React.FC<AvatarRendererProps> = ({
    equippedItems = [],
    userConfig = {},
    size = 200,
    className = '',
    showBackground = false
}) => {

    // Sort items by their Z-Index so they stack correctly (lowest to highest)
    const sortedItems = useMemo(() => {
        return [...equippedItems].sort((a, b) => a.layer_z_index - b.layer_z_index);
    }, [equippedItems]);

    return (
        <div
            className={`relative flex items-center justify-center overflow-hidden rounded-2xl ${className}`}
            style={{
                width: size,
                height: size,
                backgroundColor: showBackground ? '#f0f9ff' : 'transparent',
                border: showBackground ? '2px solid #bae6fd' : 'none'
            }}
        >
            {sortedItems.map((item) => {
                // Get user's custom offset for this specific category (if any)
                const offset = userConfig[item.category] || DEFAULT_PART_OFFSET;

                return (
                    <img
                        key={item.id}
                        src={item.image_url}
                        alt={`Avatar ${item.category} part`}
                        className="absolute object-contain pointer-events-none transition-transform duration-200"
                        style={{
                            width: '100%',
                            height: '100%',
                            zIndex: item.layer_z_index,
                            transform: `translate(${offset.x}%, ${offset.y}%) scale(${offset.scale})`,
                            transformOrigin: 'center center'
                        }}
                    />
                );
            })}

            {sortedItems.length === 0 && (
                <div className="text-gray-400 text-sm font-fredoka text-center px-4">
                    Empty Avatar
                </div>
            )}
        </div>
    );
};

