export type DiffLine = { kind: 'same' | 'add' | 'del'; text: string; a?: number; b?: number };

/** Au-delà, la table LCS devient trop lourde : on affiche tout comme remplacé. */
const MAX_CELLS = 6_000_000;

/** Diff ligne à ligne par plus longue sous-séquence commune. Numéros de ligne à partir de 1. */
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.replace(/\r\n/g, '\n').split('\n');
  const b = after.replace(/\r\n/g, '\n').split('\n');
  // Préfixe et suffixe communs : la plupart des modifications sont locales.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const out: DiffLine[] = [];
  for (let i = 0; i < start; i++) out.push({ kind: 'same', text: a[i]!, a: i + 1, b: i + 1 });

  const n = endA - start;
  const m = endB - start;
  if (n * m > MAX_CELLS) {
    for (let i = start; i < endA; i++) out.push({ kind: 'del', text: a[i]!, a: i + 1 });
    for (let j = start; j < endB; j++) out.push({ kind: 'add', text: b[j]!, b: j + 1 });
  } else {
    // dp[i][j] = longueur de la LCS de a[start+i..] et b[start+j..]
    const w = m + 1;
    const dp = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i * w + j] = a[start + i] === b[start + j] ? dp[(i + 1) * w + j + 1]! + 1 : Math.max(dp[(i + 1) * w + j]!, dp[i * w + j + 1]!);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && a[start + i] === b[start + j]) {
        out.push({ kind: 'same', text: a[start + i]!, a: start + i + 1, b: start + j + 1 });
        i++;
        j++;
      } else if (i < n && (j === m || dp[(i + 1) * w + j]! >= dp[i * w + j + 1]!)) {
        // Suppressions avant ajouts, comme dans un diff git.
        out.push({ kind: 'del', text: a[start + i]!, a: start + i + 1 });
        i++;
      } else {
        out.push({ kind: 'add', text: b[start + j]!, b: start + j + 1 });
        j++;
      }
    }
  }

  const shift = endB - endA;
  for (let i = endA; i < a.length; i++) out.push({ kind: 'same', text: a[i]!, a: i + 1, b: i + 1 + shift });
  return out;
}

export type DiffBlock = { kind: 'lines'; lines: DiffLine[] } | { kind: 'skip'; count: number; lines: DiffLine[] };

/** Regroupe les lignes inchangées loin de toute modification (au-delà de `context` lignes). */
export function foldDiff(lines: DiffLine[], context = 3): DiffBlock[] {
  const keep = new Array<boolean>(lines.length).fill(false);
  lines.forEach((l, i) => {
    if (l.kind === 'same') return;
    for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++) keep[k] = true;
  });
  const blocks: DiffBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const visible = keep[i]!;
    let j = i;
    while (j < lines.length && keep[j] === visible) j++;
    const slice = lines.slice(i, j);
    // Un repli de moins de 3 lignes coûte plus qu'il ne rapporte.
    if (visible || slice.length < 3) blocks.push({ kind: 'lines', lines: slice });
    else blocks.push({ kind: 'skip', count: slice.length, lines: slice });
    i = j;
  }
  return blocks;
}

export function diffStats(lines: DiffLine[]): { add: number; del: number } {
  let add = 0;
  let del = 0;
  for (const l of lines) {
    if (l.kind === 'add') add++;
    else if (l.kind === 'del') del++;
  }
  return { add, del };
}

// ------------------------------------------------------------------ diff unifié (git)

export interface FileDiff {
  path: string;
  header: string[];
  lines: { kind: 'hunk' | 'add' | 'del' | 'same' | 'meta'; text: string }[];
  add: number;
  del: number;
}

/** Découpe un diff unifié de `git show` en fichiers. */
export function parseUnified(diff: string): FileDiff[] {
  const files: FileDiff[] = [];
  let cur: FileDiff | null = null;
  let inHunk = false;
  for (const line of diff.replace(/\r\n/g, '\n').split('\n')) {
    if (line.startsWith('diff --git ')) {
      const m = / b\/(.+)$/.exec(line);
      cur = { path: m?.[1] ?? line.slice(11), header: [line], lines: [], add: 0, del: 0 };
      files.push(cur);
      inHunk = false;
      continue;
    }
    if (!cur) {
      if (line.trim()) {
        cur = { path: '', header: [], lines: [], add: 0, del: 0 };
        files.push(cur);
      } else continue;
    }
    if (line.startsWith('@@')) {
      inHunk = true;
      cur.lines.push({ kind: 'hunk', text: line });
    } else if (!inHunk) {
      cur.header.push(line);
      const m = /^\+\+\+ b\/(.+)$/.exec(line);
      if (m) cur.path = m[1]!;
      else if (!cur.path) {
        const r = /^rename to (.+)$/.exec(line);
        if (r) cur.path = r[1]!;
      }
    } else if (line.startsWith('+')) {
      cur.lines.push({ kind: 'add', text: line });
      cur.add++;
    } else if (line.startsWith('-')) {
      cur.lines.push({ kind: 'del', text: line });
      cur.del++;
    } else if (line.startsWith('\\')) {
      cur.lines.push({ kind: 'meta', text: line });
    } else {
      cur.lines.push({ kind: 'same', text: line });
    }
  }
  // Le dernier saut de ligne du diff produit une ligne vide parasite.
  for (const f of files) {
    const last = f.lines[f.lines.length - 1];
    if (last && last.kind === 'same' && last.text === '') f.lines.pop();
  }
  return files;
}
