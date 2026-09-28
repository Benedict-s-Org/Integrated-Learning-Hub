import { ProofreadingPracticeResult, ProofreadingAnswer } from '../types';

export type QuestionDiagnosticStatus = 
  | 'correct'           // Both detected correct word and provided correct correction
  | 'detection_error'   // Picked wrong word (failed to locate error)
  | 'correction_error'  // Located correct word, but correction text is incorrect
  | 'not_sure'          // Marked "Not Sure" / "不知道"
  | 'incomplete';       // Incomplete / skipped without selecting or typing

export interface TokenWord {
  text: string;
  index: number;
  isPunctuation: boolean;
}

export interface DetailedQuestionDiagnostic {
  lineNumber: number;
  sentence: string;
  tokens: TokenWord[];
  targetWordIndex: number;
  targetWordText: string;
  expectedCorrection: string;
  userWordIndex?: number;
  userWordText?: string;
  userCorrection?: string;
  isNotSure: boolean;
  isIncomplete: boolean;
  status: QuestionDiagnosticStatus;
  statusLabel: string;
  statusColor: string;
  category: string;
  categoryIcon: string;
  tip?: string;
  tipUsed: boolean;
}

export interface CategoryPerformance {
  category: string;
  categoryIcon: string;
  total: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  isWeakness: boolean;
}

export interface ProofreadingStudentDiagnostic {
  totalPractices: number;
  totalQuestions: number;
  correctQuestions: number;
  incorrectQuestions: number;
  notSureQuestions: number;
  incompleteQuestions: number;
  tipsUsedCount: number;
  overallAccuracy: number;
  totalTimeSeconds: number;
  avgTimePerPracticeSeconds: number;

  // Root cause counts
  detectionErrors: number;     // Picked wrong word
  correctionErrors: number;    // Found error word, but typo/grammar error in correction
  notSureErrors: number;       // Gave up
  incompleteErrors: number;    // Skipped / empty

  // Category breakdown sorted from lowest accuracy to highest
  categories: CategoryPerformance[];

  // Top weak categories
  topWeaknesses: string[];

  // Human-readable actionable advice
  recommendations: string[];

  // Processed practices with individual question diagnostics
  diagnosedPractices: DiagnosedPractice[];
}

export interface DiagnosedPractice {
  id: string;
  completedAt: string;
  accuracyPercentage: number;
  correctCount: number;
  totalCount: number;
  timeSpentSeconds: number;
  title: string;
  questions: DetailedQuestionDiagnostic[];
}

/**
 * Split sentence into tokens matching ProofreadingPractice logic.
 */
export function tokenizeSentence(sentence: string): TokenWord[] {
  const safeSentence = typeof sentence === 'string' ? sentence : String(sentence || '');
  const tokens = safeSentence.match(/\S+|\s+/g) || [];
  const words: TokenWord[] = [];
  let wordIndex = 0;

  tokens.forEach(token => {
    if (token.trim().length > 0) {
      const isPunctuation = /^[^\w]+$/.test(token);
      words.push({
        text: token,
        index: wordIndex,
        isPunctuation,
      });
      wordIndex++;
    } else {
      words.push({
        text: token,
        index: -1,
        isPunctuation: true,
      });
    }
  });

  return words;
}

// Common grammar lists for category detection
const PREPOSITIONS = new Set([
  'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'of', 'into', 'onto', 
  'under', 'over', 'between', 'among', 'about', 'through', 'across', 'behind', 
  'beside', 'near', 'off', 'out', 'around', 'against', 'during', 'since', 
  'until', 'till', 'without', 'within', 'upon', 'toward', 'towards'
]);

const ARTICLES_DETERMINERS = new Set([
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'some', 'any', 'every', 
  'each', 'all', 'both', 'neither', 'either', 'much', 'many', 'few', 'little'
]);

const PRONOUNS = new Set([
  'i', 'me', 'my', 'mine', 'myself', 'you', 'your', 'yours', 'yourself',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
  'it', 'its', 'itself', 'we', 'us', 'our', 'ours', 'ourselves',
  'they', 'them', 'their', 'theirs', 'themselves',
  'who', 'whom', 'whose', 'which', 'what', 'that'
]);

