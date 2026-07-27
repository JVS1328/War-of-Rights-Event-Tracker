/**
 * Company splitting: pack a roster of regiments into companies.
 *
 * Shared by the per-week Company Balancer in the tracker and the standalone
 * Company Splitter tab, so both use the same caps, labels, and packing.
 */

export type CompanyKind = 'special' | 'cavalry' | 'regular';

/** Fixed player cap for a special company. */
export const SPECIAL_COMPANY_CAP = 20;
/** Starting player cap for a cavalry company (editable per side). */
export const DEFAULT_CAVALRY_CAP = 30;

export interface CompanySideConfig {
  /** Total companies for this side, capped kinds included. */
  count: number;
  specialCount: number;
  cavalryCount: number;
  cavalryCap: number;
}

export const DEFAULT_COMPANY_SIDE: CompanySideConfig = {
  count: 0,
  specialCount: 0,
  cavalryCount: 0,
  cavalryCap: DEFAULT_CAVALRY_CAP,
};

/** Label + colours per company kind — one place defines how a kind looks. */
export const COMPANY_KINDS: Record<CompanyKind, { label: string; box: string; text: string }> = {
  special: {
    label: 'Special Co',
    box: 'bg-yellow-500/15 border border-yellow-600/40',
    text: 'text-yellow-700 dark:text-yellow-400',
  },
  cavalry: {
    label: 'Cav Co',
    box: 'bg-purple-500/15 border border-purple-600/40',
    text: 'text-purple-700 dark:text-purple-400',
  },
  regular: { label: 'Co', box: 'bg-bg-inset', text: 'text-text-secondary' },
};

/** Keep the capped company counts inside the side's total company count. */
export const clampSideConfig = (config: Partial<CompanySideConfig>): CompanySideConfig => {
  const next = { ...DEFAULT_COMPANY_SIDE, ...config };
  const count = Math.max(0, next.count);
  const specialCount = Math.min(Math.max(0, next.specialCount), count);
  const cavalryCount = Math.min(Math.max(0, next.cavalryCount), count - specialCount);
  return { count, specialCount, cavalryCount, cavalryCap: Math.max(0, next.cavalryCap) };
};

export interface RosterEntry {
  /** Name as pasted, e.g. "12THVA (T)". */
  rawName: string;
  /** Name with any trailing side marker stripped, e.g. "12THVA". */
  unit: string;
  min: number;
  max: number;
}

export interface Company {
  label: string;
  kind: CompanyKind;
  /** Player cap; Infinity for regular companies. */
  cap: number;
  regiments: string[];
  totalAvg: number;
}

/** Player count a regiment is packed by: the midpoint of its min/max. */
export const rosterAvg = (entry: { min: number; max: number }): number => (entry.min + entry.max) / 2;

/** Build a roster from a unit list + the tracker's min/max count map. */
export const rosterFromCounts = (
  units: string[],
  counts: Record<string, { min: number; max: number } | undefined>,
): RosterEntry[] =>
  units.map((unit) => {
    const c = counts[unit] || { min: 0, max: 0 };
    return { rawName: unit, unit, min: c.min, max: c.max };
  });

/**
 * Split a pasted line into columns. Tab-separated when tabs are present
 * (spreadsheet paste, blank filler columns and all); otherwise fall back to
 * the trailing numbers, so "7th SC 8 11" works as well as "7th SC\t8\t11".
 */
const columnsOf = (line: string): string[] => {
  if (line.includes('\t')) return line.split('\t');
  const m = line.trim().match(/^(.*?)\s+(\d+)(?:\s+(\d+))?$/);
  return m ? [m[1], m[2], m[3] ?? ''] : [line];
};

/**
 * Parse pasted roster rows — "name, min, max", one unit per line. Tolerates
 * blank filler columns, trailing tabs, blank lines, and a " (T)"/" (B)" side
 * marker on the name. A row with one number uses it for both min and max; a
 * row with none counts as 0.
 */
export const parseRosterPaste = (text: string): RosterEntry[] => {
  const rows: RosterEntry[] = [];
  for (const line of text.split('\n')) {
    const cols = columnsOf(line);
    const rawName = (cols[0] || '').trim();
    if (!rawName) continue;
    const unit = rawName.replace(/\s*\([TB]\)\s*$/i, '').trim();
    const nums = cols.slice(1).map((c) => parseInt(c.trim(), 10)).filter((n) => !isNaN(n));
    const min = nums.length >= 2 ? Math.min(nums[0], nums[1]) : nums.length === 1 ? nums[0] : 0;
    const max = nums.length >= 2 ? Math.max(nums[0], nums[1]) : min;
    rows.push({ rawName, unit, min, max });
  }
  return rows;
};

/**
 * Pack a roster into companies. Capped companies come off the top of the
 * total count — special first, then cavalry — and the rest are uncapped
 * regulars. Regiments are placed largest-first into the emptiest company they
 * still fit in, falling back to the emptiest regular when nothing fits.
 */
export const distributeCompanies = (
  roster: RosterEntry[],
  sideConfig: Partial<CompanySideConfig>,
): Company[] => {
  const { count, specialCount, cavalryCount, cavalryCap } = clampSideConfig(sideConfig);
  if (count <= 0 || roster.length === 0) return [];

  const regs = roster
    .map((entry) => ({ unit: entry.unit, avg: rosterAvg(entry) }))
    .sort((a, b) => b.avg - a.avg); // largest first for greedy fill

  const caps: Record<CompanyKind, number> = {
    special: SPECIAL_COMPANY_CAP,
    cavalry: cavalryCap,
    regular: Infinity,
  };
  const companies = Array.from({ length: count }, (_, i) => {
    const kind: CompanyKind =
      i < specialCount ? 'special' : i < specialCount + cavalryCount ? 'cavalry' : 'regular';
    return { kind, cap: caps[kind], regiments: [] as string[], total: 0 };
  });

  for (const reg of regs) {
    let best: (typeof companies)[number] | null = null;
    for (const co of companies) {
      if (co.total + reg.avg > co.cap) continue;
      if (!best || co.total < best.total) best = co;
    }
    // If no company can fit under cap, put in the least-full regular company
    if (!best) {
      const regulars = companies.filter((c) => c.kind === 'regular');
      const pool = regulars.length > 0 ? regulars : companies;
      best = pool.reduce((a, b) => (a.total <= b.total ? a : b));
    }
    best.regiments.push(reg.unit);
    best.total += reg.avg;
  }

  const seq: Record<CompanyKind, number> = { special: 0, cavalry: 0, regular: 0 };
  return companies.map((co) => {
    seq[co.kind] += 1;
    return {
      label: `${COMPANY_KINDS[co.kind].label} ${seq[co.kind]}`,
      kind: co.kind,
      cap: co.cap,
      regiments: co.regiments,
      totalAvg: co.total,
    };
  });
};

/** Plain-text rendering of a split, for pasting into Discord/a sheet. */
export const companiesToText = (companies: Company[]): string =>
  companies
    .map((co) => `${co.label} (${Math.round(co.totalAvg)}): ${co.regiments.join(', ') || 'Empty'}`)
    .join('\n');
