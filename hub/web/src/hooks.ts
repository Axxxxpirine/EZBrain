import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { errorText } from './api.ts';

export interface Async<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => void;
  /** Remplace les données localement (après une action, sans attendre le rechargement). */
  set: (update: (prev: T | undefined) => T | undefined) => void;
}

/**
 * Charge une ressource. `key` change => nouveau chargement ; `null` => rien.
 * Les données précédentes restent affichées pendant un rechargement.
 */
export function useApi<T>(key: string | null, load: () => Promise<T>, opts: { poll?: number } = {}): Async<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(key !== null);
  const loadRef = useRef(load);
  loadRef.current = load;
  const seq = useRef(0);
  const lastKey = useRef<string | null>(null);

  const run = useCallback(() => {
    const id = ++seq.current;
    setLoading(true);
    loadRef.current().then(
      (d) => {
        if (id !== seq.current) return;
        setData(d);
        setError(null);
        setLoading(false);
      },
      (err) => {
        if (id !== seq.current) return;
        setError(errorText(err));
        setLoading(false);
      },
    );
  }, []);

  useEffect(() => {
    if (key === null) {
      seq.current++;
      setData(undefined);
      setError(null);
      setLoading(false);
      lastKey.current = null;
      return;
    }
    if (lastKey.current !== key) {
      // Nouvelle ressource : ne pas montrer celle d'avant.
      setData(undefined);
      setError(null);
      lastKey.current = key;
    }
    run();
  }, [key, run]);

  usePolling(key !== null && opts.poll ? opts.poll : 0, run);

  return { data, error, loading, reload: run, set: setData as Async<T>['set'] };
}

/** Appelle `fn` toutes les `ms` quand l'onglet est visible, et dès qu'il le redevient. */
export function usePolling(ms: number, fn: () => void) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    if (!ms) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      clearInterval(timer);
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') fnRef.current();
      }, ms);
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        fnRef.current();
        start();
      } else clearInterval(timer);
    };
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [ms]);
}

export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (l) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', l);
      return () => m.removeEventListener('change', l);
    },
    () => window.matchMedia(query).matches,
  );
}

// ------------------------------------------------------------------ route (hash)

export type View = 'apercu' | 'notes' | 'carte' | 'historique';
export const VIEWS: View[] = ['apercu', 'notes', 'carte', 'historique'];

export interface Route {
  view: View;
  /** Reste du chemin, décodé (chemin de note, hash de commit…). */
  rest: string;
}

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const slash = raw.indexOf('/');
  const head = slash === -1 ? raw : raw.slice(0, slash);
  const tail = slash === -1 ? '' : raw.slice(slash + 1);
  const view = (VIEWS as string[]).includes(head) ? (head as View) : 'apercu';
  let rest = tail;
  try {
    rest = decodeURIComponent(tail);
  } catch {
    // Laisser tel quel un hash mal encodé.
  }
  return { view, rest };
}

let current = parseHash();
let currentHash = window.location.hash;
const routeListeners = new Set<() => void>();
window.addEventListener('hashchange', () => {
  current = parseHash();
  currentHash = window.location.hash;
  routeListeners.forEach((l) => l());
});

export function useRoute(): Route {
  return useSyncExternalStore(
    (l) => {
      routeListeners.add(l);
      return () => routeListeners.delete(l);
    },
    () => {
      if (window.location.hash !== currentHash) {
        current = parseHash();
        currentHash = window.location.hash;
      }
      return current;
    },
  );
}

/** Lien vers une vue : les « / » du reste restent lisibles dans l'URL. */
export function href(view: View, rest = ''): string {
  const enc = rest
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/');
  return `#/${view}${rest ? `/${enc}` : ''}`;
}

export const noteHref = (path: string) => href('notes', path);
export const commitHref = (hash: string) => href('historique', hash);

export function navigate(to: string) {
  if (window.location.hash !== to) window.location.hash = to;
}