const IRREGULAR_VERB_PAIRS = new Set([
  'go', 'went', 'gone', 'goes', 'going',
  'do', 'did', 'done', 'does', 'doing',
  'have', 'has', 'had', 'having',
  'is', 'am', 'are', 'was', 'were', 'been', 'being',
  'see', 'saw', 'seen', 'sees', 'seeing',
  'eat', 'ate', 'eaten', 'eats', 'eating',
  'come', 'came', 'comes', 'coming',
  'take', 'took', 'taken', 'takes', 'taking',
  'make', 'made', 'makes', 'making',
  'say', 'said', 'says', 'saying',
  'get', 'got', 'gotten', 'gets', 'getting',
  'buy', 'bought', 'buys', 'buying',
  'give', 'gave', 'given', 'gives', 'giving',
  'know', 'knew', 'known', 'knows', 'knowing',
  'think', 'thought', 'thinks', 'thinking',
  'write', 'wrote', 'written', 'writes', 'writing',
  'read', 'reads', 'reading',
  'find', 'found', 'finds', 'finding',
  'tell', 'told', 'tells', 'telling',
  'run', 'ran', 'runs', 'running',
  'swim', 'swam', 'swum', 'swims', 'swimming',
  'sing', 'sang', 'sung', 'sings', 'singing',
  'drink', 'drank', 'drunk', 'drinks', 'drinking',
  'bring', 'brought', 'brings', 'bringing',
  'teach', 'taught', 'teaches', 'teaching',
  'catch', 'caught', 'catches', 'catching',
  'feel', 'felt', 'feels', 'feeling',
  'hear', 'heard', 'hears', 'hearing',
  'leave', 'left', 'leaves', 'leaving',
  'meet', 'met', 'meets', 'meeting',
  'sleep', 'slept', 'sleeps', 'sleeping',
  'stand', 'stood', 'stands', 'standing',
  'sit', 'sat', 'sits', 'sitting',
  'wear', 'wore', 'worn', 'wears', 'wearing',
  'win', 'won', 'wins', 'winning',
  'lose', 'lost', 'loses', 'losing'
]);

const IRREGULAR_PLURAL_PAIRS = new Set([
  'child', 'children',
  'person', 'people',
  'man', 'men',
  'woman', 'women',
  'foot', 'feet',
  'tooth', 'teeth',
  'mouse', 'mice',
  'fish', 'fishes',
  'sheep', 'ox', 'oxen', 'goose', 'geese'
]);

/**
 * Infer grammar category from tip and word transformation.
 */
