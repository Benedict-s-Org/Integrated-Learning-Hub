import React, { useState, useEffect } from 'react';
import { Lightbulb, RefreshCw, AlertCircle, BookOpen } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { LearningActivity } from '../../types';
import InteractiveExperience from './InteractiveExperience';

const LearningHub: React.FC = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<LearningActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<LearningActivity | null>(null);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    setLoading(true);
    setError(null);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pica-notion/list-activities`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch activities');
      }

      setActivities(data.activities || []);
    } catch (err) {
      console.error('Error fetching activities:', err);
      setError(err instanceof Error ? err.message : 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (difficulty: string): string => {
    const level = difficulty.toLowerCase();
    if (level.includes('easy') || level.includes('beginner')) {
      return 'bg-green-100 text-green-800 border-green-200';
    } else if (level.includes('hard') || level.includes('advanced') || level.includes('difficult')) {
      return 'bg-red-100 text-red-800 border-red-200';
    } else {
      return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  const handleActivityClick = (activity: LearningActivity) => {
    setSelectedActivity(activity);
  };

  const handleCloseModal = () => {
    setSelectedActivity(null);
  };

  if (!user) {
    return null;
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 p-8"
      style={{ fontFamily: 'Times New Roman, serif' }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <Lightbulb size={32} className="text-amber-500" />
                <h1 className="text-3xl font-bold text-gray-800">Integrated Learning Hub</h1>
              </div>
              <p className="text-gray-600">
                Explore interactive learning activities and expand your knowledge
              </p>
            </div>
            <button
              onClick={fetchActivities}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium transition-colors"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg flex items-center space-x-3">
              <AlertCircle size={24} className="text-red-600 flex-shrink-0" />
              <div>
                <p className="text-red-700 font-medium">Error loading activities</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center">
              <RefreshCw size={48} className="mx-auto text-blue-500 animate-spin mb-4" />
              <p className="text-gray-600 text-lg">Loading activities...</p>
            </div>
          ) : activities.length === 0 ? (
            <div className="py-16 text-center">
              <BookOpen size={64} className="mx-auto text-gray-400 mb-4" />
              <p className="text-xl text-gray-600 mb-2">No activities available</p>
              <p className="text-gray-500">Check back later for new learning content</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  onClick={() => handleActivityClick(activity)}
                  className="group cursor-pointer bg-white border-2 border-gray-200 rounded-xl overflow-hidden hover:border-blue-400 hover:shadow-lg transition-all duration-300"
                >
                  <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
                    {activity.thumbnail ? (
                      <img
                        src={activity.thumbnail}
                        alt={activity.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.parentElement!.innerHTML = `
                            <div class="w-full h-full flex items-center justify-center">
                              <svg class="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                              </svg>
                            </div>
                          `;
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen size={64} className="text-gray-400" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-300" />
                  </div>

                  <div className="p-5">
                    <h3 className="text-lg font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                      {activity.name}
                    </h3>

                    <div className="flex items-center justify-between">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium border ${getDifficultyColor(
                          activity.difficulty
                        )}`}
                      >
                        {activity.difficulty}
                      </span>

                      {activity.questionsJson && activity.questionsJson.length > 0 && (
                        <span className="text-sm text-gray-500">
                          {activity.questionsJson.length} question{activity.questionsJson.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedActivity && (
        <InteractiveExperience
          activity={selectedActivity}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default LearningHub;
