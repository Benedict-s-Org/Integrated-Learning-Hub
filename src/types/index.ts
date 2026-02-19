export interface SavedContent {
  id: string;
  title: string;
  originalText: string;
  selectedWordIndices: number[];
  createdAt: Date;
  isPublished: boolean;
  publicId?: string | null;
}

export interface Word {
  text: string;
  index: number;
  isMemorized: boolean;
  isPunctuation: boolean;
  highlightGroup?: number;
  isParagraphBreak?: boolean;
}

export interface MemorizationState {
  originalText: string;
  words: Word[];
  selectedWordIndices: number[];
  hiddenWords: Set<number>;
}

export interface AppContextType {
  savedContents: SavedContent[];
  addSavedContent: (content: Omit<SavedContent, 'id' | 'createdAt'>) => Promise<boolean>;
  deleteSavedContent: (id: string) => Promise<void>;
  publishSavedContent: (id: string) => Promise<string | null>;
  fetchPublicContent: (publicId: string) => Promise<MemorizationState | null>;
  currentContent: MemorizationState | null;
  setCurrentContent: (content: MemorizationState | null) => void;
  loading: boolean;
  spellingLists: SpellingPracticeList[];
  addSpellingList: (title: string, words: string[]) => Promise<boolean>;
  deleteSpellingList: (id: string) => Promise<void>;
  saveLimit: number | null;
  currentSaveCount: number;
  proofreadingPractices: ProofreadingPractice[];
  addProofreadingPractice: (title: string, sentences: string[], answers: ProofreadingAnswer[]) => Promise<boolean>;
  updateProofreadingPractice: (id: string, title: string) => Promise<boolean>;
  deleteProofreadingPractice: (id: string) => Promise<void>;
  refreshSavedContents: () => Promise<void>;
}

export type AppPage = 'new' | 'saved' | 'admin' | 'publicPractice' | 'proofreading';

export interface ProofreadingSentence {
  text: string;
  lineNumber: number;
  words: ProofreadingWord[];
}

export interface ProofreadingWord {
  text: string;
  index: number;
  isSelected: boolean;
  isPunctuation: boolean;
}

export interface ProofreadingState {
  sentences: ProofreadingSentence[];
  answers: Map<number, { wordIndex: number; correction: string }>;
}

export interface ProofreadingAnswer {
  lineNumber: number;
  wordIndex: number;
  correction: string;
  tip?: string;
}

import { Session } from '@supabase/supabase-js';

// ... (keep existing imports)

// ...

export interface UserProfile {
  id: string;
  username: string;
  role: 'admin' | 'user';
  email?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  force_password_change: boolean;
  created_at: string;
  updated_at: string;
  accent_preference?: string;
  class?: string | null;
  can_access_proofreading?: boolean;
  can_access_spelling?: boolean;
  can_access_learning_hub?: boolean;
  can_access_spaced_repetition?: boolean;
}

export interface AuthContextType {
  user: UserProfile | null;
  profile: UserProfile | null; // Alias for user for compatibility
  session: Session | null;
  loading: boolean;
  isLoading: boolean; // Alias for loading for compatibility
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  changePassword: (currentPassword: string | undefined, newPassword: string, verificationCode?: string) => Promise<{ error: Error | null }>;
  isAdmin: boolean;
  isUserView: boolean;
  toggleViewMode: () => void;
  isMobileEmulator: boolean;
  setIsMobileEmulator: (val: boolean) => void;
  accentPreference: string;
  updateAccentPreference: (accent: string) => Promise<void>;
}

