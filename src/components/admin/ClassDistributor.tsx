import React, { useState, useEffect } from 'react';
import { User, GripVertical, Save, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
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

interface UserWithCoins {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    coins: number;
    virtual_coins?: number;
    daily_real_earned?: number; // Add this
    seat_number: number | null;
    email: string;
    created_at: string;
    is_admin: boolean;
    class_name?: string | null;
}

interface ClassDistributorProps {
    users: UserWithCoins[];
    isLoading: boolean;
    onAwardCoins: (userIds: string[]) => Promise<void>;
    onStudentClick: (student: UserWithCoins) => void;
    onReorder: (newOrder: UserWithCoins[]) => Promise<void>;
}

interface SortableUserItemProps {
    user: UserWithCoins;
    isSelected: boolean;
    index: number;
    total: number;
    isRearranging: boolean;
    onToggle: (e: React.MouseEvent, id: string) => void;
    onClick: () => void;
    onMove: (index: number, direction: 'forward' | 'backward') => void;
}

function SortableUserItem({ user, isSelected, index, total, isRearranging, onToggle, onClick, onMove }: SortableUserItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: user.id, disabled: !isRearranging });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`
                relative p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-3 group bg-white
                ${isSelected
                    ? 'border-blue-500 bg-blue-50 shadow-md transform scale-[1.02]'
                    : 'border-gray-200 hover:border-blue-300 hover:shadow-lg'
                }
            `}
        >
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
            <div className="relative z-10 w-full flex flex-col items-center pointer-events-none">

                {/* Header Controls */}
                <div className="w-full flex justify-between items-start pointer-events-auto">
                    {/* Class Number Tag */}
                    <div className={`w-6 h-6 rounded-md text-white text-[10px] font-bold flex items-center justify-center shadow-sm transition-colors ${isRearranging ? 'bg-orange-500' : 'bg-slate-800'}`}>
                        {index + 1}
                    </div>

                    {/* Selection Checkbox */}
                    <div
                        onClick={(e) => onToggle(e, user.id)}
                        className={`
                            w-6 h-6 rounded-full flex items-center justify-center text-white text-xs shadow-sm transition-colors cursor-pointer
                            ${isSelected ? 'bg-blue-500' : 'bg-gray-200 hover:bg-gray-300'}
                        `}
                    >
                        {isSelected && '✓'}
                    </div>
                </div>

                {/* Avatar with Click Handler */}
                <div
                    onClick={onClick}
                    className="w-20 h-20 rounded-2xl bg-gray-100 overflow-hidden shadow-inner mt-2 cursor-pointer hover:opacity-90 transition-opacity pointer-events-auto"
                >
                    {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.display_name || ''} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <User size={40} />
                        </div>
                    )}
                </div>

                {/* Name */}
                <span className="font-bold text-gray-700 text-center truncate w-full px-2 mt-2">
                    {user.display_name || 'Unnamed Student'}
                </span>

                {/* Coin Bubble */}
                <div className="mt-1 px-3 py-1 bg-green-100 text-green-700 font-bold rounded-full text-[10px] flex items-center gap-1 border border-green-200">
                    <span className="text-xs">🪙</span>
                    <span>{user.coins - (user.daily_real_earned || 0)}+{user.daily_real_earned || 0}</span>
                    <span className="opacity-75 whitespace-nowrap">({user.virtual_coins || 0})</span>
                </div>

                {/* Navigation Buttons - Only Visible when Rearranging */}
                {isRearranging && (
                    <div className="flex gap-2 mt-3 w-full justify-center pointer-events-auto animate-in fade-in zoom-in duration-200">
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

export function ClassDistributor({ users: initialUsers, isLoading, onAwardCoins, onStudentClick, onReorder }: ClassDistributorProps) {
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
    const [localUsers, setLocalUsers] = useState<UserWithCoins[]>(initialUsers);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [isRearranging, setIsRearranging] = useState(false);

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
        const newSelected = new Set(selectedUserIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedUserIds(newSelected);
    };

    const handleSelectAll = () => {
        if (selectedUserIds.size === localUsers.length) {
            setSelectedUserIds(new Set());
        } else {
            setSelectedUserIds(new Set(localUsers.map(u => u.id)));
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

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Classroom</h2>
                    <p className="text-gray-500">Drag items or use arrow buttons to rearrange class numbers.</p>
                </div>
                <div className="flex gap-2">
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
                    {/* Rearrange Mode Toggle - Placed to the left of Select All */}
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
                    <button
                        onClick={handleSelectAll}
                        className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        {selectedUserIds.size === localUsers.length ? 'Deselect All' : 'Select All'}
                    </button>
                    {selectedUserIds.size > 0 && (
                        <button
                            onClick={() => onAwardCoins(Array.from(selectedUserIds))}
                            className="px-6 py-2 text-sm font-bold text-white bg-blue-500 rounded-lg shadow-lg hover:bg-blue-600 hover:scale-105 transition-all animate-in fade-in zoom-in"
                        >
                            Give Feedback ({selectedUserIds.size})
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
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {localUsers.map((user, index) => (
                                <SortableUserItem
                                    key={user.id}
                                    user={user}
                                    index={index}
                                    total={localUsers.length}
                                    isRearranging={isRearranging}
                                    isSelected={selectedUserIds.has(user.id)}
                                    onToggle={toggleUser}
                                    onClick={() => onStudentClick(user)}
                                    onMove={handleMove}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}
        </div>
    );
}
