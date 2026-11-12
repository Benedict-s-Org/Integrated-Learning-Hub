/**
 * Notion is the source for the micro-skill list, SRS questions, and proofreading questions.
 * Taught ticks, attempts, and set history stay in the app database.
 */

import { supabase } from '@/integrations/supabase/client';
import type { LsPracticeQuestion } from './seedQuestionBank';
import type { GrammarMicroSkill, GrammarMicroSkillStatus } from './types';
import type { ProofreadingPair } from './proofreadingConceptCheck';

export const NOTION_LEARNING_SYSTEM_IDS = {
  learning_system_micro_skills_db_id: '9b6f9cf31a1847d6afb8600d74d3f33b',
  learning_system_srs_db_id: 'b9e05a5fd576487db54476387789d566',
  learning_system_proofreading_db_id: '12fb6903584049f6b79282b166c86df4',
} as const;

export interface NotionProofreadingItem extends ProofreadingPair {
  skillId: string;
  pageId: string;
}

const STATUSES = new Set<GrammarMicroSkillStatus>(['draft', 'review', 'active', 'retired']);

function plain(prop: any): string {
  if (!prop) return '';
  if (prop.type === 'title') return (prop.title || []).map((part: any) => part.plain_text || '').join('');
  if (prop.type === 'rich_text') return (prop.rich_text || []).map((part: any) => part.plain_text || '').join('');
  if (prop.type === 'select') return prop.select?.name || '';
  if (prop.type === 'checkbox') return prop.checkbox ? '__YES__' : '__NO__';
  return '';
}

function names(prop: any): string[] {
  if (!prop || prop.type !== 'multi_select') return [];
  return (prop.multi_select || []).map((option: any) => option.name).filter(Boolean);
}

function schoolUnit(notes: string): string | null {
  const match = notes.match(/School unit:\s*(P\.[1-6]\s+\S+)/);
  return match ? match[1] : null;
}

function yearFromSkillId(skillId: string): number | null {
  const match = skillId.match(/^p([1-6])_/);
  return match ? Number(match[1]) : null;
}

async function databaseId(key: keyof typeof NOTION_LEARNING_SYSTEM_IDS): Promise<string> {
  const { data, error } = await (supabase as any)
    .from('system_config')
    .select('value')
    .eq('key', 'notion_database_ids')
    .maybeSingle();
  if (error) throw error;
  let parsed: Record<string, string> = {};
  if (data?.value) {
    parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
  }
  return parsed[key] || NOTION_LEARNING_SYSTEM_IDS[key];
}

async function queryNotionDatabase(id: string): Promise<any[]> {
  const { data, error } = await supabase.functions.invoke('notion-api', {
    body: { action: 'query-mcq-database', databaseId: id },
    headers: {
      'x-action': 'query-mcq-database',
      'x-database-id': id,
    },
  });
  if (error) throw new Error(error.message || 'Could not read Notion.');
  if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : 'Could not read Notion.');
  if (!Array.isArray(data?.results)) throw new Error('Notion returned no pages.');
  return data.results.filter((page: any) => !page.archived);
}

export async function fetchNotionMicroSkills(): Promise<GrammarMicroSkill[]> {
  const pages = await queryNotionDatabase(await databaseId('learning_system_micro_skills_db_id'));
  const skills: GrammarMicroSkill[] = [];
  for (const page of pages) {
    const props = page.properties || {};
    const id = plain(props['Micro-skill ID']).replace(/\\_/g, '_').trim();
    const statusText = plain(props.Status) as GrammarMicroSkillStatus;
    if (!id || !STATUSES.has(statusText) || statusText === 'retired') continue;
    const options = plain(props['Example options'])
      .split('|')
      .map((option) => option.trim())
      .filter(Boolean);
    const correct = plain(props['Example correct']).trim();
    const correctIndex = options.findIndex((option) => option.toLowerCase() === correct.toLowerCase());
    skills.push({
      id,
      name: plain(props.Name).trim() || id,
      measures: plain(props.Measures).trim(),
      boundary: plain(props.Boundary).trim() || null,
      chapter_ref: schoolUnit(plain(props.Notes)),
      concept: plain(props.Concept).trim() || null,
      branch: plain(props.Branch).trim() || null,
      longman_refs: names(props['Longman refs']),
      example_stem: plain(props['Example stem']).trim() || null,
      example_options: options.length > 0 ? options : null,
      example_correct_index: correctIndex >= 0 ? correctIndex : null,
      variation_tags: names(props['Variation tags']),
      status: statusText,
      round1_in_scope: plain(props['Round1 in scope']) === '__YES__',
    });
  }
  skills.sort((a, b) => a.id.localeCompare(b.id));
  return skills;
}

export async function fetchNotionSkillMap(): Promise<Map<string, GrammarMicroSkill>> {
  const skills = await fetchNotionMicroSkills();
  return new Map(skills.map((skill) => [skill.id, skill]));
}

export async function fetchNotionProofreadingItems(): Promise<NotionProofreadingItem[]> {
  const pages = await queryNotionDatabase(await databaseId('learning_system_proofreading_db_id'));
  const items: NotionProofreadingItem[] = [];
  for (const page of pages) {
    const props = page.properties || {};
    const skillId = plain(props['Micro-skill ID']).replace(/\\_/g, '_').trim();
    const sentence = plain(props.Question).trim();
    const error = plain(props.Error).trim();
    const corrected = plain(props.Corrected).trim();
    if (!skillId || !sentence || !error || !corrected) continue;
    const hits = sentence.split(/\s+/).filter((token) => {
      const norm = (value: string) => value.replace(/[^\w']/g, '').toLowerCase();
      return norm(token) === norm(error);
    });
    if (hits.length !== 1) continue;
    items.push({ skillId, sentence, error, corrected, pageId: page.id });
  }
  return items;
}

export function groupProofreadingBank(
  items: NotionProofreadingItem[]
): Map<string, ProofreadingPair[]> {
  const bank = new Map<string, ProofreadingPair[]>();
  for (const item of items) {
    const list = bank.get(item.skillId) ?? [];
    list.push({ sentence: item.sentence, error: item.error, corrected: item.corrected });
    bank.set(item.skillId, list);
  }
  return bank;
}

export async function fetchNotionSrsQuestions(): Promise<LsPracticeQuestion[]> {
  const pages = await queryNotionDatabase(await databaseId('learning_system_srs_db_id'));
  const questions: LsPracticeQuestion[] = [];
  for (const page of pages) {
    const props = page.properties || {};
    const skillId = plain(props['Micro-skill ID']).replace(/\\_/g, '_').trim();
    const stem = plain(props.Question).trim();
    const options = ['Choice A', 'Choice B', 'Choice C', 'Choice D']
      .map((name) => plain(props[name]).trim())
      .filter(Boolean);
    const correct = plain(props['Correct Answer']).trim();
    const correctIndex = options.findIndex((option) => option.toLowerCase() === correct.toLowerCase());
    const grade = names(props['Grade tags']).find((tag) => /^P\.[1-6]$/.test(tag));
    const yearLevel = grade ? Number(grade.slice(2)) : yearFromSkillId(skillId);
    if (!skillId || !stem || options.length < 2 || correctIndex < 0 || yearLevel == null) continue;
    questions.push({
      id: `notion-srs:${page.id}`,
      skillId,
      yearLevel,
      isDue: true,
      stem,
      options,
      correctIndex,
      isSeedScaffold: false,
    });
  }
  return questions;
}
