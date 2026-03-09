import React, { useState, useEffect } from 'react';
import { User, Save, Loader2, ChevronLeft, ChevronRight, MessageSquare, BookOpen, DoorOpen } from 'lucide-react';
import { AdminMessageModal } from './notifications/AdminMessageModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useDashboardTheme } from '@/context/DashboardThemeContext';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AvatarRenderer } from '../avatar/AvatarRenderer';
import { AvatarImageItem, UserAvatarConfig } from '../avatar/avatarParts';

interface UserWithCoins {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    coins: number;
    virtual_coins?: number;
    daily_real_earned?: number;
    daily_reward_count?: number; // Add this
    toilet_coins?: number;
    class_number: number | null;
    email: string;
    created_at: string;
    is_admin: boolean;
    class_name?: string | null;
    equipped_item_ids?: string[];
    custom_offsets?: UserAvatarConfig;
}

interface ClassDistributorProps {
    users: UserWithCoins[];
    avatarCatalog: AvatarImageItem[];
    isLoading: boolean;
    onAwardCoins: (userIds: string[]) => Promise<void>;
    onStudentClick: (student: UserWithCoins) => void;
    onReorder: (newOrder: UserWithCoins[]) => Promise<void>;
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
    onHomeworkClick?: (student: UserWithCoins) => void;
    onToiletBreakClick?: (student: UserWithCoins) => void;
    isGuestMode?: boolean;
    consequenceCounts?: Record<string, number>;
    showEmail?: boolean;
    className?: string;
    onGetGuestLink?: (className: string) => Promise<void>;
}

interface SortableUserItemProps {
    user: UserWithCoins;
    avatarCatalog: AvatarImageItem[];
    isSelected: boolean;
    index: number;
    total: number;
    isRearranging: boolean;
    onToggle: (e: React.MouseEvent, id: string) => void;
    onClick: () => void;
    onHomeworkClick?: () => void;
    onToiletBreakClick?: () => void;
    onMove: (index: number, direction: 'forward' | 'backward') => void;
    isGuestMode?: boolean;
    consequenceCount?: number;
    showEmail?: boolean;
}

