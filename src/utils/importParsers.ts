import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface ImportedQuestion {
  question: string;
  choices: string[];
  correct_answer_index: number;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
}

// ─── CSV Parsing (via papaparse) ───────────────────────────────────────

export function parseCSVQuestions(csvContent: string): ImportedQuestion[] {
  const result = Papa.parse<string[]>(csvContent, {
    skipEmptyLines: true,
    header: false,
  });

  const questions: ImportedQuestion[] = [];

  for (const row of result.data) {
    if (row.length < 6) continue;

    // Try to detect header row
    const firstCell = (row[0] || '').toLowerCase().trim();
    if (firstCell === 'question' || firstCell === 'question text') continue;

    const parsed = parseRowToQuestion(row);
    if (parsed) questions.push(parsed);
  }

  return questions;
}

function parseRowToQuestion(columns: string[]): ImportedQuestion | null {
  const [question, choice1, choice2, choice3, choice4, correctIndex, explanation, difficulty] = columns;

  if (!question?.trim() || !choice1?.trim() || !choice2?.trim() || !choice3?.trim() || !choice4?.trim()) {
    return null;
  }

  const correct = parseInt(correctIndex || '0', 10);
  if (isNaN(correct) || correct < 0 || correct > 3) return null;

  return {
    question: question.trim(),
    choices: [choice1.trim(), choice2.trim(), choice3.trim(), choice4.trim()],
    correct_answer_index: correct,
    explanation: explanation?.trim() || undefined,
    difficulty: parseDifficulty(difficulty?.trim()),
    tags: [],
  };
}

function parseDifficulty(val?: string): 'easy' | 'medium' | 'hard' {
  if (!val) return 'medium';
  const lower = val.toLowerCase();
  if (lower === 'easy') return 'easy';
  if (lower === 'hard') return 'hard';
  return 'medium';
}

// ─── XLSX Parsing ──────────────────────────────────────────────────────

export function parseXLSXQuestions(arrayBuffer: ArrayBuffer): ImportedQuestion[] {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const questions: ImportedQuestion[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 6) continue;

    // Skip header row
    const firstCell = (String(row[0]) || '').toLowerCase().trim();
    if (firstCell === 'question' || firstCell === 'question text') continue;

    const stringRow = row.map(cell => String(cell));
    const parsed = parseRowToQuestion(stringRow);
    if (parsed) questions.push(parsed);
  }

  return questions;
}

