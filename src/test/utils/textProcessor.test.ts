import { describe, it, expect } from 'vitest';
import { processText, toggleWordSelection, getSelectedWordIndices } from '../../utils/textProcessor';

describe('textProcessor utilities', () => {
  describe('processText', () => {
    it('processes simple text correctly', () => {
      const text = 'Hello world test';
      const result = processText(text);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        text: 'Hello',
        index: 0,
        isSelected: false,
        isPunctuation: false,
      });
    });

    it('handles punctuation correctly', () => {
      const text = 'Hello, world!';
      const result = processText(text);
      
      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('Hello,');
      expect(result[0].isPunctuation).toBe(false);
      expect(result[1].text).toBe('world!');
      expect(result[1].isPunctuation).toBe(false);
    });

    it('handles hyphenated words', () => {
      const text = 'mother-in-law visited';
      const result = processText(text);
      
      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('mother-in-law');
      expect(result[0].isPunctuation).toBe(false);
    });
  });

  describe('toggleWordSelection', () => {
    it('toggles word selection correctly', () => {
      const words = processText('Hello world');
      const result = toggleWordSelection(words, 0);
      
      expect(result[0].isSelected).toBe(true);
      expect(result[1].isSelected).toBe(false);
    });

    it('does not select punctuation', () => {
      const words = [
        { text: '.', index: 0, isSelected: false, isPunctuation: true },
        { text: 'hello', index: 1, isSelected: false, isPunctuation: false },
      ];
      
      const result = toggleWordSelection(words, 0);
      expect(result[0].isSelected).toBe(false);
    });
  });

  describe('getSelectedWordIndices', () => {
    it('returns indices of selected words', () => {
      const words = [
        { text: 'hello', index: 0, isSelected: true, isPunctuation: false },
        { text: 'world', index: 1, isSelected: false, isPunctuation: false },
        { text: 'test', index: 2, isSelected: true, isPunctuation: false },
      ];
      
      const result = getSelectedWordIndices(words);
      expect(result).toEqual([0, 2]);
    });
  });
});