function SortableUserItemComponent({ user, avatarCatalog, isSelected, index, total, isRearranging, onToggle, onClick, onHomeworkClick, onToiletBreakClick, onMove, isGuestMode, consequenceCount = 0, showEmail }: SortableUserItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: user.id, disabled: !isRearranging });

    const { theme } = useDashboardTheme();

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.5 : 1,
        backgroundColor: theme.cardBg,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`
                relative p-2 pb-3 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-1.5 group
                ${isSelected
                    ? 'border-blue-500 shadow-md transform scale-[1.02]'
                    : consequenceCount === 2
                        ? 'border-yellow-400 bg-yellow-50'
                        : consequenceCount >= 3
                            ? 'border-red-400 bg-red-50'
                            : 'border-gray-200 hover:border-blue-300 hover:shadow-lg'
                }
            `}
        >
            {/* Consequence Frequency Badge */}
            {consequenceCount > 0 && (
                <div className={`absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm z-20 animate-in zoom-in duration-300
                    ${consequenceCount >= 3 ? 'bg-red-600 text-white animate-pulse' : 'bg-yellow-400 text-slate-900'}
                `}>
                    {consequenceCount}
                </div>
            )}

            {/* Drag Handle - Active only when rearranging */}
            {isRearranging && (
                <div
                    {...attributes}
                    {...listeners}
                    className="absolute inset-0 cursor-grab active:cursor-grabbing z-0"
                    title="Drag to reorder"
                />
            )}

            {/* Clickable Content Container (Sitting above drag layer) */}
            <div className="relative z-10 w-full flex flex-col pointer-events-none gap-2">

                {/* Top Row: Avatar (Left) and Info (Right) */}
                <div className="flex flex-row w-full gap-3 items-start">

                    {/* Left Side: Avatar */}
                    <div
                        onClick={onClick}
                        className="shrink-0 w-20 h-[100px] rounded-2xl bg-gray-100 overflow-hidden shadow-inner cursor-pointer hover:opacity-90 transition-opacity pointer-events-auto flex items-center justify-center p-0.5"
                    >
                        {user.equipped_item_ids && user.equipped_item_ids.length > 0 ? (
                            <div className="w-full h-full transform scale-[1.3] translate-y-3">
                                <AvatarRenderer
                                    equippedItems={avatarCatalog.filter(item => user.equipped_item_ids?.includes(item.id))}
                                    userConfig={user.custom_offsets || {}}
                                    size="110%"
                                    showBackground={false}
                                />
                            </div>
                        ) : user.avatar_url ? (
                            <img src={user.avatar_url} alt={user.display_name || ''} className="w-full h-full object-cover rounded-xl" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <User size={48} />
                            </div>
                        )}
                    </div>

                    {/* Right Side: Info & Controls */}
                    <div className="flex flex-col items-end flex-1 min-w-0">
                        {/* Header Controls: Stacked Vertically on the right */}
                        <div className="flex flex-col items-center gap-1.5 pointer-events-auto mb-1">
                            {/* Selection Checkbox */}
                            <div
                                onClick={(e) => onToggle(e, user.id)}
                                className={`
                                    w-6 h-6 rounded flex items-center justify-center text-white text-xs shadow-sm transition-colors cursor-pointer
                                    ${isSelected ? 'bg-blue-500' : 'bg-gray-200 hover:bg-gray-300'}
                                `}
                            >
                                {isSelected && '✓'}
                            </div>

                            {/* Class Number Tag */}
                            <div
                                className={`w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center shadow-sm transition-colors ${isRearranging ? 'bg-orange-500 text-white' : ''}`}
                                style={!isRearranging ? {
                                    backgroundColor: theme.numberTagBg,
                                    color: theme.numberTagText
                                } : {}}
                            >
                                {index + 1}
                            </div>
                        </div>

                        {/* Name */}
                        <span
                            className="font-bold text-sm leading-tight text-right truncate w-full mt-0.5"
                            style={{ color: theme.cardText }}
                        >
                            {user.display_name || 'Unnamed Student'}
                        </span>

                        {/* Login Email */}
                        {showEmail && (
                            <span className="text-[8px] leading-tight text-gray-500 text-right truncate w-full mb-0.5">
                                {user.email || 'No email'}
                            </span>
                        )}

                        <div className="mt-1 flex flex-col items-end gap-1 self-end w-full">
                            <div
                                className="px-2 py-0.5 font-bold rounded text-xs flex items-center justify-end gap-1 border min-w-[60px]"
                                style={{
                                    backgroundColor: theme.coinBg,
                                    color: theme.coinText,
                                    borderColor: theme.coinBorder
                                }}
                            >
                                <span className="text-xs shrink-0">🪙</span>
                                <span className="text-sm font-black tabular-nums">
                                    {user.coins?.toLocaleString() || 0}
                                </span>
                                {(user.virtual_coins ?? 0) > 0 && (
                                    <span className="opacity-75 whitespace-nowrap ml-0.5 text-[8px] font-medium shrink-0">({user.virtual_coins})</span>
                                )}
                            </div>

                            {(() => {
                                const dailyEarned = user.daily_real_earned || 0;
                                if (dailyEarned === 0) return null;
                                return (
                                    <div
                                        className="px-1 rounded text-[10px] font-black shrink-0 border animate-in fade-in slide-in-from-top-1 duration-300"
                                        style={{
                                            backgroundColor: theme.dailyEarnedBg,
                                            color: theme.dailyEarnedText,
                                            borderColor: theme.dailyEarnedBorder
                                        }}
                                    >
                                        (+{dailyEarned})
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>

                {/* Toilet/Break Button */}
                {onToiletBreakClick && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToiletBreakClick();
                        }}
                        className="mt-1 w-fit flex items-center justify-start gap-1 py-1 px-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs transition-all border border-amber-200 pointer-events-auto active:scale-95"
                        title="Toilet / Break (20 Coins)"
                    >
                        <DoorOpen size={12} />
                        <span className="font-black">{user.toilet_coins ?? 100}</span>
                    </button>
                )}

                {/* Homework Button */}
                {onHomeworkClick && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onHomeworkClick();
                        }}
                        className="mt-1.5 w-full flex items-center justify-center gap-1 py-1 px-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-black transition-all border border-blue-100/50 pointer-events-auto active:scale-95"
                    >
                        <BookOpen size={12} />
                        {isGuestMode ? 'Homework' : 'HOMEWORK'}
                    </button>
                )}

                {/* Navigation Buttons - Only Visible when Rearranging */}
                {isRearranging && (
                    <div className="flex gap-1 mt-2 w-full justify-center pointer-events-auto animate-in fade-in zoom-in duration-200">
                        <button
                            onClick={(e) => { e.stopPropagation(); onMove(index, 'forward'); }}
                            disabled={index === 0}
                            className="p-1 rounded-full bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-600"
                            title="Move Forward (Lower Number)"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onMove(index, 'backward'); }}
                            disabled={index === total - 1}
                            className="p-1 rounded-full bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-600"
                            title="Move Backward (Higher Number)"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

