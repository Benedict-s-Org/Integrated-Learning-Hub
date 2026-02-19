import { useState, useEffect } from 'react';
import { Plus, BookOpen, BarChart3, Flame, Zap, Play, Trash2 } from 'lucide-react';
import { SpacedRepetitionSet, UserStreak } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface SpacedRepetitionHubProps {
  onCreateNew: () => void;
  onStartLearning: (setId: string) => void;
  onViewAnalytics: () => void;
  onViewSettings: () => void;
}

export function SpacedRepetitionHub({
  onCreateNew,
  onStartLearning,
  onViewAnalytics,
  onViewSettings,
}: SpacedRepetitionHubProps) {
  const { user } = useAuth();
  const [sets, setSets] = useState<SpacedRepetitionSet[]>([]);
  const [streak, setStreak] = useState<UserStreak | null>(null);
  const [cardsDue, setCardsDue] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  const fetchData = async () => {
    if (!user?.id) return;

    try {
      const [setsRes, streakRes, cardsRes] = await Promise.all([
        supabase
          .from('spaced_repetition_sets')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('user_streaks')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase.rpc('get_cards_due_today', { p_user_id: user.id }),
      ]);

      setSets(setsRes.data || []);
      setStreak(streakRes.data);
      setCardsDue(cardsRes.data || 0);
    } catch (error) {
      console.error('Failed to fetch spaced repetition data:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteSet = async (setId: string) => {
    try {
      await supabase.from('spaced_repetition_sets').delete().eq('id', setId);
      setSets(sets.filter(s => s.id !== setId));
    } catch (error) {
      console.error('Failed to delete set:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-blue-50 to-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-2">Spaced Repetition Learning</h1>
          <p className="text-sm md:text-base text-gray-600">Master material using scientifically-proven spacing intervals</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Cards Due Today</p>
                <p className="text-3xl font-bold text-blue-600">{cardsDue}</p>
              </div>
              <Play className="w-8 h-8 text-blue-600 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Current Streak</p>
                <p className="text-3xl font-bold text-orange-600">
                  {streak?.current_streak_days || 0} 🔥
                </p>
              </div>
              <Flame className="w-8 h-8 text-orange-600 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Cards Mastered</p>
                <p className="text-3xl font-bold text-green-600">
                  {streak?.total_cards_mastered || 0}
                </p>
              </div>
              <Zap className="w-8 h-8 text-green-600 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Question Sets</p>
                <p className="text-3xl font-bold text-purple-600">{sets.length}</p>
              </div>
              <BookOpen className="w-8 h-8 text-purple-600 opacity-20" />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <button
            onClick={onCreateNew}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors w-full sm:w-auto"
          >
            <Plus className="w-5 h-5" />
            Create New Set
          </button>

          <button
            onClick={onViewAnalytics}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors w-full sm:w-auto"
          >
            <BarChart3 className="w-5 h-5" />
            Analytics
          </button>

          <button
            onClick={onViewSettings}
            className="flex items-center justify-center px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors w-full sm:w-auto"
          >
            Settings
          </button>
        </div>

        {cardsDue > 0 && (
          <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
            <h3 className="font-bold text-gray-900 mb-2">Time to Review!</h3>
            <p className="text-gray-700 mb-4">
              You have {cardsDue} card{cardsDue !== 1 ? 's' : ''} ready for review today.
            </p>
            <button
              onClick={() => sets.length > 0 && onStartLearning(sets[0].id)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Start Review Session
            </button>
          </div>
        )}

        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Question Sets</h2>

          {sets.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <BookOpen className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 mb-4">No question sets yet.</p>
              <button
                onClick={onCreateNew}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Create Your First Set
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sets.map((set) => (
                <div
                  key={set.id}
                  className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
                >
                  <h3 className="font-bold text-gray-900 mb-2 line-clamp-2">{set.title}</h3>
                  {set.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{set.description}</p>
                  )}

                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <span>{set.total_questions} questions</span>
                    <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                      {set.difficulty}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => onStartLearning(set.id)}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 transition-colors text-sm"
                    >
                      Practice
                    </button>
                    <button
                      onClick={() => deleteSet(set.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}