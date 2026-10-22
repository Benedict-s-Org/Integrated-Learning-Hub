import { describe, it, expect } from 'vitest';
import {
  normalizeClass,
  normalizeClassNumber,
  normalizeStudentName,
  crossCheckIdentity,
  computeIdentityMatchingPreview,
} from '../identityMatchingLogic';
import { StudentRosterItem, ScanPage, PageIdentityRecognition } from '../../types';

describe('identityMatchingLogic', () => {
  const sampleStudents: StudentRosterItem[] = [
    { id: 's1', displayName: 'Chan Tai Man', classNumber: 1, className: '3A' },
    { id: 's2', displayName: 'Wong Ka Yan', classNumber: 2, className: '3A' },
    { id: 's3', displayName: 'Lee Siu Lung', classNumber: 3, className: '3A' },
    { id: 's4', displayName: 'Cheung Ho Yin', classNumber: 4, className: '3A' },
  ];

  describe('Normalization', () => {
    it('normalizes class names with full-width characters and spaces', () => {
      expect(normalizeClass('3A')).toBe('3A');
      expect(normalizeClass('３Ａ')).toBe('3A');
      expect(normalizeClass('3 a')).toBe('3A');
      expect(normalizeClass(' 3A ')).toBe('3A');
      expect(normalizeClass(null)).toBeNull();
      expect(normalizeClass('unreadable')).toBeNull();
    });

    it('normalizes class numbers handling leading zeros and full-width numbers', () => {
      expect(normalizeClassNumber('03')).toBe(3);
      expect(normalizeClassNumber('3')).toBe(3);
      expect(normalizeClassNumber('３')).toBe(3);
      expect(normalizeClassNumber(3)).toBe(3);
      expect(normalizeClassNumber(null)).toBeNull();
      expect(normalizeClassNumber('unreadable')).toBeNull();
    });

    it('normalizes student names handling spaces and full-width chars', () => {
      expect(normalizeStudentName('Chan Tai Man')).toBe('chan tai man');
      expect(normalizeStudentName('  Chan   Tai   Man  ')).toBe('chan tai man');
      expect(normalizeStudentName('Ｃhan Ｔai Ｍan')).toBe('chan tai man');
      expect(normalizeStudentName(null)).toBeNull();
    });
  });

  describe('3-Way Cross Check Rules', () => {
    it('matches when Class, Name, and Number all match uniquely', () => {
      const res = crossCheckIdentity(
        {
          rawClass: '3A',
          rawStudentName: 'Chan Tai Man',
          rawClassNumber: '01',
          classReadable: true,
          nameReadable: true,
          numberReadable: true,
        },
        sampleStudents,
        '3A'
      );

      expect(res.status).toBe('matched');
      expect(res.matchedStudentId).toBe('s1');
    });

    it('gives needs_review when 2 match and 1 is unreadable (Name unreadable)', () => {
      const res = crossCheckIdentity(
        {
          rawClass: '3A',
          rawStudentName: null,
          rawClassNumber: '02',
          classReadable: true,
          nameReadable: false,
          numberReadable: true,
        },
        sampleStudents,
        '3A'
      );

      expect(res.status).toBe('needs_review');
      expect(res.matchedStudentId).toBeNull();
      expect(res.candidateStudentIds).toEqual(['s2']);
    });

    it('gives needs_review when 2 match and 1 is unreadable (Number unreadable)', () => {
      const res = crossCheckIdentity(
        {
          rawClass: '3A',
          rawStudentName: 'Lee Siu Lung',
          rawClassNumber: null,
          classReadable: true,
          nameReadable: true,
          numberReadable: false,
        },
        sampleStudents,
        '3A'
      );

      expect(res.status).toBe('needs_review');
      expect(res.matchedStudentId).toBeNull();
      expect(res.candidateStudentIds).toEqual(['s3']);
    });

    it('gives conflict when Name belongs to Student A but Number belongs to Student B (no majority vote)', () => {
      const res = crossCheckIdentity(
        {
          rawClass: '3A',
          rawStudentName: 'Chan Tai Man', // Student 1
          rawClassNumber: '02',          // Student 2
          classReadable: true,
          nameReadable: true,
          numberReadable: true,
        },
        sampleStudents,
        '3A'
      );

      expect(res.status).toBe('conflict');
      expect(res.matchedStudentId).toBeNull();
      expect(res.statusReason).toContain('不得採用二比一多數決');
    });

    it('gives conflict when recognized class is different from selected class', () => {
      const res = crossCheckIdentity(
        {
          rawClass: '4A',
          rawStudentName: 'Chan Tai Man',
          rawClassNumber: '01',
          classReadable: true,
          nameReadable: true,
          numberReadable: true,
        },
        sampleStudents,
        '3A'
      );

      expect(res.status).toBe('conflict');
      expect(res.matchedStudentId).toBeNull();
    });

    it('gives unmatched when all fields are unreadable (does not inherit previous student)', () => {
      const res = crossCheckIdentity(
        {
          rawClass: null,
          rawStudentName: null,
          rawClassNumber: null,
          classReadable: false,
          nameReadable: false,
          numberReadable: false,
        },
        sampleStudents,
        '3A'
      );

      expect(res.status).toBe('unmatched');
      expect(res.matchedStudentId).toBeNull();
    });
  });

  describe('Non-consecutive grouping & Preview', () => {
    it('groups non-consecutive pages of the same student in original scan order', () => {
      const pages: ScanPage[] = [
        { id: 'p1', fileId: 'f1', fileName: 'scan.pdf', sourcePageNumber: 1, previewUrl: '', orderIndex: 0 },
        { id: 'p2', fileId: 'f1', fileName: 'scan.pdf', sourcePageNumber: 2, previewUrl: '', orderIndex: 1 },
        { id: 'p3', fileId: 'f1', fileName: 'scan.pdf', sourcePageNumber: 3, previewUrl: '', orderIndex: 2 },
      ];

      // Page 1: Student 1
      // Page 2: Student 2
      // Page 3: Student 1 (non-consecutive second page for student 1)
      const recognitions: Record<string, PageIdentityRecognition> = {
        p1: {
          scanPageId: 'p1',
          pageNumber: 1,
          rawClass: '3A',
          rawStudentName: 'Chan Tai Man',
          rawClassNumber: '1',
          classReadable: true,
          nameReadable: true,
          numberReadable: true,
          warnings: [],
          status: 'matched',
          matchedStudentId: 's1',
        },
        p2: {
          scanPageId: 'p2',
          pageNumber: 2,
          rawClass: '3A',
          rawStudentName: 'Wong Ka Yan',
          rawClassNumber: '2',
          classReadable: true,
          nameReadable: true,
          numberReadable: true,
          warnings: [],
          status: 'matched',
          matchedStudentId: 's2',
        },
        p3: {
          scanPageId: 'p3',
          pageNumber: 3,
          rawClass: '3A',
          rawStudentName: 'Chan Tai Man',
          rawClassNumber: '1',
          classReadable: true,
          nameReadable: true,
          numberReadable: true,
          warnings: [],
          status: 'matched',
          matchedStudentId: 's1',
        },
      };

      const result = computeIdentityMatchingPreview(pages, recognitions, sampleStudents);

      // Student 1 should have 2 pages
      expect(result.studentPageCounts[0]).toBe(2);
      // Student 2 should have 1 page
      expect(result.studentPageCounts[1]).toBe(1);
      // Student 3 should have 0 pages
      expect(result.studentPageCounts[2]).toBe(0);

      // Check preview map part and total
      expect(result.preview.map[0]).toEqual({
        studentIndex: 0,
        studentId: 's1',
        studentName: 'Chan Tai Man',
        classNumber: 1,
        part: 1,
        total: 2,
      });

      expect(result.preview.map[1]).toEqual({
        studentIndex: 1,
        studentId: 's2',
        studentName: 'Wong Ka Yan',
        classNumber: 2,
        part: 1,
        total: 1,
      });

      expect(result.preview.map[2]).toEqual({
        studentIndex: 0,
        studentId: 's1',
        studentName: 'Chan Tai Man',
        classNumber: 1,
        part: 2,
        total: 2,
      });
    });

    it('preserves non-numeric matched order [3, 1, 4, 2] instead of numeric roster order [1, 2, 3, 4]', () => {
      const pages: ScanPage[] = [
        { id: 'p1', fileId: 'f1', fileName: 'page1.jpg', sourcePageNumber: 1, previewUrl: '', orderIndex: 0 },
        { id: 'p2', fileId: 'f1', fileName: 'page2.jpg', sourcePageNumber: 2, previewUrl: '', orderIndex: 1 },
        { id: 'p3', fileId: 'f1', fileName: 'page3.jpg', sourcePageNumber: 3, previewUrl: '', orderIndex: 2 },
        { id: 'p4', fileId: 'f1', fileName: 'page4.jpg', sourcePageNumber: 4, previewUrl: '', orderIndex: 3 },
      ];

      // Source order [1, 2, 3, 4] matched to students in order [s3, s1, s4, s2]
      const recognitions: Record<string, PageIdentityRecognition> = {
        p1: {
          scanPageId: 'p1',
          pageNumber: 1,
          rawClass: '3A',
          rawStudentName: 'Lee Siu Lung',
          rawClassNumber: '3',
          classReadable: true,
          nameReadable: true,
          numberReadable: true,
          warnings: [],
          status: 'matched',
          matchedStudentId: 's3', // index 2
        },
        p2: {
          scanPageId: 'p2',
          pageNumber: 2,
          rawClass: '3A',
          rawStudentName: 'Chan Tai Man',
          rawClassNumber: '1',
          classReadable: true,
          nameReadable: true,
          numberReadable: true,
          warnings: [],
          status: 'matched',
          matchedStudentId: 's1', // index 0
        },
        p3: {
          scanPageId: 'p3',
          pageNumber: 3,
          rawClass: '3A',
          rawStudentName: 'Cheung Ho Yin',
          rawClassNumber: '4',
          classReadable: true,
          nameReadable: true,
          numberReadable: true,
          warnings: [],
          status: 'matched',
          matchedStudentId: 's4', // index 3
        },
        p4: {
          scanPageId: 'p4',
          pageNumber: 4,
          rawClass: '3A',
          rawStudentName: 'Wong Ka Yan',
          rawClassNumber: '2',
          classReadable: true,
          nameReadable: true,
          numberReadable: true,
          warnings: [],
          status: 'matched',
          matchedStudentId: 's2', // index 1
        },
      };

      const result = computeIdentityMatchingPreview(pages, recognitions, sampleStudents);

      // Must preserve the non-numeric matched order [2, 0, 3, 1] corresponding to [s3, s1, s4, s2]
      expect(result.assignedStudentIndices).toEqual([2, 0, 3, 1]);

      // Every student remains correctly linked to their respective page
      expect(result.preview.map[0]?.studentId).toBe('s3');
      expect(result.preview.map[0]?.studentIndex).toBe(2);
      expect(result.preview.map[1]?.studentId).toBe('s1');
      expect(result.preview.map[1]?.studentIndex).toBe(0);
      expect(result.preview.map[2]?.studentId).toBe('s4');
      expect(result.preview.map[2]?.studentIndex).toBe(3);
      expect(result.preview.map[3]?.studentId).toBe('s2');
      expect(result.preview.map[3]?.studentIndex).toBe(1);
    });

    it('ensures unmatched and ambiguous scripts do not disturb the confirmed matches order', () => {
      const pages: ScanPage[] = [
        { id: 'p1', fileId: 'f1', fileName: 'page1.jpg', sourcePageNumber: 1, previewUrl: '', orderIndex: 0 },
        { id: 'p2', fileId: 'f1', fileName: 'page2.jpg', sourcePageNumber: 2, previewUrl: '', orderIndex: 1 },
        { id: 'p3', fileId: 'f1', fileName: 'page3.jpg', sourcePageNumber: 3, previewUrl: '', orderIndex: 2 }, // unmatched
        { id: 'p4', fileId: 'f1', fileName: 'page4.jpg', sourcePageNumber: 4, previewUrl: '', orderIndex: 3 },
        { id: 'p5', fileId: 'f1', fileName: 'page5.jpg', sourcePageNumber: 5, previewUrl: '', orderIndex: 4 },
      ];

      const recognitions: Record<string, PageIdentityRecognition> = {
        p1: {
          scanPageId: 'p1',
          pageNumber: 1,
          rawClass: '3A',
          rawStudentName: 'Lee Siu Lung',
          rawClassNumber: '3',
          classReadable: true,
          nameReadable: true,
          numberReadable: true,
          warnings: [],
          status: 'matched',
          matchedStudentId: 's3',
        },
        p2: {
          scanPageId: 'p2',
          pageNumber: 2,
          rawClass: '3A',
          rawStudentName: 'Chan Tai Man',
          rawClassNumber: '1',
          classReadable: true,
          nameReadable: true,
          numberReadable: true,
          warnings: [],
          status: 'matched',
          matchedStudentId: 's1',
        },
        p3: {
          scanPageId: 'p3',
          pageNumber: 3,
          rawClass: '3A',
          rawStudentName: null,
          rawClassNumber: null,
          classReadable: false,
          nameReadable: false,
          numberReadable: false,
          warnings: ['Unreadable'],
          status: 'unmatched',
          matchedStudentId: null,
        },
        p4: {
          scanPageId: 'p4',
          pageNumber: 4,
          rawClass: '3A',
          rawStudentName: 'Cheung Ho Yin',
          rawClassNumber: '4',
          classReadable: true,
          nameReadable: true,
          numberReadable: true,
          warnings: [],
          status: 'matched',
          matchedStudentId: 's4',
        },
        p5: {
          scanPageId: 'p5',
          pageNumber: 5,
          rawClass: '3A',
          rawStudentName: 'Wong Ka Yan',
          rawClassNumber: '2',
          classReadable: true,
          nameReadable: true,
          numberReadable: true,
          warnings: [],
          status: 'matched',
          matchedStudentId: 's2',
        },
      };

      const result = computeIdentityMatchingPreview(pages, recognitions, sampleStudents);

      // Unmatched page p3 should be counted as unmatched, and confirmed order remains [2, 0, 3, 1]
      expect(result.unmatchedPagesCount).toBe(1);
      expect(result.preview.map[2]).toBeNull();
      expect(result.assignedStudentIndices).toEqual([2, 0, 3, 1]);
    });
  });
});