const SortableUserItem = React.memo(SortableUserItemComponent, (prevProps, nextProps) => {
    if (prevProps.isSelected !== nextProps.isSelected) return false;
    if (prevProps.index !== nextProps.index) return false;
    if (prevProps.total !== nextProps.total) return false;
    if (prevProps.isRearranging !== nextProps.isRearranging) return false;
    if (prevProps.consequenceCount !== nextProps.consequenceCount) return false;
    if (prevProps.isGuestMode !== nextProps.isGuestMode) return false;
    if (prevProps.showEmail !== nextProps.showEmail) return false;

    // Check specific user fields that affect rendering
    const pUser = prevProps.user;
    const nUser = nextProps.user;

    if (pUser.id !== nUser.id) return false;
    if (pUser.coins !== nUser.coins) return false;
    if (pUser.virtual_coins !== nUser.virtual_coins) return false;
    if (pUser.daily_real_earned !== nUser.daily_real_earned) return false;
    if (pUser.daily_reward_count !== nUser.daily_reward_count) return false;
    if (pUser.toilet_coins !== nUser.toilet_coins) return false;
    if (pUser.display_name !== nUser.display_name) return false;

    // Check avatar items and offsets
    const prevIds = pUser.equipped_item_ids?.sort().join(',') || '';
    const nextIds = nUser.equipped_item_ids?.sort().join(',') || '';
    if (prevIds !== nextIds) return false;

    if (JSON.stringify(pUser.custom_offsets) !== JSON.stringify(nUser.custom_offsets)) return false;

    return true;
});

