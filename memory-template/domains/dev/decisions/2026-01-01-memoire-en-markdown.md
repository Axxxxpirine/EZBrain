---
type: decision
domain: dev
aliases: [mémoire en Markdown, sans serveur MCP, agent memory format]
updated: 2026-01-01
tags: [architecture, memory]
status: active
source: exemple
---
# La mémoire des agents est un simple dossier de fichiers Markdown

**Contexte :** une mémoire commune à Claude et Codex, enrichie au fil du travail, réutilisable entre projets.
**Choix :** dossier `EZBrain` de fichiers `.md` liés entre eux (liens Markdown relatifs), frontmatter YAML,
recherche par `rg`. Les agents écrivent automatiquement, sans validation, en suivant [PROTOCOL.md](../../../PROTOCOL.md).
**Pourquoi :** les deux agents savent déjà lire et écrire des fichiers ; zéro infrastructure ; lisible par un humain ;
indépendant de tout fournisseur.
**Écarté :**
- serveur MCP avec recherche sémantique : inutile au départ, ajoute de l'infra ;
- capture automatique des sessions avec distillation : essayée, fonctionne, mais plus lourde que la consigne aux agents ;
- application de prise de notes dédiée, syntaxe `[[ ]]` : pas de dépendance à un outil voulue ;
- validation humaine de chaque écriture : trop contraignant au quotidien.
**Conséquences :** la qualité repose sur la discipline des agents (sélectivité, mise à jour plutôt que création,
hygiène). La visualisation passe par une webapp en lecture seule (EZBrain Hub), sans rien ajouter côté agents.
À réévaluer si la recherche par mots-clés ne suffit plus.
