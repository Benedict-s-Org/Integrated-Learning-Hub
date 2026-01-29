import React, { useState, useEffect } from 'react';
import { TrendingUp, Trophy, Clock, Target, Award, BarChart3 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  ProgressSummary,
  RankingEntry,
  SpellingPracticeResult,
  ProofreadingPracticeResult,
  MemorizationSession,
} from '../../types';

type TabType = 'overview' | 'spelling' | 'proofreading' | 'memorization' | 'rankings';

const StudentProgress: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [progressSummary, setProgressSummary] = useState<ProgressSummary | null>(null);
  const [spellingResults, setSpellingResults] = useState<SpellingPracticeResult[]>([]);
  const [proofreadingResults, setProofreadingResults] = useState<ProofreadingPracticeResult[]>([]);
  const [memorizationSessions, setMemorizationSessions] = useState<MemorizationSession[]>([]);
  const [spellingRankings, setSpellingRankings] = useState<RankingEntry[]>([]);
  const [proofreadingRankings, setProofreadingRankings] = useState<RankingEntry[]>([]);
  const [userSpellingRank, setUserSpellingRank] = useState<number | null>(null);
  const [userProofreadingRank, setUserProofreadingRank] = useState<number | null>(null);

  useEffect(() => {
    if (user) {
      loadProgressData();
    }
  }, [user]);

  const loadProgressData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data: summary } = await supabase.rpc('get_user_progress_summary', {
        target_user_id: user.id,
      });

      if (summary) {
        setProgressSummary(summary);
      }

      const { data: spellingData } = await supabase
        .from('spelling_practice_results')
        .select('*')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(20);

      if (spellingData) {
        setSpellingResults(spellingData);
      }

      const { data: proofreadingData } = await supabase
        .from('proofreading_practice_results')
        .select('*')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(20);

      if (proofreadingData) {
        setProofreadingResults(proofreadingData);
      }

      const { data: memorizationData } = await supabase
        .from('memorization_practice_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(20);

      if (memorizationData) {
        setMemorizationSessions(memorizationData);
      }

      const { data: spellingRankData } = await supabase.rpc('get_spelling_rankings');
      if (spellingRankData) {
        setSpellingRankings(spellingRankData);
        const userRank = spellingRankData.find((r: RankingEntry) => r.user_id === user.id);
        setUserSpellingRank(userRank ? Number(userRank.rank) : null);
      }

      const { data: proofreadingRankData } = await supabase.rpc('get_proofreading_rankings');
      if (proofreadingRankData) {
        setProofreadingRankings(proofreadingRankData);
        const userRank = proofreadingRankData.find((r: RankingEntry) => r.user_id === user.id);
        setUserProofreadingRank(userRank ? Number(userRank.rank) : null);
      }
    } catch (error) {
      console.error('Error loading progress data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-green-50';
    if (percentage >= 70) return 'bg-yellow-50';
    return 'bg-red-50';
  };

  const renderSpellingChart = () => {
    if (spellingResults.length === 0) {
      return <div className="text-gray-500 text-center py-8">No spelling practice data yet</div>;
    }

    const recentResults = spellingResults.slice(0, 10).reverse();
    const maxScore = 100;

    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Performance</h3>
        <div className="relative h-64">
          <div className="absolute inset-0 flex items-end justify-around">
            {recentResults.map((result, index) => {
              const height = (result.accuracy_percentage / maxScore) * 100;
              return (
                <div key={result.id} className="flex flex-col items-center flex-1 mx-1">
                  <div className="relative w-full">
                    <div
                      className={`w-full rounded-t transition-all ${
                        result.accuracy_percentage >= 90
                          ? 'bg-green-500'
                          : result.accuracy_percentage >= 70
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{ height: `${height * 2}px` }}
                      title={`${result.accuracy_percentage}%`}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-2">{index + 1}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-4 text-sm text-gray-600 text-center">Last 10 Practices</div>
      </div>
    );
  };

  const renderProofreadingChart = () => {
    if (proofreadingResults.length === 0) {
      return <div className="text-gray-500 text-center py-8">No proofreading practice data yet</div>;
    }

    const recentResults = proofreadingResults.slice(0, 10).reverse();
    const maxScore = 100;

    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Performance</h3>
        <div className="relative h-64">
          <div className="absolute inset-0 flex items-end justify-around">
            {recentResults.map((result, index) => {
              const height = (result.accuracy_percentage / maxScore) * 100;
              return (
                <div key={result.id} className="flex flex-col items-center flex-1 mx-1">
                  <div className="relative w-full">
                    <div
                      className={`w-full rounded-t transition-all ${
                        result.accuracy_percentage >= 90
                          ? 'bg-green-500'
                          : result.accuracy_percentage >= 70
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{ height: `${height * 2}px` }}
                      title={`${result.accuracy_percentage}%`}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-2">{index + 1}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-4 text-sm text-gray-600 text-center">Last 10 Practices</div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="pt-20 min-h-screen bg-gray-50 pr-8" style={{ fontFamily: 'Times New Roman, serif' }}>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center text-gray-600">Loading progress data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 min-h-screen bg-gray-50 pr-8" style={{ fontFamily: 'Times New Roman, serif' }}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">My Progress</h1>
          <p className="text-gray-600">Track your learning journey and achievements</p>
        </div>

        <div className="flex space-x-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'spelling', label: 'Spelling', icon: Target },
            { id: 'proofreading', label: 'Proofreading', icon: Trophy },
            { id: 'memorization', label: 'Memorization', icon: Clock },
            { id: 'rankings', label: 'Rankings', icon: Award },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as TabType)}
              className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {activeTab === 'overview' && progressSummary && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Spelling Practice</h3>
                  <Target className="text-blue-600" size={32} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Practices:</span>
                    <span className="font-semibold">{progressSummary.spelling.total_practices}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg Accuracy:</span>
                    <span className={`font-semibold ${getScoreColor(progressSummary.spelling.average_accuracy)}`}>
                      {progressSummary.spelling.average_accuracy}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Best Score:</span>
                    <span className="font-semibold text-green-600">{progressSummary.spelling.best_score}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Time Spent:</span>
                    <span className="font-semibold">{progressSummary.spelling.total_time_minutes} min</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Proofreading</h3>
                  <Trophy className="text-yellow-600" size={32} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Practices:</span>
                    <span className="font-semibold">{progressSummary.proofreading.total_practices}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg Accuracy:</span>
                    <span className={`font-semibold ${getScoreColor(progressSummary.proofreading.average_accuracy)}`}>
                      {progressSummary.proofreading.average_accuracy}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Best Score:</span>
                    <span className="font-semibold text-green-600">{progressSummary.proofreading.best_score}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Time Spent:</span>
                    <span className="font-semibold">{progressSummary.proofreading.total_time_minutes} min</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Memorization</h3>
                  <Clock className="text-green-600" size={32} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Sessions:</span>
                    <span className="font-semibold">{progressSummary.memorization.total_sessions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Words Practiced:</span>
                    <span className="font-semibold">{progressSummary.memorization.total_words_practiced}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Time Spent:</span>
                    <span className="font-semibold">{progressSummary.memorization.total_time_minutes} min</span>
                  </div>
                </div>
              </div>
            </div>

            {userSpellingRank && (
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-6 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-3">
                  <Award className="text-blue-600" size={32} />
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">
                      Your Spelling Rank: #{userSpellingRank}
                    </h3>
                    <p className="text-gray-600">Keep practicing to climb the leaderboard!</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'spelling' && (
          <div className="space-y-6">
            {renderSpellingChart()}

            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-semibold text-gray-800">Practice History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Title</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Score</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Level</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {spellingResults.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                          No spelling practices yet. Start practicing to see your progress!
                        </td>
                      </tr>
                    ) : (
                      spellingResults.map((result) => (
                        <tr key={result.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">{formatDate(result.completed_at)}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{result.title}</td>
                          <td className="px-6 py-4">
                            <span className={`text-sm font-semibold ${getScoreColor(result.accuracy_percentage)}`}>
                              {result.correct_count}/{result.total_count} ({result.accuracy_percentage}%)
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            Level {result.practice_level}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {formatDuration(result.time_spent_seconds)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'proofreading' && (
          <div className="space-y-6">
            {renderProofreadingChart()}

            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-semibold text-gray-800">Practice History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Questions</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Score</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {proofreadingResults.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                          No proofreading practices yet. Start practicing to see your progress!
                        </td>
                      </tr>
                    ) : (
                      proofreadingResults.map((result) => (
                        <tr key={result.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">{formatDate(result.completed_at)}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{result.sentences.length} sentences</td>
                          <td className="px-6 py-4">
                            <span className={`text-sm font-semibold ${getScoreColor(result.accuracy_percentage)}`}>
                              {result.correct_count}/{result.total_count} ({result.accuracy_percentage}%)
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {formatDuration(result.time_spent_seconds)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'memorization' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-semibold text-gray-800">Session History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Title</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Words</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {memorizationSessions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                          No memorization sessions yet. Start practicing to see your progress!
                        </td>
                      </tr>
                    ) : (
                      memorizationSessions.map((session) => (
                        <tr key={session.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">{formatDate(session.completed_at)}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{session.title}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {session.hidden_words_count} of {session.total_words}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {formatDuration(session.session_duration_seconds)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rankings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-semibold text-gray-800">Spelling Leaderboard</h3>
                {userSpellingRank && (
                  <p className="text-sm text-gray-600 mt-1">Your rank: #{userSpellingRank}</p>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Rank</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Student</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Practices</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Avg Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {spellingRankings.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                          No ranking data available yet
                        </td>
                      </tr>
                    ) : (
                      spellingRankings.map((entry) => {
                        const isCurrentUser = entry.user_id === user?.id;
                        return (
                          <tr
                            key={entry.user_id}
                            className={`${isCurrentUser ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                          >
                            <td className="px-6 py-4">
                              <span
                                className={`text-sm font-bold ${
                                  Number(entry.rank) === 1
                                    ? 'text-yellow-600'
                                    : Number(entry.rank) === 2
                                    ? 'text-gray-500'
                                    : Number(entry.rank) === 3
                                    ? 'text-orange-600'
                                    : 'text-gray-700'
                                }`}
                              >
                                #{entry.rank}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-sm ${isCurrentUser ? 'font-semibold text-blue-700' : 'text-gray-900'}`}>
                                {entry.username} {isCurrentUser && '(You)'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">{Number(entry.total_practices)}</td>
                            <td className="px-6 py-4">
                              <span className={`text-sm font-semibold ${getScoreColor(Number(entry.average_accuracy))}`}>
                                {Number(entry.average_accuracy).toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-semibold text-gray-800">Proofreading Leaderboard</h3>
                {userProofreadingRank && (
                  <p className="text-sm text-gray-600 mt-1">Your rank: #{userProofreadingRank}</p>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Rank</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Student</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Practices</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Avg Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {proofreadingRankings.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                          No ranking data available yet
                        </td>
                      </tr>
                    ) : (
                      proofreadingRankings.map((entry) => {
                        const isCurrentUser = entry.user_id === user?.id;
                        return (
                          <tr
                            key={entry.user_id}
                            className={`${isCurrentUser ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                          >
                            <td className="px-6 py-4">
                              <span
                                className={`text-sm font-bold ${
                                  Number(entry.rank) === 1
                                    ? 'text-yellow-600'
                                    : Number(entry.rank) === 2
                                    ? 'text-gray-500'
                                    : Number(entry.rank) === 3
                                    ? 'text-orange-600'
                                    : 'text-gray-700'
                                }`}
                              >
                                #{entry.rank}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-sm ${isCurrentUser ? 'font-semibold text-blue-700' : 'text-gray-900'}`}>
                                {entry.username} {isCurrentUser && '(You)'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">{Number(entry.total_practices)}</td>
                            <td className="px-6 py-4">
                              <span className={`text-sm font-semibold ${getScoreColor(Number(entry.average_accuracy))}`}>
                                {Number(entry.average_accuracy).toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentProgress;
