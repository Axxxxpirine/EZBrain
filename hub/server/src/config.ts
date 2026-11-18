import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { parse } from 'yaml';

export interface Config {
  server: { host: string; port: number; origin?: string };
  auth: { mode: 'tailscale' | 'none'; allowedLogins: string[] };
  /** Copie git de la mémoire, alimentée par le hook post-commit du poste de travail. */
  brainRoot: string;
}

export function expandHome(p: string): string {
  return p === '~' || p.startsWith('~/') ? path.join(homedir(), p.slice(1)) : p;
}

type Raw = Record<string, any>;

export function loadConfig(file: string): Config {
  const raw: Raw = parse(readFileSync(file, 'utf8')) ?? {};
  const base = path.dirname(path.resolve(file));
  return {
    server: {
      host: raw.server?.host ?? '127.0.0.1',
      port: Number(raw.server?.port ?? 8792),
      origin: raw.server?.origin,
    },
    auth: {
      mode: raw.auth?.mode === 'none' ? 'none' : 'tailscale',
      allowedLogins: (raw.auth?.allowedLogins ?? []).map(String),
    },
    brainRoot: path.resolve(base, expandHome(raw.brainRoot ?? '~/EZBrain')),
  };
}
