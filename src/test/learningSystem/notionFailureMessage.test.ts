import { describe, expect, it } from 'vitest';
import { messageFromNotionFailure } from '../../lib/learningSystem/notionErrors';

describe('messageFromNotionFailure', () => {
  it('explains a database the Anagram connection cannot see', () => {
    expect(
      messageFromNotionFailure(
        'Could not find database with ID: 12fb6903-5840-49f6-b792-82b166c86df4. Make sure the relevant pages and databases are shared with your integration "Anagram".'
      )
    ).toBe(
      'The Learning System question bank is not shared with the app connection. Ask a teacher to add the Anagram connection in Notion.'
    );
  });

  it('replaces the generic edge-function status', () => {
    expect(messageFromNotionFailure('Edge Function returned a non-2xx status code')).toBe(
      'Could not read the Learning System question bank. Try again, and ask a teacher if this continues.'
    );
    expect(messageFromNotionFailure('')).toBe(
      'Could not read the Learning System question bank. Try again, and ask a teacher if this continues.'
    );
  });

  it('keeps other Notion messages', () => {
    expect(messageFromNotionFailure('Missing NOTION_TOKEN')).toBe('Missing NOTION_TOKEN');
  });
});
