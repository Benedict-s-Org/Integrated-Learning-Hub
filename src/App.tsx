import { useState, useEffect } from 'react';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { SpacedRepetitionProvider } from './context/SpacedRepetitionContext';
import { useAppContext } from './context/AppContext';
import { useAuth } from './context/AuthContext';
import Navigation from './components/Navigation/Navigation';
import TextInput from './components/TextInput/TextInput';
import WordSelection from './components/WordSelection/WordSelection';
import MemorizationView from './components/MemorizationView/MemorizationView';
import SavedContent from './components/SavedContent/SavedContent';
import ProofreadingInput from './components/ProofreadingInput/ProofreadingInput';
import ProofreadingAnswerSetting from './components/ProofreadingAnswerSetting/ProofreadingAnswerSetting';
import ProofreadingPreview from './components/ProofreadingPreview/ProofreadingPreview';
import ProofreadingPracticeComponent from './components/ProofreadingPractice/ProofreadingPractice';
import SpellingInput from './components/SpellingInput/SpellingInput';
import SpellingPreview from './components/SpellingPreview/SpellingPreview';
import SpellingPractice from './components/SpellingPractice/SpellingPractice';
import SavedPractices from './components/SavedPractices/SavedPractices';
import SavedProofreadingPractices from './components/SavedProofreadingPractices/SavedProofreadingPractices';
import ProofreadingAssignment from './components/ProofreadingAssignment/ProofreadingAssignment';
import AssignedProofreadingPractices from './components/AssignedProofreadingPractices/AssignedProofreadingPractices';
import SourceInspector from './components/SourceInspector/SourceInspector';
import AdminPanel from './components/AdminPanel/AdminPanel';
import ContentDatabase from './components/ContentDatabase/ContentDatabase';
import StudentProgress from './components/StudentProgress/StudentProgress';
import UserAnalytics from './components/UserAnalytics/UserAnalytics';
import AssignmentManagement from './components/AssignmentManagement/AssignmentManagement';
import UnifiedAssignments from './components/UnifiedAssignments/UnifiedAssignments';
import GlobalDiagnosticPanel from './components/GlobalDiagnosticPanel/GlobalDiagnosticPanel';
import { SpacedRepetitionPage } from './components/SpacedRepetition/SpacedRepetitionPage';
import { Login } from './components/Auth/Login';
import { MemoryRouter } from 'react-router-dom';
import { MemoryPalacePage } from './pages/MemoryPalacePage';
import { ComponentInspector } from './components/debug/ComponentInspector';

import { ChangePasswordModal } from './components/Auth/ChangePasswordModal';
import { Word, MemorizationState, ProofreadingAnswer, ProofreadingPractice, AssignedProofreadingPracticeContent } from './types';

type AppState =
  | { page: 'new'; step: 'input'; text?: string }
  | { page: 'new'; step: 'selection'; text: string; words?: Word[] }
  | { page: 'new'; step: 'memorization'; words: Word[]; selectedIndices: number[]; text: string }
  | { page: 'saved' }
  | { page: 'admin' }
  | { page: 'database' }
  | { page: 'practice'; memorizationState: MemorizationState }
  | { page: 'publicPractice'; memorizationState: MemorizationState }
  | { page: 'proofreading'; step: 'input' }
  | { page: 'proofreading'; step: 'answerSetting'; sentences: string[] }
  | { page: 'proofreading'; step: 'preview'; sentences: string[]; answers: ProofreadingAnswer[] }
  | { page: 'proofreading'; step: 'practice'; sentences: string[]; answers: ProofreadingAnswer[] }
  | { page: 'proofreading'; step: 'saved' }
  | { page: 'proofreading'; step: 'assignment'; practice: ProofreadingPractice }
  | { page: 'proofreading'; step: 'assignedPractice'; assignment: AssignedProofreadingPracticeContent }
  | { page: 'spelling'; step: 'input' }
  | { page: 'spelling'; step: 'preview'; title: string; words: string[]; practiceId?: string }
  | { page: 'spelling'; step: 'practice'; title: string; words: string[]; practiceId?: string; assignmentId?: string }
  | { page: 'spelling'; step: 'saved' }
  | { page: 'progress' }
  | { page: 'assignments' }
  | { page: 'assignmentManagement' }
  | { page: 'proofreadingAssignments' }
  | { page: 'assignedPractice'; memorizationState: MemorizationState; assignmentId?: string }
  | { page: 'learningHub' }
  | { page: 'spacedRepetition' };

