# Battement

**Un journal sportif local-first.** Séances, pas, sommeil, distances, calories
et fréquence cardiaque — importés depuis **Apple Santé**, **Samsung Health** ou
vos fichiers **GPX / TCX / FIT**, et gardés dans le navigateur. Aucun compte,
aucun serveur, aucune télémétrie.

Battement est la deuxième app de l'atelier [Craftline](../CraftlineSite) ; elle
est servie sur `/pulsecraft/` à côté de Feuillet.

## Ce qu'elle fait

- **Aujourd'hui** — objectif hebdomadaire, anneau de minutes actives, pas du
  jour, score d'énergie (sommeil, FC de repos, charge), séances récentes,
  édition de la journée et série de semaines dans l'objectif.
- **Activité** — toutes les séances, filtres par discipline et par période, tri,
  recherche, fiche détaillée (allure ou vitesse, FC, ressenti, notes, tracé SVG),
  sélection multiple, fusion de doublons et suppression avec annulation.
- **Importer** — glisser-déposer un `export.zip` Apple Santé, les CSV Samsung
  Health, ou une trace GPX / TCX / FIT. Tout est lu dans un Web Worker, avec
  progression et bouton Annuler : le fichier ne quitte pas l'onglet.
- **Programme** — un coach calculé sur l'appareil : il lit les quatre dernières
  semaines (fréquence, disciplines, jours actifs, durée moyenne, charge récente
  face à la base 28 jours), pose un plan de quatre semaines, puis le réajuste
  après un point de suivi hebdomadaire. Aucun appel réseau, aucune clé.
- **Progrès** — huit semaines de régularité, écarts face à la semaine
  précédente, records par discipline (le 10 km le plus rapide, le plus long
  vélo), temps par zone cardiaque, récap mensuel, provenance des données, et un
  tableau derrière chaque graphique.
- **Réglages** — objectifs de minutes, de séances, de distance et par
  discipline, FC max de référence, thème clair/sombre, quota de stockage,
  sauvegarde et restauration JSON, démonstration, effacement local.
- **Hors ligne** — un service worker garde la coquille de l'application : elle
  se rouvre sans réseau, et les polices sont auto-hébergées.
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

### Traces : GPX, TCX et FIT

Aucun compte n'est nécessaire : un fichier déposé suffit. GPX et TCX sont lus
comme du texte, FIT comme du binaire (en-tête, définitions de messages, puis
valeurs) sans bibliothèque externe.

- distance calculée par haversine quand le fichier ne la donne pas ;
- dénivelé positif cumulé à partir des altitudes ;
- FC moyenne et maximale, durée réelle, calories ;
- tracé réduit à 120 points et stocké en texte, dessiné en SVG local — pas de
  tuiles de carte, donc aucune fuite de position vers un serveur.

Les trois formats passent par le même `externalId` stable, et le ZIP d'Apple ou
de Samsung peut les contenir : les traces y sont reconnues aussi.

## Local-first

- Le journal vit dans **IndexedDB** (`battement.v1`), via Zustand et un
  adaptateur qui retombe sur `localStorage` puis sur la mémoire si nécessaire.
- `navigator.storage.persist()` est demandé au premier chargement, et le bloc
  Données des réglages affiche l'espace utilisé et le quota accordé.
- La sauvegarde JSON est réimportable : elle remplace le journal, réglages et
  programme compris, après confirmation.
- Un service worker garde la coquille (HTML, JS, CSS, polices) pour rouvrir
  l'application sans réseau. Aucune donnée du journal n'y transite.
- Aucun appel réseau pour les imports, l'affichage ou les réglages.
- Vider les données du site efface le journal.

## Limites connues

- Le sommeil est agrégé en minutes par nuit ; les stades (profond, paradoxal)
  ne sont pas conservés.
- Apple Santé peut contenir plusieurs sources pour les mêmes pas ; Battement
  garde le maximum par jour, ce qui peut sous-estimer une journée réellement
  partagée entre deux appareils.
- Un très gros `export.xml` (plusieurs centaines de Mo) est lu d'un bloc en
  mémoire après décompression, même dans le worker. Sur un appareil très
  contraint, préférer extraire `export.xml` et l'importer seul.
- Le FIT est lu sans vérifier la CRC : un fichier tronqué est signalé, pas
  réparé.
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

61 tests couvrent les parseurs Apple, Samsung et FIT, le lecteur ZIP, la
détection de source, la fusion, les statistiques hebdomadaires, les records, le
coach (plan et point de suivi) et l'entrée en mode démo. Les fixtures XML, CSV et
FIT sont écrites dans les tests — le FIT est assemblé octet par octet — et
l'archive ZIP est un base64 généré avec Python, pour ne pas versionner de
binaire.

## Structure

```
src/
├── App.tsx                 navigation, thème, modales, entrée démo
├── store.ts                journal local (Zustand + persist)
├── views.ts                les cinq écrans
├── components/             icônes, graphiques, lignes de séance, formulaires
├── screens/                Today, Activity, Import, Progress, Settings
├── lib/
│   ├── analytics.ts        semaines, records, répartition
│   ├── dates.ts            dates locales, formats français
│   ├── demo.ts             journal d'exemple de six semaines
│   ├── storage.ts          persistance, quota
│   ├── backup.ts           sauvegarde JSON relisible
│   ├── ics.ts              export .ics du programme
│   ├── route.ts            tracés normalisés et SVG
│   └── import/
│       ├── zip.ts          lecteur ZIP minimal (deflate)
│       ├── apple.ts        export.xml d'Apple Santé
│       ├── samsung.ts      CSV de Samsung Health
│       ├── track.ts        GPX et TCX
│       ├── fit.ts          FIT binaire
│       ├── worker.ts       import hors du fil principal
│       ├── workerClient.ts appel du worker, repli synchrone
│       └── index.ts        détection, lecture, fusion
└── styles.css              feuille unique, papier chaud + accent terracotta
```

## Licence

MIT. Les formats d'export appartiennent à Apple et Samsung ; Battement n'est
affilié ni à l'un ni à l'autre.

- [Apple Santé — exporter ses données](https://support.apple.com/fr-fr/guide/iphone/iph2f9e1f0/ios)
- [Samsung Health](https://www.samsung.com/be_fr/apps/samsung-health/)
