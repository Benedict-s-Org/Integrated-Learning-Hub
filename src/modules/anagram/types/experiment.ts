export interface QuestionResponse {
  questionId?: string;
  questionPageUrl?: string;
  questionIndex: number;
  letters: string;
  userAnswer: string;
  isCorrect: boolean;
  timeTaken: number;
  attempts: number;
  skipped: boolean;
  // Hint tracking
  hintStage?: 'none' | 'first_letter' | 'last_letter' | 'gave_up';
  revealedFirstLetter?: string;
  revealedLastLetter?: string;
  hintFirstLetterTime?: number;  // seconds from question start when first letter was revealed
  hintLastLetterTime?: number;   // seconds from question start when last letter was revealed
  hintGaveUpTime?: number;       // seconds from question start when "I really have no idea" was clicked
}

export interface TaskResult {
  taskId: string;
  taskName: string;
  predictionSeconds: number;
  responses: QuestionResponse[];
  startTime: number;
  endTime: number;
}

export type Demographics = Record<string, string>;
// Previous fixed structure for reference: age, gender, education, nativeLanguage, englishProficiency

export interface PostSurveyData {
  // Optimism (1-7 scale)
  optimism1: number; // "I generally expect things to go well"
  optimism2: number; // "I rarely expect things to work out my way" (reverse)
  optimism3: number; // "I'm always optimistic about my future"
  // Need for Cognition (1-7 scale)
  nfc1: number; // "I enjoy tasks that require thinking"
  nfc2: number; // "I prefer complex over simple problems"
  nfc3: number; // "Thinking hard is not my idea of fun" (reverse)
  // Past Experience
  pastAnagramExperience: number; // 1-5: never to very often
  pastPsychExperience: number;   // 1-5: never to very often
  // Manipulation Check
  manipulationCheck: string; // "self" | "other" | "unsure"
  // Task difficulty perception
  task1Difficulty: number; // 1-7
  task2Difficulty: number; // 1-7
  // Open-ended
  comments: string;
  // Dynamic Questions from CMS
  dynamicResponses?: Record<string, any>;
}

export interface ExperimentData {
  participantId: string;
  timestamp: string;
  groupId: "self" | "other";
  demographics: Demographics | null;
  demographicsContent?: any; // CMS content for labels
  trialResult: TaskResult | null;
  trialDifficulty?: 'easy' | 'moderate' | 'difficult';
  task1Result: TaskResult | null;
  task2Result: TaskResult | null;
  postSurvey: PostSurveyData | null;
}
