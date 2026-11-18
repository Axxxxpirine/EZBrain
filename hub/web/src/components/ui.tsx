import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { agentColor, agentKey, fullDate, relTime } from '../format.ts';

// ------------------------------------------------------------------ icônes

const PATHS = {
  close: <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
  sun: (
    <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="8" r="2.75" />
      <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M3.4 12.6l1.06-1.06M11.54 4.46l1.06-1.06" />
    </g>
  ),
  moon: <path d="M13.5 9.6A5.75 5.75 0 0 1 6.4 2.5a5.75 5.75 0 1 0 7.1 7.1z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />,
  menu: <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />,
  edit: <path d="M10.5 2.5 13.5 5.5 6 13H3v-3zM9 4l3 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />,
  trash: <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />,
  plus: <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
  check: <path d="m3 8.5 3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  undo: <path d="M5.5 3 2.5 6l3 3M2.5 6h7a4 4 0 0 1 0 8H7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
  retry: <path d="M13 8a5 5 0 1 1-1.6-3.7M13 2.5v2.8h-2.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  back: <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  search: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="7" cy="7" r="4.25" />
      <path d="m10.2 10.2 3.3 3.3" />
    </g>
  ),
  target: (
    <g fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="5" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
    </g>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

// ------------------------------------------------------------------ états

export function Loading({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" /> {label}
    </div>
  );
}

export function ErrorNotice({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="notice error" role="alert">
      <span className="dot" style={{ background: 'var(--critical)', marginTop: 5 }} aria-hidden="true" />
      <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{error}</span>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

// ------------------------------------------------------------------ pastilles

export function AgentBadge({ agent }: { agent: string | undefined }) {
  const key = agentKey(agent);
  return (
    <span className="agent" style={{ '--c': agentColor(agent) } as CSSProperties}>
      {key === 'autre' ? agent || 'autre' : key}
    </span>
  );
}

export function Time({ iso }: { iso: string | undefined }) {
  if (!iso) return <span className="muted">—</span>;
  return (
    <time dateTime={iso} title={fullDate(iso)}>
      {relTime(iso)}
    </time>
  );
}

/** Extrait de recherche : les termes entre « ** » sont surlignés. */
export function Snippet({ text }: { text: string }) {
  const parts = text.split('**');
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>))}
    </>
  );
}

/** Panneau plein écran (détail d'un commit). Échap ferme. */
export function Sheet({
  title,
  subtitle,
  actions,
  onClose,
  children,
  wide,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Une boîte de confirmation ouverte au-dessus gère sa propre touche Échap.
      if (e.key === 'Escape' && !document.querySelector('.dialog')) closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className={`drawer${wide ? ' wide' : ''}`} role="dialog" aria-modal="true">
        <div className="drawer-head">
          <div className="drawer-title">
            <h2>{title}</h2>
            {subtitle && <div className="drawer-sub">{subtitle}</div>}
          </div>
          <div className="drawer-actions">
            {actions}
            <button className="btn ghost close" onClick={onClose} aria-label="Fermer">
              <Icon name="close" />
            </button>
          </div>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </>
  );
}
