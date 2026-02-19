import React, { useState } from 'react';
import { SpacedRepetitionHub } from './SpacedRepetitionHub';
import { ImportSourceSelector } from './ImportSourceSelector';
import { ManualQuestionEntry } from './ManualQuestionEntry';
import { FileImporter } from './FileImporter';
import { NotionImporter } from './NotionImporter';
import { QuestionCard } from './QuestionCard';
import { SessionSummary } from './SessionSummary';
import { useSpacedRepetition } from '../../context/SpacedRepetitionContext';
import { SpacedRepetitionSessionState } from '../../types';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Login } from '../Auth/Login';
import { supabase } from '../../lib/supabase';

type PageState =
  | { view: 'hub' }
  | {
    view: 'createNew';
    source?: 'manual' | 'file' | 'notion';
    initialImportData?: {
      title: string;
      description: string;
      questions: any[];
    }
  }
  | { view: 'learning'; setId: string }
  | { view: 'edit'; setId: string; initialData: { title: string; description: string; questions: any[] } }
  | { view: 'analytics' };

export const SpacedRepetitionPage: React.FC = () => {
  const { user } = useAuth();
  const {
    createSet,
    addQuestions,
    updateSet,
    updateQuestion,
    deleteQuestion,
    getQuestionsForSet,
    recordAttempt,
    streak
  } = useSpacedRepetition();

  const [state, setState] = useState<PageState>({ view: 'hub' });
  const [sessionState, setSessionState] = useState<SpacedRepetitionSessionState | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);

  // If user is not logged in or authorized
  if (!user) return <Login />;
  if (!user.can_access_spaced_repetition) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have access to Spaced Repetition Learning yet.</p>
        </div>
      </div>
    );
  }

  // ─── Session Logic ───────────────────────────────────────────────────

  const startSession = async (setId: string) => {
    setLoadingSession(true);
    try {
      const questions = await getQuestionsForSet(setId);

      if (!questions || questions.length === 0) {
        alert("No questions found in this set.");
        setLoadingSession(false);
        return;
      }

      const sessionQuestions = questions
        .slice(0, 20);

      const now = Date.now();
      setSessionState({
        currentQuestionIndex: 0,
        questions: sessionQuestions,
        results: [],
        isCompleted: false,
        sessionStartTime: now,
        currentQuestionStartTime: now
      });

      setState({ view: 'learning', setId });
    } catch (error) {
      console.error("Failed to start session:", error);
      alert("Failed to start session. Please try again.");
    } finally {
      setLoadingSession(false);
    }
  };

  const handleAnswer = async (answerIndex: number, timeSpent: number) => {
    if (!sessionState) return;

    const currentQ = sessionState.questions[sessionState.currentQuestionIndex];
    const isCorrect = answerIndex === currentQ.correct_answer_index;

    try {
      await recordAttempt(currentQ.id, answerIndex, timeSpent);
    } catch (err) {
      console.error("Failed to record attempt:", err);
    }

    setSessionState(prev => {
      if (!prev) return null;

      const newResult = {
        question_id: currentQ.id,
        selected_answer_index: answerIndex,
        is_correct: isCorrect,
        response_time_ms: timeSpent,
      };

      const newResults = [...prev.results, newResult];
      const isLastQuestion = prev.currentQuestionIndex === prev.questions.length - 1;

      return {
        ...prev,
        results: newResults,
        isCompleted: isLastQuestion
      };
    });
  };

  const handleNext = () => {
    setSessionState(prev => {
      if (!prev) return null;
      return {
        ...prev,
        currentQuestionIndex: prev.currentQuestionIndex + 1,
        currentQuestionStartTime: Date.now()
      };
    });
  };

  const handlePrevious = () => {
    setSessionState(prev => {
      if (!prev || prev.currentQuestionIndex === 0) return prev;
      return {
        ...prev,
        currentQuestionIndex: prev.currentQuestionIndex - 1,
        currentQuestionStartTime: Date.now()
      };
    });
  };

  const handleQuestionsImport = async (
    questions: any[],
    title: string,
    description: string
  ) => {
    try {
      // setId was removed because we don't create the set immediately anymore
      // const setId = await createSet(title, description, 'medium');
      // Instead of saving immediately, redirect to manual entry for confirmation
      // This allows "Edit Before Save" and visual verification of order
      setState({
        view: 'createNew', // Use createNew with manual source to reuse ManualQuestionEntry as a "Review" step
        source: 'manual',
        initialImportData: {
          title,
          description,
          questions
        }
      });
    } catch (error) {
      console.error("Failed to prepare import:", error);
      alert("Failed to process questions. Please try again.");
    }
  };

  // ─── Creation Logic ──────────────────────────────────────────────────

  const handleSourceSelect = (source: 'manual' | 'file' | 'notion') => {
    setState({ view: 'createNew', source });
  };

  const handleEditSet = async (setId: string) => {
    setLoadingSession(true);
    try {
      const { data: set, error: setError } = await (supabase as any)
        .from('spaced_repetition_sets')
        .select('*')
        .eq('id', setId)
        .single();

      if (setError) throw setError;

      const questions = await getQuestionsForSet(setId);

      setState({
        view: 'edit',
        setId,
        initialData: {
          title: set.title,
          description: set.description || '',
          questions: questions || []
        }
      });
    } catch (err) {
      console.error("Failed to fetch set for editing:", err);
      alert("Failed to load set data.");
    } finally {
      setLoadingSession(false);
    }
  };

  const handleUpdateSet = async (
    questionsData: any[],
    title: string,
    description: string
  ) => {
    if (state.view !== 'edit') return;
    const setId = state.setId;

    try {
      // 1. Update set metadata
      await updateSet(setId, { title, description });

      // 2. Identify deleted, updated, and new questions
      const existingQuestions = state.initialData.questions;
      const currentIds = questionsData.map(q => q.id).filter(Boolean);

      // Delete questions that were removed in the UI
      const deletedIds = existingQuestions
        .filter(q => !currentIds.includes(q.id))
        .map(q => q.id);

      for (const qId of deletedIds) {
        await deleteQuestion(qId);
      }

      // Update existing or add new
      const newQuestions = [];
      for (let i = 0; i < questionsData.length; i++) {
        const q = questionsData[i];
        if (q.id) {
          // Update existing
          await updateQuestion(q.id, {
            question_text: q.question_text,
            image_url: q.image_url,
            choices: q.choices,
            correct_answer_index: q.correct_answer_index,
            explanation: q.explanation,
            difficulty: q.difficulty,
            tags: q.tags,
            order_index: i
          });
        } else {
          newQuestions.push({ ...q, order_index: i });
        }
      }

      // 3. Add any new questions
      if (newQuestions.length > 0) {
        await addQuestions(setId, newQuestions);
      }

      setState({ view: 'hub' });
    } catch (error) {
      console.error("Failed to update set:", error);
      alert("Failed to update the question set.");
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────

  // 1. Learning View
  if (state.view === 'learning' && sessionState) {
    if (sessionState.isCompleted && sessionState.results.length === sessionState.questions.length) {
      return (
        <SessionSummary
          results={sessionState.results}
          newStreak={streak?.current_streak_days || 0}
          onContinue={() => {
            if ('setId' in state) {
              startSession(state.setId);
            }
          }}
          onBackToHub={() => setState({ view: 'hub' })}
        />
      );
    }

    const currentQuestion = sessionState.questions[sessionState.currentQuestionIndex];
    const hasAnsweredCurrent = sessionState.results.length > sessionState.currentQuestionIndex;

    return (
      <QuestionCard
        key={currentQuestion.id}
        question={currentQuestion}
        questionNumber={sessionState.currentQuestionIndex + 1}
        totalQuestions={sessionState.questions.length}
        onAnswer={handleAnswer}
        onNext={handleNext}
        onPrevious={handlePrevious}
        canGoNext={hasAnsweredCurrent && sessionState.currentQuestionIndex < sessionState.questions.length - 1}
      />
    );
  }

  // ... rest of the views (createNew, hub, analytics)
  if (state.view === 'createNew') {
    if (!state.source) {
      return (
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={() => setState({ view: 'hub' })}
              className="mb-6 flex items-center text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-1" />
              Back to Hub
            </button>
            <ImportSourceSelector onSourceSelect={handleSourceSelect} />
          </div>
        </div>
      );
    }

    if (state.source === 'manual') {
      return (
        <ManualQuestionEntry
          title={state.initialImportData?.title || ""}
          description={state.initialImportData?.description || ""}
          initialQuestions={state.initialImportData?.questions}
          onSave={handleQuestionsImport}
          onCancel={() => setState({ view: 'createNew' })}
        />
      );
    }

    if (state.source === 'file') {
      return (
        <FileImporter
          title=""
          description=""
          onImport={handleQuestionsImport}
          onCancel={() => setState({ view: 'createNew' })}
        />
      );
    }

    if (state.source === 'notion') {
      return (
        <NotionImporter
          title=""
          description=""
          onImport={handleQuestionsImport}
          onCancel={() => setState({ view: 'createNew' })}
        />
      );
    }
  }

  if (state.view === 'edit') {
    return (
      <ManualQuestionEntry
        mode="edit"
        title={state.initialData.title}
        description={state.initialData.description}
        initialQuestions={state.initialData.questions}
        onSave={handleUpdateSet}
        onCancel={() => setState({ view: 'hub' })}
      />
    );
  }

  if (state.view === 'analytics') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Analytics Coming Soon</h1>
          <p className="text-gray-600 mb-6">Detailed analytics dashboard will be available soon.</p>
          <button
            onClick={() => setState({ view: 'hub' })}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
          >
            Back to Hub
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {loadingSession && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <p className="font-medium text-gray-900">Starting Session...</p>
          </div>
        </div>
      )}
      <SpacedRepetitionHub
        onCreateNew={() => setState({ view: 'createNew' })}
        onStartLearning={startSession}
        onEditSet={handleEditSet}
        onViewAnalytics={() => setState({ view: 'analytics' })}
        onViewSettings={() => console.log('Settings clicked')}
      />
    </>
  );
};