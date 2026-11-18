import assert from 'node:assert/strict';
import { test } from 'node:test';
import { agentOf } from '../server/src/brain/git.ts';
import { extractLinks, fold, parseNote, search } from '../server/src/brain/notes.ts';

const lesson = parseNote(
  'domains/gamedev/lessons/2026-10-12-ocr.md',
  `---
type: lesson
domain: gamedev
tags: [ocr, tesseract]
updated: 2026-10-12
status: active
---
# Consensus OCR et véto

Voir [Tesseract](../stack/tesseract-js.md#pieges), [site](https://github.com/x) et \`[faux](nope.md)\`.
`,
);

test('parseNote lit le frontmatter, le titre et les liens résolus', () => {
  assert.equal(lesson.title, 'Consensus OCR et véto');
  assert.equal(lesson.domain, 'gamedev');
  assert.equal(lesson.type, 'lesson');
  assert.deepEqual(lesson.tags, ['ocr', 'tesseract']);
  assert.equal(lesson.updated, '2026-10-12');
  assert.deepEqual(lesson.links, ['domains/gamedev/stack/tesseract-js.md']);
});

test('type déduit du dossier quand le frontmatter manque', () => {
  const n = parseNote('domains/architecture/lessons/x.md', '# X\n');
  assert.equal(n.type, 'lesson');
  assert.equal(n.domain, 'architecture');
  assert.equal(parseNote('INDEX.md', '# I\n').type, 'index');
});

test('extractLinks ignore les liens externes et sortant du dépôt', () => {
  assert.deepEqual(extractLinks('me/profile.md', '[a](working-style.md) [b](../../x.md) [c](http://a.md)'), ['me/working-style.md']);
});

test('fold garde les positions et retire accents et casse', () => {
  assert.equal(fold('Véto Œuf'), 'veto œuf');
  assert.equal(fold('Éàç').length, 3);
});

test('search : accents ignorés, début de mot seulement', () => {
  const other = parseNote('domains/ai-tooling/projects/hub.md', '# Projet\n\nVoir github.com\n');
  assert.equal(search([lesson, other], 'veto')[0]?.path, lesson.path);
  assert.equal(search([lesson, other], 'hub').length, 1); // le chemin contient « hub », pas « github »
  assert.match(search([lesson], 'consensus')[0]?.snippet ?? '', /\*\*Consensus\*\*/);
});

test('agentOf : identité du hub, préfixe du message, sinon humain', () => {
  assert.equal(agentOf('Claude', 'claude@ezbrain.local', 'x'), 'claude');
  assert.equal(agentOf('Alex', 'alex@example.com', 'Codex: record'), 'codex');
  assert.equal(agentOf('Alex', 'alex@example.com', 'Projet : décision'), 'humain');
});
