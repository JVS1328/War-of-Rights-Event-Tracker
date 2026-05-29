import { describe, it, expect } from 'vitest';
import {
  normalizeRegimentTag,
  extractRegimentTag,
  parseRegimentList,
  matchPlayerToRegimentList,
  resolveRegiment,
} from './regimentMatcher';

describe('normalizeRegimentTag', () => {
  it('strips trailing company suffixes, dots, pipes, and all spaces', () => {
    expect(normalizeRegimentTag('1stTX(A)')).toBe('1stTX');
    expect(normalizeRegimentTag('10thUS.A')).toBe('10thUS');
    expect(normalizeRegimentTag('SR|')).toBe('SR');
    expect(normalizeRegimentTag('23rd NYV')).toBe('23rdNYV');
  });

  it('preserves case (caller upper-cases when needed)', () => {
    expect(normalizeRegimentTag('3rdCB')).toBe('3rdCB');
  });
});

describe('extractRegimentTag', () => {
  it('prioritizes an outer tag before a bracket/brace', () => {
    expect(extractRegimentTag('CB[8th OH]')).toBe('CB');
    expect(extractRegimentTag('MSG{x}')).toBe('MSG');
  });

  it('extracts standard bracket/brace/paren tags (uppercased)', () => {
    expect(extractRegimentTag('[51stAL]Pvt. Joe')).toBe('51STAL');
    expect(extractRegimentTag('{59THNY}bar')).toBe('59THNY');
    expect(extractRegimentTag('(1stTX)baz')).toBe('1STTX');
  });

  it('extracts delimiter-prefixed tags', () => {
    expect(extractRegimentTag('JD-2ndLt.BigMac')).toBe('JD');
    expect(extractRegimentTag('SR|foo')).toBe('SR');
    expect(extractRegimentTag('II-Corps')).toBe('II');
  });

  it('falls back to the first word when it looks like a tag', () => {
    expect(extractRegimentTag('59thNY Smith')).toBe('59THNY');
  });

  it('returns UNTAGGED when nothing tag-like is present', () => {
    expect(extractRegimentTag('lowercase')).toBe('UNTAGGED');
  });
});

describe('parseRegimentList', () => {
  it('parses plain lines into a single uppercased pattern', () => {
    expect(parseRegimentList('3rdCB')).toEqual([{ label: '3rdCB', patterns: ['3RDCB'] }]);
  });

  it('parses "label = pattern, pattern" with a normalized label', () => {
    expect(parseRegimentList('II Corps = II-, II')).toEqual([
      { label: 'IICorps', patterns: ['II-', 'II'] },
    ]);
  });

  it('ignores blank lines', () => {
    expect(parseRegimentList('\n3rdCB\n\n')).toEqual([{ label: '3rdCB', patterns: ['3RDCB'] }]);
  });
});

describe('matchPlayerToRegimentList', () => {
  const list = parseRegimentList('51stNY');

  it('matches a boundary-delimited pattern and returns the label', () => {
    expect(matchPlayerToRegimentList('SB-[51stNY]Vol.x', list)).toBe('51stNY');
  });

  it('matches at string edges', () => {
    expect(matchPlayerToRegimentList('51stNY', list)).toBe('51stNY');
  });

  it('rejects a non-boundary (mid-token) substring match', () => {
    expect(matchPlayerToRegimentList('XYZ51STNYABC', parseRegimentList('51stNY'))).toBeNull();
  });

  it('breaks length ties by entry order (first wins)', () => {
    const tie = parseRegimentList('First = ABC\nSecond = ABC');
    expect(matchPlayerToRegimentList('[ABC]', tie)).toBe('First');
  });

  it('returns null when nothing matches', () => {
    expect(matchPlayerToRegimentList('nobody', list)).toBeNull();
  });
});

describe('resolveRegiment', () => {
  const list = parseRegimentList('51stNY');

  it('prefers an explicit list match over the name-tag fallback', () => {
    expect(resolveRegiment('SB-[51stNY]Vol.x', list)).toBe('51stNY');
  });

  it('falls back to extractRegimentTag when no list match', () => {
    expect(resolveRegiment('[20thGA]Pvt. Han', list)).toBe('20THGA');
  });

  it('works with no list provided', () => {
    expect(resolveRegiment('[20thGA]Pvt. Han')).toBe('20THGA');
  });
});
