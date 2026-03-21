import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { DashboardThemeProvider } from './context/DashboardThemeContext';
import { NavigationSettingsProvider, useNavigationSettings } from './context/NavigationSettingsContext';
import { AppProvider, useAppContext } from './context/AppContext';
import { SpacedRepetitionProvider } from './context/SpacedRepetitionContext';
import { SpellingSrsProvider } from './context/SpellingSrsContext';
import { MemoryPalaceProvider, useMemoryPalaceContext } from './contexts/MemoryPalaceContext';
import { useInventory } from './hooks/useInventory';
import SourceInspector from './components/SourceInspector/SourceInspector';
import { UnifiedNavigation } from './components/UnifiedNavigation/UnifiedNavigation';
import { MobileTabBar } from './components/UnifiedNavigation/MobileTabBar';
import { MobileTestEmulator } from './components/debug/MobileTestEmulator';
import UnifiedAssignments from './components/UnifiedAssignments/UnifiedAssignments';
import GlobalDiagnosticPanel from './components/GlobalDiagnosticPanel/GlobalDiagnosticPanel';
import { Login } from './components/Auth/Login';
import { ComponentInspector } from './components/debug/ComponentInspector';
import { ChangePasswordModal } from './components/Auth/ChangePasswordModal';
import { UnifiedMapEditor } from './components/admin/UnifiedMapEditor';
import { FurnitureUploader } from './components/furniture/FurnitureUploader';
import { FurnitureEditor } from './components/editor/FurnitureEditor';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeDesigner } from './components/admin/ThemeDesigner';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage';
import {
  Word,
  MemorizationState,
  ProofreadingAnswer,
  ProofreadingPractice,
  AssignedProofreadingPracticeContent,
  CustomWall,
  CustomFloor,
  PageType
} from './types';

const ExamFormatterPage = lazy(() => import('./modules/exam-formatter/ExamFormatterPage'));

// Regular Component Imports (not lazy)
import TextInput from './components/TextInput/TextInput';
import WordSelection from './components/WordSelection/WordSelection';
import MemorizationView from './components/MemorizationView/MemorizationView';
import SavedContent from './components/SavedContent/SavedContent';
import ShuffledGameView from './components/ShuffledGameView/ShuffledGameView';
import DictationView from './components/MemorizationView/DictationView';
import { ImpersonationBanner } from './components/admin/ImpersonationBanner';
import { X, Volume2, Layers, Gamepad2, Hammer } from 'lucide-react';
import { GroupCompetitionPage } from './pages/GroupCompetitionPage';

