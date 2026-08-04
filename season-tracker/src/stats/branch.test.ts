import { describe, it, expect } from 'vitest';
import { branchOf, matchesBranch, isArtilleryRegiment, CAVALRY_REGIMENTS } from './branch';

describe('branchOf', () => {
  it('knows the four mounted regiments by name', () => {
    for (const r of CAVALRY_REGIMENTS) expect(branchOf(r)).toBe('Cavalry');
  });

  it('is not confused by casing or spacing from the roster', () => {
    expect(branchOf('jeff davis legion')).toBe('Cavalry');
    expect(branchOf('  6th   Pennsylvania ')).toBe('Cavalry');
  });

  it('reads an explicit arm out of the name', () => {
    expect(branchOf('2nd US Cavalry')).toBe('Cavalry');
    expect(branchOf('Battery A')).toBe('Artillery');
    expect(branchOf('Washington Artillery')).toBe('Artillery');
    expect(branchOf('24th Georgia Infantry')).toBe('Infantry');
  });

  it('lets an explicit arm beat the mounted roster', () => {
    // A "1st Virginia Infantry" exists alongside the mounted 1st Virginia.
    expect(branchOf('1st Virginia Infantry')).toBe('Infantry');
    expect(branchOf('1st Virginia')).toBe('Cavalry');
  });

  it('does not mistake another Virginia regiment for the mounted one', () => {
    expect(branchOf('12th Virginia')).toBe('Infantry');
    expect(branchOf('21st Virginia')).toBe('Infantry');
  });

  it('falls back to infantry for anything unrecognised or missing', () => {
    expect(branchOf('69th New York')).toBe('Infantry');
    expect(branchOf(null)).toBe('Infantry');
    expect(branchOf(undefined)).toBe('Infantry');
    expect(branchOf('')).toBe('Infantry');
    expect(branchOf('Unenlisted')).toBe('Infantry');
  });
});

describe('isArtilleryRegiment', () => {
  it('keeps the old battery question answerable', () => {
    expect(isArtilleryRegiment('Battery A')).toBe(true);
    expect(isArtilleryRegiment("Pegram's Battery")).toBe(true);
    expect(isArtilleryRegiment('1st Virginia')).toBe(false);
    expect(isArtilleryRegiment(null)).toBe(false);
  });
});

describe('matchesBranch', () => {
  it('lets everything through on "all"', () => {
    expect(matchesBranch('all', 'Battery A')).toBe(true);
    expect(matchesBranch('all', null)).toBe(true);
  });

  it('separates cavalry from infantry, which the battery test could not', () => {
    expect(matchesBranch('Infantry', '1st Virginia')).toBe(false);
    expect(matchesBranch('Cavalry', '1st Virginia')).toBe(true);
    expect(matchesBranch('Infantry', '69th New York')).toBe(true);
    expect(matchesBranch('Cavalry', '69th New York')).toBe(false);
  });

  it('keeps artillery to batteries', () => {
    expect(matchesBranch('Artillery', 'Battery B')).toBe(true);
    expect(matchesBranch('Artillery', '1st Virginia')).toBe(false);
  });
});
