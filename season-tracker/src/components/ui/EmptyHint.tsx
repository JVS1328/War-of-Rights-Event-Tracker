import type { ReactNode } from 'react';

/** Centered placeholder for empty states. */
export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 py-6 text-center text-[10px] text-[color:var(--color-text-2)] font-mono uppercase tracking-wider">
      {children}
    </div>
  );
}
