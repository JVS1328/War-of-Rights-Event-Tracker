import { X } from 'lucide-react';

/**
 * Shared presentational primitives for the campaign tracker.
 *
 * These wrap the design-system classes defined in index.css so panels look
 * the same in the tracker and in the read-only share view.
 */

export const Card = ({ className = '', children, ...rest }) => (
  <section className={`ui-card ${className}`} {...rest}>
    {children}
  </section>
);

export const CardHead = ({ icon: Icon, title, meta, actions, className = '' }) => (
  <header className={`ui-card-head ${className}`}>
    <h3 className="ui-title">
      {Icon && <Icon className="w-4 h-4" />}
      <span>{title}</span>
      {meta != null && <span className="text-mist-500 font-normal normal-case tracking-normal">{meta}</span>}
    </h3>
    {actions}
  </header>
);

export const CardBody = ({ className = '', children }) => (
  <div className={`ui-card-body ${className}`}>{children}</div>
);

/** Side-aware pill: USA / CSA / NEUTRAL, or any of the generic tones. */
export const Badge = ({ tone = 'neutral', className = '', children }) => {
  const map = {
    USA: 'ui-badge-usa',
    CSA: 'ui-badge-csa',
    NEUTRAL: 'ui-badge-neutral',
    neutral: 'ui-badge-neutral',
    warn: 'ui-badge-warn',
    good: 'ui-badge-good',
  };
  return <span className={`ui-badge ${map[tone] || map.neutral} ${className}`}>{children}</span>;
};

/** Label / value line used throughout the stat panels. */
export const Row = ({ label, value, className = '' }) => (
  <div className={`ui-row ${className}`}>
    <span className="ui-row-label">{label}</span>
    <span className="ui-row-value">{value}</span>
  </div>
);

export const EmptyState = ({ icon: Icon, title, hint }) => (
  <div className="ui-empty">
    {Icon && <Icon className="w-6 h-6 opacity-60" />}
    <div className="text-mist-400 font-medium">{title}</div>
    {hint && <div className="max-w-xs">{hint}</div>}
  </div>
);

export const SIDE_TEXT = { USA: 'text-union-400', CSA: 'text-rebel-400', NEUTRAL: 'text-mist-400' };
export const SIDE_BAR = { USA: 'bg-union-500', CSA: 'bg-rebel-500', NEUTRAL: 'bg-ink-500' };

/**
 * Head-to-head scoreboard. Shared by the tracker sidebar and the share view
 * so a campaign reads the same either side of a share link.
 */
export const ScoreBoard = ({
  usaVP,
  csaVP,
  usaSP = null,
  csaSP = null,
  usaNote = null,
  csaNote = null,
  vpLabel = 'VP',
}) => {
  const total = (usaVP || 0) + (csaVP || 0);
  const usaShare = total > 0 ? Math.round(((usaVP || 0) / total) * 100) : 50;
  const leader = usaVP === csaVP ? null : usaVP > csaVP ? 'USA' : 'CSA';

  const column = (key, vp, sp, note) => {
    const right = key === 'CSA';
    return (
      <div className={`flex-1 min-w-0 ${right ? 'text-right' : ''}`}>
        <div className={`text-[11px] font-bold tracking-widest ${SIDE_TEXT[key]}`}>{key}</div>
        <div className={`mt-1 flex items-baseline gap-1.5 ${right ? 'justify-end' : ''}`}>
          <span className="text-4xl font-bold text-mist-100 tabular leading-none">{vp}</span>
          <span className="text-[11px] text-mist-500 uppercase tracking-wider">{vpLabel}</span>
        </div>
        {(sp != null || note) && (
          <div className="mt-1.5 text-[11px] text-mist-500 tabular truncate">
            {sp != null && <span className="text-mist-400">{sp.toLocaleString()} SP</span>}
            {sp != null && note && <span className="mx-1 text-ink-600">·</span>}
            {note}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-start gap-4">
        {column('USA', usaVP, usaSP, usaNote)}
        <div className="w-px self-stretch bg-ink-700" />
        {column('CSA', csaVP, csaSP, csaNote)}
      </div>

      <div className="ui-meter mt-4" title={`USA ${usaVP} — CSA ${csaVP}`}>
        <div className="bg-union-500 transition-all duration-500" style={{ width: `${usaShare}%` }} />
        <div className="bg-rebel-500 flex-1 transition-all duration-500" />
      </div>
      <div className="mt-1.5 text-center text-[11px] text-mist-500">
        {leader
          ? <>{leader} leads by <span className="text-mist-300 font-semibold tabular">{Math.abs(usaVP - csaVP)}</span> {vpLabel}</>
          : <>Dead even at <span className="text-mist-300 font-semibold tabular">{usaVP}</span> {vpLabel}</>}
      </div>
    </div>
  );
};

/** Modal shell: backdrop, panel, header with close button. */
export const Modal = ({ icon, title, subtitle, onClose, width = 'max-w-2xl', children, footer }) => (
  <div className="ui-modal-backdrop" onClick={onClose}>
    <div className={`ui-modal ${width}`} onClick={(e) => e.stopPropagation()}>
      <div className="ui-modal-head">
        <div>
          <div className="ui-modal-title">
            {icon}
            {title}
          </div>
          {subtitle && <div className="ui-hint mt-0.5">{subtitle}</div>}
        </div>
        {onClose && (
          <button onClick={onClose} className="ui-btn ui-btn-quiet ui-btn-icon" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="ui-modal-body ui-scroll">{children}</div>
      {footer && <div className="ui-modal-foot">{footer}</div>}
    </div>
  </div>
);
