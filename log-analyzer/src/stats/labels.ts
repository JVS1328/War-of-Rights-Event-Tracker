import type { Formation } from './types';

/** Display labels for victim formation / death stance. */
export const FORMATION_LABEL: Record<Formation, string> = {
  in_form: 'In Formation',
  skirm: 'Skirmish',
  oob: 'Out of Line',
};

/** Short labels for dense table headers. */
export const FORMATION_SHORT: Record<Formation, string> = {
  in_form: 'IF',
  skirm: 'Sk',
  oob: 'OoL',
};

/** Per-stance ticket weights (game rules): IF costs 1, Skirmish 3, Out of Line 5. */
export const TICKET_WEIGHT: Record<Formation, number> = { in_form: 1, skirm: 3, oob: 5 };

/** Tooltip for ×Td — tickets you cost your team per death. */
export const AVG_TD_LABEL = 'Avg ticket cost per death (1·In Formation + 3·Skirmish + 5·Out of Line) ÷ deaths — tickets you cost your team';

/** Tooltip for ×Tk — tickets you drained from the enemy per kill. */
export const AVG_TK_LABEL = 'Avg ticket value per kill (1·In Formation + 3·Skirmish + 5·Out of Line) ÷ kills — weighted by the formation each victim died in';

/**
 * Average ticket cost across in-form / skirmish / out-of-line counts. Returns
 * null when there are none (caller renders "—"). Used for both ×Td (deaths)
 * and ×Tk (kills bucketed by victim formation).
 */
export function avgTicketCost(inForm: number, skirm: number, oob: number): number | null {
  const total = inForm + skirm + oob;
  if (total <= 0) return null;
  const weighted = TICKET_WEIGHT.in_form * inForm + TICKET_WEIGHT.skirm * skirm + TICKET_WEIGHT.oob * oob;
  return weighted / total;
}

export function formatAvgT(avg: number | null): string {
  return avg == null ? '—' : `×${avg.toFixed(1)}`;
}
