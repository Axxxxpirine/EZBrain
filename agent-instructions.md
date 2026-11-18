# Consigne à coller dans les agents

À ajouter tel quel (en adaptant le chemin) dans `~/.claude/CLAUDE.md` pour Claude Code et dans `~/.codex/AGENTS.md` pour Codex.
Claude Desktop (Chat, Cowork) ne lit pas `CLAUDE.md` : y coller la même consigne dans les instructions de l'app
et ajouter le dossier EZBrain au projet.

```markdown
## Second cerveau (EZBrain)

- EZBrain est la mémoire long terme partagée entre Claude et Codex : des fichiers Markdown dans `~/EZBrain`.
  Règles complètes : `~/EZBrain/PROTOCOL.md`.
- Au début d'une tâche non triviale, lire `INDEX.md` puis l'index du domaine concerné (section Essentiel),
  et seulement les 1 à 3 notes utiles. Le code actuel et l'utilisateur priment sur une note.
- Avant la réponse finale d'une étape non triviale, faire le bilan mémoire (consignes et corrections de l'utilisateur,
  préférences durables, décisions, état du projet, pièges) et mettre à jour EZBrain sans attendre qu'il le demande,
  puis commit local selon le protocole. Terminer par une ligne `EZBrain : <fichiers>` ou `EZBrain : rien de nouveau à conserver`.
- Les préférences, décisions et leçons durables vont dans EZBrain (partagé avec Codex) plutôt que dans la mémoire
  intégrée de Claude Code.
- Ne jamais pousser EZBrain vers GitHub.
```
