import type {
  CommitDetail,
  CommitSummary,
  GraphData,
  NoteDetail,
  NoteSummary,
  Overview,
  SearchHit,
} from '../../shared/api.ts';

/** Erreur renvoyée par l'API : le message est le champ `error` du corps quand il existe. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError('Serveur injoignable', 0);
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const msg = data && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : `Erreur HTTP ${res.status}`;
    throw new ApiError(msg, res.status);
  }
  if (data === null && text) throw new ApiError('Réponse illisible du serveur', res.status);
  return data as T;
}

const q = (params: Record<string, string | number | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
};

export const api = {
  me: () => request<{ user: string | null }>('GET', '/me'),
  overview: () => request<Overview>('GET', '/overview'),
  notes: () => request<NoteSummary[]>('GET', '/notes'),
  note: (path: string) => request<NoteDetail>('GET', `/note${q({ path })}`),
  search: (query: string, domain?: string, type?: string) => request<SearchHit[]>('GET', `/search${q({ q: query, domain, type })}`),
  graph: () => request<GraphData>('GET', '/graph'),
  commits: (limit = 100, path?: string) => request<CommitSummary[]>('GET', `/commits${q({ limit, path })}`),
  commit: (hash: string) => request<CommitDetail>('GET', `/commit${q({ hash })}`),
};

export const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));
