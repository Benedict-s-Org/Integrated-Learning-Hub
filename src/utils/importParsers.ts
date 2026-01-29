import { SpacedRepetitionQuestion } from '../types';

interface ImportedQuestion {
  question: string;
  choices: string[];
  correct_answer_index: number;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
}

export function parseCSVQuestions(csvContent: string): ImportedQuestion[] {
  const lines = csvContent.trim().split('\n');
  const questions: ImportedQuestion[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    const parsed = parseCSVLine(line);
    if (parsed) {
      questions.push(parsed);
    }
  }

  return questions;
}

function parseCSVLine(line: string): ImportedQuestion | null {
  const columns = parseCSVRow(line);

  if (columns.length < 6) return null;

  const [question, choice1, choice2, choice3, choice4, correctIndex, explanation, difficulty] = columns;

  if (!question || !choice1 || !choice2 || !choice3 || !choice4) return null;

  const correct = parseInt(correctIndex || '0', 10);
  if (isNaN(correct) || correct < 0 || correct > 3) return null;

  return {
    question: question.trim(),
    choices: [choice1.trim(), choice2.trim(), choice3.trim(), choice4.trim()],
    correct_answer_index: correct,
    explanation: explanation?.trim(),
    difficulty: (difficulty?.trim() || 'medium') as 'easy' | 'medium' | 'hard',
    tags: [],
  };
}

function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

export function parseNotionJSON(jsonContent: string): ImportedQuestion[] {
  try {
    const data = JSON.parse(jsonContent);
    const questions: ImportedQuestion[] = [];

    if (Array.isArray(data.results)) {
      for (const item of data.results) {
        const question = parseNotionBlock(item);
        if (question) {
          questions.push(question);
        }
      }
    }

    return questions;
  } catch {
    console.error('Failed to parse Notion JSON');
    return [];
  }
}

function parseNotionBlock(block: any): ImportedQuestion | null {
  const titleProp = block.properties?.Title || block.properties?.Question;
  const choicesProp = block.properties?.Choices;
  const answerProp = block.properties?.Answer;
  const explanationProp = block.properties?.Explanation;

  if (!titleProp || !choicesProp || !answerProp) return null;

  const question = extractTextFromNotion(titleProp);
  const choices = extractChoicesFromNotion(choicesProp);
  const answerText = extractTextFromNotion(answerProp);
  const explanation = explanationProp ? extractTextFromNotion(explanationProp) : undefined;

  if (!question || choices.length < 2 || !answerText) return null;

  const correctIndex = choices.findIndex(c => c.toLowerCase() === answerText.toLowerCase());
  if (correctIndex === -1) return null;

  return {
    question,
    choices: choices.slice(0, 4),
    correct_answer_index: correctIndex,
    explanation,
    difficulty: 'medium',
    tags: [],
  };
}

function extractTextFromNotion(prop: any): string {
  if (typeof prop === 'string') return prop;
  if (Array.isArray(prop)) {
    return prop.map(p => extractTextFromNotion(p)).join('');
  }
  if (prop?.rich_text) {
    return prop.rich_text.map((rt: any) => rt.plain_text || '').join('');
  }
  if (prop?.text) {
    return prop.text.map((t: any) => t.content || '').join('');
  }
  return '';
}

function extractChoicesFromNotion(prop: any): string[] {
  if (typeof prop === 'string') {
    return prop.split('|').map(s => s.trim()).filter(s => s);
  }
  if (Array.isArray(prop)) {
    return prop
      .map(p => extractTextFromNotion(p))
      .join('|')
      .split('|')
      .map(s => s.trim())
      .filter(s => s);
  }
  if (prop?.rich_text) {
    return extractTextFromNotion(prop.rich_text)
      .split('|')
      .map(s => s.trim())
      .filter(s => s);
  }
  return [];
}

export function parseAnkiJSON(jsonContent: string): ImportedQuestion[] {
  try {
    const data = JSON.parse(jsonContent);
    const questions: ImportedQuestion[] = [];

    if (Array.isArray(data)) {
      for (const card of data) {
        const question = parseAnkiCard(card);
        if (question) {
          questions.push(question);
        }
      }
    }

    return questions;
  } catch {
    console.error('Failed to parse Anki JSON');
    return [];
  }
}

function parseAnkiCard(card: any): ImportedQuestion | null {
  const front = card.fields?.[0] || card.front;
  const back = card.fields?.[1] || card.back;
  const extra = card.fields?.[2];

  if (!front || !back) return null;

  const choices = parseAnkiChoices(back);
  if (choices.length < 2) return null;

  return {
    question: front.trim(),
    choices: choices.slice(0, 4),
    correct_answer_index: 0,
    explanation: extra?.trim(),
    difficulty: 'medium',
    tags: card.tags || [],
  };
}

function parseAnkiChoices(backContent: string): string[] {
  const lines = backContent.split('<br>').join('\n').split('\n');
  return lines
    .map(line => line.replace(/<[^>]*>/g, '').trim())
    .filter(line => line && !line.startsWith('*') && line.length > 0)
    .slice(0, 4);
}

export function parseGoogleSheetsCSV(csvContent: string): ImportedQuestion[] {
  return parseCSVQuestions(csvContent);
}

export function validateImportedQuestions(questions: ImportedQuestion[]): {
  valid: ImportedQuestion[];
  errors: string[];
} {
  const valid: ImportedQuestion[] = [];
  const errors: string[] = [];

  questions.forEach((q, index) => {
    const lineNum = index + 1;

    if (!q.question || q.question.trim().length === 0) {
      errors.push(`Line ${lineNum}: Question text is empty`);
      return;
    }

    if (!q.choices || q.choices.length < 2) {
      errors.push(`Line ${lineNum}: Must have at least 2 answer choices`);
      return;
    }

    if (q.choices.some(c => !c || c.trim().length === 0)) {
      errors.push(`Line ${lineNum}: One or more answer choices are empty`);
      return;
    }

    if (q.correct_answer_index < 0 || q.correct_answer_index >= q.choices.length) {
      errors.push(`Line ${lineNum}: Correct answer index is out of range`);
      return;
    }

    valid.push(q);
  });

  return { valid, errors };
}