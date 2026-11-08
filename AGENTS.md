# AGENTS.md — Instructions pour les agents travaillant sur ce dépôt

## Qu'est-ce que ce projet

Application web **100 % statique** (un seul `index.html`, aucune dépendance de build,
aucun framework) qui visualise le flux de l'argent dans l'économie circulaire de l'IA
(Nvidia, OpenAI, clouds, banques). Déployée sur GitHub Pages.

## Architecture

- Tout le code applicatif vit dans `index.html` : styles dans le `<style>`,
  données du graphe et logique dans le `<script>` unique.
- Les données sont dans les constantes `NODES` (acteurs), `EDGES` (flux),
  `FLOW_TYPES` (natures de flux financiers), `SCENARIOS` (vues filtrées),
  `SOURCES` (qualifications documenté / rapporté / fictif).
- **Aucune position manuelle** : le layout est calculé par Dagre (vendu dans
  `vendor/dagre.min.js`). Desktop = layout hiérarchique gauche→droite calculé
  depuis les flux réels ; mobile = colonne guidée par `MOBILE_ORDER` (ordre
  sémantique de lecture, pas des coordonnées).
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
- Aucune dépendance runtime externe (CDN interdit) ; les bibliothèques runtime
  doivent être **vendues** dans `vendor/` et chargées par `<script src>`.
  Seules les devDependencies du harnais de tests sont autorisées dans
  `package.json`.

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

## CI / CD

- `checks.yml` : harnais de vérifications (Node 22, requis par jsdom/undici).
- `pages.yml` : déploiement GitHub Pages, se déclenche sur push sur `main`.
- Les deux workflows doivent rester verts sur `main`.
