// Contrat entre le serveur (server/src) et le dashboard (web/src). Le dashboard est en lecture seule :
// la mémoire s'écrit dans le dossier EZBrain du poste de travail, poussé vers le serveur à chaque commit.
// Tous les chemins de notes sont relatifs à la racine du dépôt EZBrain, séparateur « / ».

export type NoteType = 'project' | 'decision' | 'stack' | 'pattern' | 'lesson' | 'preference' | 'index' | 'other';
export type NoteStatus = 'active' | 'superseded' | 'doubtful' | string;

export interface NoteSummary {
  path: string;
  title: string;
  /** Premier dossier sous domains/, ou « general », « me », « inbox », « root ». */
  domain: string;
  type: NoteType;
  status?: NoteStatus;
  tags: string[];
  aliases: string[];
  /** Date ISO (frontmatter `updated`, sinon `created`). */
  updated?: string;
  /** Date ISO du dernier commit qui a touché le fichier. */
  lastCommit?: string;
  /** Agent auteur du dernier commit : claude | codex | humain. */
  lastAgent?: string;
  words: number;
  /** Liens sortants vers d'autres fichiers .md du dépôt (chemins résolus). */
  links: string[];
}

export interface NoteDetail extends NoteSummary {
  /** Contenu complet du fichier, frontmatter compris. */
  content: string;
  /** Corps sans frontmatter. */
  body: string;
  meta: Record<string, unknown>;
  backlinks: string[];
  /** Liens sortants qui ne mènent à aucun fichier. */
  brokenLinks: string[];
  history: CommitSummary[];
}

export interface SearchHit {
  path: string;
  title: string;
  domain: string;
  type: NoteType;
  score: number;
  /** Extrait avec les termes trouvés entourés de « ** ». */
  snippet: string;
}

export interface CommitSummary {
  hash: string;
  shortHash: string;
  date: string;
  agent: string;
  message: string;
  files: { path: string; status: 'A' | 'M' | 'D' | 'R' }[];
}

export interface CommitDetail extends CommitSummary {
  /** Diff unifié complet. */
  diff: string;
}

export interface HealthIssue {
  path: string;
  kind: 'broken-link' | 'missing-frontmatter' | 'orphan' | 'stale' | 'not-indexed';
  message: string;
}

export interface Overview {
  notes: number;
  domains: { id: string; title: string; notes: number }[];
  byType: Record<string, number>;
  /** Commits des 30 derniers jours, par jour (YYYY-MM-DD) et par agent. */
  activity: { day: string; agent: string; commits: number }[];
  health: HealthIssue[];
  recent: CommitSummary[];
}

export interface GraphData {
  nodes: { id: string; title: string; domain: string; type: NoteType; degree: number }[];
  edges: { source: string; target: string }[];
}

// ---- Routes REST (préfixe /api) ----
// GET    /api/me                         -> { user: string | null }
// GET    /api/overview                   -> Overview
// GET    /api/notes                      -> NoteSummary[]
// GET    /api/note?path=...              -> NoteDetail
// GET    /api/search?q=...&domain=&type= -> SearchHit[]
// GET    /api/graph                      -> GraphData
// GET    /api/commits?limit=&path=       -> CommitSummary[]
// GET    /api/commit?hash=...            -> CommitDetail
// Erreurs : statut HTTP 4xx/5xx et corps { error: string }.
