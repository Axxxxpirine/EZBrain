import { useMemo, useState } from 'react';
import { api } from '../api.ts';
import { UnifiedDiff } from '../components/Diff.tsx';
import { AgentBadge, Empty, ErrorNotice, Loading, Sheet, Time } from '../components/ui.tsx';
import { agentKey, AGENTS, fullDate, plural } from '../format.ts';
import { commitHref, href, navigate, useApi } from '../hooks.ts';
import { FileLinks } from './Overview.tsx';

export function HistoryView({ hash }: { hash: string }) {
  const list = useApi('commits', () => api.commits(100));
  const [agent, setAgent] = useState('');
  const commits = useMemo(() => (list.data ?? []).filter((c) => !agent || agentKey(c.agent) === agent), [list.data, agent]);

  return (
    <div className="stack">
      <div className="section-head">
        <h2>Historique des commits</h2>
        {list.data && <span className="muted small">{plural(list.data.length, 'commit', 'commits')} récents</span>}
        <div className="aside">
          <div className="seg" role="group" aria-label="Agent">
            <button aria-pressed={!agent} onClick={() => setAgent('')}>
              Tous
            </button>
            {[...AGENTS, 'autre'].map((a) => (
              <button key={a} aria-pressed={agent === a} onClick={() => setAgent(a)}>
                {a}
              </button>
            ))}
          </div>
        </div>
      </div>
      {list.error && <ErrorNotice error={list.error} onRetry={list.reload} />}
      {!list.data && !list.error && <Loading />}
      {list.data && commits.length === 0 && (
        <div className="card">
          <Empty>Aucun commit.</Empty>
        </div>
      )}
      {commits.length > 0 && (
        <ul className="card flush history">
          {commits.map((c) => (
            <li key={c.hash} className={c.hash === hash || c.shortHash === hash ? 'current' : undefined}>
              <a className="history-row" href={commitHref(c.hash)}>
                <AgentBadge agent={c.agent} />
                <span className="commit-msg">{c.message}</span>
                <span className="mono muted small hide-sm">{c.shortHash}</span>
                <span className="muted small nowrap">
                  <Time iso={c.date} />
                </span>
              </a>
              <FileLinks files={c.files} max={3} />
            </li>
          ))}
        </ul>
      )}
      {hash && (
        <CommitSheet hash={hash} onClose={() => navigate(href('historique'))} />
      )}
    </div>
  );
}

function CommitSheet({ hash, onClose }: { hash: string; onClose: () => void }) {
  const commit = useApi(`commit:${hash}`, () => api.commit(hash));
  const c = commit.data;

  return (
    <Sheet
      wide
      title={c ? c.message : 'Commit'}
      subtitle={
        c ? (
          <span className="commit-sub">
            <AgentBadge agent={c.agent} />
            <span className="mono">{c.shortHash}</span>
            <span>{fullDate(c.date)}</span>
          </span>
        ) : (
          <span className="mono">{hash.slice(0, 12)}</span>
        )
      }
      onClose={onClose}
    >
      {commit.error && <ErrorNotice error={commit.error} onRetry={commit.reload} />}
      {!c && !commit.error && <Loading />}
      {c && (
        <>
          <FileLinks files={c.files} max={20} />
          <UnifiedDiff diff={c.diff} />
        </>
      )}
    </Sheet>
  );
}
