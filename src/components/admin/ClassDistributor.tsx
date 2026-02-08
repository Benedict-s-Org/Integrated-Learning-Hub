import React, { useState, useEffect } from 'react';
import { User, GripVertical, Save, Loader2 } from 'lucide-react';
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
    seat_number: number | null;
    email: string;
    created_at: string;
    is_admin: boolean;
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
    onToggle: (e: React.MouseEvent, id: string) => void;
    onClick: () => void;
}

function SortableUserItem({ user, isSelected, index, onToggle, onClick }: SortableUserItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: user.id });

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
            onClick={onClick}
            className={`
                relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 flex flex-col items-center gap-3 group
                ${isSelected
                    ? 'border-blue-500 bg-blue-50 shadow-md transform scale-[1.02]'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-lg hover:-translate-y-1'
                }
            `}
        >
            {/* Drag Handle */}
            <div
                {...attributes}
                {...listeners}
                className="absolute top-2 left-2 p-1 text-gray-400 hover:text-blue-500 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
                title="Drag to reorder"
            >
                <GripVertical size={16} />
            </div>

            {/* Seat Number Tag */}
            <div className="absolute top-2 left-2 w-6 h-6 rounded-md bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center shadow-sm opacity-100 group-hover:opacity-0 transition-opacity">
                {index + 1}
            </div>

            {/* Selection Checkbox (Top Right) */}
            <div
                onClick={(e) => onToggle(e, user.id)}
                className={`
                    absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs shadow-sm transition-colors z-10
                    ${isSelected ? 'bg-blue-500' : 'bg-gray-200 hover:bg-gray-300'}
                `}
            >
                {isSelected && '✓'}
            </div>

            {/* Avatar */}
            <div className="w-20 h-20 rounded-2xl bg-gray-100 overflow-hidden shadow-inner mt-2">
                {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.display_name || ''} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <User size={40} />
                    </div>
                )}
            </div>

            {/* Name */}
            <span className="font-bold text-gray-700 text-center truncate w-full px-2">
                {user.display_name || 'Unnamed Student'}
            </span>

            {/* Coin Bubble */}
            <div className="px-3 py-1 bg-green-100 text-green-700 font-bold rounded-full text-sm flex items-center gap-1 border border-green-200">
                <span className="text-lg">🪙</span>
                {user.coins}
            </div>
        </div>
    );
}

export function ClassDistributor({ users: initialUsers, isLoading, onAwardCoins, onStudentClick, onReorder }: ClassDistributorProps) {
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
    const [localUsers, setLocalUsers] = useState<UserWithCoins[]>(initialUsers);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

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
        } catch (error) {
            console.error('Failed to save order:', error);
            alert('Failed to save seat numbers');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Classroom</h2>
                    <p className="text-gray-500">Drag items to rearrange seat numbers. Click to view profile.</p>
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
                                    isSelected={selectedUserIds.has(user.id)}
                                    onToggle={toggleUser}
                                    onClick={() => onStudentClick(user)}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}
        </div>
    );
}
