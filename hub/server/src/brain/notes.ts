import path from 'node:path';
import { parse } from 'yaml';
import type { GraphData, HealthIssue, NoteSummary, NoteType, SearchHit } from '../../../shared/api.ts';

export interface ParsedNote extends NoteSummary {
  content: string;
  body: string;
  meta: Record<string, unknown>;
  brokenLinks: string[];
}

const NOTE_DIRS = ['domains', 'general', 'me', 'inbox'];
const TYPES: NoteType[] = ['project', 'decision', 'stack', 'pattern', 'lesson', 'preference', 'index', 'other'];
const FOLDER_TYPES: Record<string, NoteType> = {
  projects: 'project', decisions: 'decision', stack: 'stack', patterns: 'pattern', lessons: 'lesson',
};
const LINK_RE = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const FENCE_RE = /```[\s\S]*?```/g;
const CODE_RE = /`[^`\n]*`/g;

/** Une note au sens du protocole : rangée dans un dossier de notes, hors index et README. */
export function isNote(p: string): boolean {
  const base = path.posix.basename(p);
  return NOTE_DIRS.includes(p.split('/')[0] ?? '') && base !== 'INDEX.md' && base !== 'README.md';
}

export function splitFrontmatter(content: string): { meta: Record<string, unknown>; body: string } {
  if (!content.startsWith('---\n')) return { meta: {}, body: content };
  const end = content.indexOf('\n---', 4);
  if (end === -1) return { meta: {}, body: content };
  let meta: Record<string, unknown> = {};
  try {
    const parsed = parse(content.slice(4, end));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) meta = parsed as Record<string, unknown>;
  } catch {
    // Frontmatter invalide : signalé par le contrôle de santé (champs manquants).
  }
  const after = content.indexOf('\n', end + 4);
  return { meta, body: after === -1 ? '' : content.slice(after + 1) };
}

function domainOf(p: string): string {
  const parts = p.split('/');
  if (parts[0] === 'domains' && parts.length > 2) return parts[1] ?? 'root';
  if (parts.length > 1 && NOTE_DIRS.includes(parts[0] ?? '')) return parts[0] ?? 'root';
  return 'root';
}

function typeOf(p: string, meta: Record<string, unknown>): NoteType {
  if (path.posix.basename(p) === 'INDEX.md') return 'index';
  const declared = String(meta.type ?? '');
  if ((TYPES as string[]).includes(declared)) return declared as NoteType;
  for (const part of p.split('/')) if (FOLDER_TYPES[part]) return FOLDER_TYPES[part];
  return p.startsWith('me/') ? 'preference' : 'other';
}

function list(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

function date(v: unknown): string | undefined {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return typeof v === 'string' && v ? v : undefined;
}

/** Liens Markdown relatifs vers des .md, résolus depuis le dossier de la note. */
export function extractLinks(p: string, body: string): string[] {
  const text = body.replace(FENCE_RE, '').replace(CODE_RE, '');
  const out = new Set<string>();
  for (const m of text.matchAll(LINK_RE)) {
    let target = m[1] ?? '';
    if (/^[a-z]+:/i.test(target) || target.startsWith('#')) continue;
    target = decodeURIComponent(target.split('#')[0] ?? '');
    if (!target.endsWith('.md')) continue;
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(p), target));
    if (!resolved.startsWith('..')) out.add(resolved);
  }
  return [...out];
}

export function parseNote(p: string, content: string): ParsedNote {
  const { meta, body } = splitFrontmatter(content);
  const heading = /^#\s+(.+)$/m.exec(body)?.[1]?.trim();
  return {
    path: p,
    title: heading ?? path.posix.basename(p, '.md'),
    domain: domainOf(p),
    type: typeOf(p, meta),
    status: meta.status ? String(meta.status) : undefined,
    tags: list(meta.tags),
    aliases: list(meta.aliases),
    updated: date(meta.updated) ?? date(meta.created),
    words: body.split(/\s+/).filter(Boolean).length,
    links: extractLinks(p, body),
    brokenLinks: [],
    content,
    body,
    meta,
  };
}

// ---- Recherche ----

/** Minuscules sans accents, caractère pour caractère (les positions restent alignées sur l'original). */
export function fold(s: string): string {
  let out = '';
  for (const ch of s) {
    const f = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    out += f.length === 1 ? f : ch.length === 1 ? ch.toLowerCase().slice(0, 1) : ' ';
  }
  return out;
}

const WORD = /[\p{L}\p{N}]/u;

/** Occurrences en début de mot (« hub » ne compte pas dans « github »), plafonnées à 20. */
function count(hay: string, needle: string): number {
  let n = 0;
  for (let i = hay.indexOf(needle); i !== -1 && n < 20; i = hay.indexOf(needle, i + needle.length)) {
    if (i === 0 || !WORD.test(hay[i - 1] ?? '')) n++;
  }
  return n;
}

function snippet(body: string, tokens: string[]): string {
  const flat = body.replace(/\s+/g, ' ');
  const folded = fold(flat);
  let pos = -1;
  for (const t of tokens) {
    // Les termes ne contiennent que lettres, chiffres, « _ » et « - » : rien à échapper.
    const i = folded.search(new RegExp(`(?<![\\p{L}\\p{N}])${t}`, 'u'));
    if (i !== -1 && (pos === -1 || i < pos)) pos = i;
  }
  const start = Math.max(0, pos - 80);
  const end = Math.min(flat.length, (pos === -1 ? 0 : pos) + 160);
  let text = flat.slice(start, end);
  const ftext = folded.slice(start, end);
  // Entoure chaque occurrence de « ** », de la fin vers le début pour garder les positions.
  const marks: [number, number][] = [];
  for (const t of tokens) {
    for (let i = ftext.indexOf(t); i !== -1; i = ftext.indexOf(t, i + t.length)) {
      if (i === 0 || !WORD.test(ftext[i - 1] ?? '')) marks.push([i, i + t.length]);
    }
  }
  marks.sort((a, b) => b[0] - a[0]);
  let last = Infinity;
  for (const [a, b] of marks) {
    if (b > last) continue;
    text = `${text.slice(0, a)}**${text.slice(a, b)}**${text.slice(b)}`;
    last = a;
  }
  return (start > 0 ? '…' : '') + text + (end < flat.length ? '…' : '');
}

export function search(
  notes: Iterable<ParsedNote>,
  query: string,
  filter: { domain?: string; type?: string; tag?: string; status?: string; limit?: number } = {},
): SearchHit[] {
  const tokens = fold(query).split(/[^\p{L}\p{N}_-]+/u).filter((t) => t.length > 1);
  const hits: SearchHit[] = [];
  for (const n of notes) {
    if (filter.domain && n.domain !== filter.domain) continue;
    if (filter.type && n.type !== filter.type) continue;
    if (filter.status && n.status !== filter.status) continue;
    if (filter.tag && !n.tags.includes(filter.tag)) continue;
    let score = tokens.length ? 0 : 1;
    if (tokens.length) {
      const title = fold(n.title);
      const keys = fold([...n.aliases, ...n.tags].join(' '));
      const p = fold(n.path);
      const body = fold(n.body);
      let all = true;
      for (const t of tokens) {
        const s = count(title, t) * 6 + count(keys, t) * 4 + count(p, t) * 2 + Math.min(count(body, t), 10);
        if (s === 0) all = false;
        score += s;
      }
      // Tous les termes présents : nettement devant les correspondances partielles.
      if (all) score *= 3;
      if (score === 0) continue;
    }
    if (n.status === 'superseded') score *= 0.5;
    hits.push({ path: n.path, title: n.title, domain: n.domain, type: n.type, score, snippet: snippet(n.body, tokens) });
  }
  hits.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return hits.slice(0, filter.limit ?? 20);
}

// ---- Graphe et santé ----

export function backlinksOf(notes: Map<string, ParsedNote>, target: string): string[] {
  return [...notes.values()].filter((n) => n.links.includes(target)).map((n) => n.path).sort();
}

export function graph(notes: Map<string, ParsedNote>): GraphData {
  const degree = new Map<string, number>();
  const edges: GraphData['edges'] = [];
  for (const n of notes.values()) {
    for (const l of n.links) {
      if (!notes.has(l) || l === n.path) continue;
      edges.push({ source: n.path, target: l });
      degree.set(n.path, (degree.get(n.path) ?? 0) + 1);
      degree.set(l, (degree.get(l) ?? 0) + 1);
    }
  }
  const nodes = [...notes.values()]
    .filter((n) => n.path !== 'PROTOCOL.md')
    .map((n) => ({ id: n.path, title: n.title, domain: n.domain, type: n.type, degree: degree.get(n.path) ?? 0 }));
  const ids = new Set(nodes.map((n) => n.id));
  return { nodes, edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)) };
}

const STALE_DAYS = 120;

export function health(notes: Map<string, ParsedNote>, now = Date.now()): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const linked = new Set<string>();
  for (const n of notes.values()) for (const l of n.links) linked.add(l);
  for (const n of notes.values()) {
    for (const b of n.brokenLinks) issues.push({ path: n.path, kind: 'broken-link', message: `lien cassé vers ${b}` });
    if (!isNote(n.path)) continue;
    const missing = ['type', 'domain', 'status'].filter((k) => !n.meta[k]);
    if (missing.length) issues.push({ path: n.path, kind: 'missing-frontmatter', message: `frontmatter incomplet : ${missing.join(', ')}` });
    if (!linked.has(n.path) && !n.path.startsWith('inbox/'))
      issues.push({ path: n.path, kind: 'orphan', message: 'aucune note ni index ne pointe vers cette note' });
    if (n.status === 'active' && n.updated && n.type === 'project') {
      const age = (now - Date.parse(n.updated)) / 86_400_000;
      if (age > STALE_DAYS) issues.push({ path: n.path, kind: 'stale', message: `fiche projet non mise à jour depuis ${Math.round(age)} jours` });
    }
  }
  return issues;
}
