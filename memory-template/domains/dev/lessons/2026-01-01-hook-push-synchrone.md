---
type: lesson
domain: dev
tags: [git, hooks, codex]
updated: 2026-01-01
status: active
source: exemple
---
# Le hook post-commit doit pousser de façon synchrone

**Symptôme :** les commits faits par Codex n'arrivaient pas sur la copie du serveur, ceux de Claude si.
**Cause probable :** le hook lançait `git push` en arrière-plan ; Codex coupe les processus restants à la fin de chaque commande.
**Solution :** push synchrone avec délai SSH court (5 s) ; en cas d'échec, une ligne dans `.git/ezbrain-push.log`,
et le commit suivant pousse le retard. Voir `hooks/post-commit` à la racine de la mémoire.
