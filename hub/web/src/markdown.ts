import DOMPurify from 'dompurify';
import { Marked } from 'marked';
import { dirname, resolvePath } from './format.ts';
import { noteHref } from './hooks.ts';

const md = new Marked({ gfm: true, breaks: false, async: false });

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** Enlève un frontmatter YAML en tête (si le corps en contient encore un). */
export function stripFrontmatter(src: string): string {
  return src.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

/**
 * Markdown -> HTML assaini. Les liens relatifs vers des `.md` deviennent des liens internes (`#/notes/...`)
 * résolus depuis le dossier de la note ; les liens externes s'ouvrent dans un nouvel onglet ;
 * les ancres internes (`#titre`) portent `data-anchor` pour défiler sans toucher à la route.
 */
export function renderMarkdown(src: string, notePath: string, title?: string): string {
  const raw = md.parse(src) as string;
  const clean = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true }, ADD_ATTR: ['target'] });
  const tpl = document.createElement('template');
  tpl.innerHTML = clean;
  const root = tpl.content;
  const base = dirname(notePath);

  // Le titre est déjà affiché dans l'en-tête du lecteur : ne pas le répéter.
  const first = root.firstElementChild;
  if (title && first?.tagName === 'H1' && first.textContent?.trim() === title.trim()) first.remove();

  const seen = new Map<string, number>();
  root.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
    let id = slugify(h.textContent ?? '') || 'section';
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    if (n) id = `${id}-${n}`;
    h.id = `h-${id}`;
  });

  root.querySelectorAll('a[href]').forEach((a) => {
    const hrefAttr = a.getAttribute('href') ?? '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(hrefAttr) || hrefAttr.startsWith('//')) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
      return;
    }
    if (hrefAttr.startsWith('#')) {
      a.setAttribute('data-anchor', `h-${slugify(decodeSafe(hrefAttr.slice(1)))}`);
      a.setAttribute('href', '#');
      return;
    }
    const [pathPart = '', frag] = hrefAttr.split('#');
    const target = resolvePath(base, decodeSafe(pathPart.split('?')[0] ?? ''));
    if (target && /\.md$/i.test(target)) {
      a.setAttribute('href', noteHref(target) + (frag ? `?a=h-${slugify(decodeSafe(frag))}` : ''));
      a.classList.add('internal');
    } else {
      // Fichier du dépôt qui n'est pas une note : pas de route pour l'afficher.
      a.removeAttribute('href');
      a.classList.add('unresolved');
      a.setAttribute('title', target ?? hrefAttr);
    }
  });

  const div = document.createElement('div');
  div.appendChild(root);
  return div.innerHTML;
}

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
