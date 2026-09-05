import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

const VARIANT_CLASS = {
  primary: 'ui-btn-primary',
  ghost: 'ui-btn-ghost',
  quiet: 'ui-btn-quiet ui-btn-icon',
};

/**
 * App-bar actions declared once and rendered twice: the full row on a wide
 * screen, and — below the `lg` breakpoint, where ten buttons overflow the
 * header — the pinned actions plus an overflow menu.
 *
 * Each action is `{ key, label, icon, onClick, variant?, pinned?, title?,
 * divider? }`; `pinned` keeps an action out of the menu at every width.
 */
export const ActionBar = ({ actions }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    const onKeyDown = (e) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const items = actions.filter(Boolean);
  const pinned = items.filter(a => a.pinned);
  const overflow = items.filter(a => !a.pinned);

  const button = (action) => {
    const { key, label, icon: Icon, onClick, variant = 'quiet', title } = action;
    const iconOnly = variant === 'quiet';
    return (
      <button
        key={key}
        onClick={onClick}
        title={title || label}
        aria-label={label}
        className={`ui-btn ${VARIANT_CLASS[variant] || VARIANT_CLASS.quiet}`}
      >
        {Icon && <Icon className="w-4 h-4" />}
        {!iconOnly && label}
      </button>
    );
  };

  return (
    <div className="flex items-center gap-1.5">
      {pinned.map(button)}

      {/* Wide: every action on show. The full row measures ~850px with the
          campaign title beside it, so it needs `lg`, not `sm`. */}
      <div className="hidden lg:flex items-center gap-1.5">
        {overflow.map(action =>
          action.divider
            ? [<div key={`${action.key}-div`} className="w-px h-6 bg-ink-700 mx-1" />, button(action)]
            : button(action)
        )}
      </div>

      {/* Narrow: one button, everything behind it. */}
      <div className="relative lg:hidden" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(open => !open)}
          className="ui-btn ui-btn-ghost ui-btn-icon"
          aria-label="More actions"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {menuOpen && (
          <div className="ui-card absolute right-0 top-full mt-2 w-56 p-1.5 z-40 shadow-2xl">
            {overflow.map(({ key, label, icon: Icon, onClick }) => (
              <button
                key={key}
                onClick={() => { setMenuOpen(false); onClick(); }}
                className="ui-btn ui-btn-quiet ui-btn-block !justify-start"
              >
                {Icon && <Icon className="w-4 h-4 shrink-0" />}
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
