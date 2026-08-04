import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * Side drawer built on Radix Dialog. Full-screen on mobile, fixed-width panel
 * docked to the right on desktop. Controlled via `open` / `onOpenChange`.
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  subtitle,
  width = 480,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Desktop panel width in px. */
  width?: number;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-[color:var(--color-border)] bg-[color:var(--color-bg-1)] shadow-2xl outline-none sm:w-[var(--drawer-w)]"
          style={{ ['--drawer-w' as string]: `${width}px` }}
        >
          <div className="flex items-center justify-between border-b border-[color:var(--color-border)] bg-[color:var(--color-bg-2)] px-3 py-2">
            <div className="min-w-0">
              <Dialog.Title className="wor-name truncate text-base font-mono text-[color:var(--color-text-0)]">
                {title}
              </Dialog.Title>
              {subtitle && (
                <Dialog.Description className="truncate text-xs font-mono uppercase tracking-wider text-[color:var(--color-text-2)]">
                  {subtitle}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="ml-2 inline-flex h-6 w-6 shrink-0 items-center justify-center text-[color:var(--color-text-2)] hover:bg-[color:var(--color-bg-3)] hover:text-[color:var(--color-text-0)]"
              aria-label="Close"
            >
              <X size={14} />
            </Dialog.Close>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
