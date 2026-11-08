# Show Me — Flux de l'argent dans l'économie circulaire de l'IA

Application web interactive qui visualise la circulation de l'argent dans le modèle
d'économie circulaire de l'IA générative, à partir de l'exemple documenté de
**Nvidia**, d'**OpenAI**, des clouds (**Microsoft Azure**, **CoreWeave**, **Oracle**)
et de **SoftBank**.

## Principe

L'argent tourne en boucle entre les acteurs :

- Nvidia investit dans OpenAI, qui s'engage à acheter des puces Nvidia.
- Microsoft investit dans OpenAI, qui dépense sur Azure, qui achète des GPU Nvidia.
- Les banques prêtent aux datacenters qui achètent les puces, et Nvidia place sa
  trésorerie auprès des marchés financiers.

Les entités bancaires et financières dont les données ne sont pas publiques sont
représentées par des **entreprises fictives clairement étiquetées**
(Aurora Capital, Meridian Trust, Gulf Horizon Fund) qui jouent le rôle tel qu'il
est compris : prêts projet, structuration des tours de table, capital patient.

Chaque flux est qualifié : **documenté** (annoncé publiquement), **rapporté**
(presse économique, non confirmé) ou **fictif** (illustratif).

## Utilisation

- Cliquez sur un acteur ou un flux pour voir le détail, le montant et la source.
- Les boutons de scénario isolent une boucle : Nvidia, cloud ou financement bancaire.
- Contrôles : lecture/pause, vitesse d'animation, affichage des montants.

## Déploiement (GitHub Pages)

Le workflow `.github/workflows/pages.yml` publie le site à chaque push sur `main`.

Pour activer Pages sur le dépôt : **Settings → Pages → Source : GitHub Actions**.

Le site est alors disponible sur `https://<user>.github.io/show-me/`.

## Licence

Fourni tel quel, à des fins pédagogiques et de visualisation.