export function inferGrammarCategory(
  targetWord: string = '',
  expectedCorrection: string = '',
  tip: string = ''
): { category: string; icon: string } {
  const tipLower = tip.toLowerCase();
  const targetLower = targetWord.toLowerCase().replace(/[^\w]/g, '');
  const correctLower = expectedCorrection.toLowerCase().replace(/[^\w]/g, '');

  // 1. Tip explicit indicators
  if (
    tipLower.includes('tense') || 
    tipLower.includes('past') || 
    tipLower.includes('present') || 
    tipLower.includes('verb') || 
    tipLower.includes('participle') || 
    tipLower.includes('時態') || 
    tipLower.includes('過去式') || 
    tipLower.includes('動詞')
  ) {
    return { category: 'Verb Tenses', icon: '🔄' };
  }

  if (
    tipLower.includes('plural') || 
    tipLower.includes('singular') || 
    tipLower.includes('count') || 
    tipLower.includes('單數') || 
    tipLower.includes('複數')
  ) {
    return { category: 'Noun Singular / Plural', icon: '📦' };
  }

  if (
    tipLower.includes('prep') || 
    tipLower.includes('介詞') || 
    tipLower.includes('介系詞')
  ) {
    return { category: 'Prepositions', icon: '📍' };
  }

  if (
    tipLower.includes('article') || 
    tipLower.includes('vowel sound') || 
    tipLower.includes('consonant') || 
    tipLower.includes('冠詞')
  ) {
    return { category: 'Articles & Determiners', icon: '🔤' };
  }

  if (
    tipLower.includes('pronoun') || 
    tipLower.includes('possessive') || 
    tipLower.includes('代名詞') || 
    tipLower.includes('所有格')
  ) {
    return { category: 'Pronouns', icon: '👤' };
  }

  if (
    tipLower.includes('adverb') || 
    tipLower.includes('adjective') || 
    tipLower.includes('comparative') || 
    tipLower.includes('形容詞') || 
    tipLower.includes('副詞')
  ) {
    return { category: 'Adjectives & Adverbs', icon: '✨' };
  }

  if (
    tipLower.includes('conjunction') || 
    tipLower.includes('connective') || 
    tipLower.includes('連接詞')
  ) {
    return { category: 'Conjunctions', icon: '🔗' };
  }

  if (
    tipLower.includes('spelling') || 
    tipLower.includes('spell') || 
    tipLower.includes('拼字') || 
    tipLower.includes('拼寫')
  ) {
    return { category: 'Spelling & Vocabulary', icon: '✍️' };
  }

  // 2. Word heuristics if tip didn't match
  if (ARTICLES_DETERMINERS.has(targetLower) || ARTICLES_DETERMINERS.has(correctLower)) {
    return { category: 'Articles & Determiners', icon: '🔤' };
  }

  if (PREPOSITIONS.has(targetLower) || PREPOSITIONS.has(correctLower)) {
    return { category: 'Prepositions', icon: '📍' };
  }

  if (PRONOUNS.has(targetLower) || PRONOUNS.has(correctLower)) {
    return { category: 'Pronouns', icon: '👤' };
  }

  if (
    IRREGULAR_PLURAL_PAIRS.has(targetLower) || 
    IRREGULAR_PLURAL_PAIRS.has(correctLower) ||
    (correctLower.endsWith('s') && !targetLower.endsWith('s') && targetLower.length > 3) ||
    (targetLower.endsWith('s') && !correctLower.endsWith('s') && correctLower.length > 3)
  ) {
    return { category: 'Noun Singular / Plural', icon: '📦' };
  }

  if (
    IRREGULAR_VERB_PAIRS.has(targetLower) || 
    IRREGULAR_VERB_PAIRS.has(correctLower) ||
    targetLower.endsWith('ed') || 
    correctLower.endsWith('ed') ||
    targetLower.endsWith('ing') || 
    correctLower.endsWith('ing')
  ) {
    return { category: 'Verb Tenses', icon: '🔄' };
  }

  if (targetLower.endsWith('ly') || correctLower.endsWith('ly')) {
    return { category: 'Adjectives & Adverbs', icon: '✨' };
  }

  // Default fallback
  return { category: 'Grammar & Syntax', icon: '📝' };
}

/**
 * Analyze an individual question diagnostic.
 */
