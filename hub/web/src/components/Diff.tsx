import { useMemo, useState } from 'react';
import { diffStats, foldDiff, lineDiff, parseUnified, type DiffLine } from '../diff.ts';
import { noteHref } from '../hooks.ts';

function Row({ l }: { l: DiffLine }) {
  const sign = l.kind === 'add' ? '+' : l.kind === 'del' ? '−' : ' ';
  return (
    <div className={`dl ${l.kind}`}>
      <span className="ln">{l.a ?? ''}</span>
      <span className="ln">{l.b ?? ''}</span>
      <span className="sg">{sign}</span>
      <span className="tx">{l.text || ' '}</span>
    </div>
  );
}

/** Diff ligne à ligne entre deux versions d'un fichier, lignes inchangées repliées. */
export function LineDiff({ before, after }: { before: string; after: string }) {
  const lines = useMemo(() => lineDiff(before, after), [before, after]);
  const blocks = useMemo(() => foldDiff(lines), [lines]);
  const stats = useMemo(() => diffStats(lines), [lines]);
  const [open, setOpen] = useState<Set<number>>(new Set());
  if (!stats.add && !stats.del) return <div className="empty">Aucune différence avec la version actuelle.</div>;
  return (
    <div className="diff">
      <div className="diff-stats">
        <span className="add-ink">+{stats.add}</span> <span className="del-ink">−{stats.del}</span>
      </div>
      {blocks.map((b, i) =>
        b.kind === 'lines' || open.has(i) ? (
          b.lines.map((l, k) => <Row key={`${i}-${k}`} l={l} />)
        ) : (
          <button key={i} className="dl-skip" onClick={() => setOpen((s) => new Set(s).add(i))}>
            … {b.count} lignes inchangées
          </button>
        ),
      )}
    </div>
  );
}

/** Diff unifié d'un commit, découpé par fichier. */
export function UnifiedDiff({ diff }: { diff: string }) {
  const files = useMemo(() => parseUnified(diff), [diff]);
  if (!files.length) return <div className="empty">Diff vide.</div>;
  return (
    <div className="udiff">
      {files.map((f, i) => (
        <section key={i} className="udiff-file">
          <header>
            {f.path && /\.md$/i.test(f.path) ? (
              <a className="mono" href={noteHref(f.path)}>
                {f.path}
              </a>
            ) : (
              <span className="mono">{f.path || 'en-tête'}</span>
            )}
            <span className="diff-stats">
              <span className="add-ink">+{f.add}</span> <span className="del-ink">−{f.del}</span>
            </span>
          </header>
          <div className="diff">
            {f.lines.length === 0 && <div className="dl meta"><span className="tx">{f.header.slice(1).join(' · ') || 'Aucun contenu texte.'}</span></div>}
            {f.lines.map((l, k) => (
              <div key={k} className={`dl u ${l.kind}`}>
                <span className="tx">{l.text || ' '}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
