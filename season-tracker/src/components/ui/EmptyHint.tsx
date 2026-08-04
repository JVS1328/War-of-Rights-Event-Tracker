import type { ReactNode } from 'react';

/** Nothing to show, and why. */
export function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="note">{children}</p>;
}
