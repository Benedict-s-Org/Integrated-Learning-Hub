import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppProvider, useAppContext } from './context/AppContext';
import { SpacedRepetitionProvider } from './context/SpacedRepetitionContext';
import { MemoryPalaceProvider, useMemoryPalaceContext } from './contexts/MemoryPalaceContext';
import { useInventory } from './hooks/useInventory';
import SourceInspector from './components/SourceInspector/SourceInspector';
import { UnifiedNavigation } from './components/UnifiedNavigation/UnifiedNavigation';
import UnifiedAssignments from './components/UnifiedAssignments/UnifiedAssignments';
import GlobalDiagnosticPanel from './components/GlobalDiagnosticPanel/GlobalDiagnosticPanel';
import { SpacedRepetitionPage } from './components/SpacedRepetition/SpacedRepetitionPage';
import { Login } from './components/Auth/Login';
import { NotionHub } from './components/NotionHub/NotionHub';
import { ComponentInspector } from './components/debug/ComponentInspector';
import { ChangePasswordModal } from './components/Auth/ChangePasswordModal';
import { MemoryPalacePage } from './pages/MemoryPalacePage';
import { FlowithTestPage } from './pages/FlowithTestPage';
import { WordSnakeGame } from './pages/WordSnakeGame';
import { ClassDashboardPage } from './pages/ClassDashboardPage';
import { QuickRewardPage } from './pages/QuickRewardPage';
import { PendingRewardsModal } from './components/admin/PendingRewardsModal';
import { supabase } from '@/integrations/supabase/client';
import {
  Word,
  MemorizationState,
  ProofreadingAnswer,
  ProofreadingPractice,
  AssignedProofreadingPracticeContent
} from './types';

// Regular Component Imports (not lazy)
import TextInput from './components/TextInput/TextInput';
import WordSelection from './components/WordSelection/WordSelection';
import MemorizationView from './components/MemorizationView/MemorizationView';
import SavedContent from './components/SavedContent/SavedContent';
import AdminPanel from './components/AdminPanel/AdminPanel';
import ContentDatabase from './components/ContentDatabase/ContentDatabase';
import ProofreadingInput from './components/ProofreadingInput/ProofreadingInput';
import ProofreadingAnswerSetting from './components/ProofreadingAnswerSetting/ProofreadingAnswerSetting';
import ProofreadingPreview from './components/ProofreadingPreview/ProofreadingPreview';
import ProofreadingPracticeComponent from './components/ProofreadingPractice/ProofreadingPractice';
import SavedProofreadingPractices from './components/SavedProofreadingPractices/SavedProofreadingPractices';
import ProofreadingAssignment from './components/ProofreadingAssignment/ProofreadingAssignment';
import AssignedProofreadingPractices from './components/AssignedProofreadingPractices/AssignedProofreadingPractices';
import SpellingInput from './components/SpellingInput/SpellingInput';
import SpellingPreview from './components/SpellingPreview/SpellingPreview';
import SpellingPractice from './components/SpellingPractice/SpellingPractice';
import SavedPractices from './components/SavedPractices/SavedPractices';
import StudentProgress from './components/StudentProgress/StudentProgress';
import UserAnalytics from './components/UserAnalytics/UserAnalytics';
import AssignmentManagement from './components/AssignmentManagement/AssignmentManagement';
import { AssetGenerator } from './components/admin/AssetGenerator';
import { UnifiedMapEditor } from './components/admin/UnifiedMapEditor';
import { ShopView } from './components/shop/ShopView';
import { SpaceDesignCenter } from './components/SpaceDesignCenter';
import { FurnitureUploader } from './components/furniture/FurnitureUploader';
import { FurnitureEditor } from './components/editor/FurnitureEditor';
import { AssetUploadCenter } from './components/ui-builder/AssetUploadCenter';
import { ThemeDesigner } from './components/admin/ThemeDesigner';
import { TransformPanel } from './components/TransformPanel';
import { X, Volume2, Layers, Gamepad2, Hammer } from 'lucide-react';

type AppState =
  | { page: 'new'; step: 'input'; text?: string }
  | { page: 'new'; step: 'selection'; text: string; words?: Word[] }
  | { page: 'new'; step: 'memorization'; words: Word[]; selectedIndices: number[]; text: string }
  | { page: 'saved' }
  | { page: 'admin' }
  | { page: 'admin' }
  | { page: 'assetGenerator' }
  | { page: 'assetUpload' }
  | { page: 'database' }
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
  | { page: 'spacedRepetition' }
  | { page: 'flowithTest' }
  | { page: 'wordSnake' }
  | { page: 'classDashboard' }
  | { page: 'quickReward'; qrToken: string }
  | { page: 'scanner' }
  | { page: 'phonics'; section: 'wall' | 'blending' | 'quiz' | 'builder' }
  | { page: 'notionHub' };

