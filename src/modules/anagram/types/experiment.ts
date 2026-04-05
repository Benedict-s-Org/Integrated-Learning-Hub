export interface QuestionResponse {
  questionIndex: number;
  letters: string;
  userAnswer: string;
  isCorrect: boolean;
  timeTaken: number;
  attempts: number;
  skipped: boolean;
}

export interface TaskResult {
  taskId: string;
  taskName: string;
  predictionSeconds: number;
  responses: QuestionResponse[];
  startTime: number;
  endTime: number;
}

export interface Demographics {
  age: string;
  gender: string;
  education: string;
  nativeLanguage: string;
  englishProficiency: string;
}

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
}

export interface ExperimentData {
  participantId: string;
  timestamp: string;
  groupId: "self" | "other";
  demographics: Demographics | null;
  task1Result: TaskResult | null;
  task2Result: TaskResult | null;
  postSurvey: PostSurveyData | null;
}