export function ClassDistributor({ users: initialUsers, avatarCatalog, isLoading, onAwardCoins, onStudentClick, onHomeworkClick, onToiletBreakClick, onReorder, selectedIds, onSelectionChange, isGuestMode, consequenceCounts = {}, showEmail, className, onGetGuestLink }: ClassDistributorProps) {
    const [localUsers, setLocalUsers] = useState<UserWithCoins[]>(initialUsers);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [isRearranging, setIsRearranging] = useState(false);
    const [isCreatingLink, setIsCreatingLink] = useState(false);

    // Admin Message Modal State
    const [showAdminMessageModal, setShowAdminMessageModal] = useState(false);
    const { user } = useAuth();

    useEffect(() => {
        setLocalUsers(initialUsers);
        setHasChanges(false);
    }, [initialUsers]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const toggleUser = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        onSelectionChange(Array.from(newSelected));
    };

    const handleSelectAll = () => {
        if (selectedIds.length === localUsers.length) {
            onSelectionChange([]);
        } else {
            onSelectionChange(localUsers.map(u => u.id));
        }
    };

    const handleMove = (index: number, direction: 'forward' | 'backward') => {
        if (direction === 'forward' && index > 0) {
            setLocalUsers(prev => arrayMove(prev, index, index - 1));
            setHasChanges(true);
        } else if (direction === 'backward' && index < localUsers.length - 1) {
            setLocalUsers(prev => arrayMove(prev, index, index + 1));
            setHasChanges(true);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            setLocalUsers((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over?.id);
                const newList = arrayMove(items, oldIndex, newIndex);
                setHasChanges(true);
                return newList;
            });
        }
    };

    const handleSaveOrder = async () => {
        setIsSaving(true);
        try {
            await onReorder(localUsers);
            setHasChanges(false);
            setIsRearranging(false);
        } catch (error) {
            console.error('Failed to save order:', error);
            alert('Failed to save class numbers');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAdminMessageSend = async (message: string, type: any, studentIds?: string[]) => {
        try {
            const records = [];

            if (studentIds && studentIds.length > 0) {
                studentIds.forEach(id => {
                    records.push({
                        student_id: id,
                        message,
                        type,
                        created_by: user?.id,
                        is_internal: true,
                        is_read: false
                    });
                });
            } else {
                records.push({
                    student_id: null,
                    message,
                    type,
                    created_by: user?.id,
                    is_internal: true,
                    is_read: false
                });
            }

            const { error } = await supabase
                .from('student_records')
                .insert(records as any);

            if (error) throw error;

            setShowAdminMessageModal(false);
            // alert('Message logged.'); // Optional feedback

        } catch (error) {
            console.error('Error sending admin message:', error);
            alert('Failed to log message');
        }
    };

    const handleLinkClick = async () => {
        if (!onGetGuestLink || !className) return;
        setIsCreatingLink(true);
        try {
            await onGetGuestLink(className);
        } finally {
            setIsCreatingLink(false);
        }
    };

    // Check if all local users are selected for button text
    const areAllLocalSelected = localUsers.length > 0 && localUsers.every(u => selectedIds.includes(u.id));

    // Calculate selection count for just this group
    const localSelectionCount = localUsers.filter(u => selectedIds.includes(u.id)).length;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Classroom</h2>
                    <p className="text-gray-500 mb-2">Drag items or use arrow buttons to rearrange class numbers.</p>

                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {hasChanges && (
                        <button
                            onClick={handleSaveOrder}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-green-500 rounded-lg shadow-lg hover:bg-green-600 transition-all"
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Save Order
                        </button>
                    )}

                    {/* Guest Link Button */}
                    {!isGuestMode && onGetGuestLink && (
                        <button
                            onClick={handleLinkClick}
                            disabled={isCreatingLink}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg transition-all"
                            title="Copy Guest Link for this class"
                        >
                            {isCreatingLink ? (
                                <Loader2 size={16} className="animate-spin text-blue-500" />
                            ) : (
                                <BookOpen size={16} className="text-blue-500" />
                            )}
                            Link
                        </button>
                    )}

                    {/* Admin Message Button */}
                    <button
                        onClick={() => setShowAdminMessageModal(true)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg transition-all"
                    >
                        <MessageSquare size={16} className="text-blue-500" />
                        Message
                    </button>

                    {/* Rearrange Mode Toggle */}
                    <button
                        onClick={() => setIsRearranging(!isRearranging)}
                        className={`
                            flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all
                            ${isRearranging
                                ? 'bg-orange-100 text-orange-700 border border-orange-200'
                                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                            }
                        `}
                    >
                        {isRearranging ? 'Done Rearranging' : 'Edit Order'}
                    </button>

                    <div className="h-8 w-px bg-gray-200 mx-1 hidden sm:block" />

                    <button
                        onClick={handleSelectAll}
                        className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        {areAllLocalSelected ? 'Deselect All' : 'Select All'}
                    </button>

                    {localSelectionCount > 0 && (
                        <button
                            onClick={() => onAwardCoins(selectedIds)}
                            className="px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg shadow-lg hover:bg-blue-700 hover:scale-105 transition-all animate-in fade-in zoom-in"
                        >
                            Give Feedback ({localSelectionCount})
                        </button>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={localUsers.map(u => u.id)}
                        strategy={rectSortingStrategy}
                    >
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                            {localUsers.map((user, index) => (
                                <SortableUserItem
                                    key={user.id}
                                    user={user}
                                    avatarCatalog={avatarCatalog}
                                    index={index}
                                    total={localUsers.length}
                                    isRearranging={isRearranging}
                                    isSelected={selectedIds.includes(user.id)}
                                    onToggle={toggleUser}
                                    onClick={() => onStudentClick(user)}
                                    onHomeworkClick={onHomeworkClick ? () => onHomeworkClick(user) : undefined}
                                    onToiletBreakClick={onToiletBreakClick ? () => onToiletBreakClick(user) : undefined}
                                    onMove={handleMove}
                                    isGuestMode={isGuestMode}
                                    consequenceCount={consequenceCounts[user.id] || 0}
                                    showEmail={showEmail}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            <AdminMessageModal
                isOpen={showAdminMessageModal}
                onClose={() => setShowAdminMessageModal(false)}
                onSend={handleAdminMessageSend}
                students={localUsers.map(u => ({ id: u.id, display_name: u.display_name || 'Unknown' }))}
            />
        </div>
    );
}
