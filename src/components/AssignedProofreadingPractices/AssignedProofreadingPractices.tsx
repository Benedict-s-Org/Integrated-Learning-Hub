import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, FileText, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { AssignedProofreadingPracticeContent } from '../../types';

interface AssignedProofreadingPracticesProps {
  onLoadContent: (assignment: AssignedProofreadingPracticeContent) => void;
}

const AssignedProofreadingPractices: React.FC<AssignedProofreadingPracticesProps> = ({ onLoadContent }) => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<AssignedProofreadingPracticeContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchAssignments();
    }
  }, [user]);

  const fetchAssignments = async () => {
    if (!user?.id) return;

    try {
      setError(null);
      const { data, error: fetchError } = await supabase.rpc('get_user_assigned_proofreading_practices', {
        target_user_id: user.id,
      });

      if (fetchError) throw fetchError;

      const formattedAssignments: AssignedProofreadingPracticeContent[] = (data || []).map((item: any) => ({
        id: item.id,
        practice_id: item.practice_id,
        title: item.title,
        sentences: item.sentences,
        answers: item.answers,
        assigned_at: item.assigned_at,
        due_date: item.due_date,
        completed: item.completed,
        completed_at: item.completed_at,
        assigned_by_username: item.assigned_by_username,
        result_id: item.result_id,
        accuracy_percentage: item.accuracy_percentage,
      }));

      setAssignments(formattedAssignments);
    } catch (err) {
      console.error('Error fetching assigned practices:', err);
      setError('Failed to load assigned practices');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <p className="text-gray-600">Loading assignments...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <AlertCircle size={64} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchAssignments}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-8"
      style={{ fontFamily: 'Times New Roman, serif' }}
      data-source-tsx="AssignedProofreadingPractices|src/components/AssignedProofreadingPractices/AssignedProofreadingPractices.tsx"
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">My Proofreading Assignments</h1>
          <p className="text-gray-600">Complete assigned practices and track your progress</p>
        </div>

        {assignments.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <AlertCircle size={64} className="mx-auto text-gray-400 mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">No Assignments Yet</h2>
            <p className="text-gray-600">
              Your teacher hasn't assigned any proofreading practices yet. Check back later!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {assignments.map((assignment) => {
              const isOverdue =
                assignment.due_date &&
                !assignment.completed &&
                new Date(assignment.due_date) < new Date();

              return (
                <div
                  key={assignment.id}
                  className={`bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden ${
                    assignment.completed ? 'border-2 border-green-200' : isOverdue ? 'border-2 border-red-200' : ''
                  }`}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-2xl font-bold text-gray-800">{assignment.title}</h3>
                          {assignment.completed && (
                            <span className="flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                              <CheckCircle size={16} />
                              <span>Completed</span>
                            </span>
                          )}
                          {isOverdue && (
                            <span className="flex items-center space-x-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                              <Clock size={16} />
                              <span>Overdue</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-6 text-sm text-gray-600 mb-3">
                          <div className="flex items-center space-x-1">
                            <FileText size={16} />
                            <span>{assignment.sentences.length} sentences</span>
                          </div>
                          <div>
                            <span className="font-medium">Assigned by:</span> {assignment.assigned_by_username}
                          </div>
                          <div>
                            <span className="font-medium">Assigned:</span>{' '}
                            {new Date(assignment.assigned_at).toLocaleDateString()}
                          </div>
                          {assignment.due_date && (
                            <div>
                              <span className="font-medium">Due:</span>{' '}
                              {new Date(assignment.due_date).toLocaleDateString()}
                            </div>
                          )}
                        </div>

                        {assignment.completed && assignment.accuracy_percentage !== undefined && (
                          <div className="mb-3">
                            <div className="flex items-center space-x-4">
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium text-gray-700">Score</span>
                                  <span className="text-sm font-bold text-blue-700">
                                    {assignment.accuracy_percentage.toFixed(0)}%
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${
                                      assignment.accuracy_percentage >= 80
                                        ? 'bg-green-500'
                                        : assignment.accuracy_percentage >= 60
                                        ? 'bg-yellow-500'
                                        : 'bg-red-500'
                                    }`}
                                    style={{ width: `${assignment.accuracy_percentage}%` }}
                                  />
                                </div>
                              </div>
                              {assignment.completed_at && (
                                <div className="text-sm text-gray-600">
                                  Completed: {new Date(assignment.completed_at).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex space-x-3">
                      <button
                        onClick={() => onLoadContent(assignment)}
                        className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
                          assignment.completed
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                      >
                        {assignment.completed ? 'Review Practice' : 'Start Practice'}
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
  );
};

export default AssignedProofreadingPractices;