type AppState =
  | { page: 'new'; step: 'input'; text?: string }
  | { page: 'new'; step: 'selection'; text: string; words?: Word[] }
  | { page: 'new'; step: 'memorization'; words: Word[]; selectedIndices: number[]; text: string }
  | { page: 'new'; step: 'shuffledGame'; words: Word[]; selectedIndices: number[]; text: string }
  | { page: 'new'; step: 'dictation'; words: Word[]; selectedIndices: number[]; text: string }
  | { page: 'saved' }
  | { page: 'admin' }
  | { page: 'admin' }
  | { page: 'assetGenerator' }
  | { page: 'assetUpload' }
  | { page: 'database' }
  | { page: 'database' }
  | { page: 'practice'; memorizationState: MemorizationState }
  | { page: 'proofreading'; step: 'input' }
  | { page: 'proofreading'; step: 'answerSetting'; sentences: string[]; prefilledAnswers?: ProofreadingAnswer[] }
  | { page: 'proofreading'; step: 'preview'; sentences: string[]; answers: ProofreadingAnswer[] }
  | { page: 'proofreading'; step: 'practice'; sentences: string[]; answers: ProofreadingAnswer[] }
  | { page: 'proofreading'; step: 'saved' }
  | { page: 'proofreading'; step: 'assignment'; practice: ProofreadingPractice }
  | { page: 'proofreading'; step: 'assignedPractice'; assignment: AssignedProofreadingPracticeContent }
  | { page: 'spelling'; step: 'input' }
  | { page: 'spelling'; step: 'preview'; title: string; words: string[]; isPhraseMode?: boolean; practiceId?: string; wordLimit?: number }
  | { page: 'spelling'; step: 'practice'; title: string; words: string[]; isPhraseMode?: boolean; practiceId?: string; assignmentId?: string; level?: number; wordLimit?: number; isSRSReview?: boolean }
  | { page: 'spelling'; step: 'saved' }
  | { page: 'progress' }
  | { page: 'assignments' }
  | { page: 'assignmentManagement' }
  | { page: 'proofreadingAssignments' }
  | { page: 'assignedPractice'; memorizationState: MemorizationState; assignmentId?: string }
  | { page: 'learningHub' }
  | { page: 'spacedRepetition' }
  | { page: 'flowithTest' }
  | { page: 'wordSnake' }
  | { page: 'classDashboard' }
  | { page: 'scanner' }
  | { page: 'phonics'; section: 'wall' | 'blending' | 'games' | 'quiz' | 'builder' }
  | { page: 'notionHub' }
  | { page: 'adminAvatarUploader' }
  | { page: 'avatarBuilder' }
  | { page: 'markerGenerator' }
  | { page: 'interactiveScanner' }
  | { page: 'adminHomeworkRecord' }
  | { page: 'broadcastManagement' }
  | { page: 'adminTimetable' }
  | { page: 'readingComprehension'; practiceId?: string; assignmentId?: string }
  | { page: 'adminAnalytics' }
  | { page: 'groupCompetition' }
  | { page: 'examFormatter' };

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isItemVisible } = useNavigationSettings();
  const [appState, setAppState] = useState<AppState>({ page: 'classDashboard' });

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(true);
  const {
    fetchPublicContent,
    proofreadingPractices,
    deleteProofreadingPractice,
    addSavedContent,
  } = useAppContext();
  const { user, loading, toggleViewMode, isAdmin, isStaff, signOut, isMobileEmulator, setIsMobileEmulator, isUserView } = useAuth();

  // Memory Palace Context Handlers
  const {
    toggleShop,
    toggleStudio,
    toggleEditor,
    toggleUploader,
    toggleMapEditor,
    toggleAssetUpload,
    toggleSpaceDesign,
    toggleThemeDesigner,
    toggleFurniturePanel,
    toggleHistoryPanel,
    toggleMemoryPanel,
    toggleTransformPanel,
    setView,
    uiState,
    uiAssets,
    setUiAssets,
    coins,
    houseLevel,
    setHouseLevel,
    inventory,
    customWalls,
    customFloors,
    activeWallId,
    activeFloorId,
    setActiveWallId,
    setActiveFloorId,
    fullCatalog,
    setCustomCatalog,
    setCustomWalls,
    setCustomFloors,
    fullModels,
  } = useMemoryPalaceContext();
  const { buyItem } = useInventory();
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

  useEffect(() => {
    const handleToggleNav = (e: any) => setIsNavOpen(e.detail);
    window.addEventListener('toggle-navigation', handleToggleNav);
    
    const handleNavigate = () => setAppState({ page: 'spelling', step: 'saved' });
    window.addEventListener('navigate-to-spelling-saved', handleNavigate);

    return () => {
      window.removeEventListener('toggle-navigation', handleToggleNav);
      window.removeEventListener('navigate-to-spelling-saved', handleNavigate);
    };
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
    // Check if we're on the quick-reward route from URL (for initial load)
    const path = window.location.pathname;

    const qrUpMatch = path.match(/^\/qr-up\/dashboard$/);
    if (qrUpMatch) {
      setAppState({ page: 'interactiveScanner' });
      setIsNavOpen(false); // Auto-collapse navigation for QR Up!
      return;
    }

    const handleHashChange = async () => {
      // Unused hash routing removed
    };

    // Check hash on mount
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [fetchPublicContent, location.pathname]);

  // Handle permissions and conditional state updates
  useEffect(() => {
    if (!user || user.role === 'admin') return;

    // Redirect students away from admin-only dashboard (allow isStaff)
    if (appState.page === 'classDashboard' && !isStaff && !new URLSearchParams(window.location.search).get('token')) {
      setAppState({ page: 'new', step: 'input' });
      return;
    }
    if (appState.page === 'proofreading' && !isItemVisible('proofreading')) {
      setAppState({ page: 'new', step: 'input' });
    }

    // Check permissions for spelling
    if (appState.page === 'spelling' && !isItemVisible('spelling')) {
      setAppState({ page: 'new', step: 'input' });
    }

    // Check permissions for learning hub
    if (appState.page === 'learningHub' && !isItemVisible('learningHub')) {
      setAppState({ page: 'new', step: 'input' });
    }

    // Ensure students land on saved practices view when accessing spelling
    if (appState.page === 'spelling' && (appState as any).step === 'input') {
      setAppState({ page: 'spelling', step: 'saved' });
    }
  }, [appState, user]);

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
    appState.page === 'spacedRepetition' ||
    appState.page === 'wordSnake' ||
    appState.page === 'flowithTest' ||
    appState.page === 'adminAnalytics' ||
    (appState.page === 'classDashboard' && !isStaff);

  if (!user && isRestrictedPage) {
    return <Login />;
  }



  if (user?.force_password_change) {
    return <ChangePasswordModal isForced={true} />;
  }

  const handlePageChange = (page: PageType) => {
    // Check if user is trying to access restricted pages without authentication
    if (!user && (page === 'saved' || page === 'admin' || page === 'assetGenerator' || page === 'assetUpload' || page === 'database' || page === 'spelling' || page === 'progress' || page === 'assignments' || page === 'assignmentManagement' || page === 'proofreadingAssignments' || page === 'learningHub' || page === 'spacedRepetition' || page === 'wordSnake' || page === 'classDashboard' || page === 'scanner' || page === 'notionHub' || page === 'phonics' || page === 'adminAvatarUploader' || page === 'avatarBuilder' || page === 'interactiveScanner' || page === 'adminHomeworkRecord' || page === 'broadcastManagement' || page === 'readingComprehension' || page === 'adminTimetable' || page === 'adminAnalytics' || page === 'examFormatter')) {
      setShowLoginModal(true);
      return;
    }

    // Check permissions for proofreading (admins have automatic access)
    if ((page === 'proofreading' || page === 'proofreadingAssignments') && !isItemVisible('proofreading') && user?.role !== 'admin') {
      alert('You do not have permission to access Proofreading Exercise.');
      return;
    }

    // Check permissions for spelling (admins have automatic access)
    if (page === 'spelling' && !isItemVisible('spelling') && user?.role !== 'admin') {
      alert('You do not have permission to access Spelling Practice.');
      return;
    }

    // Check permissions for learning hub (admins have automatic access)
    if (page === 'learningHub' && !isItemVisible('learningHub') && user?.role !== 'admin') {
      alert('You do not have permission to access Learning Hub.');
      return;
    }

    window.location.hash = '';

    // Clear special URL paths when navigating to standard views via state change
    if (window.location.pathname !== '/' && !['interactiveScanner'].includes(page)) {
      navigate('/', { replace: true });
    }

    if (page === 'new') {
      setAppState({ page: 'new', step: 'input' });
    } else if (page === 'saved') {
      setAppState({ page: 'saved' });
    } else if (page === 'admin') {
      setAppState({ page: 'admin' });
    } else if (page === 'assetUpload') {
      setAppState({ page: 'assetUpload' });
    } else if (page === 'database') {
      setAppState({ page: 'database' });
    } else if (page === 'proofreading') {
      // Admins go to input, students go to assignments
      if (isAdmin) {
        setAppState({ page: 'proofreading', step: 'input' });
      } else {
        setAppState({ page: 'proofreadingAssignments' });
      }
    } else if (page === 'spelling') {
      // Students go directly to saved practices, admins go to input
      if (isAdmin) {
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
    } else if (page === 'flowithTest') {
      setAppState({ page: 'flowithTest' });
    } else if (page === 'wordSnake') {
      setAppState({ page: 'wordSnake' });
    } else if (page === 'classDashboard') {
      setAppState({ page: 'classDashboard' });
    } else if (page === 'scanner') {
      setAppState({ page: 'scanner' });
    } else if (page === 'notionHub') {
      setAppState({ page: 'notionHub' });
    } else if (page === 'phonics') {
      setAppState({ page: 'phonics', section: 'wall' });
    } else if (page === 'adminAvatarUploader') {
      setAppState({ page: 'adminAvatarUploader' });
    } else if (page === 'avatarBuilder') {
      setAppState({ page: 'avatarBuilder' });
    } else if (page === 'interactiveScanner') {
      setAppState({ page: 'interactiveScanner' });
      setIsNavOpen(false); // Auto-collapse when opening
    } else if (page === 'adminHomeworkRecord') {
      setAppState({ page: 'adminHomeworkRecord' });
    } else if (page === 'broadcastManagement') {
      setAppState({ page: 'broadcastManagement' });
    } else if (page === 'readingComprehension') {
      setAppState({ page: 'readingComprehension' });
    } else if (page === 'adminTimetable') {
      setAppState({ page: 'adminTimetable' });
    } else if (page === 'adminAnalytics') {
      setAppState({ page: 'adminAnalytics' });
    } else if (page === 'groupCompetition') {
      setAppState({ page: 'groupCompetition' });
    } else if (page === 'examFormatter') {
      setAppState({ page: 'examFormatter' });
    }
  };

  const handleLogin = () => {
    setShowLoginModal(true);
  };

  const handleTextSubmit = (text: string) => {
    setAppState({ page: 'new', step: 'input', text }); // Initialize with text
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

  const handleStartGame = (words: Word[], selectedIndices: number[]) => {
    if (appState.page === 'new' && appState.step === 'selection') {
      setAppState({
        page: 'new',
        step: 'shuffledGame',
        words,
        selectedIndices,
        text: appState.text,
      });
    }
  };

  const handleStartDictation = (words: Word[], selectedIndices: number[]) => {
    if (appState.page === 'new' && appState.step === 'selection') {
      setAppState({
        page: 'new',
        step: 'dictation',
        words,
        selectedIndices,
        text: appState.text,
      });
    }
  };

  const handleSaveDictation = async (_words: Word[], selectedIndices: number[]) => {
    if (!isAdmin) return;

    const title = prompt('Enter a title for this Dictation Practice:');
    if (!title) return;

    try {
      await addSavedContent({
        title,
        originalText: appState.page === 'new' && 'text' in appState ? (appState as any).text : '',
        selectedWordIndices: selectedIndices,
        practiceMode: 'dictation',
        isPublished: false
      });
      alert('Dictation saved successfully!');
      setAppState({ page: 'saved' });
    } catch (error) {
      console.error('Failed to save dictation:', error);
      alert('Failed to save dictation. Please try again.');
    }
  };

  const handleSaveGame = async (_words: Word[], selectedIndices: number[]) => {
    if (!isAdmin) return;

    const title = prompt('Enter a title for this Shuffled Word Game:');
    if (!title) return;

    try {
      await addSavedContent({
        title,
        originalText: appState.page === 'new' && 'text' in appState ? (appState as any).text : '',
        selectedWordIndices: selectedIndices,
        practiceMode: 'shuffledGame',
        isPublished: false
      });
      alert('Game saved successfully!');
      setAppState({ page: 'saved' });
    } catch (error) {
      console.error('Failed to save game:', error);
      alert('Failed to save game. Please try again.');
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
    if (appState.page === 'new' && (appState.step === 'memorization' || appState.step === 'shuffledGame' || appState.step === 'dictation')) {
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

  const handleProofreadingSentencesSubmit = (sentences: string[], prefilledAnswers?: ProofreadingAnswer[]) => {
    setAppState({ page: 'proofreading', step: 'answerSetting', sentences, prefilledAnswers });
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
    if (isAdmin) {
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

  const handleSpellingWordsSubmit = (title: string, words: string[], isPhraseMode?: boolean, wordLimit?: number) => {
    setAppState({ page: 'spelling', step: 'preview', title, words, isPhraseMode, wordLimit });
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
        ...appState,
        step: 'practice',
        wordLimit: (appState as any).wordLimit
      });
    }
  };

  const handleBackToSpellingInput = () => {
    setAppState({ page: 'spelling', step: 'input' });
  };

  const handleApplySystemStyle = (style: any) => {
    if (style.type === 'wall') {
      const wallObj: CustomWall = {
        id: style.id,
        name: style.name,
        color: style.color_hex,
        price: style.price
      };

      // Ensure it's in customWalls before applying
      if (!customWalls.some((w: any) => w.id === style.id)) {
        setCustomWalls((prev: any) => [...prev, wallObj]);
      }
      setActiveWallId(style.id);
    } else {
      const floorObj: CustomFloor = {
        id: style.id,
        name: style.name,
        color: style.color_hex,
        price: style.price
      };

      // Ensure it's in customFloors before applying
      if (!customFloors.some((f: any) => f.id === style.id)) {
        setCustomFloors((prev: any) => [...prev, floorObj]);
      }
      setActiveFloorId(style.id);
    }
  };

  const handleBackToSpellingPreview = () => {
    if (appState.page === 'spelling' && appState.step === 'practice') {
      // Students go back to saved practices list, admins go to preview
      if (isAdmin) {
        setAppState({ page: 'spelling', step: 'preview', title: appState.title, words: appState.words, wordLimit: (appState as any).wordLimit });
      } else {
        setAppState({ page: 'spelling', step: 'saved' });
      }
    }
  };

  const renderCurrentView = () => {
    return (
      <Suspense fallback={<PageLoader />}>
        {(() => {
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
                      onStartGame={handleStartGame}
                      onSaveGame={handleSaveGame}
                      onStartDictation={handleStartDictation}
                      onSaveDictation={handleSaveDictation}
                      isAdmin={isAdmin}
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
                case 'shuffledGame':
                  return (
                    <ShuffledGameView
                      words={(appState as any).words}
                      onBack={handleBackToSelection}
                      onSaveGame={isAdmin ? () => handleSaveGame((appState as any).words, (appState as any).selectedIndices) : undefined}
                    />
                  );
                case 'dictation':
                  return (
                    <DictationView
                      words={(appState as any).words}
                      selectedIndices={(appState as any).selectedIndices}
                      originalText={(appState as any).text}
                      onBack={handleBackToSelection}
                    />
                  );
              }
              break;
            case 'saved':
              return <SavedContent onLoadContent={handleLoadContent} onCreateNew={handleCreateNewMemorization} />;
            case 'admin':
              return <AdminPanel
                onNavigateToAssets={() => setAppState({ page: 'assetUpload' })}
                onOpenMapEditor={toggleMapEditor}
                onNavigateToAvatarUploader={() => setAppState({ page: 'adminAvatarUploader' })}
                onNavigateToAvatarBuilder={() => setAppState({ page: 'avatarBuilder' })}
                onNavigateToMarkerGenerator={() => setAppState({ page: 'markerGenerator' })}
              />;
            case 'interactiveScanner':
              return <InteractiveScanQuizPage />;
            case 'groupCompetition':
              return <GroupCompetitionPage />;
            case 'markerGenerator':
              return <MarkerGenerator onBack={() => setAppState({ page: 'admin' })} />;
            case 'assetUpload':
              return (
                <div className="h-full bg-background p-4 md:p-8 flex flex-col overflow-hidden">
                  <div className="max-w-7xl mx-auto w-full h-full flex flex-col gap-4">
                    <div className="flex items-center justify-between shrink-0">
                      <h1 className="text-2xl font-bold">Asset Management Center</h1>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setAppState({ page: 'assetGenerator' })}
                          className="px-4 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
                        >
                          Switch to AI Generator
                        </button>
                        <button
                          onClick={() => setAppState({ page: 'admin' })}
                          className="px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
                        >
                          Back to Admin
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 min-h-0 border rounded-lg shadow-sm overflow-hidden bg-white">
                      <AssetUploadCenter
                        assets={uiAssets}
                        onAddAsset={(asset) => setUiAssets(prev => [...prev, asset])}
                        onRemoveAsset={(id) => setUiAssets(prev => prev.filter(a => a.id !== id))}
                      />
                    </div>
                  </div>
                </div>
              );
            case 'assetGenerator':
              return <AssetGenerator />;
            case 'database':
              return <ContentDatabase />;
            case 'examFormatter':
              return <ExamFormatterPage />;
            case 'practice':
              if (appState.memorizationState.practiceMode === 'shuffledGame') {
                return (
                  <ShuffledGameView
                    words={appState.memorizationState.words}
                    onBack={handleBackFromPractice}
                    isPractice={true}
                  />
                );
              }
              if (appState.memorizationState.practiceMode === 'dictation') {
                return (
                  <DictationView
                    words={appState.memorizationState.words}
                    selectedIndices={appState.memorizationState.selectedWordIndices}
                    originalText={appState.memorizationState.originalText}
                    onBack={handleBackFromPractice}
                    isPractice={true}
                  />
                );
              }
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
            case 'proofreading':
              switch (appState.step) {
                case 'input':
                  return <ProofreadingInput onNext={handleProofreadingSentencesSubmit} onViewSaved={isAdmin ? handleViewSavedProofreading : undefined} />;
                case 'answerSetting':
                  return (
                    <ProofreadingAnswerSetting
                      sentences={appState.sentences}
                      prefilledAnswers={appState.prefilledAnswers}
                      onNext={handleProofreadingAnswersSet}
                      onBack={handleBackToProofreadingInput}
                      onViewSaved={isAdmin ? handleViewSavedProofreading : undefined}
                    />
                  );
                case 'preview':
                  return (
                    <ProofreadingPreview
                      sentences={appState.sentences}
                      answers={appState.answers}
                      onNext={handleProofreadingPreviewNext}
                      onBack={handleBackToAnswerSetting}
                      onViewSaved={isAdmin ? handleViewSavedProofreading : undefined}
                    />
                  );
                case 'practice':
                  return (
                    <ProofreadingPracticeComponent
                      sentences={appState.sentences}
                      answers={appState.answers}
                      onBack={handleBackToProofreadingPreview}
                      onViewSaved={isAdmin ? handleViewSavedProofreading : undefined}
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
                      onViewSaved={isAdmin ? handleViewSavedSpelling : undefined}
                    />
                  );
                case 'preview':
                  return (
                    <SpellingPreview
                      title={appState.title}
                      words={appState.words}
                      isPhraseMode={appState.isPhraseMode}
                      onNext={handleSpellingPreviewNext}
                      onBack={handleBackToSpellingInput}
                      onSave={isAdmin ? handleViewSavedSpelling : undefined}
                      onViewSaved={isAdmin ? handleViewSavedSpelling : undefined}
                      wordLimit={(appState as any).wordLimit}
                    />
                  );
                case 'practice':
                  return (
                    <SpellingPractice
                      title={appState.title}
                      words={appState.words}
                      isPhraseMode={appState.isPhraseMode}
                      practiceId={appState.practiceId}
                      assignmentId={appState.assignmentId}
                      initialLevel={appState.level}
                      onBack={handleBackToSpellingPreview}
                      wordLimit={(appState as any).wordLimit}
                      isSRSReview={(appState as any).isSRSReview}
                    />
                  );
                case 'saved':
                  return (
                    <SavedPractices
                      onCreateNew={handleBackToSpellingCreate}
                      onSelectPractice={(practice) => {
                        // Students go directly to practice, admins can preview
                        if (isAdmin) {
                          setAppState({
                            page: 'spelling',
                            step: 'preview',
                            title: practice.title,
                            words: practice.words,
                            practiceId: practice.id,
                            wordLimit: (practice as any).metadata?.wordLimit
                          });
                        } else {
                          setAppState({
                            page: 'spelling',
                            step: 'practice',
                            title: practice.title,
                            words: practice.words,
                            practiceId: practice.id,
                            assignmentId: practice.assignment_id,
                            level: practice.level,
                            wordLimit: (practice as any).metadata?.wordLimit,
                            isSRSReview: practice.id === 'srs-review'
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
                          wordLimit: (practice as any).metadata?.wordLimit,
                          isSRSReview: practice.id === 'srs-review'
                        });
                      }}
                    />
                  );
              }
              break;
            case 'progress':
              return isAdmin ? <UserAnalytics /> : <StudentProgress />;
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
                      level: practice.level,
                    });
                  }}
                  onLoadProofreading={handleLoadAssignedProofreadingPractice}
                  onLoadSpacedRepetition={() => {
                    setAppState({
                      page: 'spacedRepetition'
                    });
                  }}
                  onLoadReading={(assignment) => {
                    setAppState({
                      page: 'readingComprehension',
                      practiceId: assignment.content_data.practice_id,
                      assignmentId: assignment.assignment_id,
                    });
                  }}
                />
              );
            case 'assignmentManagement':
              return <AssignmentManagement />;
            case 'proofreadingAssignments':
              return <AssignedProofreadingPractices onLoadContent={handleLoadAssignedProofreadingPractice} />;
            case 'adminAvatarUploader':
              return <AdminAssetUploader />;
            case 'avatarBuilder':
              return <AvatarBuilderPage />;
            case 'learningHub':
              return (
                <MemoryPalacePage onExit={() => setAppState({ page: 'new', step: 'input' })} />
              );
            case 'spacedRepetition':
              return <SpacedRepetitionPage />;
            case 'assignedPractice':
              if (appState.memorizationState.practiceMode === 'shuffledGame') {
                return (
                  <ShuffledGameView
                    words={appState.memorizationState.words}
                    onBack={handleBackFromAssignedPractice}
                    isPractice={true}
                  />
                );
              }
              if (appState.memorizationState.practiceMode === 'dictation') {
                return (
                  <DictationView
                    words={appState.memorizationState.words}
                    selectedIndices={appState.memorizationState.selectedWordIndices}
                    originalText={appState.memorizationState.originalText}
                    onBack={handleBackFromAssignedPractice}
                    assignmentId={appState.assignmentId}
                  />
                );
              }
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
            case 'flowithTest':
              return <FlowithTestPage />;
            case 'adminAnalytics':
              return <AdminAnalyticsPage />;
            case 'wordSnake':
              return <IPadInteractiveZone />;
            case 'classDashboard':
              return <ClassDashboardPage />;
            case 'scanner':
              return <QRScannerPage />;
            case 'notionHub':
              return <NotionHub />;
            case 'phonics':
              return (
                <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-amber-100 font-fredoka">
                  <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="bg-white/80 backdrop-blur-md rounded-2xl p-2 shadow-sm mb-6 flex flex-wrap gap-2">
                      {[
                        { id: 'wall', label: 'Sound Wall', icon: Volume2 },
                        { id: 'blending', label: 'Blending Board', icon: Layers },
                        { id: 'quiz', label: 'Quiz & Games', icon: Gamepad2 },
                        { id: 'builder', label: 'Word Builder', icon: Hammer },
                      ].map((tab) => {
                        const isActive = appState.section === tab.id;
                        const Icon = tab.icon;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setAppState({ page: 'phonics', section: tab.id as any })}
                            className={`
                              flex items-center gap-2 px-4 py-3 rounded-xl transition-all duration-200
                              font-medium text-sm sm:text-base flex-1 sm:flex-none justify-center
                              ${isActive
                                ? 'bg-amber-500 text-white shadow-md transform scale-105'
                                : 'text-amber-700 hover:bg-amber-100'
                              }
                            `}
                          >
                            <Icon className={`w-5 h-5 ${isActive ? 'animate-bounce' : ''}`} />
                            <span>{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                      {appState.section === 'wall' && <PhonicsSoundWall />}
                      {appState.section === 'blending' && <BlendingBoard />}
                      {appState.section === 'quiz' && <PhonicsQuiz />}
                      {appState.section === 'builder' && <WordBuilder />}
                    </div>
                  </div>
                </div>
              );
            case 'adminHomeworkRecord':
              return <AdminHomeworkRecordPage />;
            case 'adminTimetable':
              return <AdminTimetablePage />;
            case 'broadcastManagement':
              return <BroadcastManagementPage />;
            case 'readingComprehension':
              return isAdmin && !isUserView ? (
                <ReadingManagementPage />
              ) : (
                <ReadingLearningPage 
                  practiceId={appState.page === 'readingComprehension' ? appState.practiceId : undefined}
                  assignmentId={appState.page === 'readingComprehension' ? appState.assignmentId : undefined}
                />
              );
          }
        })()}
      </Suspense>
    );
  };

  const getCurrentPage = () => {
    if (appState.page === 'practice') {
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
    if (appState.page === 'phonics') {
      return 'phonics';
    }
    if (appState.page === 'spacedRepetition') {
      return 'spacedRepetition';
    }
    if (appState.page === 'admin' || appState.page === 'markerGenerator') {
      return 'admin';
    }
    if (appState.page === 'assetGenerator') {
      return 'assetGenerator';
    }
    if (appState.page === 'assetUpload') {
      return 'assetUpload';
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
    if (appState.page === 'readingComprehension') {
      return 'readingComprehension';
    }
    return appState.page;
  };

  const getDiagnosticPage = (): string => {
    if (appState.page === 'practice') return 'practice';
    if (appState.page === 'assignedPractice') return 'assignedPractice';
    if (appState.page === 'learningHub') return 'learningHub';

    if (appState.page === 'proofreading') {
      return `proofreading-${appState.step}`;
    }

    if (appState.page === 'spelling') {
      return `spelling-${appState.step}`;
    }

    if (appState.page === 'progress') {
      return isAdmin ? 'progress-admin' : 'progress';
    }

    return appState.page;
  };

  // State for navigation visibility moved to top to follow Rules of Hooks

  return (
    <MobileTestEmulator isActive={isMobileEmulator} onExit={() => setIsMobileEmulator(false)}>
      <div className="flex h-screen overflow-hidden bg-background">
        {!['scanner'].includes(appState.page) && !(appState.page === 'classDashboard' && new URLSearchParams(window.location.search).get('token')) && (
          <UnifiedNavigation
            currentPage={getCurrentPage()}
            onPageChange={handlePageChange}
            onLogin={handleLogin}
            isNavOpen={isNavOpen}
            onToggle={() => setIsNavOpen(!isNavOpen)}
            // Memory Palace Handlers
            onShop={toggleShop}
            onCity={() => setView('map')}
            onRegion={() => setView('region')}
            onOpenStudio={toggleStudio}
            onOpenUploader={toggleUploader}
            onOpenEditor={toggleEditor}
            onOpenSpaceDesign={toggleSpaceDesign}
            onOpenThemeDesigner={toggleThemeDesigner}
            onOpenMapEditor={toggleMapEditor}
            onOpenAssetUpload={toggleAssetUpload}
            onOpenFurniture={toggleFurniturePanel}
            onOpenHistory={toggleHistoryPanel}
            onOpenMemory={toggleMemoryPanel}
          />
        )}
        {!['scanner'].includes(appState.page) && !(appState.page === 'classDashboard' && new URLSearchParams(window.location.search).get('token')) && (
          <MobileTabBar
            currentPage={getCurrentPage()}
            onPageChange={handlePageChange}
            isAdmin={isAdmin}
            onLogin={handleLogin}
            onSignOut={signOut}
            userName={user?.display_name || user?.username}
            userRole={user?.role}
            onShop={toggleShop}
            onCity={() => setView('map')}
            onRegion={() => setView('region')}
            onOpenStudio={toggleStudio}
            onOpenUploader={toggleUploader}
            onOpenEditor={toggleEditor}
            onOpenSpaceDesign={toggleSpaceDesign}
            onOpenThemeDesigner={toggleThemeDesigner}
            onOpenMapEditor={toggleMapEditor}
            onOpenAssetUpload={toggleAssetUpload}
            onOpenFurniture={toggleFurniturePanel}
            onOpenHistory={toggleHistoryPanel}
            onOpenMemory={toggleMemoryPanel}
          />
        )}
        <main
          className={`h-screen overflow-y-auto transition-all duration-300 pb-16 md:pb-0 flex-1 w-full ${isMobileEmulator ? "ml-0" : (['scanner'].includes(appState.page) || (appState.page === 'classDashboard' && new URLSearchParams(window.location.search).get('token'))) ? "" : (isNavOpen ? "ml-0 md:ml-64" : "ml-0 md:ml-20")}`}
          style={{
            '--nav-width': isMobileEmulator || ['scanner'].includes(appState.page) || (appState.page === 'classDashboard' && new URLSearchParams(window.location.search).get('token'))
              ? '0px'
              : isNavOpen
                ? '256px' // w-64
                : (window.innerWidth >= 768 ? '80px' : '0px') // w-20 or 0
          } as React.CSSProperties}
        >
          <ErrorBoundary>
            {renderCurrentView()}
          </ErrorBoundary>
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
        <UnifiedMapEditor
          isOpen={uiState.showMapEditor}
          onClose={toggleMapEditor}
        />

        {uiState.showShop && (
          <ShopView
            coins={coins}
            inventory={inventory}
            houseLevel={houseLevel}
            onBuy={buyItem as any}
            onUpgrade={() => setHouseLevel((h: number) => h + 1)}
            onClose={toggleShop}
            isAdmin={isAdmin}
            customWalls={customWalls as any}
            customFloors={customFloors as any}
            activeWallId={activeWallId}
            activeFloorId={activeFloorId}
            onSelectWall={setActiveWallId}
            onSelectFloor={setActiveFloorId}
            fullCatalog={fullCatalog as any}
            publishedBlueprints={[]}
            ownedBlueprints={[]}
            onBuyBlueprint={() => { }}
            onApplyBlueprint={() => { }}
            onApplySystemStyle={handleApplySystemStyle}
          />
        )}

        {uiState.showSpaceDesign && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full h-full bg-white flex flex-col">
              <SpaceDesignCenter
                onClose={toggleSpaceDesign}
                fullCatalog={fullCatalog as any[]}
                activeWall={customWalls.find((w: any) => w.id === activeWallId) || null}
                activeFloor={customFloors.find((f: any) => f.id === activeFloorId) || null}
                customWalls={customWalls as any[]}
                customFloors={customFloors as any[]}
                activeWallId={activeWallId}
                activeFloorId={activeFloorId}
                onSelectWall={setActiveWallId}
                onSelectFloor={setActiveFloorId}
              />
            </div>
          </div>
        )}

        {uiState.showAssetUpload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] overflow-hidden">
              <div className="h-full flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                  <h3 className="font-bold text-xl">素材上傳中心</h3>
                  <button onClick={toggleAssetUpload} className="p-2 hover:bg-slate-200 rounded-full">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="flex-1 overflow-auto">
                  <AssetUploadCenter
                    assets={uiAssets}
                    onAddAsset={(asset) => setUiAssets(prev => [...prev, asset])}
                    onRemoveAsset={(id) => setUiAssets(prev => prev.filter(a => a.id !== id))}
                  />
                </div>
              </div>
            </div>
          </div>
        )}



        {uiState.showThemeDesigner && (
          <div className="fixed inset-0 z-50 flex bg-background/80 backdrop-blur-sm">
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
              <ThemeDesigner onClose={toggleThemeDesigner} />
            </div>
          </div>
        )}

        {uiState.showUploader && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] overflow-hidden flex flex-col">
              <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-xl">家具上傳中心</h3>
                <button onClick={toggleUploader} className="p-2 hover:bg-slate-200 rounded-full text-slate-500">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <FurnitureUploader
                  onClose={toggleUploader}
                  onSave={() => toggleUploader()}
                />
              </div>
            </div>
          </div>
        )}

        {uiState.showEditor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col">
              <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-xl">資產編輯器</h3>
                <button onClick={toggleEditor} className="p-2 hover:bg-slate-200 rounded-full text-slate-500">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <FurnitureEditor
                  onClose={toggleEditor}
                  customCatalog={fullCatalog as any[]}
                  onUpdate={(updated) => setCustomCatalog((prev: any[]) => prev.map(i => i.id === updated.id ? updated : i))}
                  onDelete={(id) => setCustomCatalog((prev: any[]) => prev.filter(i => i.id !== id))}
                  customWalls={customWalls as any[]}
                  customFloors={customFloors as any[]}
                  onUpdateWall={() => { }}
                  onUpdateFloor={() => { }}
                  onDeleteWall={() => { }}
                  onDeleteFloor={() => { }}
                  onEnterTransformMode={(id) => toggleTransformPanel(id)}
                  customModels={fullModels}
                />
              </div>
            </div>
          </div>
        )}

        {uiState.showTransformPanel && uiState.transformTargetId && (() => {
          const targetItem = fullCatalog.find((f: any) => f.id === uiState.transformTargetId);
          if (!targetItem) return null;
          return (
            <div className="fixed inset-0 z-[60] flex">
              <TransformPanel
                furnitureName={targetItem.name || '未命名家具'}
                furnitureImage={targetItem.spriteImages?.[0] || undefined}
                data={{
                  spriteOffsetX: targetItem.spriteOffsetX ?? 0,
                  spriteOffsetY: targetItem.spriteOffsetY ?? 20,
                  spriteScale: targetItem.spriteScale ?? 1,
                  spriteScaleX: targetItem.spriteScaleX ?? 100,
                  spriteScaleY: targetItem.spriteScaleY ?? 100,
                  spriteSkewX: targetItem.spriteSkewX ?? 0,
                  spriteSkewY: targetItem.spriteSkewY ?? 0,
                }}
                onChange={(changes) => {
                  setCustomCatalog((prev: any[]) =>
                    prev.map((item) =>
                      item.id === uiState.transformTargetId ? { ...item, ...changes } : item
                    )
                  );
                }}
                onSave={() => toggleTransformPanel(null)}
                onCancel={() => toggleTransformPanel(null)}
                onReset={() => { }}
              />
            </div>
          );
        })()}
      </div>
    </MobileTestEmulator>
  );
}

