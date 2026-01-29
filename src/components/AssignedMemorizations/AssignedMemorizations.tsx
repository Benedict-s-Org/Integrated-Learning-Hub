import React, { useState, useEffect } from 'react';
import { Play, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { AssignedMemorizationContent, MemorizationState } from '../../types';
import { processText } from '../../utils/textProcessor';

interface AssignedMemorizationsProps {
  onLoadContent: (content: MemorizationState) => void;
}

const AssignedMemorizations: React.FC<AssignedMemorizationsProps> = ({ onLoadContent }) => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<AssignedMemorizationContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadAssignments();
    }
  }, [user]);

  const loadAssignments = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase.rpc('get_user_assigned_memorizations', {
        target_user_id: user.id,
      });

      if (fetchError) throw fetchError;

      const formattedAssignments = (data || []).map((a: any) => ({
        id: a.id,
        content_id: a.content_id,
        title: a.title,
        original_text: a.original_text,
        selected_word_indices: Array.isArray(a.selected_word_indices)
          ? a.selected_word_indices
          : JSON.parse(a.selected_word_indices || '[]'),
        assigned_at: a.assigned_at,
        due_date: a.due_date,
        completed: a.completed,
        completed_at: a.completed_at,
        assigned_by_username: a.assigned_by_username,
      }));

      setAssignments(formattedAssignments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  const handlePractice = async (assignment: AssignedMemorizationContent) => {
    const words = processText(assignment.original_text);
    const wordsWithSelection = words.map((word) => ({
      ...word,
      isMemorized: assignment.selected_word_indices.includes(word.index),
    }));

    const memorizationState: MemorizationState = {
      originalText: assignment.original_text,
      words: wordsWithSelection,
      selectedWordIndices: assignment.selected_word_indices,
      hiddenWords: new Set(assignment.selected_word_indices),
    };

    if (!assignment.completed) {
      try {
        await supabase
          .from('memorization_assignments')
          .update({
            completed: true,
            completed_at: new Date().toISOString(),
          })
          .eq('id', assignment.id);

        await loadAssignments();
      } catch (error) {
        console.error('Failed to mark assignment as complete:', error);
      }
    }

    onLoadContent(memorizationState);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isOverdue = (dueDateString?: string) => {
    if (!dueDateString) return false;
    return new Date(dueDateString) < new Date();
  };

  const getDaysUntilDue = (dueDateString?: string) => {
    if (!dueDateString) return null;
    const dueDate = new Date(dueDateString);
    const today = new Date();
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="pt-20 min-h-screen bg-gray-50 pr-8" style={{ fontFamily: 'Times New Roman, serif' }}>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center text-gray-600">Loading assignments...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-20 min-h-screen bg-gray-50 pr-8" style={{ fontFamily: 'Times New Roman, serif' }}>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
        </div>
      </div>
    );
  }

  const pendingAssignments = assignments.filter((a) => !a.completed);
  const completedAssignments = assignments.filter((a) => a.completed);

  return (
    <div className="pt-20 min-h-screen bg-gray-50 pr-8" style={{ fontFamily: 'Times New Roman, serif' }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">My Assignments</h1>

          {assignments.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <p className="text-xl">No assignments yet.</p>
              <p className="text-lg mt-2">Your teacher will assign memorization exercises here.</p>
            </div>
          ) : (
            <>
              {pendingAssignments.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">
                    Pending ({pendingAssignments.length})
                  </h2>
                  <div className="space-y-4">
                    {pendingAssignments.map((assignment) => {
                      const daysUntilDue = getDaysUntilDue(assignment.due_date);
                      const overdue = isOverdue(assignment.due_date);

                      return (
                        <div
                          key={assignment.id}
                          className={`border rounded-lg p-6 hover:shadow-md transition-shadow ${
                            overdue ? 'border-red-300 bg-red-50' : 'border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg font-semibold text-gray-800 mb-2">{assignment.title}</h3>
                              <p className="text-gray-600 text-sm mb-3 line-clamp-2">{assignment.original_text}</p>
                              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                                <span className="flex items-center space-x-1">
                                  <Clock size={14} />
                                  <span>Assigned {formatDate(assignment.assigned_at)}</span>
                                </span>
                                {assignment.due_date && (
                                  <span
                                    className={`flex items-center space-x-1 ${
                                      overdue ? 'text-red-600 font-semibold' : daysUntilDue && daysUntilDue <= 3 ? 'text-orange-600 font-semibold' : ''
                                    }`}
                                  >
                                    {overdue ? <AlertCircle size={14} /> : <Clock size={14} />}
                                    <span>
                                      {overdue
                                        ? 'Overdue'
                                        : daysUntilDue === 0
                                        ? 'Due today'
                                        : daysUntilDue === 1
                                        ? 'Due tomorrow'
                                        : `Due ${formatDate(assignment.due_date)}`}
                                    </span>
                                  </span>
                                )}
                                <span>By {assignment.assigned_by_username}</span>
                                <span>{assignment.selected_word_indices.length} words</span>
                              </div>
                            </div>
                            <button
                              onClick={() => handlePractice(assignment)}
                              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ml-4"
                            >
                              <Play size={18} />
                              <span>Start</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {completedAssignments.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">
                    Completed ({completedAssignments.length})
                  </h2>
                  <div className="space-y-4">
                    {completedAssignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="border border-gray-200 rounded-lg p-6 bg-green-50 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-2">
                              <CheckCircle size={20} className="text-green-600" />
                              <h3 className="text-lg font-semibold text-gray-800">{assignment.title}</h3>
                            </div>
                            <p className="text-gray-600 text-sm mb-3 line-clamp-2">{assignment.original_text}</p>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                              <span>Completed {formatDate(assignment.completed_at!)}</span>
                              <span>By {assignment.assigned_by_username}</span>
                              <span>{assignment.selected_word_indices.length} words</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handlePractice(assignment)}
                            className="flex items-center space-x-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors ml-4"
                          >
                            <Play size={18} />
                            <span>Practice Again</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignedMemorizations;