function AppContent() {
  const [appState, setAppState] = useState<AppState>({ page: 'classDashboard' });

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(true);
  const { fetchPublicContent, proofreadingPractices, deleteProofreadingPractice } = useAppContext();
  const { user, loading, toggleViewMode, isAdmin } = useAuth();

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
    fullModels,
  } = useMemoryPalaceContext();
  const { buyItem } = useInventory();
  const [showComponentInspector, setShowComponentInspector] = useState(() => {
    return localStorage.getItem('showComponentInspector') === 'true';
  });
  const [pendingCount, setPendingCount] = useState(0);
  const [showPendingModal, setShowPendingModal] = useState(false);

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

  // Fetch and Subscribe to Pending Rewards Count
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      setPendingCount(0);
      return;
    }

    const fetchPendingCount = async () => {
      const { count, error } = await supabase
        .from('pending_rewards' as any)
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (!error && count !== null) {
        setPendingCount(count);
      }
    };

    fetchPendingCount();

    // Subscribe to changes in the pending_rewards table
    const channel = supabase
      .channel('pending_rewards_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pending_rewards'
        },
        () => {
          fetchPendingCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.role]);

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
    const quickRewardMatch = path.match(/^\/quick-reward\/([^\/]+)$/);
    const legacyRewardMatch = path.match(/^\/reward\/([^\/]+)$/);
    const scannerMatch = path.match(/^\/scanner$/);
    const classMatch = path.match(/^\/class$/);

    if (quickRewardMatch) {
      setAppState({ page: 'quickReward', qrToken: quickRewardMatch[1] });
      return;
    }

    if (legacyRewardMatch) {
      setAppState({ page: 'quickReward', qrToken: legacyRewardMatch[1] });
      return;
    }

    if (scannerMatch) {
      setAppState({ page: 'scanner' });
      return;
    }

    if (classMatch) {
      setAppState({ page: 'classDashboard' });
      return;
    }

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

  // Handle permissions and conditional state updates
  useEffect(() => {
    if (!user || user.role === 'admin') return;

    // Redirect students away from admin-only dashboard
    if (appState.page === 'classDashboard' && !new URLSearchParams(window.location.search).get('token')) {
      setAppState({ page: 'new', step: 'input' });
      return;
    }
    if (appState.page === 'proofreading' && !user.can_access_proofreading) {
      setAppState({ page: 'new', step: 'input' });
    }

    // Check permissions for spelling
    if (appState.page === 'spelling' && !user.can_access_spelling) {
      setAppState({ page: 'new', step: 'input' });
    }

    // Check permissions for learning hub
    if (appState.page === 'learningHub' && !user.can_access_learning_hub) {
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
    appState.page === 'classDashboard' && !new URLSearchParams(window.location.search).get('token');

  if (!user && isRestrictedPage) {
    return <Login />;
  }



  if (user?.force_password_change) {
    return <ChangePasswordModal isForced={true} />;
  }

  const handlePageChange = (page: 'new' | 'saved' | 'admin' | 'assetGenerator' | 'assetUpload' | 'database' | 'proofreading' | 'spelling' | 'progress' | 'assignments' | 'assignmentManagement' | 'proofreadingAssignments' | 'learningHub' | 'spacedRepetition' | 'flowithTest' | 'wordSnake' | 'classDashboard' | 'quickReward' | 'scanner' | 'notionHub' | 'phonics') => {
    // Check if user is trying to access restricted pages without authentication
    if (!user && (page === 'saved' || page === 'admin' || page === 'assetGenerator' || page === 'assetUpload' || page === 'database' || page === 'spelling' || page === 'progress' || page === 'assignments' || page === 'assignmentManagement' || page === 'proofreadingAssignments' || page === 'learningHub' || page === 'spacedRepetition' || page === 'wordSnake' || page === 'classDashboard' || page === 'quickReward' || page === 'scanner' || page === 'notionHub' || page === 'phonics')) {
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
    } else if (page === 'quickReward') {
      setAppState({ page: 'quickReward', qrToken: '' }); // Default or empty, will be picked up by URL usually
    } else if (page === 'scanner') {
      setAppState({ page: 'scanner' });
    } else if (page === 'notionHub') {
      setAppState({ page: 'notionHub' });
    } else if (page === 'phonics') {
      setAppState({ page: 'phonics', section: 'wall' });
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
      if (isAdmin) {
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
        return <AdminPanel
          onNavigateToAssets={() => setAppState({ page: 'assetUpload' })}
          onOpenMapEditor={toggleMapEditor}
        />;
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
            return <ProofreadingInput onNext={handleProofreadingSentencesSubmit} onViewSaved={isAdmin ? handleViewSavedProofreading : undefined} />;
          case 'answerSetting':
            return (
              <ProofreadingAnswerSetting
                sentences={appState.sentences}
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
                onNext={handleSpellingPreviewNext}
                onBack={handleBackToSpellingInput}
                onSave={isAdmin ? handleViewSavedSpelling : undefined}
                onViewSaved={isAdmin ? handleViewSavedSpelling : undefined}
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
                  if (isAdmin) {
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
          <MemoryPalacePage onExit={() => setAppState({ page: 'new', step: 'input' })} />
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
      case 'flowithTest':
        return <FlowithTestPage />;
      case 'wordSnake':
        return <WordSnakeGame />;
      case 'classDashboard':
        return <ClassDashboardPage />;
      case 'quickReward':
        return <QuickRewardPage />;
      case 'scanner':
        return <QRScannerPage />;
      case 'notionHub':
        return <NotionHub />;
      case 'phonics':
        return (
          <Suspense fallback={<PageLoader />}>
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
          </Suspense>
        );
    }
  };

  const getCurrentPage = () => {
    if (appState.page === 'practice' || appState.page === 'publicPractice') {
      return 'saved';
    }
    if (appState.page === 'proofreading') {
      return 'proofreading';
    }
    if (appState.page === 'quickReward') {
      return 'quickReward';
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
    if (appState.page === 'admin') {
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
      return isAdmin ? 'progress-admin' : 'progress';
    }

    return appState.page;
  };

  // State for navigation visibility moved to top to follow Rules of Hooks

  return (
    <>
      {!['scanner', 'quickReward'].includes(appState.page) && !(appState.page === 'classDashboard' && new URLSearchParams(window.location.search).get('token')) && (
        <UnifiedNavigation
          currentPage={getCurrentPage()}
          onPageChange={handlePageChange}
          onLogin={handleLogin}
          isNavOpen={isNavOpen}
          onToggle={() => setIsNavOpen(!isNavOpen)}
          pendingCount={pendingCount}
          onOpenNotifications={() => setShowPendingModal(true)}
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
      <main className={`h-screen overflow-y-auto transition-all duration-300 ${(['scanner', 'quickReward'].includes(appState.page) || (appState.page === 'classDashboard' && new URLSearchParams(window.location.search).get('token'))) ? "" : (isNavOpen ? "ml-0 md:ml-72" : "ml-0 md:ml-20")}`}>
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

      {showPendingModal && (
        <PendingRewardsModal
          isOpen={true}
          onClose={() => setShowPendingModal(false)}
          onProcessed={() => {
            // Count will be updated by Realtime subscription
          }}
        />
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
    </>
  );
}

// Lazy load standalone pages
const RewardPage = lazy(() => import('./pages/RewardPage.tsx'));
const QRScannerPage = lazy(() => import('./pages/QRScannerPage.tsx'));
const AdminUIBuilderPage = lazy(() => import('./pages/AdminUIBuilderPage.tsx'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage.tsx').then(m => ({ default: m.AdminUsersPage })));
const AdminProgressPage = lazy(() => import('./pages/AdminProgressPage.tsx').then(m => ({ default: m.AdminProgressPage })));
const AdminCityEditorPage = lazy(() => import('./pages/AdminCityEditorPage.tsx'));
const RegionPage = lazy(() => import('./pages/RegionPage.tsx'));
const PhonicsLayout = lazy(() => import('./components/phonics/PhonicsLayout.tsx').then(m => ({ default: m.PhonicsLayout })));
const PhonicsSoundWall = lazy(() => import('./pages/PhonicsSoundWall.tsx').then(m => ({ default: m.PhonicsSoundWall })));
const BlendingBoard = lazy(() => import('./components/phonics/BlendingBoard.tsx').then(m => ({ default: m.BlendingBoard })));
const PhonicsQuiz = lazy(() => import('./components/phonics/PhonicsQuiz.tsx').then(m => ({ default: m.PhonicsQuiz })));
const WordBuilder = lazy(() => import('./components/phonics/WordBuilder.tsx').then(m => ({ default: m.WordBuilder })));

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
        <AppRoutes />
      </ThemeProvider>
    </AuthProvider>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Standalone pages inside Auth/Theme context */}
      <Route
        path="/reward/:qrToken"
        element={
          <Suspense fallback={<PageLoader />}>
            <RewardPage />
          </Suspense>
        }
      />
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
        path="/admin/scanner"
        element={
          <Suspense fallback={<PageLoader />}>
            <QRScannerPage />
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
        <Route path="quiz" element={<PhonicsQuiz />} />
        <Route path="builder" element={<WordBuilder />} />
      </Route>

      {/* Legacy app logic for all other routes */}
      <Route path="*" element={<AppProviderWrapper />} />
    </Routes>
  );
}

function AppProviderWrapper() {
  const { user } = useAuth();

  return (
    <AppProvider userId={user?.id}>
      <SpacedRepetitionProvider userId={user?.id}>
        <MemoryPalaceProvider>
          <SourceInspector />
          <AppContent />
        </MemoryPalaceProvider>
      </SpacedRepetitionProvider>
    </AppProvider>
  );
}

export default App;