// ─── Notion JSON Parsing (for Notion export files) ─────────────────────

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
  const titleProp = block.properties?.Title || block.properties?.Question || block.properties?.question;
  const choicesProp = block.properties?.Choices || block.properties?.choices;
  const answerProp = block.properties?.Answer || block.properties?.answer || block.properties?.['Correct Answer'];
  const explanationProp = block.properties?.Explanation || block.properties?.explanation;

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
  if (prop?.title) {
    return prop.title.map((t: any) => t.plain_text || '').join('');
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

// ─── Notion API Response Parsing ───────────────────────────────────────

export function parseNotionAPIResponse(results: any[]): ImportedQuestion[] {
  const questions: ImportedQuestion[] = [];

  for (const page of results) {
    const props = page.properties || {};

    // Flexible property name matching
    const questionText = extractNotionProperty(props, ['Question', 'question', 'Title', 'title', 'Name', 'name']);
    const choiceA = extractNotionProperty(props, ['Choice A', 'choice_a', 'Option A', 'option_a', 'A']);
    const choiceB = extractNotionProperty(props, ['Choice B', 'choice_b', 'Option B', 'option_b', 'B']);
    const choiceC = extractNotionProperty(props, ['Choice C', 'choice_c', 'Option C', 'option_c', 'C']);
    const choiceD = extractNotionProperty(props, ['Choice D', 'choice_d', 'Option D', 'option_d', 'D']);
    const correctAnswer = extractNotionProperty(props, ['Correct Answer', 'correct_answer', 'Answer', 'answer', 'Correct']);
    const explanation = extractNotionProperty(props, ['Explanation', 'explanation', 'Note', 'note']);
    const difficulty = extractNotionProperty(props, ['Difficulty', 'difficulty', 'Level', 'level']);

    if (!questionText) continue;

    // Build choices array
    const choices: string[] = [];
    if (choiceA) choices.push(choiceA);
    if (choiceB) choices.push(choiceB);
    if (choiceC) choices.push(choiceC);
    if (choiceD) choices.push(choiceD);

    if (choices.length < 2) continue;

    // Determine correct answer index
    let correctIndex = -1;
    if (correctAnswer) {
      // Try as number (0-3)
      const num = parseInt(correctAnswer, 10);
      if (!isNaN(num) && num >= 0 && num < choices.length) {
        correctIndex = num;
      } else {
        // Try as letter (A, B, C, D)
        const letter = correctAnswer.toUpperCase().trim();
        if (letter === 'A') correctIndex = 0;
        else if (letter === 'B') correctIndex = 1;
        else if (letter === 'C') correctIndex = 2;
        else if (letter === 'D') correctIndex = 3;
        else {
          // Try matching by text
          correctIndex = choices.findIndex(c => c.toLowerCase() === correctAnswer.toLowerCase());
        }
      }
    }

    if (correctIndex < 0 || correctIndex >= choices.length) continue;

    // Pad to 4 choices if needed
    while (choices.length < 4) {
      choices.push('');
    }

    questions.push({
      question: questionText,
      choices: choices.slice(0, 4),
      correct_answer_index: correctIndex,
      explanation: explanation || undefined,
      difficulty: parseDifficulty(difficulty || undefined),
      tags: [],
    });
  }

  return questions;
}

function extractNotionProperty(props: Record<string, any>, possibleNames: string[]): string {
  for (const name of possibleNames) {
    const prop = props[name];
    if (!prop) continue;

    if (prop.type === 'title' && prop.title?.[0]) {
      return prop.title[0].plain_text || '';
    }
    if (prop.type === 'rich_text' && prop.rich_text?.[0]) {
      return prop.rich_text.map((rt: any) => rt.plain_text || '').join('');
    }
    if (prop.type === 'select' && prop.select) {
      return prop.select.name || '';
    }
    if (prop.type === 'number' && prop.number !== null) {
      return String(prop.number);
    }
  }
  return '';
}

// ─── Template Generators ───────────────────────────────────────────────

export function generateCSVTemplate(): string {
  const header = 'Question,Choice A,Choice B,Choice C,Choice D,Correct Answer Index (0-3),Explanation,Difficulty';
  const example1 = '"What is the capital of France?","London","Paris","Berlin","Madrid",1,"Paris is the capital city of France",easy';
  const example2 = '"Which planet is closest to the Sun?","Venus","Mercury","Earth","Mars",1,"Mercury orbits closest to the Sun",medium';
  return [header, example1, example2].join('\n');
}

export function generateXLSXTemplate(): ArrayBuffer {
  const data = [
    ['Question', 'Choice A', 'Choice B', 'Choice C', 'Choice D', 'Correct Answer Index (0-3)', 'Explanation', 'Difficulty'],
    ['What is the capital of France?', 'London', 'Paris', 'Berlin', 'Madrid', 1, 'Paris is the capital city of France', 'easy'],
    ['Which planet is closest to the Sun?', 'Venus', 'Mercury', 'Earth', 'Mars', 1, 'Mercury orbits closest to the Sun', 'medium'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = [
    { wch: 40 }, // Question
    { wch: 15 }, // Choice A
    { wch: 15 }, // Choice B
    { wch: 15 }, // Choice C
    { wch: 15 }, // Choice D
    { wch: 10 }, // Correct Index
    { wch: 40 }, // Explanation
    { wch: 10 }, // Difficulty
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');

  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

// ─── Validation ────────────────────────────────────────────────────────

export function validateImportedQuestions(questions: ImportedQuestion[]): {
  valid: ImportedQuestion[];
  errors: string[];
} {
  const valid: ImportedQuestion[] = [];
  const errors: string[] = [];

  questions.forEach((q, index) => {
    const lineNum = index + 1;

    if (!q.question || q.question.trim().length === 0) {
      errors.push(`Row ${lineNum}: Question text is empty`);
      return;
    }

    if (!q.choices || q.choices.length < 2) {
      errors.push(`Row ${lineNum}: Must have at least 2 answer choices`);
      return;
    }

    const nonEmptyChoices = q.choices.filter(c => c && c.trim().length > 0);
    if (nonEmptyChoices.length < 2) {
      errors.push(`Row ${lineNum}: Must have at least 2 non-empty answer choices`);
      return;
    }

    if (q.correct_answer_index < 0 || q.correct_answer_index >= q.choices.length) {
      errors.push(`Row ${lineNum}: Correct answer index is out of range (must be 0-${q.choices.length - 1})`);
      return;
    }

    if (!q.choices[q.correct_answer_index] || q.choices[q.correct_answer_index].trim().length === 0) {
      errors.push(`Row ${lineNum}: The correct answer choice is empty`);
      return;
    }

    valid.push(q);
  });

  return { valid, errors };
}