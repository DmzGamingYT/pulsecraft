# PulseCraft

**Suivi sportif et santé, local-first, avec un coach IA.**

PulseCraft réunit dans une seule application ce qu'Apple Health et Samsung Health
font chacun de leur côté : anneaux d'objectifs, journal d'entraînement, sommeil,
composition corporelle, nutrition et un coach capable de commenter votre semaine.
La différence : **les données restent sur votre appareil**, le code est public et
il n'y a ni compte, ni abonnement, ni télémétrie.

- Frontend : React 18 + TypeScript + Vite
- Noyau de calcul : Rust compilé en WebAssembly (`crates/pulse-core`)
- Application de bureau : Tauri 2 (`src-tauri/`)
- Persistance : IndexedDB, aucune requête vers un serveur PulseCraft

[**Essayer dans le navigateur →**](https://site-837caca50a67485a994f4549b9ef7404.freebuff.page/pulsecraft/)
(aucune installation, aucune donnée envoyée)

---

## Ce que fait l'application

| Écran | Contenu |
| --- | --- |
| **Aujourd'hui** | Anneaux (bouger, entraînement, hydratation), forme du jour, séance prévue par le plan, pas, sommeil, poids, briefing du coach, séances du jour |
| **Plan** | Programme long terme : phases, semaines allégées, séances cochables, repères, régularité |
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
- des séances cochables qui s'ajoutent au journal (et se retirent si on décoche).

Le plan est **calculé localement**, jamais généré par le modèle : une séance
inventée ne peut donc pas se retrouver dans votre programme. L'IA ne rédige que
le commentaire, à partir de choix fermés — le champ « contrainte ou douleur »
reste sur l'appareil et n'entre dans aucun prompt.

### Imports

- **Apple Health** : `export.xml` (ou l'archive `.zip`)
- **Samsung Health** : export CSV (pas, sommeil, poids, exercices)
- **GPX / TCX** : sorties GPS et séances

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

> Le port 5186 est réservé à PulseCraft (5183 = TubeCraft, 5184 = SpotifyCraft,
> 5185 = la vitrine « L'Atelier ») pour que tout l'écosystème tourne en même temps.

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
respectifs ; PulseCraft n'est affilié ni à Apple ni à Samsung. Inspiration
d'interface uniquement.