function AppContent() {
  const [appState, setAppState] = useState<AppState>({ page: 'new', step: 'input' });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(true);
  const { fetchPublicContent, proofreadingPractices, deleteProofreadingPractice } = useAppContext();
  const { user, loading, toggleViewMode } = useAuth();
  const [showComponentInspector, setShowComponentInspector] = useState(() => {
    return localStorage.getItem('showComponentInspector') === 'true';
  });

  // Global keyboard shortcut for quick toggle (Alt+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 's') {
        if (user?.role === 'admin') {
          e.preventDefault();
          toggleViewMode();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user, toggleViewMode]);

  useEffect(() => {
    const handleToggle = (e: any) => setShowComponentInspector(e.detail);
    window.addEventListener('toggle-component-inspector', handleToggle);
    return () => window.removeEventListener('toggle-component-inspector', handleToggle);
  }, []);

  // Close login modal when user signs in
  useEffect(() => {
    if (user && showLoginModal) {
      setShowLoginModal(false);
    }
  }, [user, showLoginModal]);

  // Reset app state when user signs out
  useEffect(() => {
    if (!user && !loading) {
      const isRestrictedState =
        appState.page === 'saved' ||
        appState.page === 'admin' ||
        appState.page === 'database' ||
        (appState.page === 'spelling' && appState.step === 'saved') ||
        appState.page === 'practice';

      if (isRestrictedState) {
        setAppState({ page: 'new', step: 'input' });
        window.location.hash = '';
      }
    }
  }, [user, loading]);

  // Handle hash-based routing for public links - MUST be before any conditional returns
  useEffect(() => {
    const handleHashChange = async () => {
      const hash = window.location.hash;
      const publicMatch = hash.match(/^#\/public\/(.+)$/);

      if (publicMatch) {
        const publicId = publicMatch[1];
        const publicContent = await fetchPublicContent(publicId);

        if (publicContent) {
          setAppState({ page: 'publicPractice', memorizationState: publicContent });
        } else {
          // Content not found, redirect to home
          window.location.hash = '';
          setAppState({ page: 'new', step: 'input' });
          alert('The requested practice content was not found or is no longer available.');
        }
      }
    };

    // Check hash on mount
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [fetchPublicContent]);

  // Conditional rendering after all hooks
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // Check if user is trying to access restricted pages
  const isRestrictedPage =
    appState.page === 'saved' ||
    appState.page === 'admin' ||
    appState.page === 'database' ||
    appState.page === 'learningHub' ||
    appState.page === 'progress' ||
    appState.page === 'assignments' ||
    appState.page === 'assignmentManagement' ||
    appState.page === 'spacedRepetition';

  if (!user && isRestrictedPage) {
    return <Login />;
  }

  // Check permissions for proofreading (admins have automatic access)
  if (appState.page === 'proofreading' && user && !user.can_access_proofreading && user.role !== 'admin') {
    setAppState({ page: 'new', step: 'input' });
  }

  // Check permissions for spelling (admins have automatic access)
  if (appState.page === 'spelling' && user && !user.can_access_spelling && user.role !== 'admin') {
    setAppState({ page: 'new', step: 'input' });
  }

  // Check permissions for learning hub (admins have automatic access)
  if (appState.page === 'learningHub' && user && !user.can_access_learning_hub && user.role !== 'admin') {
    setAppState({ page: 'new', step: 'input' });
  }

  // Ensure students land on saved practices view when accessing spelling
  if (appState.page === 'spelling' && appState.step === 'input' && user && user.role !== 'admin') {
    setAppState({ page: 'spelling', step: 'saved' });
  }

  if (user?.force_password_change) {
    return <ChangePasswordModal isForced={true} />;
  }

  const handlePageChange = (page: 'new' | 'saved' | 'admin' | 'database' | 'proofreading' | 'spelling' | 'progress' | 'assignments' | 'assignmentManagement' | 'proofreadingAssignments' | 'learningHub' | 'spacedRepetition') => {
    // Check if user is trying to access restricted pages without authentication
    if (!user && (page === 'saved' || page === 'admin' || page === 'database' || page === 'spelling' || page === 'progress' || page === 'assignments' || page === 'assignmentManagement' || page === 'proofreadingAssignments' || page === 'learningHub' || page === 'spacedRepetition')) {
      setShowLoginModal(true);
      return;
    }

    // Check permissions for proofreading (admins have automatic access)
    if ((page === 'proofreading' || page === 'proofreadingAssignments') && !user?.can_access_proofreading && user?.role !== 'admin') {
      alert('You do not have permission to access Proofreading Exercise.');
      return;
    }

    // Check permissions for spelling (admins have automatic access)
    if (page === 'spelling' && !user?.can_access_spelling && user?.role !== 'admin') {
      alert('You do not have permission to access Spelling Practice.');
      return;
    }

    // Check permissions for learning hub (admins have automatic access)
    if (page === 'learningHub' && !user?.can_access_learning_hub && user?.role !== 'admin') {
      alert('You do not have permission to access Integrated Learning Hub.');
      return;
    }

    window.location.hash = '';

    if (page === 'new') {
      setAppState({ page: 'new', step: 'input' });
    } else if (page === 'saved') {
      setAppState({ page: 'saved' });
    } else if (page === 'admin') {
      setAppState({ page: 'admin' });
    } else if (page === 'database') {
      setAppState({ page: 'database' });
    } else if (page === 'proofreading') {
      // Admins go to input, students go to assignments
      if (user?.role === 'admin') {
        setAppState({ page: 'proofreading', step: 'input' });
      } else {
        setAppState({ page: 'proofreadingAssignments' });
      }
    } else if (page === 'spelling') {
      // Students go directly to saved practices, admins go to input
      if (user?.role === 'admin') {
        setAppState({ page: 'spelling', step: 'input' });
      } else {
        setAppState({ page: 'spelling', step: 'saved' });
      }
    } else if (page === 'progress') {
      setAppState({ page: 'progress' });
    } else if (page === 'assignments') {
      setAppState({ page: 'assignments' });
    } else if (page === 'assignmentManagement') {
      setAppState({ page: 'assignmentManagement' });
    } else if (page === 'proofreadingAssignments') {
      setAppState({ page: 'proofreadingAssignments' });
    } else if (page === 'learningHub') {
      setAppState({ page: 'learningHub' });
    } else if (page === 'spacedRepetition') {
      setAppState({ page: 'spacedRepetition' });
    }
  };

  const handleLogin = () => {
    setShowLoginModal(true);
  };

  const handleTextSubmit = (text: string) => {
    setAppState({ page: 'new', step: 'selection', text });
  };

  const handleWordsSelected = (words: Word[], selectedIndices: number[]) => {
    if (appState.page === 'new' && appState.step === 'selection') {
      setAppState({
        page: 'new',
        step: 'memorization',
        words,
        selectedIndices,
        text: appState.text,
      });
    }
  };

  const handleBackToInput = () => {
    if (appState.page === 'new' && appState.step === 'selection') {
      setAppState({ page: 'new', step: 'input', text: appState.text });
    } else {
      setAppState({ page: 'new', step: 'input' });
    }
  };

  const handleBackToSelection = () => {
    if (appState.page === 'new' && appState.step === 'memorization') {
      setAppState({ page: 'new', step: 'selection', text: appState.text, words: appState.words });
    }
  };

  const handleSave = () => {
    setAppState({ page: 'saved' });
  };

  const handleLoadContent = (memorizationState: MemorizationState) => {
    setAppState({ page: 'practice', memorizationState });
  };

  const handleLoadAssignedContent = (memorizationState: any) => {
    setAppState({
      page: 'assignedPractice',
      memorizationState,
      assignmentId: memorizationState.assignmentId
    });
  };

  const handleBackFromPractice = () => {
    setAppState({ page: 'saved' });
  };

  const handleBackFromAssignedPractice = () => {
    setAppState({ page: 'assignments' });
  };

  const handleViewSavedMemorization = () => {
    setAppState({ page: 'saved' });
  };

  const handleCreateNewMemorization = () => {
    setAppState({ page: 'new', step: 'input' });
  };

  const handleProofreadingSentencesSubmit = (sentences: string[]) => {
    setAppState({ page: 'proofreading', step: 'answerSetting', sentences });
  };

  const handleProofreadingAnswersSet = (answers: ProofreadingAnswer[]) => {
    if (appState.page === 'proofreading' && appState.step === 'answerSetting') {
      setAppState({ page: 'proofreading', step: 'preview', sentences: appState.sentences, answers });
    }
  };

  const handleProofreadingPreviewNext = () => {
    if (appState.page === 'proofreading' && appState.step === 'preview') {
      setAppState({ page: 'proofreading', step: 'practice', sentences: appState.sentences, answers: appState.answers });
    }
  };

  const handleBackToProofreadingPreview = () => {
    if (appState.page === 'proofreading' && appState.step === 'practice') {
      setAppState({ page: 'proofreading', step: 'preview', sentences: appState.sentences, answers: appState.answers });
    }
  };

  const handleBackToProofreadingInput = () => {
    setAppState({ page: 'proofreading', step: 'input' });
  };

  const handleBackToAnswerSetting = () => {
    if (appState.page === 'proofreading' && appState.step === 'preview') {
      setAppState({ page: 'proofreading', step: 'answerSetting', sentences: appState.sentences });
    }
  };


  const handleViewSavedProofreading = () => {
    setAppState({ page: 'proofreading', step: 'saved' });
  };

  const handleSelectProofreadingPractice = (practice: ProofreadingPractice) => {
    if (user?.role === 'admin') {
      setAppState({ page: 'proofreading', step: 'preview', sentences: practice.sentences, answers: practice.answers });
    } else {
      setAppState({ page: 'proofreading', step: 'practice', sentences: practice.sentences, answers: practice.answers });
    }
  };

  const handleAssignProofreadingPractice = (practice: ProofreadingPractice) => {
    setAppState({ page: 'proofreading', step: 'assignment', practice });
  };

  const handleDeleteProofreadingPractice = async (id: string) => {
    await deleteProofreadingPractice(id);
  };

  const handleBackToSavedProofreading = () => {
    setAppState({ page: 'proofreading', step: 'saved' });
  };

  const handleLoadAssignedProofreadingPractice = (assignment: AssignedProofreadingPracticeContent) => {
    setAppState({ page: 'proofreading', step: 'assignedPractice', assignment });
  };

  const handleBackFromProofreadingAssignments = () => {
    setAppState({ page: 'proofreadingAssignments' });
  };

  const handleSpellingWordsSubmit = (title: string, words: string[]) => {
    setAppState({ page: 'spelling', step: 'preview', title, words });
  };

  const handleViewSavedSpelling = () => {
    setAppState({ page: 'spelling', step: 'saved' });
  };

  const handleBackToSpellingCreate = () => {
    setAppState({ page: 'spelling', step: 'input' });
  };

  const handleSpellingPreviewNext = () => {
    if (appState.page === 'spelling' && appState.step === 'preview') {
      setAppState({
        page: 'spelling',
        step: 'practice',
        title: appState.title,
        words: appState.words,
        practiceId: appState.practiceId
      });
    }
  };

  const handleBackToSpellingInput = () => {
    setAppState({ page: 'spelling', step: 'input' });
  };

  const handleBackToSpellingPreview = () => {
    if (appState.page === 'spelling' && appState.step === 'practice') {
      // Students go back to saved practices list, admins go to preview
      if (user?.role === 'admin') {
        setAppState({ page: 'spelling', step: 'preview', title: appState.title, words: appState.words });
      } else {
        setAppState({ page: 'spelling', step: 'saved' });
      }
    }
  };

  const renderCurrentView = () => {
    switch (appState.page) {
      case 'new':
        switch (appState.step) {
          case 'input':
            return <TextInput onNext={handleTextSubmit} initialText={appState.text} onViewSaved={handleViewSavedMemorization} />;
          case 'selection':
            return (
              <WordSelection
                text={appState.text}
                initialWords={appState.words}
                onNext={handleWordsSelected}
                onBack={handleBackToInput}
                onViewSaved={handleViewSavedMemorization}
              />
            );
          case 'memorization':
            return (
              <MemorizationView
                words={appState.words}
                selectedIndices={appState.selectedIndices}
                originalText={appState.text}
                onBack={handleBackToSelection}
                onSave={handleSave}
                onViewSaved={handleViewSavedMemorization}
              />
            );
        }
        break;
      case 'saved':
        return <SavedContent onLoadContent={handleLoadContent} onCreateNew={handleCreateNewMemorization} />;
      case 'admin':
        return <AdminPanel />;
      case 'database':
        return <ContentDatabase />;
      case 'practice':
        return (
          <MemorizationView
            words={appState.memorizationState.words}
            selectedIndices={appState.memorizationState.selectedWordIndices}
            originalText={appState.memorizationState.originalText}
            onBack={handleBackFromPractice}
            onSave={() => { }}
            onViewSaved={handleViewSavedMemorization}
          />
        );
      case 'publicPractice':
        return (
          <MemorizationView
            words={appState.memorizationState.words}
            selectedIndices={appState.memorizationState.selectedWordIndices}
            originalText={appState.memorizationState.originalText}
            onBack={() => {
              window.location.hash = '';
              setAppState({ page: 'new', step: 'input' });
            }}
            onSave={() => { }}
            onViewSaved={() => { }}
            isPublicView={true}
          />
        );
      case 'proofreading':
        switch (appState.step) {
          case 'input':
            return <ProofreadingInput onNext={handleProofreadingSentencesSubmit} onViewSaved={user?.role === 'admin' ? handleViewSavedProofreading : undefined} />;
          case 'answerSetting':
            return (
              <ProofreadingAnswerSetting
                sentences={appState.sentences}
                onNext={handleProofreadingAnswersSet}
                onBack={handleBackToProofreadingInput}
                onViewSaved={user?.role === 'admin' ? handleViewSavedProofreading : undefined}
              />
            );
          case 'preview':
            return (
              <ProofreadingPreview
                sentences={appState.sentences}
                answers={appState.answers}
                onNext={handleProofreadingPreviewNext}
                onBack={handleBackToAnswerSetting}
                onViewSaved={user?.role === 'admin' ? handleViewSavedProofreading : undefined}
              />
            );
          case 'practice':
            return (
              <ProofreadingPracticeComponent
                sentences={appState.sentences}
                answers={appState.answers}
                onBack={handleBackToProofreadingPreview}
                onViewSaved={user?.role === 'admin' ? handleViewSavedProofreading : undefined}
              />
            );
          case 'saved':
            return (
              <SavedProofreadingPractices
                practices={proofreadingPractices}
                onCreateNew={handleBackToProofreadingInput}
                onSelectPractice={handleSelectProofreadingPractice}
                onAssignPractice={handleAssignProofreadingPractice}
                onDeletePractice={handleDeleteProofreadingPractice}
              />
            );
          case 'assignment':
            return (
              <ProofreadingAssignment
                practice={appState.practice}
                onBack={handleBackToSavedProofreading}
              />
            );
          case 'assignedPractice':
            return (
              <ProofreadingPracticeComponent
                sentences={appState.assignment.sentences}
                answers={appState.assignment.answers}
                onBack={handleBackFromProofreadingAssignments}
                practiceId={appState.assignment.practice_id}
                assignmentId={appState.assignment.id}
              />
            );
        }
        break;
      case 'spelling':
        switch (appState.step) {
          case 'input':
            return (
              <SpellingInput
                onNext={handleSpellingWordsSubmit}
                onViewSaved={user?.role === 'admin' ? handleViewSavedSpelling : undefined}
              />
            );
          case 'preview':
            return (
              <SpellingPreview
                title={appState.title}
                words={appState.words}
                onNext={handleSpellingPreviewNext}
                onBack={handleBackToSpellingInput}
                onSave={user?.role === 'admin' ? handleViewSavedSpelling : undefined}
                onViewSaved={user?.role === 'admin' ? handleViewSavedSpelling : undefined}
              />
            );
          case 'practice':
            return (
              <SpellingPractice
                title={appState.title}
                words={appState.words}
                practiceId={appState.practiceId}
                assignmentId={appState.assignmentId}
                onBack={handleBackToSpellingPreview}
              />
            );
          case 'saved':
            return (
              <SavedPractices
                onCreateNew={handleBackToSpellingCreate}
                onSelectPractice={(practice) => {
                  // Students go directly to practice, admins can preview
                  if (user?.role === 'admin') {
                    setAppState({
                      page: 'spelling',
                      step: 'preview',
                      title: practice.title,
                      words: practice.words,
                      practiceId: practice.id,
                    });
                  } else {
                    setAppState({
                      page: 'spelling',
                      step: 'practice',
                      title: practice.title,
                      words: practice.words,
                      practiceId: practice.id,
                      assignmentId: practice.assignment_id,
                    });
                  }
                }}
                onPractice={(practice) => {
                  setAppState({
                    page: 'spelling',
                    step: 'practice',
                    title: practice.title,
                    words: practice.words,
                    practiceId: practice.id,
                    assignmentId: practice.assignment_id,
                  });
                }}
              />
            );
        }
        break;
      case 'progress':
        return user?.role === 'admin' ? <UserAnalytics /> : <StudentProgress />;
      case 'assignments':
        return (
          <UnifiedAssignments
            onLoadMemorization={handleLoadAssignedContent}
            onLoadSpelling={(practice) => {
              setAppState({
                page: 'spelling',
                step: 'practice',
                title: practice.title,
                words: practice.words,
                practiceId: practice.practiceId,
                assignmentId: practice.assignmentId,
              });
            }}
            onLoadProofreading={handleLoadAssignedProofreadingPractice}
          />
        );
      case 'assignmentManagement':
        return <AssignmentManagement />;
      case 'proofreadingAssignments':
        return <AssignedProofreadingPractices onLoadContent={handleLoadAssignedProofreadingPractice} />;
      case 'learningHub':
        return (
          <MemoryRouter>
            <MemoryPalacePage onExit={() => setAppState({ page: 'new', step: 'input' })} />
          </MemoryRouter>
        );
      case 'spacedRepetition':
        return <SpacedRepetitionPage />;
      case 'assignedPractice':
        return (
          <MemorizationView
            words={appState.memorizationState.words}
            selectedIndices={appState.memorizationState.selectedWordIndices}
            originalText={appState.memorizationState.originalText}
            onBack={handleBackFromAssignedPractice}
            onSave={() => { }}
            onViewSaved={() => { }}
            assignmentId={appState.assignmentId}
          />
        );
    }
  };

  const getCurrentPage = (): 'new' | 'saved' | 'admin' | 'database' | 'proofreading' | 'spelling' | 'progress' | 'assignments' | 'assignmentManagement' | 'proofreadingAssignments' | 'learningHub' | 'spacedRepetition' => {
    if (appState.page === 'practice' || appState.page === 'publicPractice') {
      return 'saved';
    }
    if (appState.page === 'proofreading') {
      return 'proofreading';
    }
    if (appState.page === 'proofreadingAssignments') {
      return 'proofreadingAssignments';
    }
    if (appState.page === 'spelling') {
      return 'spelling';
    }
    if (appState.page === 'learningHub') {
      return 'learningHub';
    }
    if (appState.page === 'spacedRepetition') {
      return 'spacedRepetition';
    }
    if (appState.page === 'admin') {
      return 'admin';
    }
    if (appState.page === 'database') {
      return 'database';
    }
    if (appState.page === 'progress') {
      return 'progress';
    }
    if (appState.page === 'assignments' || appState.page === 'assignedPractice') {
      return 'assignments';
    }
    if (appState.page === 'assignmentManagement') {
      return 'assignmentManagement';
    }
    return appState.page;
  };

  const getDiagnosticPage = (): string => {
    if (appState.page === 'practice') return 'practice';
    if (appState.page === 'publicPractice') return 'publicPractice';
    if (appState.page === 'assignedPractice') return 'assignedPractice';
    if (appState.page === 'learningHub') return 'learningHub';

    if (appState.page === 'proofreading') {
      return `proofreading-${appState.step}`;
    }

    if (appState.page === 'spelling') {
      return `spelling-${appState.step}`;
    }

    if (appState.page === 'progress') {
      return user?.role === 'admin' ? 'progress-admin' : 'progress';
    }

    return appState.page;
  };

  // State for navigation visibility moved to top to follow Rules of Hooks

  return (
    <>
      <Navigation
        currentPage={getCurrentPage()}
        onPageChange={handlePageChange}
        userRole={user?.role || null}
        onLogin={handleLogin}
        isNavOpen={isNavOpen}
        onToggle={() => setIsNavOpen(!isNavOpen)}
      />
      <main className={`h-screen overflow-y-auto transition-all duration-300 ${isNavOpen ? "ml-0 md:ml-64" : "ml-0 md:ml-20"}`}>
        {renderCurrentView()}
      </main>
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="relative">
            <Login />
          </div>
        </div>
      )}
      <GlobalDiagnosticPanel currentPage={getDiagnosticPage()} />
      <ComponentInspector enabled={showComponentInspector} />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppProviderWrapper />
    </AuthProvider>
  );
}

function AppProviderWrapper() {
  const { user } = useAuth();

  return (
    <AppProvider userId={user?.id}>
      <SpacedRepetitionProvider userId={user?.id}>
        <SourceInspector />
        <AppContent />
      </SpacedRepetitionProvider>
    </AppProvider>
  );
}

export default App;