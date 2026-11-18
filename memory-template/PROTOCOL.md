# EZBrain : protocole des agents

Mémoire long terme partagée entre les agents IA de l'utilisateur (Claude, Codex). Simples fichiers Markdown dans
`~/EZBrain` (adapter le chemin), git local. Option : chaque commit est poussé automatiquement (hook `post-commit`) vers une
copie sur un serveur, affichée en lecture seule par la webapp EZBrain Hub (graphe, notes, historique).

**Sobriété avant tout.** EZBrain doit faire gagner du temps, pas en coûter. Lire peu, écrire peu,
ne pas sur-réfléchir. Dans le doute, ne rien écrire.

## Organiser pour retrouver sans tout charger

- Les index orientent : sujets disponibles et liens descriptifs, sans recopier les notes.
- La fiche projet sert à reprendre le travail : but, état actuel daté, contraintes et décisions actives,
  point de reprise utile, selon le sujet, sans formulaire imposé. Elle donne accès aux détails ; elle n'accumule
  ni historique des séances ni seconde liste de tâches.
- Une note répond à un besoin de consultation cohérent. Séparer un détail technique, une décision argumentée
  ou un historique documentaire lorsqu'il peut être consulté indépendamment. Garder ensemble ce qui doit être compris ensemble.
  Ni seuil de longueur, ni alerte, ni découpage pour atteindre un quota ; aucun dossier ou fichier créé par anticipation.
- Chaque information a une note de référence. Ailleurs, un bref résumé avec lien suffit ; ne pas dupliquer les développements.
  Les documents originaux restent les sources : conserver les références et conclusions utiles, pas leur transcription intégrale.
- Donner aux fichiers et titres des noms explicites (sujet, projet ou numéro de dossier). Chaque lien précise ce qu'on y trouvera.
  Une annexe propre au projet peut rester dans `projects/<project-slug>/`, liée depuis la fiche existante ; une leçon réutilisable
  va dans `lessons/`, une décision dans `decisions/`. L'index du domaine pointe vers les entrées utiles, pas vers chaque annexe.
- Privé et professionnel séparés : la vie privée (santé, véhicules, démarches personnelles) va dans un domaine `perso`,
  les dossiers et l'administration d'une société dans son propre domaine, le savoir-faire technique dans le domaine du métier
  (`dev`, `web`...). Les documents originaux sensibles (médicaux, identité, finances) ne sont jamais copiés dans EZBrain :
  ils restent dans leur dossier source, la note renvoie à leur chemin.

## Structure

```
INDEX.md                 liste des domaines, à lire en premier
domains/<domaine>/       un dossier par sphère ou métier : dev, web, sysadmin, ai-tooling, perso...
  INDEX.md               (rester large, pas un domaine par projet)
  projects/ decisions/ stack/ patterns/ lessons/
general/                 ce qui sert à plusieurs domaines (mêmes sous-dossiers)
me/                      profil et préférences de l'utilisateur
inbox/                   à classer
```

## Lire

Seulement pour une tâche non triviale :
1. `INDEX.md` → choisir le domaine.
2. `domains/<domaine>/INDEX.md` → section Essentiel, puis la fiche du projet ou la note directement utile.
3. Suivre seulement les liens nécessaires à la question, généralement 1 à 3 notes au total ; ne pas charger toutes les annexes.
   S'arrêter dès que le contexte suffit. Si besoin : `rg -i -l "<mot>" domains/<domaine> general`.

Ne pas lire les autres domaines ni tout le dossier. Le code actuel et l'utilisateur priment sur une note.

## Écrire

Seulement ce qui est **durable et réutilisable** : une préférence de l'utilisateur, une décision argumentée, un piège ou une
recette sur une techno, une façon de faire, un bug non évident résolu, l'état d'un projet.
En général 0 à 2 écritures par session, à la fin d'une étape importante.

### Bilan avant de conclure

Avant la réponse finale qui clôt une étape non triviale, vérifier systématiquement ce qui a été appris :
consignes et corrections de l'utilisateur, préférences durables, décisions, état du projet, méthodes ou pièges réutilisables.
« Écrire rarement » limite les écritures, pas ce bilan. Ne pas attendre que l'utilisateur demande de mémoriser.
Si un élément mérite d'être conservé dans le périmètre autorisé, mettre la note à jour avant de conclure,
puis vérifier l'écriture et le commit local. Sinon, ne pas créer une note pour remplir un quota.
Ne pas généraliser une instruction ponctuelle ni présenter une déduction comme une confirmation de l'utilisateur.

Jamais : journal de tâche, évidences, infos éphémères, secrets ou données personnelles de tiers.

Étapes :
1. Identifier la note de référence. Actualiser l'état connu plutôt qu'empiler des ajouts datés ; garder la date et la provenance
   des faits importants, distinguer confirmé et incertain. Mettre à jour les résumés concernés si l'information change.
   Remplacer l'état périmé (version, statut, date) au lieu d'ajouter un paragraphe par séance. Ne pas recopier ce que git,
   GitHub ou le dossier source conservent déjà (hashes, numéros de version intermédiaires, nombre de tests à chaque étape).
