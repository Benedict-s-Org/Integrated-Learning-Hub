import { Word } from '../types';

// 定義可作為「詞」的字符模式（英文字母、數字、各種中日韓字符）
const wordCharPattern = '[A-Za-z\\d\\u4e00-\\u9fff\\u3400-\\u4dbf\\u20000-\\u2a6df\\u2a700-\\u2b73f\\u2b740-\\u2b81f\\u2b820-\\u2ceaf\\u2ceb0-\\u2ebef\\u30000-\\u3134f]';

// 可以被選作詞的特殊標點符號
const selectableSpecialChars = new Set(['，', '（', '）', ',', '？', '：', '！', '+']);

// 判斷是否為中文字符（涵蓋多個 CJK 區段與相關標點）
const isChineseChar = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return (
    (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
    (code >= 0x3400 && code <= 0x4dbf) || // CJK Extension A
    (code >= 0x20000 && code <= 0x2a6df) || // CJK Extension B
    (code >= 0x2a700 && code <= 0x2b73f) || // CJK Extension C
    (code >= 0x2b740 && code <= 0x2b81f) || // CJK Extension D
    (code >= 0x2b820 && code <= 0x2ceaf) || // CJK Extension E
    (code >= 0x2ceb0 && code <= 0x2ebef) || // CJK Extension F
    (code >= 0x30000 && code <= 0x3134f) || // CJK Extension G
    (code >= 0x3190 && code <= 0x319f) || // Kanbun
    (code >= 0x2e80 && code <= 0x2eff) || // CJK Radicals Supplement
    (code >= 0x2f00 && code <= 0x2fdf) || // Kangxi Radicals
    (code >= 0x31c0 && code <= 0x31ef) || // CJK Strokes
    (code >= 0x2ff0 && code <= 0x2fff) || // Ideographic Description Characters
    (code >= 0x3000 && code <= 0x303f) || // CJK Symbols and Punctuation
    (code >= 0x3040 && code <= 0x309f) || // Hiragana
    (code >= 0x30a0 && code <= 0x30ff) || // Katakana
    (code >= 0xff00 && code <= 0xffef)    // Halfwidth and Fullwidth Forms
  );
};

// 判斷文本是否為有效可選文字（僅包含詞字符的完整標記）
const isActualWord = (text: string): boolean => {
  if (selectableSpecialChars.has(text)) return true;  // treat listed punctuations as words
  // Allow words with hyphens (e.g., self-esteem, code-switching)
  return new RegExp(`^${wordCharPattern}+$`).test(text) || /^[A-Za-z]+(?:-[A-Za-z]+)+$/.test(text);
};

// 判斷字串是否包含任意中文字符
const containsChineseChars = (text: string): boolean => {
  return Array.from(text).some(char => isChineseChar(char));
};

// 計算字詞寬度，中文字使用較寬字元寬度
const getWordWidth = (text: string): string => {
  const isChineseText = containsChineseChars(text);
  const charWidth = isChineseText ? 1.2 : 0.6;
  const minWidth = text.length === 1 ? 1.5 : 3;
  const baseWidth = Math.max(text.length * charWidth, minWidth);
  return `${baseWidth}rem`;
};

// 主要分詞函式，將文字分割成 Word 物件陣列
export const processText = (text: string): Word[] => {
  const words: Word[] = [];
  //
  // [A-Za-z]+(?:-[A-Za-z]+)*  => 英文詞（支援連字號）
  // \d+                      => 連續數字
  // ${wordCharPattern}       => 单个中日韓字符
  // [.,!?;:，。？！；：""''""''()（）\\[\\]【】] => 明確匹配標點符號
  // [^\s${wordCharPattern}]   => 任何非空白且非詞字符的符號
  // \s+                      => 空白字符
  //
const regex = new RegExp(
  `\\r\\n\\r\\n|\\n\\n|[A-Za-z]+(?:-[A-Za-z]+)*|\\d+|${wordCharPattern}|[.,!?;:，。？！；：""''""''()（）\\[\\]【】]|\\r\\n|\\n|[^\\s${wordCharPattern}.,!?;:，。？！；：""''""''()（）\\[\\]【】]|\\s+`,
  'g'
);

  let match;
  let currentIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    const token = match[0];

    if (token === '\n\n' || token === '\r\n\r\n') {
      // Double newlines are paragraph breaks
      words.push({
        text: '',
        index: currentIndex,
        isMemorized: false,
        isPunctuation: false,
        isParagraphBreak: true,
      });
      currentIndex++;
    } else if (token === '\n' || token === '\r\n') {
      // Single newlines are line breaks (marked as punctuation for rendering)
      words.push({
        text: token,
        index: currentIndex,
        isMemorized: false,
        isPunctuation: true,
      });
      currentIndex++;
    } else if (/^\s+$/.test(token)) {
      // Add spaces for rendering but mark as punctuation so they can't be selected
      // Don't increment index so they don't count as words
      words.push({
        text: token,
        index: -1, // Use -1 to indicate this is not a selectable word
        isMemorized: false,
        isPunctuation: true,
      });
    } else {
      // Regular tokens
      const isPunctuation = !isActualWord(token) && token.trim() !== '';

      words.push({
        text: token,
        index: currentIndex,
        isMemorized: false,
        isPunctuation,
      });
      currentIndex++;
    }
  }

  return words;
};

const getWordAtPosition = (words: Word[], position: number): Word | null => {
  return words.find(word => word.index === position) || null;
};

const toggleWordSelection = (words: Word[], index: number): Word[] => {
  return words.map(word =>
    word.index === index && !word.isPunctuation
      ? { ...word, isMemorized: !word.isMemorized }
      : word
  );
};

export const getSelectedWordIndices = (words: Word[]): number[] => {
  return words.filter(word => word.isMemorized).map(word => word.index);
};

export { getWordWidth };