import { describe, it, expect } from 'vitest';
import {
  canonicalMapName,
  areaOf,
  mapAttacker,
  hasAttacker,
  mapMode,
  MAP_AREAS,
  USA_ATTACK_MAPS,
  ALL_MAPS,
} from './mapCatalog';

describe('canonicalMapName', () => {
  it('returns canonical names unchanged', () => {
    expect(canonicalMapName('Burnside Bridge')).toBe('Burnside Bridge');
    expect(canonicalMapName('Otto & Sherrick Farm')).toBe('Otto & Sherrick Farm');
  });

  it('maps legacy/misspelled names via the alias table', () => {
    expect(canonicalMapName("Burnside's Bridge")).toBe('Burnside Bridge');
    expect(canonicalMapName('Otto and Sherrick Farms')).toBe('Otto & Sherrick Farm');
    expect(canonicalMapName('Harpers Ferry Graveyard')).toBe('Harpers Graveyard');
    expect(canonicalMapName("Colquitt's Defense")).toBe("Colquitt's Defence");
    expect(canonicalMapName('Hagertown Turnpike')).toBe('Hagerstown Turnpike');
  });

  it("resolves Harper's Graveyard apostrophe variant via normalized key", () => {
    expect(canonicalMapName("Harper's Graveyard")).toBe('Harpers Graveyard');
    expect(canonicalMapName('harpers graveyard')).toBe('Harpers Graveyard');
  });

  it('resolves case/punctuation variants via normalized key', () => {
    expect(canonicalMapName('burnside bridge')).toBe('Burnside Bridge');
    expect(canonicalMapName('  Otto and Sherrick Farm ')).toBe('Otto & Sherrick Farm');
    expect(canonicalMapName('colquitts defence')).toBe("Colquitt's Defence");
  });

  it('leaves unknown names untouched (trimmed)', () => {
    expect(canonicalMapName('Totally Made Up Map')).toBe('Totally Made Up Map');
    expect(canonicalMapName('  spacey  ')).toBe('spacey');
  });

  it('handles null/empty', () => {
    expect(canonicalMapName(null)).toBe('');
    expect(canonicalMapName(undefined)).toBe('');
    expect(canonicalMapName('')).toBe('');
  });

  it('does not collapse distinct short names (West vs East Woods)', () => {
    expect(canonicalMapName('West Woods')).toBe('West Woods');
    expect(canonicalMapName('East Woods')).toBe('East Woods');
  });
});

describe('areaOf', () => {
  it('groups Skirmish maps under their area, including via aliases', () => {
    expect(areaOf('Burnside Bridge')).toBe('antietam');
    expect(areaOf("Burnside's Bridge")).toBe('antietam');
    expect(areaOf('Harpers Ferry Graveyard')).toBe('harpers_ferry');
    expect(areaOf("Colquitt's Defense")).toBe('south_mountain');
  });

  it('groups Conquest/Contention areas under their battle', () => {
    for (const m of ['Smokestacks', 'Forest Stream', 'Framing Fencelines', 'Farmland', 'Limestone Bridge', 'Waterways']) {
      expect(areaOf(m)).toBe('antietam');
    }
    for (const m of ['Corn Crib', 'Orchards', 'Railroad Cut', 'Towering Trunks']) {
      expect(areaOf(m)).toBe('drill_camp');
      expect(mapMode(m)).toBe('conquest');
      expect(hasAttacker(m)).toBe(false);
    }
    for (const m of ['River Town', 'Outskirts', 'Overlook', 'Valley']) {
      expect(areaOf(m)).toBe('harpers_ferry');
      expect(hasAttacker(m)).toBe(false);
    }
  });

  it('returns null for unknown maps', () => {
    expect(areaOf('Nowhere')).toBeNull();
  });
});

describe('attacker', () => {
  it('derives USA/CSA attacker for Skirmish maps from the JSON DefendingTeam', () => {
    expect(mapAttacker('Burnside Bridge')).toBe('USA'); // CSA defends
    expect(mapAttacker("Cooke's Countercharge")).toBe('CSA'); // USA defends
    expect(mapAttacker('Hagerstown Turnpike')).toBe('USA');
  });

  it('has no attacker for Conquest/Contention', () => {
    expect(mapAttacker('Smokestacks')).toBeNull();
    expect(hasAttacker('Smokestacks')).toBe(false);
    expect(hasAttacker('Burnside Bridge')).toBe(true);
  });

  it('USA_ATTACK_MAPS contains only USA-attacker maps', () => {
    expect(USA_ATTACK_MAPS.has('Burnside Bridge')).toBe(true);
    expect(USA_ATTACK_MAPS.has("Cooke's Countercharge")).toBe(false);
    expect(USA_ATTACK_MAPS.has('Smokestacks')).toBe(false);
  });
});

describe('mode + structure', () => {
  it('reports mode', () => {
    expect(mapMode('Burnside Bridge')).toBe('skirmish');
    expect(mapMode('Smokestacks')).toBe('conquest');
  });

  it('Antietam area includes the 18 Skirmish + 6 Conquest/Contention maps', () => {
    expect(MAP_AREAS.antietam).toHaveLength(24);
    expect(MAP_AREAS.antietam).toContain('Burnside Bridge');
    expect(MAP_AREAS.antietam).toContain('Waterways');
  });

  it('ALL_MAPS is sorted and free of legacy spellings', () => {
    expect(ALL_MAPS).toContain('Burnside Bridge');
    expect(ALL_MAPS).not.toContain("Burnside's Bridge");
    expect([...ALL_MAPS]).toEqual([...ALL_MAPS].sort());
  });
});