2. Si aucune note ne convient, créer `domains/<domaine>/<type>/<nom-en-kebab-case>.md` (décisions et leçons préfixées par la date),
   ou `general/...` si utile à plusieurs domaines. Créer le domaine s'il manque (dossier + INDEX.md + ligne dans INDEX.md racine).
3. Relier la note depuis son entrée de lecture : fiche projet pour une annexe, index du domaine pour un sujet autonome
   (et dans Essentiel si c'est une règle critique, 7 lignes max). Aucun détail utile ne doit devenir introuvable après séparation.
4. Vérifier le diff, sélectionner uniquement les fichiers de cette tâche avec `git add -- <files>`, puis commit local
   dans EZBrain : `git commit --only -m "<agent>: <résumé>" -- <files>`. Ne pas embarquer le travail d'un autre agent
   (voir « Travail en parallèle »).
   Jamais de push manuel. Si le hook `post-commit` est installé, il pousse seul vers le serveur (remote `hub`).
   **Le contenu d'EZBrain ne va pas sur un service public** (GitHub...) : le hook `pre-push` le bloque.
5. Après une étape non triviale, une ligne en fin de réponse donnant le résultat réel :
   `EZBrain : <fichier(s)>`, `EZBrain : rien de nouveau à conserver` ou
   `EZBrain : mise à jour impossible (<cause>)`. Ne jamais annoncer une écriture ou un commit non vérifié.

## Travail en parallèle (Claude et Codex)

Les deux agents peuvent écrire en même temps dans le même dépôt. Un fichier n'a qu'un auteur à la fois.
- **Avant de modifier un fichier** : `git status --short -- <fichier>`. S'il est déjà modifié ou indexé sans que ce soit de ton fait,
  l'autre agent y travaille : ne pas y toucher. Écrire dans ton annexe, ou attendre et le signaler à l'utilisateur.
- **Sujet traité par les deux agents** : chacun écrit ses résultats dans son annexe `projects/<slug>/claude.md` ou
  `projects/<slug>/codex.md` (frontmatter `source:`), jamais dans celle de l'autre. La fiche projet ne garde que l'état consolidé
  et lie les deux annexes. Par défaut, les mises à jour vont dans l'annexe de l'agent. La consolidation de la fiche commune
  est une étape distincte, confiée à un seul agent à la fois, sur demande de l'utilisateur ou après coordination explicite.
- **Un état git propre n'est pas un verrou** : deux agents peuvent le constater simultanément. Ne pas lancer deux
  consolidations en parallèle. Relire la fiche juste avant l'écriture et vérifier qu'elle n'a pas changé depuis la lecture.
  Si elle a changé, reprendre depuis son état actuel sans écraser le travail reçu.
- **Consolidation** : ne présenter comme communs que les faits recoupés. Attribuer les conclusions propres à chaque agent
  et garder les désaccords et réserves visibles, avec un lien vers les annexes. Une synthèse ne transforme pas une hypothèse
  ou une pièce non consultée en fait établi.
- **Avant chaque commit** : `git diff -- <fichiers>` et `git diff --cached --stat`. `git commit --only <fichier>` enregistre tout
  le contenu actuel du fichier, y compris les modifications non commitées de l'autre agent. Si le diff contient autre chose
  que ton travail, ne pas committer et le signaler. Jamais `git add -A` ni `git commit -a`.
- Déplacer, fusionner ou réécrire le texte de l'autre agent seulement à la demande de l'utilisateur, en le conservant tel quel.

Format d'une note (court, factuel, termes techniques en anglais) :

```markdown
---
type: project | decision | stack | pattern | lesson | preference
domain: dev
tags: [ocr]
updated: 2026-01-01
status: active        # active | superseded | doubtful
---
# Titre qui dit l'essentiel

Contenu. Pour une décision : contexte, choix, pourquoi, alternatives écartées.
Pour une leçon : symptôme, cause, solution.

Liens : [Projet](../projects/x.md), [Techno](../stack/y.md)
```

Optionnel : `aliases: [synonymes]` si la note risque de ne pas être trouvée par ses mots-clés.

## Entretien

Au fil des reprises et mises à jour : corriger une note fausse (ou `status: superseded`), fusionner un doublon,
ranger l'inbox et séparer les contenus aux usages distincts. Conserver l'ancien chemin comme fiche d'entrée lorsque possible,
sinon corriger les liens entrants. Préserver les références et les nuances utiles ; conserver l'ancien état seulement s'il explique
une décision ou reste nécessaire au dossier. Pas de réorganisation générale périodique.
Outil facultatif : `python3 tools/ezbrain.py check | find | backlinks | tags`. La vue d'ensemble de la webapp signale aussi
liens cassés, frontmatter incomplet et notes orphelines.
