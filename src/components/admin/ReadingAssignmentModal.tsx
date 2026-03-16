import React, { useState, useEffect } from 'react';
import { X, Users, Calendar, CheckCircle, Search, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface User {
  id: string;
  display_name: string | null;
  username: string;
  role: string;
  class: string | null;
}

interface ReadingAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  practiceId: string;
  practiceTitle: string;
}

export const ReadingAssignmentModal: React.FC<ReadingAssignmentModalProps> = ({
  isOpen,
  onClose,
  practiceId,
  practiceTitle
}) => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [existingAssignmentIds, setExistingAssignmentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('all');

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, practiceId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Students
      const { data: userData, error: userError } = await supabase.functions.invoke('user-management/list-users', {
        body: { adminUserId: currentUser?.id }
      });

      if (userError) throw userError;
      
      const students = (userData.users || []).filter((u: any) => u.role !== 'admin');
      setUsers(students);

      // 2. Fetch Existing Assignments for this practice
      const { data: assignData, error: assignError } = await (supabase
        .from('reading_practice_assignments' as any) as any)
        .select('user_id')
        .eq('practice_id', practiceId);

      if (assignError) throw assignError;
      
      const existingUserIds = new Set<string>((assignData || []).map((a: any) => a.user_id as string));
      setExistingAssignmentIds(existingUserIds);
    } catch (err) {
      console.error('Error fetching data for assignment:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = (userId: string) => {
    const newSelected = new Set(selectedUserIds);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUserIds(newSelected);
  };

  const toggleSelectAll = (filteredUsers: User[]) => {
    const allFilteredAreSelected = filteredUsers.every(u => selectedUserIds.has(u.id));
    const newSelected = new Set(selectedUserIds);
    
    if (allFilteredAreSelected) {
      filteredUsers.forEach(u => newSelected.delete(u.id));
    } else {
      filteredUsers.forEach(u => newSelected.add(u.id));
    }
    setSelectedUserIds(newSelected);
  };

  const handleSave = async () => {
    if (selectedUserIds.size === 0) return;
    
    setIsSaving(true);
    try {
      const assignments = Array.from(selectedUserIds).map(userId => ({
        practice_id: practiceId,
        user_id: userId,
        assigned_by: currentUser?.id,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
      }));

      const { error } = await (supabase
        .from('reading_practice_assignments' as any) as any)
        .insert(assignments);

      if (error) throw error;

      alert(`Successfully assigned to ${selectedUserIds.size} students.`);
      onClose();
    } catch (err: any) {
      console.error('Error saving assignments:', err);
      alert(`Failed to save assignments: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = (u.display_name || u.username || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = classFilter === 'all' || u.class === classFilter;
    return matchesSearch && matchesClass;
  });

  const classes = Array.from(new Set(users.map(u => u.class).filter(Boolean))).sort();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-500" />
              Assign Practice
            </h2>
            <p className="text-slate-500 font-medium">{practiceTitle}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search students..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              value={classFilter}
              onChange={e => setClassFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
            >
              <option value="all">All Classes</option>
              {classes.map(c => <option key={c} value={c as string}>{c as string}</option>)}
            </select>
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-2 mb-4">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  {filteredUsers.length} Students Found
                </span>
                <button 
                  onClick={() => toggleSelectAll(filteredUsers)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                >
                  {filteredUsers.every(u => selectedUserIds.has(u.id)) ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {filteredUsers.map(u => {
                const isAssigned = existingAssignmentIds.has(u.id);
                const isSelected = selectedUserIds.has(u.id);
                
                return (
                  <div 
                    key={u.id}
                    onClick={() => !isAssigned && toggleUser(u.id)}
                    className={`
                      flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer
                      ${isAssigned 
                        ? 'bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed' 
                        : isSelected 
                          ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                          : 'bg-white border-slate-100 hover:border-slate-200'
                      }
                    `}
                  >
                    <div className={`
                      w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all
                      ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-200'}
                    `}>
                      {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-slate-800">{u.display_name || u.username}</div>
                      <div className="text-xs text-slate-400 font-bold uppercase">{u.class || 'No Class'}</div>
                    </div>
                    {isAssigned && (
                      <span className="text-[10px] font-black bg-green-100 text-green-700 px-2 py-1 rounded-full uppercase">
                        Already Assigned
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-400" />
              <input 
                type="date" 
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <span className="text-xs font-bold text-slate-400 uppercase">Optional Due Date</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-slate-500">
              {selectedUserIds.size} student(s) selected
            </div>
            <div className="flex gap-3">
              <button 
                onClick={onClose}
                className="px-6 py-2 rounded-xl text-slate-600 font-bold hover:bg-white hover:shadow-sm transition-all text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={selectedUserIds.size === 0 || isSaving}
                className="px-8 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none transition-all text-sm flex items-center gap-2"
              >
                {isSaving ? 'Assigning...' : 'Assign Now'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