// Lazy load standalone pages
const QRScannerPage = lazy(() => import('./pages/QRScannerPage.tsx'));
const AdminUIBuilderPage = lazy(() => import('./pages/AdminUIBuilderPage.tsx'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage.tsx').then(m => ({ default: m.AdminUsersPage })));
const AdminStudentLevelsPage = lazy(() => import('./pages/AdminStudentLevelsPage.tsx').then(m => ({ default: m.AdminStudentLevelsPage })));
const NavigationManagementPage = lazy(() => import('./pages/admin/NavigationManagementPage'));
const AdminGroupsPage = lazy(() => import('./pages/AdminGroupsPage.tsx').then(m => ({ default: m.AdminGroupsPage })));
const AuditLogsPage = lazy(() => import('./pages/admin/AuditLogsPage').then(m => ({ default: m.AuditLogsPage })));
const SuperAdminPanel = lazy(() => import('./pages/SuperAdminPanel.tsx').then(m => ({ default: m.SuperAdminPanel })));
const AdminProgressPage = lazy(() => import('./pages/AdminProgressPage.tsx').then(m => ({ default: m.AdminProgressPage })));
const InteractiveScanQuizPage = lazy(() => import('./pages/InteractiveScanQuizPage').then(module => ({ default: module.InteractiveScanQuizPage })));
const AdminCityEditorPage = lazy(() => import('./pages/AdminCityEditorPage.tsx'));
const AdminHomeworkRecordPage = lazy(() => import('./pages/AdminHomeworkRecordPage.tsx'));
const AdminTimetablePage = lazy(() => import('./pages/AdminTimetablePage.tsx'));
const RegionPage = lazy(() => import('./pages/RegionPage.tsx'));
const PhonicsLayout = lazy(() => import('./components/phonics/PhonicsLayout.tsx').then(m => ({ default: m.PhonicsLayout })));
const PhonicsSoundWall = lazy(() => import('./pages/PhonicsSoundWall.tsx').then(m => ({ default: m.PhonicsSoundWall })));
const BlendingBoard = lazy(() => import('./components/phonics/BlendingBoard.tsx').then(m => ({ default: m.BlendingBoard })));
const PhonicsGameHub = lazy(() => import('./components/phonics/PhonicsGameHub.tsx').then(m => ({ default: m.PhonicsGameHub })));
const PhonicsQuiz = lazy(() => import('./components/phonics/PhonicsQuiz.tsx').then(m => ({ default: m.PhonicsQuiz })));
const WordBuilder = lazy(() => import('./components/phonics/WordBuilder.tsx').then(m => ({ default: m.WordBuilder })));
const CodebaseManifestPage = lazy(() => import('./pages/CodebaseManifestPage.tsx'));
const BroadcastManagementPage = lazy(() => import('./pages/admin/BroadcastManagementPage.tsx'));
const ReadingManagementPage = lazy(() => import('./pages/admin/ReadingManagementPage.tsx'));
const ReadingLearningPage = lazy(() => import('./pages/student/ReadingLearningPage.tsx').then(m => ({ default: m.ReadingLearningPage })));

const SpacedRepetitionPage = lazy(() => import('./components/SpacedRepetition/SpacedRepetitionPage').then(m => ({ default: m.SpacedRepetitionPage })));
const NotionHub = lazy(() => import('./components/NotionHub/NotionHub').then(m => ({ default: m.NotionHub })));
const MemoryPalacePage = lazy(() => import('./pages/MemoryPalacePage').then(m => ({ default: m.MemoryPalacePage })));
const FlowithTestPage = lazy(() => import('./pages/FlowithTestPage').then(m => ({ default: m.FlowithTestPage })));
const IPadInteractiveZone = lazy(() => import('./pages/IPadInteractiveZone').then(m => ({ default: m.IPadInteractiveZone })));
const ClassDashboardPage = lazy(() => import('./pages/ClassDashboardPage').then(m => ({ default: m.ClassDashboardPage })));

const AdminPanel = lazy(() => import('./components/AdminPanel/AdminPanel'));
const ContentDatabase = lazy(() => import('./components/ContentDatabase/ContentDatabase'));
const ProofreadingInput = lazy(() => import('./components/ProofreadingInput/ProofreadingInput'));
const ProofreadingAnswerSetting = lazy(() => import('./components/ProofreadingAnswerSetting/ProofreadingAnswerSetting'));
const ProofreadingPreview = lazy(() => import('./components/ProofreadingPreview/ProofreadingPreview'));
const ProofreadingPracticeComponent = lazy(() => import('./components/ProofreadingPractice/ProofreadingPractice'));
const SavedProofreadingPractices = lazy(() => import('./components/SavedProofreadingPractices/SavedProofreadingPractices'));
const ProofreadingAssignment = lazy(() => import('./components/ProofreadingAssignment/ProofreadingAssignment'));
const AssignedProofreadingPractices = lazy(() => import('./components/AssignedProofreadingPractices/AssignedProofreadingPractices'));
const SpellingInput = lazy(() => import('./components/SpellingInput/SpellingInput'));
const SpellingPreview = lazy(() => import('./components/SpellingPreview/SpellingPreview'));
const SpellingPractice = lazy(() => import('./components/SpellingPractice/SpellingPractice'));
const SavedPractices = lazy(() => import('./components/SavedPractices/SavedPractices'));
const StudentProgress = lazy(() => import('./components/StudentProgress/StudentProgress'));
const UserAnalytics = lazy(() => import('./components/UserAnalytics/UserAnalytics'));
const AssignmentManagement = lazy(() => import('./components/AssignmentManagement/AssignmentManagement'));
const AssetGenerator = lazy(() => import('./components/admin/AssetGenerator').then(m => ({ default: m.AssetGenerator })));
const AdminAssetUploader = lazy(() => import('./components/admin/AdminAssetUploader').then(m => ({ default: m.AdminAssetUploader })));
const AvatarBuilderPage = lazy(() => import('./components/avatar/AvatarBuilderPage').then(m => ({ default: m.AvatarBuilderPage })));
const ShopView = lazy(() => import('./components/shop/ShopView').then(m => ({ default: m.ShopView })));
const SpaceDesignCenter = lazy(() => import('./components/SpaceDesignCenter').then(m => ({ default: m.SpaceDesignCenter })));
const AssetUploadCenter = lazy(() => import('./components/ui-builder/AssetUploadCenter').then(m => ({ default: m.AssetUploadCenter })));
const TransformPanel = lazy(() => import('./components/TransformPanel').then(m => ({ default: m.TransformPanel })));
const MarkerGenerator = lazy(() => import('./components/admin/MarkerGenerator').then(m => ({ default: m.MarkerGenerator })));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="text-gray-600 text-lg">Loading...</div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <DashboardThemeProvider>
          <NavigationSettingsProvider>
            <AppRoutes />
          </NavigationSettingsProvider>
        </DashboardThemeProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

function AppRoutes() {
  const { isImpersonating, user, setImpersonatedAdminId } = useAuth();

  return (
    <div className="min-h-screen flex flex-col overflow-hidden">
      {isImpersonating && (
        <ImpersonationBanner
          name={user?.display_name || user?.username || 'Admin'}
          onExit={() => setImpersonatedAdminId(null)}
        />
      )}
      <div className="flex-1 overflow-hidden relative">
        <Routes>
          <Route
            path="/admin/ui-builder"
            element={
              <Suspense fallback={<PageLoader />}>
                <AdminUIBuilderPage />
              </Suspense>
            }
          />
          <Route
            path="/admin/users"
            element={
              <Suspense fallback={<PageLoader />}>
                <AdminUsersPage />
              </Suspense>
            }
          />
          <Route
            path="/admin/student-levels"
            element={
              <Suspense fallback={<PageLoader />}>
                <AdminStudentLevelsPage />
              </Suspense>
            }
          />
          <Route
            path="/admin/audit-logs"
            element={
              <Suspense fallback={<PageLoader />}>
                <AuditLogsPage />
              </Suspense>
            }
          />
          <Route
            path="/admin/groups"
            element={
              <Suspense fallback={<PageLoader />}>
                <AdminGroupsPage />
              </Suspense>
            }
          />
          <Route
            path="/admin/super-admin-panel"
            element={
              <Suspense fallback={<PageLoader />}>
                <SuperAdminPanel />
              </Suspense>
            }
          />
          <Route
            path="/admin/navigation"
            element={
              <Suspense fallback={<PageLoader />}>
                <NavigationManagementPage />
              </Suspense>
            }
          />
          <Route
            path="/admin/manifest"
            element={
              <Suspense fallback={<PageLoader />}>
                <CodebaseManifestPage />
              </Suspense>
            }
          />
          <Route
            path="/admin/scanner"
            element={
              <Suspense fallback={<PageLoader />}>
                <QRScannerPage />
              </Suspense>
            }
          />
          <Route
            path="/admin/marker-generator"
            element={
              <Suspense fallback={<PageLoader />}>
                <MarkerGenerator onBack={() => window.history.back()} />
              </Suspense>
            }
          />
          <Route
            path="/admin/progress"
            element={
              <Suspense fallback={<PageLoader />}>
                <AdminProgressPage />
              </Suspense>
            }
          />
          <Route
            path="/admin/city-editor"
            element={
              <Suspense fallback={<PageLoader />}>
                <AdminCityEditorPage />
              </Suspense>
            }
          />
          <Route
            path="/admin/homework-record"
            element={
              <Suspense fallback={<PageLoader />}>
                <AdminHomeworkRecordPage />
              </Suspense>
            }
          />
          <Route
            path="/admin/broadcast"
            element={
              <Suspense fallback={<PageLoader />}>
                <BroadcastManagementPage />
              </Suspense>
            }
          />
          <Route
            path="/admin/timetable"
            element={
              <Suspense fallback={<PageLoader />}>
                <AdminTimetablePage />
              </Suspense>
            }
          />
          <Route
            path="/region"
            element={
              <Suspense fallback={<PageLoader />}>
                <RegionPage />
              </Suspense>
            }
          />
          <Route
            path="/phonics"
            element={
              <Suspense fallback={<PageLoader />}>
                <PhonicsLayout />
              </Suspense>
            }
          >
            <Route index element={<PhonicsSoundWall />} />
            <Route path="wall" element={<PhonicsSoundWall />} />
            <Route path="blending" element={<BlendingBoard />} />
            <Route path="games" element={<PhonicsGameHub />} />
            <Route path="quiz" element={<PhonicsQuiz />} />
            <Route path="builder" element={<WordBuilder />} />
          </Route>
          <Route path="*" element={<AppProviderWrapper />} />
        </Routes>
      </div>
    </div>
  );
}

function AppProviderWrapper() {
  const { user } = useAuth();

  return (
    <AppProvider userId={user?.id}>
      <SpacedRepetitionProvider userId={user?.id}>
        <SpellingSrsProvider>
          <MemoryPalaceProvider>
            <SourceInspector />
            <AppContent />
          </MemoryPalaceProvider>
        </SpellingSrsProvider>
      </SpacedRepetitionProvider>
    </AppProvider>
  );
}

export default App;