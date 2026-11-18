import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

// Même clé que le script en ligne de index.html, qui applique le thème avant le premier rendu.
const KEY = 'theme';
const listeners = new Set<() => void>();

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Navigation privée : le choix ne sera simplement pas conservé.
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', cssVar('--page'));
  listeners.forEach((l) => l());
}

export function useTheme(): Theme {
  return useSyncExternalStore((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, getTheme);
}

export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
