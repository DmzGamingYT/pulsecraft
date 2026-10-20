# Battement

**Suivi sportif et santé, local-first, avec un coach IA.**

Battement réunit dans une seule application ce qu'Apple Health et Samsung Health
font chacun de leur côté : anneaux d'objectifs, journal d'entraînement, sommeil,
composition corporelle, nutrition et un coach capable de commenter votre semaine.
La différence : **les données restent sur votre appareil**, le code est public et
il n'y a ni compte, ni abonnement, ni télémétrie.

- Frontend : React 18 + TypeScript + Vite
- Noyau de calcul : Rust compilé en WebAssembly (`crates/pulse-core`)
- Application de bureau : Tauri 2 (`src-tauri/`)
- Persistance : IndexedDB, aucune requête vers un serveur Battement

[**Essayer dans le navigateur →**](https://site-837caca50a67485a994f4549b9ef7404.freebuff.page/pulsecraft/)
(aucune installation, aucune donnée envoyée)

---

## Ce que fait l'application

| Écran | Contenu |
| --- | --- |
| **Aujourd'hui** | Anneaux (bouger, entraînement, hydratation), forme du jour, séance prévue par le plan (reprise d'une séance guidée incluse), pas, sommeil, poids, briefing du coach, séances du jour |
| **Plan** | Programme long terme : phases, semaines allégées, séances cochables et détaillées (mouvements, séries, repos), repères, régularité — et le programme du mois avec ses créneaux horaires |
| **Activité** | Journal d'entraînement, charge aiguë/chronique sur 14 jours, répartition par discipline, séance détaillée |
| **Sommeil** | Durée, stades, score, dette de sommeil, régularité du coucher, tendance |
| **Corps** | Poids, composition, IMC, VO₂ max estimé, tendances de fond |
| **Nutrition** | Repas, calories, macros, hydratation, objectifs quotidiens |
| **Coach IA** | Conversation contextuelle + plan de la semaine, avec repli local hors ligne |
| **Progrès** | Régularité sur 18 semaines, records personnels, tendances, export |
| **Réglages** | Profil, objectifs, thème, unités, imports, IA, sauvegarde |

### Formules (noyau Rust)

Tout le calcul « métier » vit dans `crates/pulse-core` et tourne en WASM, avec la
même implémentation testée côté Rust et utilisée côté interface :

- FC max estimée, zones cardiaques
- charge d'entraînement (durée × intensité × RPE), ratio aigu/chronique
- calories par MET, score et dette de sommeil, régularité du coucher
- score de forme (`readiness`), pente de tendance, moyenne glissante
- IMC, VO₂ max, allure, séries (streaks)

### Bilan de démarrage

Au premier lancement, un assistant en six étapes demande le profil, l'objectif
principal (endurance, force, perte de poids, santé, performance), la fréquence
réellement tenable (2 à 6 séances de 20 à 120 min), le matériel et le sommeil.
Il en sort un **plan de 4 à 24 semaines** :

- trois phases (socle, développement, spécifique) ;
- une semaine allégée toutes les quatre semaines ;
- volume hebdomadaire qui monte d'au plus ~15 % sur un bloc ;
- des repères mesurables à ~25 %, 50 % et 100 % du plan ;
- des séances cochables qui s'ajoutent au journal (et se retirent si on décoche) ;
- des séances de renforcement détaillées, adaptées au matériel déclaré : au poids
  du corps (dips sur banc, entre deux chaises ou aux barres, pompes, rowing sous
  table), à la maison (haltères, élastiques) ou en salle. Le niveau choisit la
  variante, la semaine ajuste les séries, et la semaine allégée en retire une.

Un plan démarré en semaine place une première séance **le jour même**, sans
attendre le lundi suivant, puis reprend le rythme hebdomadaire.

### Programme du mois

Quand aucun plan n'existe encore, Battement installe tout seul un **programme du
mois** de quatre semaines, pensé pour une semaine d'atelier informatique de
14 h à 18 h suivie d'études, avec **poids du corps et haltères légers** :

| Jour | Créneau | Séance |
| --- | --- | --- |
| lundi | 7 h 30, avant l'atelier | Haut du corps · poussée & tirage |
| mercredi | 7 h 30, avant l'atelier | Bas du corps · squat & fentes |
| vendredi | 19 h, après l'atelier | Haut du corps · épaules & bras |
| dimanche | 10 h | Corps complet & gainage |

Aucune séance ne tombe entre 14 h et 18 h. Chaque bloc tient en 40 min, avec
5 min d'échauffement ; les séries montent en semaine 2 et 3, la semaine 4 est
allégée. Comme les haltères sont légers, la progression passe par les
répétitions, le tempo lent, les variantes unilatérales et les séries proches de
l'échec technique — jamais un poids inventé.

À la fin du bloc, la fiche du mois propose d'**enchaîner le mois suivant** : même
rythme, variantes plus difficiles, nouveau bloc de quatre semaines. Le journal et
les séances cochées restent en place. Le bilan complet ou **Ajuster** remplace ce
programme par un plan calculé sur les réponses — la fiche le signale avant
d'appliquer.

Le plan s'ajuste ensuite depuis **Plan → Ajuster** (objectif, matériel, niveau,
séances par semaine, durée de base) sans refaire tout le bilan. Le calendrier et
les séances déjà cochées sont conservés : seules les séances à venir sont
recalculées, et le journal n'est jamais modifié. Le bilan complet reste
accessible depuis cette fiche ou depuis les réglages.

### Séance guidée

