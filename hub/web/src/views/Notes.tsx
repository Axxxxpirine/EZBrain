import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import type { NoteSummary } from '../../../shared/api.ts';
import { api } from '../api.ts';
import { AgentBadge, Empty, ErrorNotice, Icon, Loading, Snippet, Time } from '../components/ui.tsx';
import {
  basename,
  compareDomains,
  domainColorMap,
  domainLabel,
  plural,
  shortDate,
  statusLabel,
  TYPE_ORDER,
  typeLabel,
  typeSingular,
} from '../format.ts';
import { commitHref, href, noteHref, useApi, useDebounced } from '../hooks.ts';
import { renderMarkdown } from '../markdown.ts';

export function NotesView({ rest }: { rest: string }) {
  const [path = '', anchor] = rest.split('?a=');
  const notes = useApi('notes', api.notes, { poll: 30_000 });

  return (
    <div className={`notes-layout${path ? ' has-note' : ''}`}>
      <aside className="notes-side">
        <div className="side-actions">
          {notes.data && <span className="muted small">{plural(notes.data.length, 'note', 'notes')}</span>}
        </div>
        <NoteBrowser notes={notes.data} error={notes.error} reload={notes.reload} currentPath={path} />
      </aside>
      <section className="notes-main">
        {path ? (
          <NoteReader key={path} path={path} anchor={anchor} />
        ) : (
          <div className="card reader-empty">
            <p>Choisis une note dans la liste, ou ouvre l’index général.</p>
            <a className="btn" href={noteHref('INDEX.md')}>
              Ouvrir INDEX.md
            </a>
          </div>
        )}
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ liste

const FILTER_KEY = 'ezbrain.notes.filters';

function loadFilters(): { domain: string; type: string; status: string } {
  try {
    const f = JSON.parse(sessionStorage.getItem(FILTER_KEY) ?? '{}') as Record<string, string>;
    return { domain: f.domain ?? '', type: f.type ?? '', status: f.status ?? '' };
  } catch {
    return { domain: '', type: '', status: '' };
  }
}

function NoteBrowser({ notes, error, reload, currentPath }: { notes: NoteSummary[] | undefined; error: string | null; reload: () => void; currentPath: string }) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(loadFilters);
  const q = useDebounced(query.trim(), 250);
  useEffect(() => {
    try {
      sessionStorage.setItem(FILTER_KEY, JSON.stringify(filters));
    } catch {
      // Sans stockage, les filtres ne survivent pas au rechargement.
    }
  }, [filters]);

  const search = useApi(q ? `search:${q}:${filters.domain}:${filters.type}` : null, () => api.search(q, filters.domain || undefined, filters.type || undefined));

  const options = useMemo(() => {
    const domains = new Set<string>();
    const types = new Set<string>();
    const statuses = new Set<string>();
    for (const n of notes ?? []) {
      domains.add(n.domain);
      types.add(n.type);
      if (n.status) statuses.add(n.status);
    }
    return {
      domains: [...domains].sort(compareDomains),
      types: [...types].sort((a, b) => TYPE_ORDER.indexOf(a as never) - TYPE_ORDER.indexOf(b as never)),
      statuses: [...statuses].sort(),
    };
  }, [notes]);

  const colors = useMemo(() => domainColorMap(options.domains), [options.domains]);
  const byPath = useMemo(() => new Map((notes ?? []).map((n) => [n.path, n])), [notes]);

  const filtered = useMemo(
    () =>
      (notes ?? []).filter(
        (n) => (!filters.domain || n.domain === filters.domain) && (!filters.type || n.type === filters.type) && (!filters.status || n.status === filters.status),
      ),
    [notes, filters],
  );

  const set = (k: keyof typeof filters) => (e: { target: { value: string } }) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const anyFilter = filters.domain || filters.type || filters.status;

  return (
    <div className="browser">
      <label className="search">
        <Icon name="search" />
        <input className="input" type="search" placeholder="Rechercher dans les notes…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Rechercher" />
      </label>
      <div className="filters">
        <select className="input" value={filters.domain} onChange={set('domain')} aria-label="Domaine">
          <option value="">Domaine</option>
          {options.domains.map((d) => (
            <option key={d} value={d}>
              {domainLabel(d)}
            </option>
          ))}
        </select>
        <select className="input" value={filters.type} onChange={set('type')} aria-label="Type">
          <option value="">Type</option>
          {options.types.map((t) => (
            <option key={t} value={t}>
              {typeLabel(t)}
            </option>
          ))}
        </select>
        <select className="input" value={filters.status} onChange={set('status')} aria-label="Statut">
          <option value="">Statut</option>
          {options.statuses.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
        {anyFilter && (
          <button className="btn ghost" onClick={() => setFilters({ domain: '', type: '', status: '' })}>
            Effacer
          </button>
        )}
      </div>

      {error && <ErrorNotice error={error} onRetry={reload} />}
      {!notes && !error && <Loading />}

      {q ? (
        <div className="results">
          {search.error && <ErrorNotice error={search.error} onRetry={search.reload} />}
          {search.loading && !search.data && <Loading label="Recherche…" />}
          {search.data && (
            <>
              {(() => {
                const hits = search.data.filter((h) => !filters.status || byPath.get(h.path)?.status === filters.status);
                if (!hits.length) return <Empty>Aucun résultat pour « {q} ».</Empty>;
                return hits.map((h) => (
                  <a key={h.path} className={`hit${h.path === currentPath ? ' current' : ''}`} href={noteHref(h.path)}>
                    <b>
                      <span className="dot" style={{ background: colors.get(h.domain) }} />
                      {h.title}
                    </b>
                    <small className="mono">{h.path}</small>
                    {h.snippet && (
                      <span className="snippet">
                        <Snippet text={h.snippet} />
                      </span>
                    )}
                  </a>
                ));
              })()}
            </>
          )}
        </div>
      ) : (
        notes && <NoteTree notes={filtered} colors={colors} currentPath={currentPath} />
      )}
    </div>
  );
}

function NoteTree({ notes, colors, currentPath }: { notes: NoteSummary[]; colors: Map<string, string>; currentPath: string }) {
  const tree = useMemo(() => {
    const m = new Map<string, Map<string, NoteSummary[]>>();
    for (const n of notes) {
      const d = m.get(n.domain) ?? new Map<string, NoteSummary[]>();
      d.set(n.type, [...(d.get(n.type) ?? []), n]);
      m.set(n.domain, d);
    }
    return [...m.entries()]
      .sort((a, b) => compareDomains(a[0], b[0]))
      .map(([domain, types]) => ({
        domain,
        count: [...types.values()].reduce((s, l) => s + l.length, 0),
        types: [...types.entries()]
          .sort((a, b) => TYPE_ORDER.indexOf(a[0] as never) - TYPE_ORDER.indexOf(b[0] as never))
          .map(([type, list]) => ({ type, list: list.sort((x, y) => (x.type === 'index' ? -1 : 0) || (y.updated ?? '').localeCompare(x.updated ?? '') || x.title.localeCompare(y.title, 'fr')) })),
      }));
  }, [notes]);
  const currentDomain = notes.find((n) => n.path === currentPath)?.domain;

  if (!notes.length) return <Empty>Aucune note ne correspond aux filtres.</Empty>;
  return (
    <div className="tree">
      {tree.map((d) => (
        <details key={d.domain} open={tree.length <= 3 || d.domain === currentDomain}>
          <summary>
            <span className="dot" style={{ background: colors.get(d.domain) }} />
            <span className="tree-name">{domainLabel(d.domain)}</span>
            <span className="muted small">{d.count}</span>
          </summary>
          {d.types.map((t) => (
            <div key={t.type} className="tree-type">
              {(d.types.length > 1 || t.type !== 'other') && <div className="tree-type-name">{typeLabel(t.type)}</div>}
              {t.list.map((n) => (
                <a key={n.path} className={`tree-note${n.path === currentPath ? ' current' : ''}${n.status && n.status !== 'active' ? ' dim' : ''}`} href={noteHref(n.path)} title={n.path}>
                  <span className="t">{n.title || basename(n.path)}</span>
                  {n.updated && <span className="d">{shortDate(n.updated)}</span>}
                </a>
              ))}
            </div>
          ))}
        </details>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ lecteur

function NoteReader({ path, anchor }: { path: string; anchor: string | undefined }) {
  // La copie se met à jour à chaque commit poussé depuis le poste de travail : relire régulièrement.
  const note = useApi(`note:${path}`, () => api.note(path), { poll: 30_000 });
  const bodyRef = useRef<HTMLDivElement>(null);
  const d = note.data;

  const html = useMemo(() => (d ? renderMarkdown(d.body, d.path, d.title) : ''), [d]);

  useEffect(() => {
    if (!html) return;
    if (anchor) document.getElementById(anchor)?.scrollIntoView({ block: 'start' });
    else document.querySelector('.notes-main')?.scrollIntoView({ block: 'start' });
  }, [html, anchor]);

  const onBodyClick = (e: MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest('a');
    const target = a?.getAttribute('data-anchor');
    if (target) {
      e.preventDefault();
      document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <article className="reader">
      <a className="btn ghost back" href={href('notes')}>
        <Icon name="back" />
        Notes
      </a>
      {note.error && <ErrorNotice error={note.error} onRetry={note.reload} />}
      {!d && !note.error && <Loading />}
      {d && (
        <>
          <div className="card reader-card">
            <header className="reader-head">
              <div className="reader-title">
                <h2>{d.title || basename(d.path)}</h2>
                <div className="mono muted small path">{d.path}</div>
              </div>
            </header>
            <div className="chips">
              <span className="chip">{typeSingular(d.type)}</span>
              {d.status && <span className={`chip status-${d.status}`}>{statusLabel(d.status)}</span>}
              <span className="chip">{domainLabel(d.domain)}</span>
              {d.tags.map((t) => (
                <span key={t} className="chip tag">
                  #{t}
                </span>
              ))}
              {d.updated && <span className="chip">mis à jour {shortDate(d.updated)}</span>}
              {d.lastAgent && (
                <span className="chip plain">
                  <AgentBadge agent={d.lastAgent} /> <Time iso={d.lastCommit} />
                </span>
              )}
              <span className="chip plain muted">{plural(d.words, 'mot', 'mots')}</span>
            </div>
            {d.aliases.length > 0 && <div className="muted small">Aussi appelé : {d.aliases.join(', ')}</div>}
            <div className="md" ref={bodyRef} onClick={onBodyClick} dangerouslySetInnerHTML={{ __html: html }} />
          </div>

          <div className="reader-meta">
            <section className="card">
              <h3 className="card-title">
                Liens entrants <span className="aside muted">{d.backlinks.length}</span>
              </h3>
              {d.backlinks.length ? (
                <ul className="plain-list">
                  {d.backlinks.map((p) => (
                    <li key={p}>
                      <a className="mono" href={noteHref(p)}>
                        {p}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>Aucune note ne pointe ici.</Empty>
              )}
            </section>
            {d.brokenLinks.length > 0 && (
              <section className="card warn">
                <h3 className="card-title">
                  Liens cassés <span className="aside muted">{d.brokenLinks.length}</span>
                </h3>
                <ul className="plain-list">
                  {d.brokenLinks.map((p) => (
                    <li key={p} className="mono del-ink">
                      {p}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="card">
              <h3 className="card-title">
                Historique <span className="aside muted">{d.history.length}</span>
              </h3>
              {d.history.length ? (
                <ul className="plain-list history-mini">
                  {d.history.map((c) => (
                    <li key={c.hash}>
                      <AgentBadge agent={c.agent} />
                      <a href={commitHref(c.hash)}>{c.message}</a>
                      <span className="muted small nowrap">
                        <Time iso={c.date} />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>Pas encore de commit.</Empty>
              )}
            </section>
          </div>
        </>
      )}
    </article>
  );
}
