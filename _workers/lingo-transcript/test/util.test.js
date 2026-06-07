import { describe, it, expect } from 'vitest';
import { extractVideoId, chunk, mergeCuesWithTranslations } from '../src/util.js';

describe('extractVideoId', () => {
  it('extracts from watch URL', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('extracts from youtu.be short URL', () => {
    expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ?t=10')).toBe('dQw4w9WgXcQ');
  });
  it('extracts from shorts URL', () => {
    expect(extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('extracts from raw videoId', () => {
    expect(extractVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('returns null for non-YouTube URLs', () => {
    expect(extractVideoId('https://example.com/video')).toBeNull();
  });
  it('returns null for empty input', () => {
    expect(extractVideoId('')).toBeNull();
  });
});

describe('chunk', () => {
  it('splits array into N-sized groups', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it('returns empty array for empty input', () => {
    expect(chunk([], 3)).toEqual([]);
  });
  it('returns one chunk when size >= length', () => {
    expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
  });
});

describe('mergeCuesWithTranslations', () => {
  it('pairs cues with translations by index', () => {
    const cues = [
      { start: 0, end: 2, en: 'Hello.' },
      { start: 2, end: 4, en: 'World.' },
    ];
    const ja = ['こんにちは。', '世界。'];
    expect(mergeCuesWithTranslations(cues, ja)).toEqual([
      { start: 0, end: 2, en: 'Hello.', ja: 'こんにちは。' },
      { start: 2, end: 4, en: 'World.', ja: '世界。' },
    ]);
  });
  it('falls back to empty string when translation missing', () => {
    const cues = [{ start: 0, end: 2, en: 'Hello.' }];
    expect(mergeCuesWithTranslations(cues, [])).toEqual([
      { start: 0, end: 2, en: 'Hello.', ja: '' },
    ]);
  });
});