Depuis la fiche d'une séance, **Démarrer la séance** ouvre un mode guidé :

- les séries se cochent une à une, avec un repos décompté automatiquement
  (bouton +15 s, bouton Passer) ;
- le chrono, la progression et l'exercice en cours restent visibles ;
- **Mettre en pause** ferme l'écran sans perdre la séance : un bandeau
  « Séance en cours » sur Aujourd'hui et un bouton Reprendre dans le plan
  permettent de continuer, même après un rechargement de l'application ;
- **Terminer la séance** ajoute la séance au journal avec la durée réelle, et
  pas seulement la durée prévue.

Une seule séance guidée peut être en cours à la fois ; démarrer une autre séance
propose d'abord de reprendre celle qui est ouverte.

Le plan est **calculé localement**, jamais généré par le modèle : une séance
inventée ne peut donc pas se retrouver dans votre programme. L'IA ne rédige que
le commentaire, à partir de choix fermés — le champ « contrainte ou douleur »
reste sur l'appareil et n'entre dans aucun prompt.

### Imports

- **Apple Health** : `export.xml` (ou l'archive `.zip`)
- **Samsung Health** : export CSV (pas, sommeil, poids, exercices)
- **GPX / TCX** : sorties GPS et séances
- **Sauvegarde Battement** : le JSON produit par « Exporter tout », relu après
  confirmation — le journal est remplacé, le plan d'entraînement et les réglages
  restent en place.

Les fichiers sont lus dans le navigateur ; rien n'est téléversé.

### Coach IA

Le coach reçoit **uniquement des agrégats** (volumes, durées, FC, poids,
objectifs sur 7 et 28 jours, résumé du plan) — jamais de nom, de note de séance,
de repas ni de donnée brute. Trois fournisseurs au choix, dans les réglages ou
pendant le bilan :

| Mode | Ce qu'il faut | Remarque |
| --- | --- | --- |
| **Gratuit** (Pollinations) | rien | palier gratuit, débit limité ; relais local `/pc/api/ai` en développement |
| **Ma clé** | une clé d'API compatible OpenAI | OpenAI, OpenRouter, Groq, Mistral, Together… ; URL de base et modèle libres |
| **Local** | Ollama, LM Studio ou llama.cpp | rien ne quitte la machine |

Un bouton « Tester » vérifie la connexion en n'envoyant qu'un « ok ». La clé est
stockée dans IndexedDB, sur l'appareil, et n'est jointe qu'à la requête du
fournisseur choisi. Si l'IA échoue ou est coupée, un raisonnement local
déterministe répond quand même, et le plan reste valable.

Aucun contenu du coach n'est un avis médical.

---

## Démarrer

Prérequis : Node 20.19+ ou 22.12+, npm. Rust et `wasm-pack` ne sont nécessaires
que pour modifier le noyau ; le module WASM est déjà présent dans
`src/wasm/pulse-core` et le build fonctionne sans toolchain Rust.

```bash
npm install
npm run dev        # http://127.0.0.1:5186
```

Autres commandes :

```bash
npm run typecheck  # TypeScript strict
npm test           # Vitest (formules, analytics, imports, coach)
npm run build      # build statique portatif (base: './')
npm run check      # typecheck + tests + build

npm run wasm:build # reconstruit le noyau Rust → src/wasm/pulse-core
npm run wasm:test  # cargo test du noyau

npm run tauri:dev  # application de bureau
npm run tauri:build
```

> Le port 5186 est réservé à Battement (5183 = Séquence, 5184 = Portée,
> 5185 = la vitrine Craftline) pour que tout l'écosystème tourne en même temps.

---

## Structure

```
crates/pulse-core/     noyau Rust (formules pures + tests) → WASM
src/
  components/          anneaux, graphiques, formulaires, mise en page
  pages/               Aujourd'hui, Activité, Sommeil, Corps, Nutrition, Coach, Progrès, Réglages
  lib/
    analytics.ts       agrégats, séries, forme du jour
    ai.ts              coach IA + repli local
    llm.ts             fournisseurs : gratuit, clé compatible OpenAI, local
    plan.ts            moteur de plan long terme (phases, séances, repères)
    imports/           Apple Health, Samsung Health, GPX/TCX
    export.ts          export JSON / CSV
    idbStorage.ts      persistance IndexedDB
  components/
    Onboarding.tsx     bilan de démarrage en six étapes
    PlanAdjust.tsx     ajustement du plan sans refaire le bilan
    SessionSheet.tsx   fiche de séance (mouvements, séries, repos)
    SessionRun.tsx     séance guidée (séries, repos, reprise)
    AppIcon.tsx        icône 3D en verre liquide (SVG animé)
  pages/Plan.tsx       programme long terme
  store.ts             état applicatif (zustand)
src-tauri/             coque Tauri 2 (fenêtre, icônes, CSP)
server/aiProxy.ts      relais de développement pour le coach
```

## Vie privée

- Aucune inscription, aucun identifiant envoyé.
- Données stockées dans IndexedDB, effaçables depuis les réglages.
- Export complet en JSON/CSV pour repartir avec vos données.
- L'IA est optionnelle, se désactive, et ne reçoit que des agrégats.
- La clé d'API éventuelle reste locale et n'apparaît jamais dans un export.

## Licence

MIT — voir [LICENSE](LICENSE).

Les noms Apple Health et Samsung Health appartiennent à leurs éditeurs
respectifs ; Battement n'est affilié ni à Apple ni à Samsung. Inspiration
d'interface uniquement.
