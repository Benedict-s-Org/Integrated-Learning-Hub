export interface PhonicsMapping {
    id: string;
    grapheme: string;
    phoneme: string;
    plain_label: string | null;
    category: SoundWallCategory;
    level: number;
    vowel_group: string | null;
    sort_order: number;
    audio_url: string | null;
    examples_real: string[] | null;
    examples_nonsense: string[] | null;
}

export type SoundWallCategory = 'vowel' | 'consonant' | 'digraph' | 'blend';
export type SoundWallView = 'practice' | 'chart';

export const SOUND_WALL_LEVELS = [
    { id: 1, label: 'L1 Beginner', shortLabel: 'L1' },
    { id: 2, label: 'L2 Intermediate', shortLabel: 'L2' },
    { id: 3, label: 'L3 Advanced', shortLabel: 'L3' },
    { id: 4, label: 'L4 Mastery', shortLabel: 'L4' },
] as const;

export const SOUND_WALL_CATEGORIES: { value: SoundWallCategory; label: string }[] = [
    { value: 'vowel', label: 'Vowels' },
    { value: 'consonant', label: 'Consonants' },
    { value: 'digraph', label: 'Digraphs' },
    { value: 'blend', label: 'Blends' },
];

/** Flat category color palette — NO gradients */
export const CATEGORY_STYLES: Record<SoundWallCategory, { border: string; bg: string; bgHover: string; ring: string }> = {
    vowel: { border: '#EC8F8D', bg: '#FCE9E8', bgHover: '#F9DCDA', ring: '#EC8F8D' },
    consonant: { border: '#3A9AFF', bg: '#EAF4FF', bgHover: '#D6EAFF', ring: '#3A9AFF' },
    digraph: { border: '#6FBF9A', bg: '#EAF6F0', bgHover: '#D8EDE4', ring: '#6FBF9A' },
    blend: { border: '#E8B36B', bg: '#FBF2E6', bgHover: '#F5E6D0', ring: '#E8B36B' },
};

export const VOWEL_GROUPS = ['a', 'e', 'i', 'o', 'u'] as const;
