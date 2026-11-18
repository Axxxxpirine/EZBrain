import { watch, type FSWatcher } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { NoteDetail, NoteSummary, Overview } from '../../../shared/api.ts';
import { Git } from './git.ts';
import { backlinksOf, graph, health, isNote, parseNote, search, type ParsedNote } from './notes.ts';

/**
 * Copie de la mémoire, en lecture seule : les agents écrivent dans le dossier EZBrain du poste de travail,
 * dont chaque commit est poussé ici. L'index se recharge quand les fichiers changent.
 */
export class Brain {
  readonly root: string;
  readonly git: Git;
  private notes: Map<string, ParsedNote> | null = null;
  private watcher?: FSWatcher;
  private reloadTimer?: NodeJS.Timeout;

  constructor(root: string) {
    this.root = root;
    this.git = new Git(root);
  }

  watch() {
    this.watcher = watch(this.root, { recursive: true }, (_event, file) => {
      // Un push met à jour .git puis les fichiers : les deux invalident l'index (historique compris).
      if (!file) return;
      clearTimeout(this.reloadTimer);
      this.reloadTimer = setTimeout(() => (this.notes = null), 300);
    });
  }

  close() {
    this.watcher?.close();
  }

  private async walk(dir = ''): Promise<string[]> {
    const out: string[] = [];
    for (const e of await readdir(path.join(this.root, dir), { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'tools') continue;
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) out.push(...(await this.walk(rel)));
      else if (e.name.endsWith('.md')) out.push(rel);
    }
    return out;
  }

  async all(): Promise<Map<string, ParsedNote>> {
    if (this.notes) return this.notes;
    const map = new Map<string, ParsedNote>();
    for (const p of await this.walk()) map.set(p, parseNote(p, await readFile(path.join(this.root, p), 'utf8')));
    for (const n of map.values()) n.brokenLinks = n.links.filter((l) => !map.has(l));
    const touch = await this.git.lastTouch();
    for (const n of map.values()) {
      const t = touch.get(n.path);
      n.lastCommit = t?.date;
      n.lastAgent = t?.agent;
    }
    this.notes = map;
    return map;
  }

  async summaries(): Promise<NoteSummary[]> {
    return [...(await this.all()).values()]
      .map(({ content: _c, body: _b, meta: _m, brokenLinks: _bl, ...s }) => s)
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  async get(p: string): Promise<NoteDetail> {
    const rel = this.normalize(p);
    const notes = await this.all();
    const n = notes.get(rel);
    if (!n) throw new NotFound(`note introuvable : ${rel}`);
    return { ...n, backlinks: backlinksOf(notes, rel), history: await this.git.log({ path: rel, limit: 30 }) };
  }

  async search(query: string, filter: Parameters<typeof search>[2] = {}) {
    return search((await this.all()).values(), query, filter);
  }

  async graph() {
    return graph(await this.all());
  }

  async overview(): Promise<Overview> {
    const notes = await this.all();
    const byType: Record<string, number> = {};
    let count = 0;
    for (const n of notes.values()) {
      if (!isNote(n.path)) continue;
      count++;
      byType[n.type] = (byType[n.type] ?? 0) + 1;
    }
    const domains = [...notes.values()]
      .filter((n) => /^domains\/[^/]+\/INDEX\.md$/.test(n.path))
      .map((idx) => ({
        id: idx.domain,
        // « Bureau : mémoire des dossiers », « gamedev : index » → « Bureau », « gamedev ».
        title: idx.title.split(/\s+:\s+/)[0] || idx.domain,
        notes: [...notes.values()].filter((n) => n.domain === idx.domain && isNote(n.path)).length,
      }))
      .sort((a, b) => b.notes - a.notes);
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const counts = new Map<string, number>();
    for (const c of await this.git.log({ since })) {
      const key = `${c.date.slice(0, 10)}|${c.agent}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const activity = [...counts].map(([k, commits]) => {
      const [day = '', agent = ''] = k.split('|');
      return { day, agent, commits };
    });
    return { notes: count, domains, byType, activity, health: health(notes), recent: await this.git.log({ limit: 10 }) };
  }

  /** Chemin relatif propre, dans le dépôt, vers un fichier .md. */
  normalize(p: string): string {
    const rel = path.posix.normalize(String(p).replace(/\\/g, '/').replace(/^\/+/, ''));
    if (!rel.endsWith('.md') || rel.startsWith('..') || rel.startsWith('.git'))
      throw new BadRequest(`chemin refusé : ${p} (attendu : chemin relatif d'un fichier .md dans EZBrain)`);
    return rel;
  }
}

export class NotFound extends Error {}
export class BadRequest extends Error {}