export function diagnoseQuestion(
  sentence: string,
  lineNumber: number,
  correctAns?: ProofreadingAnswer,
  userAns?: {
    lineNumber: number;
    wordIndex?: number;
    correction?: string;
    isNotSure?: boolean;
    isIncomplete?: boolean;
  },
  tipsUsedSet: Set<number> = new Set()
): DetailedQuestionDiagnostic {
  const tokens = tokenizeSentence(sentence);
  const wordsOnly = tokens.filter(t => t.index !== -1);

  const targetWordIndex = correctAns?.wordIndex ?? -1;
  const targetWordText = (targetWordIndex >= 0 && targetWordIndex < wordsOnly.length)
    ? wordsOnly[targetWordIndex].text
    : '';

  const expectedCorrection = correctAns?.correction || '';
  const tip = correctAns?.tip;
  const tipUsed = tipsUsedSet.has(lineNumber);

  const isNotSure = !!userAns?.isNotSure;
  const userWordIndex = userAns?.wordIndex;
  const userWordText = (userWordIndex !== undefined && userWordIndex >= 0 && userWordIndex < wordsOnly.length)
    ? wordsOnly[userWordIndex].text
    : undefined;
  const userCorrection = userAns?.correction;

  const hasSelectedWord = userWordIndex !== undefined && userWordIndex !== -1;
  const hasTypedCorrection = !!userCorrection && userCorrection.trim() !== '';

  const isIncomplete = !!userAns?.isIncomplete || (!isNotSure && (!hasSelectedWord || !hasTypedCorrection));

  let status: QuestionDiagnosticStatus = 'incorrect';
  let statusLabel = 'Incorrect';
  let statusColor = 'text-rose-600 bg-rose-50 border-rose-200';

  if (isNotSure) {
    status = 'not_sure';
    statusLabel = 'Not Sure';
    statusColor = 'text-amber-700 bg-amber-50 border-amber-200';
  } else if (isIncomplete) {
    status = 'incomplete';
    statusLabel = 'Incomplete / Skipped';
    statusColor = 'text-slate-600 bg-slate-100 border-slate-300';
  } else {
    const isWordCorrect = userWordIndex === targetWordIndex;
    const isCorrectionCorrect = 
      userCorrection?.trim().toLowerCase() === expectedCorrection.trim().toLowerCase();

    if (isWordCorrect && isCorrectionCorrect) {
      status = 'correct';
      statusLabel = 'Correct';
      statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    } else if (!isWordCorrect) {
      status = 'detection_error';
      statusLabel = 'Wrong Word Selected (Detection Error)';
      statusColor = 'text-rose-700 bg-rose-50 border-rose-200';
    } else {
      status = 'correction_error';
      statusLabel = 'Correction Error (Incorrect Revision)';
      statusColor = 'text-orange-700 bg-orange-50 border-orange-200';
    }
  }

  const { category, icon: categoryIcon } = inferGrammarCategory(targetWordText, expectedCorrection, tip || '');

  return {
    lineNumber,
    sentence,
    tokens,
    targetWordIndex,
    targetWordText,
    expectedCorrection,
    userWordIndex,
    userWordText,
    userCorrection,
    isNotSure,
    isIncomplete,
    status,
    statusLabel,
    statusColor,
    category,
    categoryIcon,
    tip,
    tipUsed
  };
}

/**
 * Generate full diagnostic report for a student across all practice results.
 */
