import React, { useState, useEffect } from 'react';
import { useSpacedRepetition } from '../../context/SpacedRepetitionContext';
import { useAuth } from '../../context/AuthContext';
import { SpacedRepetitionHub } from './SpacedRepetitionHub';
import { ImportSourceSelector } from './ImportSourceSelector';
import { ManualQuestionEntry } from './ManualQuestionEntry';
import { CSVImporter } from './CSVImporter';
import { ExternalSourceImporter } from './ExternalSourceImporter';
import { QuestionCard } from './QuestionCard';
import { SessionSummary } from './SessionSummary';
import { Login } from '../Auth/Login';


interface PageState {
  type: 'hub' | 'createNew' | 'learning' | 'analytics';
  source?: 'manual' | 'csv' | 'notion' | 'anki' | 'google' | null;
  setId?: string;
  createTitle?: string;
  createDescription?: string;
  currentQuestionIndex?: number;
  sessionResults?: any[];
  newStreak?: number;
  achievementUnlocked?: any;
}

export function SpacedRepetitionPage() {
  const { user } = useAuth();
  const { fetchCardsDueToday, questions, recordAttempt, streak, achievements, createSet, addQuestions, loading } = useSpacedRepetition();
  const [pageState, setPageState] = useState<PageState>({ type: 'hub' });
  const [cardsDueToday, setCardsDueToday] = useState<any[]>([]);
  const [sessionResults, setSessionResults] = useState<any[]>([]);
  const [newStreak, setNewStreak] = useState(0);

  useEffect(() => {
    if (user?.id && pageState.type === 'learning') {
      loadCardsDueToday();
    }
  }, [pageState.type, user?.id]);

  const loadCardsDueToday = async () => {
    const cards = await fetchCardsDueToday();
    setCardsDueToday(cards);
    setSessionResults([]);
  };

  if (!user) {
    return <Login />;
  }

  if (!user.can_access_spaced_repetition) {
    return (
      <div className="min-h-full flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have access to Spaced Repetition Learning yet.</p>
        </div>
      </div>
    );
  }

  const handleCreateNew = async (questions_data: any[], title: string, description: string) => {
    const setId = await createSet(title, description, 'medium');
    if (setId) {
      await addQuestions(setId, questions_data);
      setPageState({ type: 'hub' });
    }
  };

  const handleAnswer = async (questionIndex: number, selectedIndex: number, responseTime: number) => {
    const question = cardsDueToday[questionIndex];
    const isCorrect = selectedIndex === question.correct_answer_index;
    const result = {
      question_id: question.id,
      selected_answer_index: selectedIndex,
      is_correct: isCorrect,
      response_time_ms: responseTime,
    };

    const newResults = [...sessionResults, result];
    setSessionResults(newResults);

    await recordAttempt(question.id, selectedIndex, responseTime);

    if (questionIndex === cardsDueToday.length - 1) {
      setNewStreak(streak?.current_streak_days || 0);
      setPageState({
        type: 'learning',
        setId: '',
        currentQuestionIndex: -1,
        sessionResults: newResults,
      } as any);
    }
  };

  switch (pageState.type) {
    case 'hub':
      return (
        <SpacedRepetitionHub
          onCreateNew={() => setPageState({ type: 'createNew', source: null })}
          onStartLearning={(setId) => {
            setPageState({ type: 'learning', setId } as any);
            loadCardsDueToday();
          }}
          onViewAnalytics={() => setPageState({ type: 'analytics' })}
          onViewSettings={() => { }}
        />
      );

    case 'createNew':
      if (!pageState.source) {
        return (
          <ImportSourceSelector
            onSourceSelect={(source) => {
              setPageState({
                type: 'createNew',
                source,
                createTitle: '',
                createDescription: '',
              });
            }}
          />
        );
      }

      if (pageState.source === 'manual') {
        return (
          <ManualQuestionEntry
            title={pageState.createTitle || ''}
            description={pageState.createDescription || ''}
            onSave={handleCreateNew}
            onCancel={() => setPageState({ type: 'hub' })}
          />
        );
      }

      if (pageState.source === 'csv') {
        return (
          <CSVImporter
            title={pageState.createTitle || ''}
            description={pageState.createDescription || ''}
            onImport={handleCreateNew}
            onCancel={() => setPageState({ type: 'hub' })}
          />
        );
      }

      return (
        <ExternalSourceImporter
          source={pageState.source as 'notion' | 'anki' | 'google'}
          title={pageState.createTitle || ''}
          description={pageState.createDescription || ''}
          onImport={handleCreateNew}
          onCancel={() => setPageState({ type: 'hub' })}
        />
      );

    case 'learning':
      if (sessionResults.length > 0 && sessionResults.length === cardsDueToday.length) {
        return (
          <SessionSummary
            results={sessionResults}
            newStreak={newStreak}
            achievementUnlocked={undefined}
            onContinue={() => {
              loadCardsDueToday();
              setPageState({ type: 'hub' });
            }}
            onBackToHub={() => setPageState({ type: 'hub' })}
          />
        );
      }

      if (cardsDueToday.length === 0) {
        return (
          <div className="min-h-full flex items-center justify-center bg-gray-50 p-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">No Cards Due Today</h1>
              <p className="text-gray-600 mb-6">Great job! You're all caught up. Come back later for more review.</p>
              <button
                onClick={() => setPageState({ type: 'hub' })}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
              >
                Back to Hub
              </button>
            </div>
          </div>
        );
      }

      const currentQuestion = cardsDueToday[sessionResults.length];
      return (
        <QuestionCard
          question={currentQuestion}
          questionNumber={sessionResults.length + 1}
          totalQuestions={cardsDueToday.length}
          onAnswer={(selectedIndex, responseTime) => {
            handleAnswer(sessionResults.length, selectedIndex, responseTime);
          }}
          onNext={() => {
            if (sessionResults.length === cardsDueToday.length - 1) {
              setPageState({
                type: 'learning',
                setId: pageState.setId,
                currentQuestionIndex: sessionResults.length + 1,
              } as any);
            }
          }}
          onPrevious={() => {
            if (sessionResults.length > 0) {
              setSessionResults(sessionResults.slice(0, -1));
            }
          }}
          canGoNext={sessionResults.length > 0}
        />
      );

    case 'analytics':
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Analytics Coming Soon</h1>
            <p className="text-gray-600 mb-6">Detailed analytics dashboard will be available soon.</p>
            <button
              onClick={() => setPageState({ type: 'hub' })}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
            >
              Back to Hub
            </button>
          </div>
        </div>
      );

    default:
      return null;
  }
}