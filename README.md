# Battement

**Un journal sportif local-first.** Séances, pas, distances, calories et
fréquence cardiaque — importés depuis **Apple Santé** ou **Samsung Health**, et
gardés dans le navigateur. Aucun compte, aucun serveur, aucune télémétrie.

Battement est la deuxième app de l'atelier [Craftline](../CraftlineSite) ; elle
est servie sur `/pulsecraft/` à côté de Feuillet.

## Ce qu'elle fait

- **Aujourd'hui** — objectif hebdomadaire, anneau de minutes actives, pas du
  jour, séances récentes et série en cours.
- **Activité** — toutes les séances, filtres par discipline, recherche, groupes
  par mois, suppression d'une ligne.
- **Importer** — glisser-déposer un `export.zip` Apple Santé ou les CSV Samsung
  Health. Le fichier est lu dans l'onglet, sans requête réseau.
- **Programme** — un coach calculé sur l'appareil : il lit les quatre dernières
  semaines (fréquence, disciplines, jours actifs, durée moyenne, charge récente
  face à la base 28 jours), pose un plan de quatre semaines, puis le réajuste
  après un point de suivi hebdomadaire. Aucun appel réseau, aucune clé.
- **Progrès** — huit semaines de régularité, répartition par sport, records,
  provenance des données.
- **Réglages** — objectifs de minutes et de pas, thème clair/sombre, export JSON,
  démonstration, effacement local.
- **Démo** — `?demo=1` ouvre un journal d'exemple de six semaines. Le drapeau ne
  remplace jamais un journal déjà rempli, et n'affiche aucune visite guidée.

## Le coach, et ce qu'il emprunte

Rien n'est envoyé nulle part : le plan se calcule dans l'onglet, à partir du
journal déjà présent. Trois idées viennent de ce que font les montres :

| Battement | D'où ça vient |
| --- | --- |
| Charge : 7 derniers jours contre la moyenne des 28 jours | la charge d'entraînement d'Apple Santé |
| Énergie du jour : repos, charge récente, pas | le score d'énergie de Samsung Health |
| Plan de 4 semaines + point de suivi | les programmes de sommeil de Samsung |

Le point de suivi n'est pas décoratif : selon le ressenti et la fatigue, les
séances à venir perdent 15 % de volume, en gagnent 8 %, ou gardent le cap. Deux
garde-fous l'empêchent de déformer le plan : le volume cumulé reste entre −25 %
et +15 % de la version d'origine — une bonne semaine peut donc rendre ce qu'un
point difficile avait retiré — et un point saisi en retard ne réécrit jamais une
séance déjà passée. Une séance déjà présente au journal compte comme faite sans
être recochée.

## Les imports, pour de vrai

Les deux formats sont lus sans dépendance et sans passer par un serveur.

### Apple Santé

L'utilisateur exporte **Santé → profil → Exporter toutes les données de santé**,
puis dépose `export.zip`. Battement :

- lit le répertoire central du ZIP et décompresse avec `DecompressionStream` ;
- parcourt `export.xml` en streaming tolérant, sans construire un DOM complet ;
- convertit `HKWorkoutActivityType*` en disciplines, avec les unités réelles
  (`min`/`h`, `km`/`m`/`mi`, `kcal`/`kJ`) ;
- lit `WorkoutStatistics` pour la distance et la fréquence cardiaque ;
- agrège les pas et l'énergie active par jour, puis **garde le maximum par
  appareil** : l'iPhone et la Watch ne doublent pas la journée.

### Samsung Health

L'utilisateur télécharge ses données personnelles depuis Samsung Health, puis
dépose le ZIP ou seulement :

- `com.samsung.health.exercise.*.csv`
- `com.samsung.health.step_count.*.csv`

Les en-têtes sont normalisés (`com.samsung.health.exercise.start_time` →
`start_time`) et lus par nom, pas par position. Sont reconnus :

| Colonne | Usage |
| --- | --- |
| `start_time` / `create_time` / `day_time` | date, ISO ou epoch (s/ms) |
| `exercise_type` | code Samsung → discipline |
| `duration` | millisecondes → minutes |
| `distance` | mètres → kilomètres |
| `total_calorie` | kcal |
| `mean_heart_rate` / `max_heart_rate` | bpm |
| `datauuid` / `uuid` | identifiant stable pour la déduplication |

Les codes d'exercice connus (course `1002`, marche `1001`, vélo `11007`,
natation `14001`, randonnée `13001`, musculation `10004`–`10027`, yoga `9001`…)
sont regroupés en disciplines. Un code inconnu reste « Autre », avec le libellé
de l'export quand il existe, et l'interface le signale.

Réimporter le même fichier ne crée pas de doublon : chaque séance porte un
`externalId` stable, et les journées de pas fusionnent en gardant le maximum.

## Local-first

- Le journal vit dans `localStorage` (`battement.v1`), via Zustand.
- Aucun appel réseau pour les imports, l'affichage ou les réglages.
- L'export JSON est un simple téléchargement ; il n'est pas encore réimportable.
- Vider les données du site efface le journal.

## Limites connues

- Le sommeil, la fréquence cardiaque au repos et les exercices en intérieur sans
  distance ne sont pas encore importés.
- Apple Santé peut contenir plusieurs sources pour les mêmes pas ; Battement
  garde le maximum par jour, ce qui peut sous-estimer une journée réellement
  partagée entre deux appareils.
- Un très gros `export.xml` (plusieurs centaines de Mo) est lu d'un bloc en
  mémoire après décompression. Sur un appareil très contraint, préférer extraire
  `export.xml` et l'importer seul.
- Pas de synchronisation entre appareils, pas de compte, pas de backend.

## Développer

```bash
npm install
npm run dev        # http://127.0.0.1:5186
npm run typecheck
npm test
npm run build
npm run check      # typecheck + tests + build
```

Depuis la racine de l'atelier :

```bash
npm run dev:battement
npm run dev:all
npm run build:atelier   # paquet Sites : /, /feuillet/, /pulsecraft/
```

### Tests

57 tests couvrent les parseurs Apple et Samsung, le lecteur ZIP, la détection
de source, la fusion, les statistiques hebdomadaires, les records, le coach (plan
et point de suivi) et l'entrée en mode démo. Les fixtures XML/CSV sont écrites
dans les tests ; l'archive ZIP est un base64 généré avec Python, pour ne pas
versionner de binaire.

## Structure

```
src/
├── App.tsx                 navigation, thème, modales, entrée démo
├── store.ts                journal local (Zustand + persist)
├── views.ts                les quatre écrans
├── components/             icônes, graphiques, lignes de séance, formulaires
├── screens/                Today, Activity, Import, Progress, Settings
├── lib/
│   ├── analytics.ts        semaines, records, répartition
│   ├── dates.ts            dates locales, formats français
│   ├── demo.ts             journal d'exemple de six semaines
│   └── import/
│       ├── zip.ts          lecteur ZIP minimal (deflate)
│       ├── apple.ts        export.xml d'Apple Santé
│       ├── samsung.ts      CSV de Samsung Health
│       └── index.ts        détection, lecture, fusion
└── styles.css              feuille unique, papier chaud + accent terracotta
```

## Licence

MIT. Les formats d'export appartiennent à Apple et Samsung ; Battement n'est
affilié ni à l'un ni à l'autre.

- [Apple Santé — exporter ses données](https://support.apple.com/fr-fr/guide/iphone/iph2f9e1f0/ios)
- [Samsung Health](https://www.samsung.com/be_fr/apps/samsung-health/)
