import type { HealthIssue, NoteType } from '../../shared/api.ts';

const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
const dateFmt = new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function parse(iso: string | undefined): Date | null {
  if (!iso) return null;
  // Une date seule (frontmatter « 2026-10-12 ») est une date locale, pas minuit UTC.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function relTime(iso: string | undefined): string {
  const d = parse(iso);
  if (!d) return '—';
  const sec = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(sec);
  if (abs < 45) return 'à l’instant';
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), 'hour');
  if (abs < 86400 * 7) return rtf.format(Math.round(sec / 86400), 'day');
  return dateFmt.format(d);
}

export function shortDate(iso: string | undefined): string {
  const d = parse(iso);
  return d ? dateFmt.format(d) : '—';
}

export function fullDate(iso: string | undefined): string {
  const d = parse(iso);
  if (!d) return '';
  return /^\d{4}-\d{2}-\d{2}$/.test(iso ?? '') ? dateFmt.format(d) : dateTimeFmt.format(d);
}

/** Jour local au format YYYY-MM-DD. */
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function chars(n: number): string {
  if (n < 1000) return `${n} car.`;
  if (n < 1_000_000) return `${(n / 1000).toLocaleString('fr-CH', { maximumFractionDigits: 1 })} k car.`;
  return `${(n / 1_000_000).toLocaleString('fr-CH', { maximumFractionDigits: 1 })} M car.`;
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ------------------------------------------------------------------ agents

export const AGENTS = ['claude', 'codex', 'humain'] as const;

const AGENT_COLORS: Record<string, string> = {
  claude: '#d97757',
  codex: '#3987e5',
  humain: '#0ca30c',
};

export function agentColor(agent: string | undefined): string {
  return AGENT_COLORS[agent ?? ''] ?? '#8a8984';
}

export function agentKey(agent: string | undefined): string {
  return agent && agent in AGENT_COLORS ? agent : 'autre';
}

// ------------------------------------------------------------------ domaines

const DOMAIN_PALETTE = ['#2a78d6', '#eb6834', '#0ca30c', '#a660e8', '#c99a06', '#e0457b', '#14a3a3', '#5b6ee1', '#b5651d', '#7a8f2e', '#c2410c', '#0e7490'];
const SPECIAL_DOMAINS: Record<string, string> = { general: '#7c7a73', me: '#9b8f7a', inbox: '#b0aea6', root: '#5f5e59' };

/** Couleur stable par domaine : l'ordre alphabétique des domaines connus fixe l'indice. */
export function domainColorMap(domains: string[]): Map<string, string> {
  const map = new Map<string, string>();
  const regular = [...new Set(domains)].filter((d) => !(d in SPECIAL_DOMAINS)).sort();
  regular.forEach((d, i) => map.set(d, DOMAIN_PALETTE[i % DOMAIN_PALETTE.length]!));
  for (const [d, c] of Object.entries(SPECIAL_DOMAINS)) map.set(d, c);
  return map;
}

const DOMAIN_ORDER_TAIL = ['general', 'me', 'inbox', 'root'];
export function compareDomains(a: string, b: string): number {
  const ia = DOMAIN_ORDER_TAIL.indexOf(a);
  const ib = DOMAIN_ORDER_TAIL.indexOf(b);
  if (ia !== ib) return ia - ib;
  return a.localeCompare(b, 'fr');
}

export function domainLabel(d: string): string {
  if (d === 'general') return 'Général';
  if (d === 'me') return 'Moi';
  if (d === 'inbox') return 'Boîte de réception';
  if (d === 'root') return 'Racine';
  return d;
}

// ------------------------------------------------------------------ types

export const TYPE_ORDER: NoteType[] = ['index', 'project', 'decision', 'stack', 'pattern', 'lesson', 'preference', 'other'];

const TYPE_LABEL: Record<string, string> = {
  index: 'Index',
  project: 'Projets',
  decision: 'Décisions',
  stack: 'Stack',
  pattern: 'Patterns',
  lesson: 'Leçons',
  preference: 'Préférences',
  other: 'Autres',
};

const TYPE_SINGULAR: Record<string, string> = {
  index: 'index',
  project: 'projet',
  decision: 'décision',
  stack: 'stack',
  pattern: 'pattern',
  lesson: 'leçon',
  preference: 'préférence',
  other: 'autre',
};

export const typeLabel = (t: string) => TYPE_LABEL[t] ?? t;
export const typeSingular = (t: string) => TYPE_SINGULAR[t] ?? t;

const STATUS_LABEL: Record<string, string> = { active: 'actif', superseded: 'remplacé', doubtful: 'douteux' };
export const statusLabel = (s: string) => STATUS_LABEL[s] ?? s;

export const HEALTH_LABEL: Record<HealthIssue['kind'], string> = {
  'broken-link': 'Liens cassés',
  orphan: 'Notes orphelines',
  'not-indexed': 'Non indexées',
  stale: 'Obsolètes',
  'missing-frontmatter': 'Frontmatter manquant',
};

// ------------------------------------------------------------------ chemins

export function dirname(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i);
}

export function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** Résout `rel` par rapport au dossier `base` (chemins du dépôt, séparateur « / »). Null si on sort du dépôt. */
export function resolvePath(base: string, rel: string): string | null {
  const parts = rel.startsWith('/') ? [] : base.split('/').filter(Boolean);
  for (const seg of rel.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(seg);
  }
  return parts.join('/');
}
