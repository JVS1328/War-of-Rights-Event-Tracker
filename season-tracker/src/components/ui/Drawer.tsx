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
        <Dialog.Overlay className="drawer-scrim" />
        <Dialog.Content
          className="drawer"
          style={{ ['--drawer-w' as string]: `${width}px` }}
        >
          <div className="ph">
            <div style={{ minWidth: 0 }}>
              <Dialog.Title asChild>
                <div className="mid wor-name" style={{ fontSize: 17 }}>{title}</div>
              </Dialog.Title>
              {subtitle && (
                <Dialog.Description asChild>
                  <div className="cap" style={{ marginTop: 4 }}>{subtitle}</div>
                </Dialog.Description>
              )}
            </div>
            <span className="rule" />
            <Dialog.Close className="gh" aria-label="Close">
              <X size={12} />
            </Dialog.Close>
          </div>
          <div className="drawer-b">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
