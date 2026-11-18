import { useMemo, useState } from 'react';
import type { CommitSummary, HealthIssue, Overview } from '../../../shared/api.ts';
import { AgentBadge, Empty, ErrorNotice, Loading, Time } from '../components/ui.tsx';
import { agentColor, agentKey, AGENTS, dayKey, domainLabel, HEALTH_LABEL, plural, shortDate, typeLabel, TYPE_ORDER } from '../format.ts';
import { commitHref, href, noteHref, type Async } from '../hooks.ts';

export function OverviewView({ overview }: { overview: Async<Overview> }) {
  const { data, error, loading, reload } = overview;
  if (!data) return error ? <ErrorNotice error={error} onRetry={reload} /> : <Loading />;
  return (
    <div className="stack">
      {error && <ErrorNotice error={`Actualisation impossible : ${error}`} onRetry={reload} />}
      <Tiles o={data} />
      <div className="grid-2">
        <Activity activity={data.activity} />
        <ByType byType={data.byType} total={data.notes} />
      </div>
      <div className="grid-2">
        <Recent commits={data.recent} />
        <Health issues={data.health} />
      </div>
      {loading && <span className="sr-only">Actualisation…</span>}
    </div>
  );
}

function Tiles({ o }: { o: Overview }) {
  const domains = [...o.domains].sort((a, b) => b.notes - a.notes);
  return (
    <div className="tiles">
      <a className="card tile link" href={href('notes')}>
        <span className="label">Notes</span>
        <span className="value">{o.notes}</span>
        <span className="sub">{plural(Object.keys(o.byType).length, 'type', 'types')}</span>
      </a>
      <div className="card tile">
        <span className="label">Domaines</span>
        <span className="value">{o.domains.length}</span>
        <span className="sub">
          {domains.slice(0, 4).map((d) => (
            <span key={d.id}>
              {domainLabel(d.id)} <span className="mono">{d.notes}</span>
            </span>
          ))}
        </span>
      </div>
      <a className="card tile link" href={href('historique')}>
        <span className="label">Commits sur 30 jours</span>
        <span className="value">{o.activity.reduce((n, a) => n + a.commits, 0)}</span>
        <span className="sub">{o.recent[0] ? <>dernier : {o.recent[0].agent}, <Time iso={o.recent[0].date} /></> : 'aucun'}</span>
      </a>
      <div className={`card tile${o.health.length ? ' attention' : ''}`}>
        <span className="label">À vérifier</span>
        <span className="value">{o.health.length}</span>
        <span className="sub">{o.health.length ? 'liens cassés, notes orphelines…' : 'tout est en ordre'}</span>
      </div>
    </div>
  );
}

