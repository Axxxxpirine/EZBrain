import type { CommitDetail, CommitSummary } from '../../../shared/api.ts';
import { run, runOk } from '../exec.ts';

const KNOWN_AGENTS = ['claude', 'codex', 'humain'];
const FIELD = '\x1f';
const RECORD = '\x1e';
// Séparateur en tête : les lignes --name-status suivent l'en-tête de leur commit.
const FORMAT = '%x1e' + ['%H', '%h', '%aI', '%an', '%ae', '%s'].join('%x1f');

/** Agent d'un commit : identité « <agent>@ezbrain.local », sinon préfixe du message (« codex: … »), sinon humain. */
export function agentOf(authorName: string, authorEmail: string, message: string): string {
  const local = authorEmail.split('@')[0]?.toLowerCase() ?? '';
  if (authorEmail.endsWith('@ezbrain.local') && local) return local;
  const prefix = /^\s*(claude|codex)\b/i.exec(message)?.[1]?.toLowerCase();
  if (prefix) return prefix;
  const name = authorName.toLowerCase();
  return KNOWN_AGENTS.includes(name) ? name : 'humain';
}

function parseLog(out: string): CommitSummary[] {
  const commits: CommitSummary[] = [];
  for (const chunk of out.split(RECORD)) {
    const text = chunk.replace(/^\n+/, '');
    if (!text.trim()) continue;
    const [header = '', ...rest] = text.split('\n');
    const [hash = '', shortHash = '', date = '', an = '', ae = '', message = ''] = header.split(FIELD);
    const files: CommitSummary['files'] = [];
    for (const line of rest) {
      const parts = line.split('\t');
      if (parts.length < 2) continue;
      const code = (parts[0] ?? '')[0] as CommitSummary['files'][number]['status'];
      const file = parts[parts.length - 1] ?? '';
      if (['A', 'M', 'D', 'R'].includes(code)) files.push({ path: file, status: code });
    }
    commits.push({ hash, shortHash, date, agent: agentOf(an, ae, message), message, files });
  }
  return commits;
}

export class Git {
  private readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  private git(args: string[], input?: string) {
    return runOk('git', ['-C', this.root, ...args], { input });
  }

  async log(opts: { limit?: number; path?: string; since?: string } = {}): Promise<CommitSummary[]> {
    const args = ['log', `--format=${FORMAT}`, '--name-status', '--no-renames'];
    if (opts.limit) args.push(`-n${opts.limit}`);
    if (opts.since) args.push(`--since=${opts.since}`);
    if (opts.path) args.push('--', opts.path);
    const out = await run('git', ['-C', this.root, ...args]);
    // Dépôt sans commit : pas d'historique.
    return out.code === 0 ? parseLog(out.stdout) : [];
  }

  async show(hash: string): Promise<CommitDetail> {
    if (!/^[0-9a-f]{4,40}$/i.test(hash)) throw new Error('hash invalide');
    const [summary] = parseLog(await this.git(['log', '-1', `--format=${FORMAT}`, '--name-status', '--no-renames', hash]));
    if (!summary) throw new Error('commit introuvable');
    const diff = await this.git(['show', '--format=', '--no-color', '--no-renames', hash]);
    return { ...summary, diff };
  }

  /** Dernier commit de chaque fichier encore présent. */
  async lastTouch(): Promise<Map<string, { date: string; agent: string }>> {
    const map = new Map<string, { date: string; agent: string }>();
    for (const c of await this.log()) {
      for (const f of c.files) if (!map.has(f.path)) map.set(f.path, { date: c.date, agent: c.agent });
    }
    return map;
  }
}
