import React, { useState, useEffect } from 'react';
import { FileText, Eye, Users, Trash2, AlertCircle, Pencil, Check, X } from 'lucide-react';
import { ProofreadingPractice } from '../../types';
import ProofreadingTopNav from '../ProofreadingTopNav/ProofreadingTopNav';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useAppContext } from '../../context/AppContext';

interface SavedProofreadingPracticesProps {
  practices: ProofreadingPractice[];
  onCreateNew: () => void;
  onSelectPractice: (practice: ProofreadingPractice) => void;
  onAssignPractice: (practice: ProofreadingPractice) => void;
  onDeletePractice: (id: string) => void;
}

interface AssignmentStats {
  [practiceId: string]: {
    totalAssigned: number;
    totalCompleted: number;
    completionRate: number;
  };
}

const SavedProofreadingPractices: React.FC<SavedProofreadingPracticesProps> = ({
  practices,
  onCreateNew,
  onSelectPractice,
  onAssignPractice,
  onDeletePractice,
}) => {
  const { user } = useAuth();
  const { updateProofreadingPractice } = useAppContext();
  const [assignmentStats, setAssignmentStats] = useState<AssignmentStats>({});
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchAssignmentStats();
  }, [practices]);

  const fetchAssignmentStats = async () => {
    if (practices.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const stats: AssignmentStats = {};

      for (const practice of practices) {
        const { data, error } = await (supabase.rpc as any)('get_proofreading_assignment_stats', {
          target_practice_id: practice.id,
        });

        if (!error && data && data.length > 0) {
          stats[practice.id] = {
            totalAssigned: parseInt(data[0].total_assigned),
            totalCompleted: parseInt(data[0].total_completed),
            completionRate: parseFloat(data[0].completion_rate),
          };
        } else {
          stats[practice.id] = {
            totalAssigned: 0,
            totalCompleted: 0,
            completionRate: 0,
          };
        }
      }

      setAssignmentStats(stats);
    } catch (error) {
      console.error('Error fetching assignment stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (practice: ProofreadingPractice, e: React.MouseEvent) => {
    e.stopPropagation();

    const stats = assignmentStats[practice.id];
    if (stats && stats.totalAssigned > 0) {
      if (!confirm(`This practice is assigned to ${stats.totalAssigned} student(s). Deleting it will remove all assignments. Are you sure?`)) {
        return;
      }
    } else {
      if (!confirm(`Delete "${practice.title}"? This cannot be undone.`)) {
        return;
      }
    }

    onDeletePractice(practice.id);
  };

  const startEdit = (practice: ProofreadingPractice, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(practice.id);
    setEditTitle(practice.title);
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditTitle("");
  };

  const handleUpdateTitle = async (practiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editTitle.trim()) {
      alert("Please enter a title");
      return;
    }

    setIsUpdating(true);
    const success = await updateProofreadingPractice(practiceId, editTitle.trim());
    setIsUpdating(false);

    if (success) {
      setEditingId(null);
      setEditTitle("");
    } else {
      alert("Failed to update title. Please try again.");
    }
  };

  return (
    <>
      <ProofreadingTopNav
        onCreateNew={onCreateNew}
        onViewSaved={() => { }}
        currentView="saved"
      />
      <div
        className="pt-20 min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-8"
      >
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Saved Proofreading Practices</h1>
            <p className="text-gray-600">Manage and assign your saved practices to students</p>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
              <p className="text-gray-600">Loading practices...</p>
            </div>
          ) : practices.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
              <AlertCircle size={64} className="mx-auto text-gray-400 mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">No Saved Practices</h2>
              <p className="text-gray-600 mb-6">
                Create your first proofreading practice to get started.
              </p>
              <button
                onClick={onCreateNew}
                className="px-8 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                Create New Practice
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {practices.map((practice) => {
                const stats = assignmentStats[practice.id] || {
                  totalAssigned: 0,
                  totalCompleted: 0,
                  completionRate: 0,
                };

                const isEditing = editingId === practice.id;

                return (
                  <div
                    key={practice.id}
                    className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4 gap-2">
                        <div className="flex-1">
                          {isEditing ? (
                            <div className="flex items-center gap-2 mb-2" onClick={e => e.stopPropagation()}>
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="flex-1 px-2 py-1 text-lg font-bold border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Enter title"
                                autoFocus
                                disabled={isUpdating}
                              />
                              <button
                                onClick={(e) => handleUpdateTitle(practice.id, e)}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                                disabled={isUpdating}
                                title="Save changes"
                              >
                                <Check size={20} />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors"
                                disabled={isUpdating}
                                title="Cancel"
                              >
                                <X size={20} />
                              </button>
                            </div>
                          ) : (
                            <div className="group relative">
                              <h3 className="text-xl font-bold text-gray-800 mb-2 line-clamp-2 pr-8">
                                {practice.title}
                              </h3>
                              <button
                                onClick={(e) => startEdit(practice, e)}
                                className="absolute top-0 right-0 p-1.5 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all rounded hover:bg-blue-50"
                                title="Edit title"
                              >
                                <Pencil size={16} />
                              </button>
                            </div>
                          )}
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <div className="flex items-center space-x-1">
                              <FileText size={16} />
                              <span>{practice.sentences.length} sentences</span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDelete(practice, e)}
                          className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
                          title="Delete practice"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>

                      {stats.totalAssigned > 0 && (
                        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-700 font-medium">Assigned to:</span>
                            <span className="text-blue-700 font-bold">
                              {stats.totalAssigned} student{stats.totalAssigned !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm mt-1">
                            <span className="text-gray-700 font-medium">Completed:</span>
                            <span className="text-green-700 font-bold">
                              {stats.totalCompleted} ({stats.completionRate.toFixed(0)}%)
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-gray-500 mb-4">
                        Created {new Date(practice.created_at).toLocaleDateString()}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => onSelectPractice(practice)}
                          className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          <Eye size={16} />
                          <span>Preview</span>
                        </button>
                        <button
                          onClick={() => onAssignPractice(practice)}
                          className="flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                        >
                          <Users size={16} />
                          <span>Assign</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SavedProofreadingPractices;