export interface SpellingPracticeList {
  id: string;
  userId: string;
  title: string;
  words: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SpellingPracticeState {
  currentWordIndex: number;
  words: string[];
  results: {
    word: string;
    userAnswer: string;
    isCorrect: boolean;
  }[];
  isCompleted: boolean;
}

export interface SpellingPracticeResult {
  id: string;
  user_id: string;
  practice_id?: string;
  title: string;
  words: string[];
  user_answers: {
    word: string;
    userAnswer: string;
    isCorrect: boolean;
    level: number;
  }[];
  correct_count: number;
  total_count: number;
  accuracy_percentage: number;
  practice_level: number;
  time_spent_seconds: number;
  completed_at: string;
  created_at: string;
}

export interface ProofreadingPracticeResult {
  id: string;
  user_id: string;
  sentences: string[];
  correct_answers: ProofreadingAnswer[];
  user_answers: {
    lineNumber: number;
    wordIndex: number;
    correction: string;
  }[];
  correct_count: number;
  total_count: number;
  accuracy_percentage: number;
  time_spent_seconds: number;
  tips_used: number[];
  completed_at: string;
  created_at: string;
}

export interface MemorizationSession {
  id: string;
  user_id: string;
  content_id?: string;
  title: string;
  original_text: string;
  total_words: number;
  hidden_words_count: number;
  session_duration_seconds: number;
  completed_at: string;
  created_at: string;
}

export interface ProgressSummary {
  spelling: {
    total_practices: number;
    average_accuracy: number;
    total_time_minutes: number;
    best_score: number;
  };
  proofreading: {
    total_practices: number;
    average_accuracy: number;
    total_time_minutes: number;
    best_score: number;
  };
  memorization: {
    total_sessions: number;
    total_time_minutes: number;
    total_words_practiced: number;
  };
}

export interface RankingEntry {
  user_id: string;
  username: string;
  total_practices: number;
  average_accuracy: number;
  rank: number;
}

export interface MemorizationAssignment {
  id: string;
  content_id: string;
  user_id: string;
  assigned_by: string;
  assigned_at: string;
  due_date?: string;
  completed: boolean;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AssignedMemorizationContent {
  id: string;
  content_id: string;
  title: string;
  original_text: string;
  selected_word_indices: number[];
  assigned_at: string;
  due_date?: string;
  completed: boolean;
  completed_at?: string;
  assigned_by_username: string;
}

export interface ProofreadingPractice {
  id: string;
  user_id: string;
  title: string;
  sentences: string[];
  answers: ProofreadingAnswer[];
  created_at: string;
  updated_at: string;
}

export interface AssignedProofreadingPracticeContent {
  id: string;
  practice_id: string;
  title: string;
  sentences: string[];
  answers: ProofreadingAnswer[];
  assigned_at: string;
  due_date?: string;
  completed: boolean;
  completed_at?: string;
  assigned_by_username: string;
  result_id?: string;
  accuracy_percentage?: number;
}

export interface LearningActivity {
  id: string;
  name: string;
  thumbnail: string | null;
  difficulty: string;
  questionsJson: LearningQuestion[];
}

export interface LearningQuestion {
  type: 'multiple_choice' | 'true_false' | 'fill_blank' | 'short_answer' | 'matching' | string;
  question: string;
  options?: string[];
  correctAnswer?: string | string[] | boolean;
  explanation?: string;
  hint?: string;
  points?: number;
  pairs?: { left: string; right: string }[];
}

export interface SpacedRepetitionSet {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  total_questions: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface SpacedRepetitionQuestion {
  id: string;
  set_id: string;
  question_text: string;
  image_url?: string | null;
  choices: [string, string, string, string];
  correct_answer_index: number;
  explanation?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface SpacedRepetitionSchedule {
  id: string;
  user_id: string;
  question_id: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_date: string;
  last_reviewed_at?: string;
  last_quality_rating?: number;
  created_at: string;
  updated_at: string;
}

export interface SpacedRepetitionAttempt {
  id: string;
  user_id: string;
  question_id: string;
  selected_answer_index: number;
  is_correct: boolean;
  response_time_ms?: number;
  quality_rating?: number;
  attempt_date: string;
  created_at: string;
}

export interface UserStreak {
  id: string;
  user_id: string;
  current_streak_days: number;
  longest_streak_days: number;
  last_practice_date?: string;
  total_cards_learned: number;
  total_cards_mastered: number;
  created_at: string;
  updated_at: string;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_type: string;
  achievement_name: string;
  description?: string;
  icon_name?: string;
  earned_at: string;
  created_at: string;
}

export interface SetAssignment {
  id: string;
  set_id: string;
  user_id: string;
  assigned_by: string;
  due_date?: string;
  assigned_at: string;
  created_at: string;
}

export interface SpacedRepetitionSessionState {
  currentQuestionIndex: number;
  questions: SpacedRepetitionQuestion[];
  results: {
    question_id: string;
    selected_answer_index: number;
    is_correct: boolean;
    response_time_ms: number;
    quality_rating?: number;
  }[];
  isCompleted: boolean;
  sessionStartTime: number;
  currentQuestionStartTime: number;
}

export interface SpacedRepetitionStats {
  total_cards: number;
  cards_mastered: number;
  cards_learning: number;
  cards_due_today: number;
  average_ease: number;
  today_accuracy: number;
}

// Memory Palace Types
export * from "./furniture";
export * from "./room";
export * from "./game";
export * from "./city";
export * from "./region";
export * from "./ui-builder";