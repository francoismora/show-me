# AGENTS.md — Instructions pour les agents travaillant sur ce dépôt

## Qu'est-ce que ce projet

Application web qui visualise le flux de l'argent dans l'économie circulaire de
l'IA (Nvidia, OpenAI, clouds, banques). Sources en modules ES dans `src/`,
bundlées par esbuild vers `dist/`, publié sur GitHub Pages.

## Architecture

- `src/data.js` : les données du graphe (acteurs, flux, natures, scénarios).
- `src/main.js` : l'application (rendu D3, layout dagre, interactions, panneau).
- `src/styles.css` : les styles, bundlés en `dist/bundle.css`.
- `index.html` : gabarit HTML qui charge `bundle.js` + `bundle.css` ; copié dans
  `dist/` par le build.
- `npm run build` (esbuild) produit `dist/` ; `dist/` n'est jamais commité.
- Les données sont dans les constantes `NODES` (acteurs), `EDGES` (flux),
  `FLOW_TYPES` (natures de flux financiers), `SCENARIOS` (vues filtrées),
  `SOURCES` (qualifications documenté / rapporté / fictif).
- **Aucune position manuelle** : le layout est calculé par dagre (dépendance
  npm). Desktop = layout hiérarchique gauche→droite calculé depuis les flux
  réels ; mobile = colonne guidée par `MOBILE_ORDER` (ordre sémantique de
  lecture, pas des coordonnées).
- Le rendu utilise les modules D3 : `d3-selection` (data-joins),
  `d3-shape` (générateurs de liens `linkHorizontal`/`linkVertical`),
  `d3-zoom` (pan/zoom, `touch-action: pan-y` pour préserver le défilement
  mobile).
- Chaque flux possède : `id`, `type` (nature financière), `from`, `to`, `amount`,
  `source` (qualification), `label`, `scenario`, `desc`.
- Les entités bancaires/financières dont les données ne sont pas publiques sont
  **fictives** et toujours étiquetées comme telles (`fictif: true`, bordure
  pointillée rouge, flux en pointillés).

## Règles de contribution

- Interface en français.
- Les couleurs des flux codent la **nature financière** (participation, achat,
  crédit, garantie, commissions, revenus, valeur, réserves, dépôts), jamais le
  secteur d'origine de l'argent.
- Tout nouveau flux doit avoir une qualification `source` honnête :
  `documente` (annoncé publiquement), `rapporte` (presse, non confirmé) ou
  `fictif` (illustratif).
- Toutes les dépendances (runtime et dev) passent par **npm** (`package.json`,
  lockfile commité) ; aucun CDN, aucun fichier vendor. Le bundle est généré par
  esbuild : `npm run build` → `dist/`.

## Vérifications — règle fondamentale

**Toute vérification faite ponctuellement, mais qui a du sens d'être toujours
contrôlée, doit être ajoutée au harnais systématique du projet
(`scripts/check.js`, exécuté via `npm run check`).**

Concrètement :

- Si vous vérifiez à la main un aspect de l'application (cohérence des données,
  rendu d'un scénario, bascule mobile, absence d'erreur JS, structure du graphe…)
  et que cette vérification resterait vraie ou utile au déploiement suivant,
  **promouvez-la en check permanent** dans `scripts/check.js` plutôt que de la
  refaire ponctuellement.
- Le harnais teste le **build réellement publié** : il lance `npm run build`
  puis charge `dist/index.html`. Ne testez jamais uniquement les sources.
- Le harnais s'exécute automatiquement dans GitHub Actions
  (`.github/workflows/checks.yml`) **à chaque push sur `main` et sur chaque pull
  request**, c'est-à-dire à chaque publication de la page
  (`.github/workflows/pages.yml` déploie sur GitHub Pages sur ces mêmes pushes).
  Une vérification ajoutée au harnais est donc vérifiée **au moment même du
  déploiement** ; un check en échec doit bloquer et être corrigé avant de pousser.
- Avant tout commit : exécuter `npm install && npm run check` localement et
  ne pousser que si toutes les vérifications passent.
- Après l'ajout d'un check, vérifier que le workflow **Checks** passe sur `main`
  avant de considérer le travail comme terminé.

## Catalogue des vérifications et refactoring

Chaque check est déclaré avec son **tier** et son **intention** :

- `contrat` : invariant de données ou de lecture (schéma, encodages, promesse
  éditoriale). Ne doit **jamais** être retiré lors d'un refactoring ; s'il
  échoue, le refactor a introduit un bug.
- `comportement` : invariant de la page publiée (démarrage sans erreur,
  structure rendue = données, bascule mobile). Doit survivre aux refactors
  d'implémentation ; s'il échoue, décider explicitement.
- `rendu` : couplé à l'implémentation actuelle (ex. usage de D3). À
  **réévaluer à chaque refactoring** ; candidat légitime à suppression ou
  réécriture.

Le catalogue est toujours à jour car généré depuis le code :

```bash
npm run check:list
```

**Procédure décisionnelle quand un refactoring casse un check** (jamais
automatique — un check qui se régénère pour coller au code ne protège plus
rien) :

1. Lire l'intention du check dans le catalogue.
2. Si l'intention reste valide → le refactor a un bug : corriger le code.
3. Si l'intention n'a plus de sens → **supprimer** le check (ne jamais
  l'affaiblir pour le faire passer).
4. Si le contrat a changé → mettre à jour le check **et** son intention, et
  le dire dans le message de commit.
5. Tout nouveau check doit déclarer un tier et une intention ; le harnais
  rejette un catalogue incohérent.

Privilégier les invariants dérivés des données (ex. « particules = somme
des fréquences ») sur les valeurs pinnées (ex. dimensions exactes du
viewBox) : les invariants survivent aux refactors, les valeurs pinnées
génèrent des fausses alarmes.

## CI / CD

- `checks.yml` : harnais de vérifications (Node 22, requis par jsdom/undici) ;
  il build puis teste `dist/`.
- `pages.yml` : build puis déploiement de `dist/` sur GitHub Pages, se
  déclenche sur push sur `main`.
- Les deux workflows doivent rester verts sur `main`.