export function analyzeStudentProofreadingResults(
  results: ProofreadingPracticeResult[] = []
): ProofreadingStudentDiagnostic {
  let totalQuestions = 0;
  let correctQuestions = 0;
  let incorrectQuestions = 0;
  let notSureQuestions = 0;
  let incompleteQuestions = 0;
  let tipsUsedCount = 0;
  let totalTimeSeconds = 0;

  let detectionErrors = 0;
  let correctionErrors = 0;
  let notSureErrors = 0;
  let incompleteErrors = 0;

  const categoryMap = new Map<string, { icon: string; total: number; correct: number; incorrect: number }>();

  const diagnosedPractices: DiagnosedPractice[] = [];

  // Sort results newest first
  const sortedResults = [...results].sort((a, b) => 
    new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime()
  );

  sortedResults.forEach(res => {
    totalTimeSeconds += res.time_spent_seconds || 0;
    const tipsSet = new Set<number>(res.tips_used || []);
    tipsUsedCount += tipsSet.size;

    const questions: DetailedQuestionDiagnostic[] = [];
    const sentences = Array.isArray(res.sentences) ? res.sentences : [];

    sentences.forEach((sentence, idx) => {
      const correctAns = res.correct_answers?.find(a => a.lineNumber === idx);
      const userAns = res.user_answers?.find(a => a.lineNumber === idx);
      const qDiag = diagnoseQuestion(sentence, idx, correctAns, userAns, tipsSet);

      questions.push(qDiag);
      totalQuestions++;

      // Count stats
      if (qDiag.status === 'correct') {
        correctQuestions++;
      } else {
        incorrectQuestions++;
        if (qDiag.status === 'detection_error') detectionErrors++;
        else if (qDiag.status === 'correction_error') correctionErrors++;
        else if (qDiag.status === 'not_sure') {
          notSureErrors++;
          notSureQuestions++;
        } else if (qDiag.status === 'incomplete') {
          incompleteErrors++;
          incompleteQuestions++;
        }
      }

      // Category tally
      const cat = qDiag.category;
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, { icon: qDiag.categoryIcon, total: 0, correct: 0, incorrect: 0 });
      }
      const catData = categoryMap.get(cat)!;
      catData.total++;
      if (qDiag.status === 'correct') catData.correct++;
      else catData.incorrect++;
    });

    diagnosedPractices.push({
      id: res.id,
      completedAt: res.completed_at,
      accuracyPercentage: res.accuracy_percentage,
      correctCount: res.correct_count,
      totalCount: res.total_count || sentences.length,
      timeSpentSeconds: res.time_spent_seconds,
      title: (res as any).proofreading_practices?.title || (res as any).practice_title || `${sentences.length}-Question Proofreading Practice`,
      questions,
    });
  });

  const overallAccuracy = totalQuestions > 0 ? Math.round((correctQuestions / totalQuestions) * 100) : 0;
  const avgTimePerPracticeSeconds = sortedResults.length > 0 
    ? Math.round(totalTimeSeconds / sortedResults.length) 
    : 0;

  // Format categories
  const categories: CategoryPerformance[] = Array.from(categoryMap.entries()).map(([cat, data]) => {
    const accuracy = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
    return {
      category: cat,
      categoryIcon: data.icon,
      total: data.total,
      correct: data.correct,
      incorrect: data.incorrect,
      accuracy,
      // Weakness if accuracy < 70% and total questions >= 2
      isWeakness: data.total >= 2 && accuracy < 70
    };
  }).sort((a, b) => a.accuracy - b.accuracy); // Lowest accuracy first

  // Extract top weaknesses
  const topWeaknesses = categories
    .filter(c => c.isWeakness)
    .slice(0, 3)
    .map(c => `${c.categoryIcon} ${c.category} (${c.accuracy}% Accuracy)`);

  // Actionable recommendations
  const recommendations: string[] = [];

  if (totalQuestions === 0) {
    recommendations.push('This student has not completed any proofreading exercises yet. Assign baseline exercises to evaluate their grammar proficiency.');
  } else {
    // Detection vs Correction insight
    if (detectionErrors > correctionErrors * 2 && detectionErrors >= 3) {
      recommendations.push(`🔍 Error Detection Weakness: The student frequently chose the wrong word to correct (${detectionErrors} detection errors). Recommend practicing sentence reading and syntax flow to help them identify unnatural phrasing before correcting.`);
    } else if (correctionErrors > detectionErrors && correctionErrors >= 3) {
      recommendations.push(`✏️ Revision & Spelling Accuracy: The student correctly identified the flawed word, but made mistakes when providing the replacement (${correctionErrors} correction errors). Focus on irregular verb forms, noun plurals, and high-frequency vocabulary spelling.`);
    }

    // Incomplete insight
    if (incompleteErrors >= 3) {
      recommendations.push(`⏳ Incomplete Submissions: There are ${incompleteErrors} blank or unattempted questions. Encourage the student to manage pacing and attempt every question.`);
    }

    // Not sure insight
    if (notSureErrors >= 3) {
      recommendations.push(`❓ Knowledge Gaps / Low Confidence: The student actively marked 'Not Sure' on ${notSureErrors} questions. Review the targeted grammar rules and provide guided practice for these specific sentence patterns.`);
    }

    // Specific category alerts
    const weakCats = categories.filter(c => c.isWeakness);
    if (weakCats.length > 0) {
      const catNames = weakCats.map(c => `"${c.category}"`).join(', ');
      recommendations.push(`⚠️ High Priority Focus: Accuracy is notably low in ${catNames}. Assign targeted worksheets for these specific grammar areas.`);
    }

    if (overallAccuracy >= 90) {
      recommendations.push('🌟 Outstanding Performance: The student achieved an overall accuracy of 90%+ in proofreading. Excellent grammar detection and syntax skills. Ready for advanced reading and proofreading challenges.');
    } else if (recommendations.length === 0) {
      recommendations.push('Good overall grammar performance. Continuing regular practice will maintain sharp proofreading and self-editing instincts.');
    }
  }

  return {
    totalPractices: sortedResults.length,
    totalQuestions,
    correctQuestions,
    incorrectQuestions,
    notSureQuestions,
    incompleteQuestions,
    tipsUsedCount,
    overallAccuracy,
    totalTimeSeconds,
    avgTimePerPracticeSeconds,
    detectionErrors,
    correctionErrors,
    notSureErrors,
    incompleteErrors,
    categories,
    topWeaknesses,
    recommendations,
    diagnosedPractices
  };
}
