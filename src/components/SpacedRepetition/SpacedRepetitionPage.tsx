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
import { SpacedRepetitionAnalytics } from './SpacedRepetitionAnalytics';

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

  const startSession = async (setId?: string) => {
    setLoadingSession(true);
    try {
      const { data: schedulesRes, error: schedulesError } = await (supabase as any)
        .from('spaced_repetition_schedules')
        .select('*, spaced_repetition_questions(*)')
        .eq('user_id', user.id);

      if (schedulesError) throw schedulesError;

      let sessionQuestions: any[] = [];

      if (setId) {
        // Specific Set Session: Prioritize due cards within this set
        const setQuestions = await getQuestionsForSet(setId);
        const setSchedules = (schedulesRes || []).filter((s: any) => s.spaced_repetition_questions?.set_id === setId);

        const dueIds = (setSchedules || [])
          .filter((s: any) => new Date(s.next_review_date) <= new Date())
          .map((s: any) => s.question_id);

        const dueQuestions = setQuestions.filter((q: any) => dueIds.includes(q.id));
        const otherQuestions = setQuestions.filter((q: any) => !dueIds.includes(q.id));

        // Session order: Due first, then the rest
        sessionQuestions = [...dueQuestions, ...otherQuestions].slice(0, 20);
      } else {
        // Global Review Session: Fetch top 20 due cards from ALL sets
        sessionQuestions = (schedulesRes || [])
          .filter((s: any) => new Date(s.next_review_date) <= new Date())
          .sort((a: any, b: any) => new Date(a.next_review_date).getTime() - new Date(b.next_review_date).getTime())
          .slice(0, 20)
          .map((s: any) => ({
            ...s.spaced_repetition_questions,
            // Ensure ID is the question ID, not the schedule ID if there's any confusion
            id: s.question_id
          }))
          .filter((q: any) => q.question_text); // filter out any broken joins
      }

      if (sessionQuestions.length === 0) {
        alert("No questions found or all cards are up to date.");
        setLoadingSession(false);
        return;
      }

      const now = Date.now();
      setSessionState({
        currentQuestionIndex: 0,
        questions: sessionQuestions,
        results: [],
        isCompleted: false,
        sessionStartTime: now,
        currentQuestionStartTime: now
      });

      setState({ view: 'learning', setId: setId || 'global' });
    } catch (error) {
      console.error("Failed to start session:", error);
      alert("Failed to start session. Please try again.");
    } finally {
      setLoadingSession(false);
    }
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleAnswer = async (answerIndex: number, timeSpent: number) => {
    if (!sessionState) return;

    const currentQ = sessionState.questions[sessionState.currentQuestionIndex];
    const isCorrect = answerIndex === currentQ.correct_answer_index;

    // 1. Optimistic state update for UI responsiveness
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

    // 2. Perform and track the actual DB save
    setIsSaving(true);
    try {
      await recordAttempt(currentQ.id, answerIndex, timeSpent);
    } catch (err) {
      console.error("Failed to record attempt:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndExit = async () => {
    // If we're currently saving, wait a bit or we could use a reference to the promise
    // For now, let's just use a simple check. If isSaving is true, we might miss the last one
    // if we transition immediately.
    if (isSaving) {
      // Wait for a short duration to allow the async save to progress
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    setState({ view: 'hub' });
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

  /**
   * Final Save Handler (Commit to DB)
   * This function is used by ManualQuestionEntry to actually save the new set.
   */
  const handleInternalSaveSet = async (
    questions: any[],
    title: string,
    description: string
  ): Promise<void> => {
    try {
      const setId = await createSet(title, description, 'medium');
      if (setId) {
        // Here we ensure questions are added IN ORDER
        await addQuestions(setId, questions);
        setState({ view: 'hub' });
      } else {
        throw new Error("Failed to create set ID");
      }
    } catch (error) {
      console.error("Failed to save set:", error);
      alert("Failed to save the question set. Please try again.");
    }
  };

  /**
   * Import Preview Handler
   * This function receives data from importers (Notion/File/Manual) and 
   * redirects to the Manual Entry screen for "Edit Before Save".
   */
  const handleQuestionsImportPreview = async (
    questions: any[],
    title: string,
    description: string
  ) => {
    try {
      // Instead of saving immediately, redirect to manual entry for confirmation
      // This allows "Edit Before Save" and visual verification of order
      const mappedQuestions = questions.map(q => ({
        ...q,
        question_text: q.question || q.question_text || '',
        choices: q.choices,
        correct_answer_index: q.correct_answer_index,
        explanation: q.explanation || '',
        difficulty: q.difficulty || 'medium',
        tags: q.tags || [],
        image_url: null
      }));

      setState({
        view: 'createNew', // Use createNew with manual source to reuse ManualQuestionEntry as a "Review" step
        source: 'manual',
        initialImportData: {
          title,
          description,
          questions: mappedQuestions
        }
      });
    } catch (error) {
      console.error("Failed to prepare import:", error);
      alert("Failed to process questions. Please try again.");
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
        onSaveAndExit={handleSaveAndExit}
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
          onSave={handleInternalSaveSet} // Manual entry saves to DB
          onCancel={() => setState({ view: 'createNew' })}
        />
      );
    }

    if (state.source === 'file') {
      return (
        <FileImporter
          title=""
          description=""
          onImport={handleQuestionsImportPreview} // File imports go to preview
          onCancel={() => setState({ view: 'createNew' })}
        />
      );
    }

    if (state.source === 'notion') {
      return (
        <NotionImporter
          title=""
          description=""
          onImport={handleQuestionsImportPreview} // Notion imports go to preview
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
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Learning Analytics</h1>
              <p className="text-gray-500 mt-1">Track your progress and card mastery over time</p>
            </div>
            <button
              onClick={() => setState({ view: 'hub' })}
              className="px-6 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors shadow-sm"
            >
              Back to Hub
            </button>
          </div>
          <SpacedRepetitionAnalytics />
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