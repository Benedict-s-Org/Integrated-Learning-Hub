import React, { useState, useEffect } from 'react';
import { X, Search, User, Check, Users, Calendar } from 'lucide-react';
import { useSpacedRepetition } from '../../context/SpacedRepetitionContext';

interface SetAssignmentModalProps {
    setId: string;
    setTitle: string;
    onClose: () => void;
}

export const SetAssignmentModal: React.FC<SetAssignmentModalProps> = ({
    setId,
    setTitle,
    onClose
}) => {
    const { assignSet, fetchAllStudents } = useSpacedRepetition();
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
    const [dueDate, setDueDate] = useState('');
    const [isAssigning, setIsAssigning] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        loadStudents();
    }, []);

    const loadStudents = async () => {
        setLoading(true);
        const data = await fetchAllStudents();
        setStudents(data);
        setLoading(false);
    };

    const toggleStudent = (studentId: string) => {
        const newSelected = new Set(selectedStudents);
        if (newSelected.has(studentId)) {
            newSelected.delete(studentId);
        } else {
            newSelected.add(studentId);
        }
        setSelectedStudents(newSelected);
    };

    const selectAllFiltered = () => {
        const newSelected = new Set(selectedStudents);
        filteredStudents.forEach(s => newSelected.add(s.id));
        setSelectedStudents(newSelected);
    };

    const deselectAllFiltered = () => {
        const newSelected = new Set(selectedStudents);
        filteredStudents.forEach(s => newSelected.delete(s.id));
        setSelectedStudents(newSelected);
    };

    const handleAssign = async () => {
        if (selectedStudents.size === 0) return;
        setIsAssigning(true);
        const success = await assignSet(setId, Array.from(selectedStudents), dueDate);
        setIsAssigning(false);
        if (success) {
            setSuccess(true);
            setTimeout(() => {
                onClose();
            }, 1500);
        } else {
            alert('Failed to assign set. Please try again.');
        }
    };

    const filteredStudents = students.filter(s =>
        (s.display_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.class || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Assign Set</h2>
                        <p className="text-sm text-gray-500 mt-1">Assigning: <span className="text-blue-600 font-medium">{setTitle}</span></p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {success ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 animate-bounce">
                            <Check className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">Success!</h3>
                        <p className="text-gray-600">The set has been assigned to {selectedStudents.size} student{selectedStudents.size !== 1 ? 's' : ''}.</p>
                    </div>
                ) : (
                    <>
                        {/* Search and Selection Controls */}
                        <div className="p-6 pb-2 space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search students by name, username, or class..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex gap-2">
                                    <button
                                        onClick={selectAllFiltered}
                                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded"
                                    >
                                        Select All Results
                                    </button>
                                    <button
                                        onClick={deselectAllFiltered}
                                        className="text-xs font-semibold text-gray-600 hover:text-gray-700 bg-gray-50 px-2 py-1 rounded"
                                    >
                                        Deselect All Results
                                    </button>
                                </div>
                                <div className="text-xs font-medium text-gray-500">
                                    {selectedStudents.size} students selected
                                </div>
                            </div>
                        </div>

                        {/* Student List */}
                        <div className="flex-1 overflow-y-auto p-6 pt-2">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
                                    <p>Loading students...</p>
                                </div>
                            ) : filteredStudents.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>No students found matching your search.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {filteredStudents.map(student => (
                                        <button
                                            key={student.id}
                                            onClick={() => toggleStudent(student.id)}
                                            className={`flex items-center p-3 rounded-xl border transition-all text-left group ${selectedStudents.has(student.id)
                                                    ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500/10'
                                                    : 'bg-white border-gray-100 hover:border-blue-200'
                                                }`}
                                        >
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 transition-colors ${selectedStudents.has(student.id) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'
                                                }`}>
                                                {selectedStudents.has(student.id) ? (
                                                    <Check className="w-5 h-5" />
                                                ) : (
                                                    <User className="w-5 h-5" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-gray-900 truncate">{student.display_name || student.username}</p>
                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                    <span className="truncate">@{student.username}</span>
                                                    {student.class && (
                                                        <>
                                                            <span className="w-1 h-1 rounded-full bg-gray-300" />
                                                            <span className="text-blue-600 font-medium">{student.class}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-gray-100 flex flex-col gap-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Calendar className="w-5 h-5 text-gray-400" />
                                    <span>Optional Due Date:</span>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="px-3 py-1 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={onClose}
                                        className="px-6 py-2 border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleAssign}
                                        disabled={selectedStudents.size === 0 || isAssigning}
                                        className={`px-8 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none flex items-center gap-2`}
                                    >
                                        {isAssigning ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                Assigning...
                                            </>
                                        ) : (
                                            <>
                                                <Users className="w-5 h-5" />
                                                Assign to {selectedStudents.size} Students
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
