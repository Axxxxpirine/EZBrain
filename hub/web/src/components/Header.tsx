import { useEffect, useState } from 'react';
import { href, type View } from '../hooks.ts';
import { setTheme, useTheme } from '../theme.ts';
import { Icon } from './ui.tsx';

export const VIEW_LABEL: Record<View, string> = {
  apercu: 'Vue d’ensemble',
  notes: 'Notes',
  carte: 'Carte',
  historique: 'Historique',
};

export function Header({ user, view }: { user: string | null | undefined; view: View }) {
  const dark = useTheme() === 'dark';
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [view]);

  return (
    <>
      <header className="header">
        <a className="brand" href={href('apercu')}>
          <img src="/icon.svg" alt="" width={24} height={24} />
          <h1>EZBrain</h1>
        </a>
        <span className="conn">{user ? <span title="Utilisateur connecté">{user.split('@')[0]}</span> : user === null ? <span className="muted" title="Pas d’authentification configurée">accès local</span> : null}</span>
        <button
          type="button"
          className="btn ghost theme-toggle"
          aria-label="Thème sombre"
          aria-pressed={dark}
          title={dark ? 'Passer au thème clair' : 'Passer au thème sombre'}
          onClick={() => setTheme(dark ? 'light' : 'dark')}
        >
          <Icon name={dark ? 'sun' : 'moon'} />
        </button>
        <button type="button" className="btn ghost nav-toggle" aria-expanded={open} aria-controls="main-nav" onClick={() => setOpen((o) => !o)}>
          <Icon name="menu" />
          <span>{VIEW_LABEL[view]}</span>
        </button>
      </header>
      <nav id="main-nav" className={`tabs${open ? ' open' : ''}`} aria-label="Sections">
        {(Object.keys(VIEW_LABEL) as View[]).map((v) => (
          <a key={v} href={href(v)} aria-current={v === view ? 'page' : undefined} onClick={() => setOpen(false)}>
            {VIEW_LABEL[v]}
          </a>
        ))}
      </nav>
    </>
  );
}
