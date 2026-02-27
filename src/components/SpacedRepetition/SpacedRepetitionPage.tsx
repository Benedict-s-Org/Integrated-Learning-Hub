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
  | { view: 'learning'; setId: string; setTitle?: string }
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
    streak,
    saveActiveSession,
    fetchActiveSession,
    clearActiveSession
  } = useSpacedRepetition();

  const [state, setState] = useState<PageState>({ view: 'hub' });
  const [sessionState, setSessionState] = useState<SpacedRepetitionSessionState | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [resumptionData, setResumptionData] = useState<{ setId: string; sessionData: any; intendedLimit: number; setTitle?: string } | null>(null);
  const [prepSession, setPrepSession] = useState<{ setId?: string; setTitle?: string } | null>(null);
  const [selectedSize, setSelectedSize] = useState<number | 'custom'>(20);
  const [customSize, setCustomSize] = useState<number>(10);
  const [isMasterMode, setIsMasterMode] = useState(false);

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

  const startSession = async (setId?: string, forceFresh = false, limit = 20, setTitle?: string) => {
    setLoadingSession(true);
    const effectiveSetId = setId || 'global';

    try {
      if (!forceFresh) {
        const existingSession = await fetchActiveSession(effectiveSetId);
        const isFactuallyCompleted = existingSession && (existingSession.isCompleted || existingSession.results.length === existingSession.questions.length);

        if (existingSession && !isFactuallyCompleted) {
          setResumptionData({ setId: effectiveSetId, sessionData: existingSession, intendedLimit: limit, setTitle });
          setLoadingSession(false);
          return;
        } else if (existingSession && isFactuallyCompleted) {
          // Auto-clear silent completed sessions
          await clearActiveSession(effectiveSetId);
        }
      }

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
          .filter((s: any) => {
            const nextReviewDate = new Date(s.next_review_date);
            nextReviewDate.setHours(0, 0, 0, 0);
            const now = new Date();
            now.setHours(0, 0, 0, 0);

            const isDue = nextReviewDate.getTime() <= now.getTime();

            const hoursSinceReview = s.last_reviewed_at
              ? (Date.now() - new Date(s.last_reviewed_at).getTime()) / (1000 * 60 * 60)
              : Infinity;
            const reviewedToday = hoursSinceReview < 16;

            return isDue && (!reviewedToday || s.interval_days === 0);
          })
          .map((s: any) => s.question_id);

        const alreadyReviewedIds = (setSchedules || [])
          .filter((s: any) => {
            if (!s.last_reviewed_at || s.interval_days === 0) return false;
            const hoursSinceReview = (Date.now() - new Date(s.last_reviewed_at).getTime()) / (1000 * 60 * 60);
            return hoursSinceReview < 16;
          })
          .map((s: any) => s.question_id);

        const dueQuestions = setQuestions.filter((q: any) => dueIds.includes(q.id));
        // Include questions that aren't due and haven't been reviewed today
        const otherQuestions = setQuestions.filter((q: any) => !dueIds.includes(q.id) && !alreadyReviewedIds.includes(q.id));

        // Session order: Due first, then the rest
        sessionQuestions = [...dueQuestions, ...otherQuestions].slice(0, limit);
      } else {
        // Global Review Session: Fetch top cards from ALL sets based on limit
        sessionQuestions = (schedulesRes || [])
          .filter((s: any) => {
            const nextReviewDate = new Date(s.next_review_date);
            nextReviewDate.setHours(0, 0, 0, 0);
            const now = new Date();
            now.setHours(0, 0, 0, 0);

            const isDue = nextReviewDate.getTime() <= now.getTime();

            const hoursSinceReview = s.last_reviewed_at
              ? (Date.now() - new Date(s.last_reviewed_at).getTime()) / (1000 * 60 * 60)
              : Infinity;
            const reviewedToday = hoursSinceReview < 16;

            return isDue && (!reviewedToday || s.interval_days === 0);
          })
          .sort((a: any, b: any) => new Date(a.next_review_date).getTime() - new Date(b.next_review_date).getTime())
          .slice(0, limit)
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
      const newSessionState: SpacedRepetitionSessionState = {
        currentQuestionIndex: 0,
        questions: sessionQuestions,
        results: [],
        isCompleted: false,
        sessionStartTime: now,
        currentQuestionStartTime: now
      };

      setSessionState(newSessionState);
      // Save initial session only if not in master mode
      if (!isMasterMode) {
        await saveActiveSession(effectiveSetId, newSessionState);
      }

      setState({
        view: 'learning',
        setId: effectiveSetId,
        setTitle: setTitle || (setId ? 'Loading Set...' : 'Global Review')
      });
      setLoadingSession(false);
    } catch (error) {
      console.error("Failed to start session:", error);
      alert("Failed to start session. Please try again.");
    } finally {
      setLoadingSession(false);
    }
  };

  const resumeSession = async () => {
    if (!resumptionData) return;

    let sessionData = resumptionData.sessionData;

    // Check if the current question has already been answered
    const currentQuestion = sessionData.questions[sessionData.currentQuestionIndex];
    const isAnswered = sessionData.results.some((r: any) => r.question_id === currentQuestion?.id);

    // If it's already answered, move to the next one
    const isFactuallyCompleted = sessionData.isCompleted || sessionData.results.length === sessionData.questions.length;

    if (isAnswered && sessionData.currentQuestionIndex < sessionData.questions.length - 1) {
      sessionData = {
        ...sessionData,
        currentQuestionIndex: sessionData.currentQuestionIndex + 1,
        currentQuestionStartTime: Date.now()
      };
      // Save the advanced index so we don't need to do this check again
      await saveActiveSession(resumptionData.setId, sessionData);
    } else if (isFactuallyCompleted) {
      // It was the last question and it was answered
      sessionData = { ...sessionData, isCompleted: true };
      await saveActiveSession(resumptionData.setId, sessionData);
    }

    setSessionState(sessionData);
    setState({ view: 'learning', setId: resumptionData.setId, setTitle: resumptionData.setTitle });
    setResumptionData(null);
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleAnswer = async (answerIndex: number, timeSpent: number) => {
    if (!sessionState) return;

    const currentQ = sessionState.questions[sessionState.currentQuestionIndex];
    const isCorrect = answerIndex === currentQ.correct_answer_index;

    let newQuestionsList = [...sessionState.questions];
    if (!isCorrect) {
      // Re-add the question to the end of the session queue
      newQuestionsList.push(currentQ);
    }

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
      const isLastQuestion = prev.currentQuestionIndex === newQuestionsList.length - 1;

      return {
        ...prev,
        questions: newQuestionsList,
        results: newResults,
        isCompleted: isLastQuestion
      };
    });

    // 2. Perform and track the actual DB save if not in Master Mode
    if (!isMasterMode) {
      setIsSaving(true);
      try {
        await recordAttempt(currentQ.id, answerIndex, timeSpent);

        // Update persistent session state
        if (state.view === 'learning' && sessionState) {
          const isLastQuestion = sessionState.currentQuestionIndex === newQuestionsList.length - 1;
          const updatedSession = {
            ...sessionState,
            questions: newQuestionsList,
            results: [...sessionState.results, {
              question_id: currentQ.id,
              selected_answer_index: answerIndex,
              is_correct: isCorrect,
              response_time_ms: timeSpent,
            }],
            isCompleted: isLastQuestion
          };
          await saveActiveSession(state.setId, updatedSession);
        }
      } catch (err) {
        console.error("Failed to record attempt or save session:", err);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleSaveAndExit = async () => {
    if (isSaving) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Explicitly save state before exiting if possible
    if (state.view === 'learning' && sessionState) {
      await saveActiveSession(state.setId, sessionState);
    }

    setIsMasterMode(false);
    setState({ view: 'hub' });
  };

  const handleNext = () => {
    if (!sessionState) return;
    const isLast = sessionState.currentQuestionIndex === sessionState.questions.length - 1;

    if (isLast) {
      setSessionState(prev => prev ? { ...prev, isCompleted: true } : null);
      // Clear persistent session on success only if not in master mode
      if (state.view === 'learning' && !isMasterMode) {
        clearActiveSession(state.setId);
      }
    } else {
      const nextIndex = sessionState.currentQuestionIndex + 1;
      const updatedSession = {
        ...sessionState,
        currentQuestionIndex: nextIndex,
        currentQuestionStartTime: Date.now()
      };
      setSessionState(updatedSession);

      // Update persistent index only if not in master mode
      if (state.view === 'learning' && !isMasterMode) {
        saveActiveSession(state.setId, updatedSession);
      }
    }
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

  // ─── Helpers ────────────────────────────────────────────────────────

  const renderModals = () => (
    <>
      {resumptionData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-gray-900 mb-2 font-display">Resume Session?</h3>
            <p className="text-gray-600 mb-6 text-sm">
              You have an unfinished learning session. Would you like to continue or start over?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={resumeSession}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-sm active:scale-95"
              >
                Resume Progress
              </button>
              <button
                onClick={() => {
                  const id = resumptionData.setId === 'global' ? undefined : resumptionData.setId;
                  const limit = resumptionData.intendedLimit;
                  const setTitle = resumptionData.setTitle;
                  setResumptionData(null);
                  startSession(id, true, limit, setTitle); // `true` here means ignore completed sessions
                }}
                className="w-full px-4 py-3 border border-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-50 transition-all active:scale-95"
              >
                Start Fresh
              </button>
              <button
                onClick={() => setResumptionData(null)}
                className="w-full px-4 py-2 text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {prepSession && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-8 shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-300">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-6">
              <Loader2 className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2 font-display">Practice Session</h3>
            <p className="text-gray-500 mb-8 text-sm leading-relaxed">
              Choose how many cards you would like to practice in this session.
            </p>

            <div className="space-y-6 mb-8">
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 15, 20].map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`py-2 rounded-xl text-sm font-bold transition-all border ${selectedSize === size
                      ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200'
                      : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-white hover:border-blue-200'
                      }`}
                  >
                    {size}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setSelectedSize('custom')}
                className={`w-full py-3 rounded-xl text-sm font-bold transition-all border flex items-center justify-center gap-2 ${selectedSize === 'custom'
                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200'
                  : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-white hover:border-blue-200'
                  }`}
              >
                <span>Custom Amount</span>
                {selectedSize === 'custom' && (
                  <input
                    type="number"
                    min="1"
                    max="100"
                    autoFocus
                    value={customSize}
                    onChange={(e) => setCustomSize(parseInt(e.target.value) || 1)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-16 px-2 py-1 bg-white/20 border-white/30 rounded text-white focus:outline-none placeholder-white/50"
                  />
                )}
              </button>
            </div>


            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  const limit = selectedSize === 'custom' ? customSize : selectedSize;
                  const setId = prepSession.setId;
                  const setTitle = prepSession.setTitle;
                  setPrepSession(null);
                  startSession(setId, false, limit, setTitle);
                }}
                className="w-full px-4 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
              >
                Start Learning
              </button>
              <button
                onClick={() => setPrepSession(null)}
                className="w-full px-4 py-2 text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // ─── Render ──────────────────────────────────────────────────────────

  // 1. Learning View
  if (state.view === 'learning' && sessionState) {
    if (sessionState.isCompleted && sessionState.results.length === sessionState.questions.length) {
      return (
        <>
          <SessionSummary
            results={sessionState.results}
            newStreak={streak?.current_streak_days || 0}
            onContinue={() => {
              const id = state.setId === 'global' ? undefined : state.setId;
              setPrepSession({ setId: id });
            }}
            onBackToHub={() => {
              setIsMasterMode(false);
              setState({ view: 'hub' });
            }}
          />
          {renderModals()}
        </>
      );
    }

    const currentQuestion = sessionState.questions[sessionState.currentQuestionIndex];
    const hasAnsweredCurrent = sessionState.results.length > sessionState.currentQuestionIndex;

    return (
      <>
        <QuestionCard
          key={currentQuestion.id}
          question={currentQuestion}
          setTitle={state.view === 'learning' ? state.setTitle : undefined}
          questionNumber={sessionState.currentQuestionIndex + 1}
          totalQuestions={sessionState.questions.length}
          onAnswer={handleAnswer}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onSaveAndExit={handleSaveAndExit}
          canGoNext={hasAnsweredCurrent && sessionState.currentQuestionIndex < sessionState.questions.length - 1}
          isMasterMode={isMasterMode}
        />
        {renderModals()}
      </>
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
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
          <p className="text-gray-600 font-medium animate-pulse">Initializing Session...</p>
        </div>
      )}

      {renderModals()}
      <SpacedRepetitionHub
        onCreateNew={() => setState({ view: 'createNew' })}
        onStartLearning={(id, title) => setPrepSession({ setId: id, setTitle: title })}
        onEditSet={handleEditSet}
        onViewAnalytics={() => setState({ view: 'analytics' })}
        onViewSettings={() => console.log('Settings clicked')}
        isMasterMode={isMasterMode}
        setIsMasterMode={setIsMasterMode}
      />
    </>
  );
};