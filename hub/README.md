# EZBrain Hub

Webapp de visualisation d'une mémoire EZBrain : vue d'ensemble et santé, notes rendues avec liens entrants,
graphe des liens, recherche, historique des commits par agent. Lecture seule.

Facultative : la mémoire fonctionne sans elle (de simples fichiers Markdown). Stack : Hono (Node ≥ 22.13), React, Vite, d3-force.

## Principe

- **Mémoire :** le dossier EZBrain du poste de travail. Claude Code et Codex y lisent et écrivent directement,
  selon la consigne de `~/.claude/CLAUDE.md` / `~/.codex/AGENTS.md` et le `PROTOCOL.md` de la mémoire.
- **Copie affichée :** un dépôt git sur un serveur (ici un Mac allumé en permanence). Le hook `post-commit` de la mémoire
  y pousse chaque commit (remote `hub`). Serveur injoignable : rien n'est perdu, le commit suivant pousse le retard.
- **Accès :** la webapp écoute sur `127.0.0.1` ; `tailscale serve` la publie en HTTPS sur le tailnet et transmet
  l'identité de l'appelant, vérifiée par `auth.allowedLogins`.
  La webapp n'a pas d'authentification propre : elle fait confiance à l'en-tête ajouté par `tailscale serve`.
  Ne jamais l'écouter sur une autre interface que `127.0.0.1` ni la placer derrière un autre proxy
  (voir [SECURITY.md](../SECURITY.md)). `auth.mode: none` sert uniquement au développement local.

```
poste : ~/EZBrain ──commit──▶ hook post-commit ──git push hub──▶ serveur : ~/EZBrain
                                                                    │ (fichiers surveillés)
                         navigateur ◀── tailscale serve :8446 ◀── webapp 127.0.0.1:8792
```

## Développement

```bash
npm install
cp config.example.yaml config.dev.yaml   # puis brainRoot: ../memory-template, auth.mode: none
npm run dev:server                        # API sur 127.0.0.1:8792
npm run dev:web                           # Vite avec proxy /api
npm test && npm run typecheck
```

## Déploiement (serveur macOS)

Prérequis sur le serveur : Node, Tailscale, accès SSH par clé, et un dépôt qui reçoit la mémoire
(`git init ~/EZBrain` puis, dans ce dossier, `git config receive.denyCurrentBranch updateInstead`).

```bash
DEPLOY_HOST=moi@mon-serveur deploy/deploy.sh
# build, copie dans ~/Apps/ezbrain-hub, LaunchAgent local.ezbrain-hub, tailscale serve :8446
```

Réglages facultatifs : `DEPLOY_DIR`, `DEPLOY_LABEL`, `DEPLOY_HTTPS_PORT`. Pour ne pas les retaper, les écrire une fois dans
`deploy/deploy.env` (copie de `deploy/deploy.env.example`, jamais versionné) : `deploy/deploy.sh` suffit ensuite.
Logs : `~/Apps/ezbrain-hub/logs/` sur le serveur.
Éditer ensuite `~/Apps/ezbrain-hub/config.yaml` (origin, allowedLogins).

Côté poste, brancher la mémoire : `git remote add hub moi@mon-serveur:EZBrain`, puis copier
`memory-template/hooks/post-commit` dans `.git/hooks/` de la mémoire (voir le README à la racine).

## Agents reconnus

L'historique attribue chaque commit à `claude`, `codex` ou `humain` : identité `<agent>@ezbrain.local`, sinon préfixe
du message (`claude: …`, `codex: …`), sinon `humain`. Voir `server/src/brain/git.ts` et `web/src/format.ts`.