function Activity({ activity }: { activity: Overview['activity'] }) {
  const { days, max, agents, total } = useMemo(() => {
    const byDay = new Map<string, Map<string, number>>();
    const agentSet = new Set<string>();
    let total = 0;
    for (const a of activity) {
      const k = agentKey(a.agent);
      agentSet.add(k);
      const m = byDay.get(a.day) ?? new Map<string, number>();
      m.set(k, (m.get(k) ?? 0) + a.commits);
      byDay.set(a.day, m);
      total += a.commits;
    }
    const days: { day: string; counts: Map<string, number>; sum: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = dayKey(d);
      const counts = byDay.get(key) ?? new Map<string, number>();
      days.push({ day: key, counts, sum: [...counts.values()].reduce((s, n) => s + n, 0) });
    }
    const order = [...AGENTS, 'autre'];
    const agents = [...agentSet].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return { days, max: Math.max(1, ...days.map((d) => d.sum)), agents, total };
  }, [activity]);

  return (
    <section className="card">
      <h2 className="card-title">
        Activité, 30 derniers jours <span className="aside muted">{plural(total, 'commit', 'commits')}</span>
      </h2>
      <div className="bars" role="img" aria-label={`Commits par jour sur 30 jours, ${total} au total`}>
        {days.map((d) => (
          <div
            key={d.day}
            className="bar-col"
            title={`${shortDate(d.day)} : ${d.sum ? agents.filter((a) => d.counts.get(a)).map((a) => `${a} ${d.counts.get(a)}`).join(', ') : 'aucun commit'}`}
          >
            <div className="bar-stack" style={{ height: `${(d.sum / max) * 100}%` }}>
              {agents.map((a) => {
                const n = d.counts.get(a) ?? 0;
                return n ? <i key={a} style={{ flexGrow: n, background: agentColor(a) }} /> : null;
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="bars-axis">
        <span>{shortDate(days[0]?.day)}</span>
        <span>aujourd’hui</span>
      </div>
      <div className="legend-row" style={{ marginTop: 8 }}>
        {agents.length === 0 && <span className="muted">Aucun commit sur la période.</span>}
        {agents.map((a) => (
          <span key={a} className="key">
            <i style={{ background: agentColor(a) }} />
            {a}
          </span>
        ))}
      </div>
    </section>
  );
}

function ByType({ byType, total }: { byType: Record<string, number>; total: number }) {
  const rows = Object.entries(byType).sort((a, b) => {
    const ia = TYPE_ORDER.indexOf(a[0] as never);
    const ib = TYPE_ORDER.indexOf(b[0] as never);
    return b[1] - a[1] || (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <section className="card">
      <h2 className="card-title">
        Répartition par type <span className="aside muted">{plural(total, 'note', 'notes')}</span>
      </h2>
      {rows.length === 0 ? (
        <Empty>Aucune note.</Empty>
      ) : (
        <div className="hbars">
          {rows.map(([t, n]) => (
            <div key={t} className="hbar">
              <span className="hbar-label">{typeLabel(t)}</span>
              <span className="hbar-track">
                <i style={{ width: `${(n / max) * 100}%` }} />
              </span>
              <span className="num">{n}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Recent({ commits }: { commits: CommitSummary[] }) {
  return (
    <section className="card">
      <h2 className="card-title">
        Derniers commits
        <a className="aside" href={href('historique')}>
          Tout l’historique
        </a>
      </h2>
      {commits.length === 0 ? (
        <Empty>Aucun commit.</Empty>
      ) : (
        <ul className="commit-list">
          {commits.slice(0, 10).map((c) => (
            <li key={c.hash}>
              <div className="commit-line">
                <AgentBadge agent={c.agent} />
                <a className="commit-msg" href={commitHref(c.hash)}>
                  {c.message}
                </a>
                <span className="muted small nowrap">
                  <Time iso={c.date} />
                </span>
              </div>
              <FileLinks files={c.files} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function FileLinks({ files, max = 4 }: { files: CommitSummary['files']; max?: number }) {
  const [all, setAll] = useState(false);
  if (!files.length) return null;
  const shown = all ? files : files.slice(0, max);
  return (
    <div className="files">
      {shown.map((f) => (
        <span key={f.path} className={`file st-${f.status}`}>
          <span className="st" title={{ A: 'Ajouté', M: 'Modifié', D: 'Supprimé', R: 'Renommé' }[f.status]}>
            {f.status}
          </span>
          {f.status !== 'D' && /\.md$/i.test(f.path) ? <a href={noteHref(f.path)}>{f.path}</a> : <span>{f.path}</span>}
        </span>
      ))}
      {!all && files.length > max && (
        <button className="linkish" onClick={() => setAll(true)}>
          + {files.length - max} autres
        </button>
      )}
    </div>
  );
}

function Health({ issues }: { issues: HealthIssue[] }) {
  const groups = useMemo(() => {
    const m = new Map<HealthIssue['kind'], HealthIssue[]>();
    for (const i of issues) m.set(i.kind, [...(m.get(i.kind) ?? []), i]);
    const order: HealthIssue['kind'][] = ['broken-link', 'missing-frontmatter', 'not-indexed', 'orphan', 'stale'];
    return [...m.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  }, [issues]);
  return (
    <section className="card">
      <h2 className="card-title">
        Santé <span className="aside muted">{issues.length ? plural(issues.length, 'point', 'points') : ''}</span>
      </h2>
      {issues.length === 0 ? (
        <Empty>
          <span className="dot" style={{ background: 'var(--good)', marginRight: 6 }} />
          Aucun problème détecté.
        </Empty>
      ) : (
        <div className="health">
          {groups.map(([kind, list]) => (
            <details key={kind} open={list.length <= 6}>
              <summary>
                <span className="dot" style={{ background: kind === 'broken-link' || kind === 'missing-frontmatter' ? 'var(--critical)' : 'var(--warning)' }} />
                {HEALTH_LABEL[kind] ?? kind}
                <span className="badge">{list.length}</span>
              </summary>
              <ul>
                {list.map((i, k) => (
                  <li key={k}>
                    <a className="mono" href={noteHref(i.path)}>
                      {i.path}
                    </a>
                    <span className="muted">{i.message}</span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
