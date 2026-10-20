/**
 * Plan d'entraînement long terme, calculé localement.
 *
 * Le même moteur sert de base quand l'IA est disponible : elle ne fabrique pas
 * les séances (elle n'a pas à inventer des charges), elle commente et ajuste le
 * plan produit ici. Le résultat reste donc reproductible, testable et lisible
 * même hors ligne, sans clé et sans réseau.
 *
 * Principes :
 *  - progression par blocs de 4 semaines, la 4e allégée (deload) ;
 *  - volume hebdomadaire qui monte d'au plus ~15 % sur un bloc ;
 *  - 2 à 6 séances, réparties pour laisser au moins un jour entre deux séances
 *    d'intensité ;
 *  - aucun champ libre de l'utilisateur n'entre dans le plan : seulement des
 *    choix fermés (objectif, niveau, fréquence, durée, matériel, sommeil).
 */

import type {
  Equipment,
  Experience,
  GoalKind,
  ISODate,
  PlanExercise,
  PlanIntake,
  PlanMilestone,
  PlanPhase,
  PlanSession,
  PlanType,
  PlanWeek,
  TrainingPlan,
} from '../types';
import { addDays, startOfWeek, todayISO } from './dates';

export interface GoalMeta {
  label: string;
  tagline: string;
  detail: string;
  accent: string;
}

export const GOALS: Record<GoalKind, GoalMeta> = {
  endurance: {
    label: 'Endurance',
    tagline: 'Courir, rouler, tenir plus longtemps',
    detail: 'Un socle aérobie solide, une sortie longue, un peu de renforcement.',
    accent: 'var(--coral)',
  },
  force: {
    label: 'Force & muscle',
    tagline: 'Dips, pompes, tractions : progresser au poids du corps',
    detail: 'Deux à quatre séances de renforcement détaillées, du cardio d’entretien.',
    accent: 'var(--amber)',
  },
  perte: {
    label: 'Perte de poids',
    tagline: 'Dépenser sans se blesser',
    detail: 'Cardio régulier, renforcement, marche : la régularité avant l’intensité.',
    accent: 'var(--brand)',
  },
  sante: {
    label: 'Santé & mobilité',
    tagline: 'Bouger chaque jour, sans douleur',
    detail: 'Marche, mobilité, gainage et sommeil : un plan doux et tenable.',
    accent: 'var(--cyan)',
  },
  performance: {
    label: 'Performance',
    tagline: 'Préparer une date, un chrono',
    detail: 'Fractionné, tempo, sortie longue et renforcement spécifique.',
    accent: 'var(--violet)',
  },
};

export const EXPERIENCE_LABELS: Record<Experience, string> = {
  debutant: 'Je débute',
  intermediaire: 'Je pratique déjà',
  avance: 'Je m’entraîne régulièrement',
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  aucun: 'Poids du corps',
  maison: 'Maison · élastiques & haltères',
  salle: 'Salle de sport',
};

/** Jours de la semaine (0 = lundi) : on écarte les enchaînements de qualité. */
const DAY_SLOTS: Record<number, number[]> = {
  2: [1, 5],
  3: [0, 2, 5],
  4: [0, 1, 3, 5],
  5: [0, 1, 3, 4, 6],
  6: [0, 1, 2, 3, 5, 6],
};

const DEFAULT_SLOTS = [1, 3, 5, 6];

type Slot = 'quality' | 'long' | 'easy' | 'strength' | 'mobility' | 'recovery';

interface Blueprint {
  slot: Slot;
  type: PlanType;
  title: string;
  detail: string;
  intensity: PlanSession['intensity'];
  extraMin?: number;
}

const BLUEPRINTS: Record<GoalKind, Blueprint[]> = {
  endurance: [
    {
      slot: 'quality',
      type: 'Course',
      title: 'Fractionné court',
      detail: '10 min d’échauffement, 6 × 1 min rapide / 1 min lent, 5 min de retour au calme.',
      intensity: 'soutenue',
    },
    {
      slot: 'long',
      type: 'Course',
      title: 'Sortie longue',
      detail: 'Allure conversationnelle, respiration régulière. Marchez 1 min si la FC dérive.',
      intensity: 'modérée',
      extraMin: 20,
    },
    {
      slot: 'easy',
      type: 'Vélo',
      title: 'Endurance douce',
      detail: 'Zone 2, cadence souple, sans chercher la vitesse.',
      intensity: 'faible',
    },
    {
      slot: 'strength',
      type: 'Musculation',
      title: 'Renforcement coureur',
      detail: '5 min d’échauffement, puis les mouvements ci-dessous. Charge modérée, technique propre.',
      intensity: 'modérée',
    },
    {
      slot: 'mobility',
      type: 'Mobilité',
      title: 'Mobilité & hanches',
      detail: '10 min de mobilité hanches, chevilles et dos, puis 10 min de respiration.',
      intensity: 'faible',
    },
  ],
  force: [
    {
      slot: 'strength',
      type: 'Musculation',
      title: 'Haut du corps · dips',
      detail: 'Échauffement 5 min (épaules, pompes faciles), puis dips et le reste. Repos 90 s sur les dips.',
      intensity: 'modérée',
    },
    {
      slot: 'strength',
      type: 'Musculation',
      title: 'Bas du corps',
      detail: 'Échauffement 5 min, puis les mouvements ci-dessous. Repos 60 à 90 s entre les séries.',
      intensity: 'soutenue',
    },
    {
      slot: 'strength',
      type: 'Musculation',
      title: 'Corps complet · dips',
      detail: 'Un circuit complet, dips compris. Repos 60 à 90 s entre les séries.',
      intensity: 'modérée',
    },
    {
      slot: 'easy',
      type: 'Marche',
      title: 'Cardio d’entretien',
      detail: 'Marche rapide ou vélo souple, souffle court mais conversation possible.',
      intensity: 'faible',
    },
    {
      slot: 'mobility',
      type: 'Mobilité',
      title: 'Mobilité & récupération',
      detail: 'Épaules, hanches, dos. Étirements doux, jamais jusqu’à la douleur.',
      intensity: 'faible',
    },
  ],
  perte: [
    {
      slot: 'quality',
      type: 'HIIT',
      title: 'Intervalles courts',
      detail: '8 × 40 s d’effort / 80 s de récupération, puis 5 min de retour au calme.',
      intensity: 'soutenue',
    },
    {
      slot: 'strength',
      type: 'Musculation',
      title: 'Renforcement complet',
      detail: 'Un tour complet des mouvements ci-dessous, sans chrono. Repos 45 à 75 s.',
      intensity: 'modérée',
    },
    {
      slot: 'long',
      type: 'Marche',
      title: 'Marche longue',
      detail: 'Rythme soutenu, sans essoufflement. Le volume le plus rentable pour la dépense.',
      intensity: 'faible',
      extraMin: 15,
    },
    {
      slot: 'easy',
      type: 'Vélo',
      title: 'Cardio continu',
      detail: 'Zone 2, 60 à 70 % de la FC max. Facile, régulier, sans à-coups.',
      intensity: 'faible',
    },
    {
      slot: 'mobility',
      type: 'Yoga',
      title: 'Yoga & récupération',
      detail: 'Séquences douces, respiration lente, étirements du bas du corps.',
      intensity: 'faible',
    },
  ],
  sante: [
    {
      slot: 'easy',
      type: 'Marche',
      title: 'Marche active',
      detail: '30 min à bonne allure, bras relâchés, respiration ample.',
      intensity: 'faible',
      extraMin: 10,
    },
    {
      slot: 'strength',
      type: 'Musculation',
      title: 'Renforcement doux',
      detail: 'Deux séries calmes, amplitude confortable, jamais jusqu’à la douleur.',
      intensity: 'faible',
    },
    {
      slot: 'mobility',
      type: 'Yoga',
      title: 'Mobilité du dos',
      detail: 'Chat-vache, torsion allongée, étirement des ischio-jambiers. 20 min.',
      intensity: 'faible',
    },
    {
      slot: 'recovery',
      type: 'Marche',
      title: 'Récupération',
      detail: '20 min tranquille, idéalement dehors. Aucun objectif de vitesse.',
      intensity: 'faible',
    },
    {
      slot: 'easy',
      type: 'Natation',
      title: 'Natation ou vélo',
      detail: 'Portage du poids du corps, articulations préservées. 25 à 35 min.',
      intensity: 'faible',
    },
  ],
  performance: [
    {
      slot: 'quality',
      type: 'Course',
      title: 'Fractionné spécifique',
      detail: '12 min d’échauffement, 5 × 3 min à allure objectif / 90 s lent, 8 min de calme.',
      intensity: 'soutenue',
    },
    {
      slot: 'easy',
      type: 'Course',
      title: 'Endurance fondamentale',
      detail: '40 min en zone 2 stricte. La discipline du facile fait la performance du dur.',
      intensity: 'faible',
    },
    {
      slot: 'strength',
      type: 'Musculation',
      title: 'Renforcement spécifique',
      detail: 'Échauffement 5 min, puis les mouvements ci-dessous. 3 séries de 6 à 10.',
      intensity: 'modérée',
    },
    {
      slot: 'long',
      type: 'Course',
      title: 'Sortie longue',
      detail: '60 à 80 min, dernière partie à allure objectif si la forme le permet.',
      intensity: 'modérée',
      extraMin: 30,
    },
    {
      slot: 'mobility',
      type: 'Mobilité',
      title: 'Récupération active',
      detail: '20 min de mobilité + 10 min de marche. Aucune intensité.',
      intensity: 'faible',
    },
  ],
};

/* ------------------------------------------- mouvements de renforcement */

/**
 * Les séances de musculation ne sont pas les mêmes pour tout le monde : le
 * matériel choisi au bilan décide de la famille de mouvements, le niveau décide
 * de la variante. Les dips existent dans les trois familles — sur banc, entre
 * deux chaises, ou aux barres — pour que le poids du corps reste une vraie
 * progression et pas un plan au rabais.
 */
type MovementPattern =
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'push'
  | 'dip'
  | 'pull'
  | 'core'
  | 'calf'
  | 'shoulder';

interface MovementVariant {
  name: string;
  reps: string;
  note?: string;
}

const MOVEMENTS: Record<Equipment, Record<MovementPattern, MovementVariant[]>> = {
  aucun: {
    squat: [
      { name: 'Squat sur chaise', reps: '10–15', note: 'Effleurez l’assise, sans relâcher le gainage.' },
      { name: 'Squat au poids du corps', reps: '15–20', note: 'Cuisses au moins parallèles, talons au sol.' },
      { name: 'Squat sauté', reps: '8–12', note: 'Réception souple, genoux alignés avec les pieds.' },
    ],
    hinge: [
      { name: 'Pont fessier', reps: '15–20', note: 'Poussez dans les talons, serrez les fessiers en haut.' },
      { name: 'Pont fessier une jambe', reps: '10–12 / jambe', note: 'Bassin stable, ne cambrez pas le bas du dos.' },
      { name: 'Soulevé de terre une jambe', reps: '8–10 / jambe', note: 'Dos plat, hanche qui recule ; appuyez-vous au mur.' },
    ],
    lunge: [
      { name: 'Fente soutenue', reps: '8–10 / jambe', note: 'Une main sur une chaise pour l’équilibre.' },
      { name: 'Fente avant', reps: '10–12 / jambe', note: 'Le genou arrière frôle le sol, buste droit.' },
      { name: 'Fente bulgare sur chaise', reps: '8–12 / jambe', note: 'Pied arrière sur la chaise, appui avant stable.' },
    ],
    push: [
      { name: 'Pompes inclinées sur table', reps: '10–15', note: 'Mains sur une table stable, corps gainé.' },
      { name: 'Pompes', reps: '8–15', note: 'Coudes à 45°, poitrine proche du sol.' },
      { name: 'Pompes déclinées', reps: '6–12', note: 'Pieds sur une chaise, gainage strict.' },
    ],
    dip: [
      { name: 'Dips sur banc, pieds au sol', reps: '8–12', note: 'Mains au bord du banc, coudes vers l’arrière.' },
      { name: 'Dips entre deux chaises', reps: '6–10', note: 'Chaises stables contre un mur, descente contrôlée.' },
      { name: 'Dips aux barres parallèles', reps: '6–10', note: 'Épaules basses, amplitude confortable ; lestez avec un sac.' },
    ],
    pull: [
      { name: 'Rowing inversé sous table', reps: '8–12', note: 'Table solide, corps aligné, poitrine vers le bord.' },
      { name: 'Rowing inversé jambes tendues', reps: '8–12', note: 'Corps plus horizontal, tirez les omoplates.' },
      { name: 'Rowing inversé pieds surélevés', reps: '6–10', note: 'Pieds sur une chaise, gainage strict.' },
    ],
    core: [
      { name: 'Dead bug', reps: '8–10 / côté', note: 'Bas du dos plaqué au sol.' },
      { name: 'Planche', reps: '30–45 s', note: 'Alignement épaules-bassin-chevilles.' },
      { name: 'Hollow hold', reps: '20–40 s', note: 'Bas du dos au sol, bras tendus.' },
    ],
    calf: [
      { name: 'Mollets debout', reps: '20–25', note: 'Montée lente sur la pointe, appui au mur.' },
      { name: 'Mollets une jambe', reps: '12–15 / jambe', note: 'Une main au mur, cheville stable.' },
      { name: 'Mollets sautés', reps: '15–20', note: 'Réception silencieuse, genoux souples.' },
    ],
    shoulder: [
      { name: 'Y-T-W au sol', reps: '8 / forme', note: 'Bras au sol, omoplates serrées ; aucun poids.' },
      { name: 'Pike push-up', reps: '6–10', note: 'Hanche haute, tête entre les mains.' },
      { name: 'Pike push-up décliné', reps: '6–10', note: 'Pieds surélevés, descente contrôlée.' },
    ],
  },
  maison: {
    squat: [
      { name: 'Squat gobelet (haltère)', reps: '10–12', note: 'Haltère contre la poitrine, dos droit.' },
      { name: 'Squat gobelet lourd', reps: '8–12', note: 'Charge tenable, amplitude complète.' },
      { name: 'Fente bulgare haltères', reps: '8–10 / jambe', note: 'Pied arrière sur une chaise, buste stable.' },
    ],
    hinge: [
      { name: 'Pont fessier', reps: '15–20', note: 'Poussez dans les talons, gainage serré.' },
      { name: 'Soulevé de terre haltères', reps: '8–12', note: 'Dos plat, haltères le long des jambes.' },
      { name: 'Soulevé de terre une jambe', reps: '8–10 / jambe', note: 'Hanche qui recule, dos plat.' },
    ],
    lunge: [
      { name: 'Fente avant haltères', reps: '10–12 / jambe', note: 'Buste droit, genou dans l’axe du pied.' },
      { name: 'Fente marchée haltères', reps: '10–12 / jambe', note: 'Pas contrôlé, sans rebond.' },
      { name: 'Fente bulgare haltères', reps: '8–10 / jambe', note: 'Pied arrière surélevé, appui stable.' },
    ],
    push: [
      { name: 'Pompes', reps: '8–15', note: 'Coudes à 45°, corps gainé.' },
      { name: 'Développé haltères', reps: '8–12', note: 'Omoplates serrées, poignets au-dessus des coudes.' },
      { name: 'Pompes déclinées', reps: '6–12', note: 'Pieds surélevés, gainage strict.' },
    ],
    dip: [
      { name: 'Dips sur banc', reps: '8–12', note: 'Mains au bord, coudes vers l’arrière.' },
      { name: 'Dips entre chaises', reps: '6–10', note: 'Chaises stables, descente contrôlée.' },
      { name: 'Dips lestées (sac)', reps: '6–10', note: 'Sac sur les cuisses, amplitude confortable.' },
    ],
    pull: [
      { name: 'Rowing élastique', reps: '12–15', note: 'Élastique ancré bas, coudes vers l’arrière.' },
      { name: 'Rowing haltère', reps: '8–12 / bras', note: 'Dos plat, coude le long du corps.' },
      { name: 'Tirage élastique fort', reps: '8–12', note: 'Élastique court, tenez 1 s en fin de tirage.' },
    ],
    core: [
      { name: 'Planche', reps: '30–45 s', note: 'Alignement épaules-bassin-chevilles.' },
      { name: 'Planche + reach', reps: '8 / côté', note: 'Tendez un bras sans tourner le bassin.' },
      { name: 'Hollow hold', reps: '20–40 s', note: 'Bas du dos au sol, bras tendus.' },
    ],
    calf: [
      { name: 'Mollets debout', reps: '20–25', note: 'Montée lente, appui au mur.' },
      { name: 'Mollets haltères', reps: '12–15', note: 'Charge dans les mains, chevilles stables.' },
      { name: 'Mollets une jambe', reps: '12–15 / jambe', note: 'Une main au mur, amplitude complète.' },
    ],
    shoulder: [
      { name: 'Élévations latérales', reps: '12–15', note: 'Haltères légers, coudes légèrement fléchis.' },
      { name: 'Développé militaire haltères', reps: '8–12', note: 'Gainage serré, sans cambrer.' },
      { name: 'Oiseau haltères', reps: '10–12', note: 'Buste penché, omoplates serrées.' },
    ],
  },
  salle: {
    squat: [
      { name: 'Presse à cuisses', reps: '10–15', note: 'Amplitude confortable, sans décoller le bassin.' },
      { name: 'Squat barre', reps: '6–10', note: 'Barre stable, descente contrôlée.' },
      { name: 'Squat barre lourd', reps: '4–8', note: 'Charge progressive, technique d’abord.' },
    ],
    hinge: [
      { name: 'Leg curl', reps: '10–15', note: 'Contrôlez la descente, sans élan.' },
      { name: 'Soulevé de terre roumain', reps: '8–10', note: 'Dos plat, hanche qui recule.' },
      { name: 'Soulevé de terre', reps: '4–8', note: 'Charge progressive, gainage strict.' },
    ],
    lunge: [
      { name: 'Fente guidée', reps: '10–12 / jambe', note: 'Appui stable, genou dans l’axe.' },
      { name: 'Fente haltères', reps: '10–12 / jambe', note: 'Buste droit, pas contrôlé.' },
      { name: 'Fente bulgare', reps: '8–10 / jambe', note: 'Pied arrière surélevé, charge modérée.' },
    ],
    push: [
      { name: 'Développé couché', reps: '8–12', note: 'Omoplates serrées, poignets stables.' },
      { name: 'Développé incliné haltères', reps: '8–12', note: 'Trajectoire contrôlée, sans cambrer.' },
      { name: 'Développé couché barre', reps: '4–8', note: 'Charge progressive, sécurité assurée.' },
    ],
    dip: [
      { name: 'Dips assistées', reps: '8–12', note: 'Machine ou élastique, descente contrôlée.' },
      { name: 'Dips aux barres', reps: '6–10', note: 'Épaules basses, coudes vers l’arrière.' },
      { name: 'Dips lestées', reps: '4–8', note: 'Ceinture ou haltère entre les pieds.' },
    ],
    pull: [
      { name: 'Tirage vertical', reps: '10–12', note: 'Poitrine haute, coudes vers le bas.' },
      { name: 'Tirage horizontal', reps: '10–12', note: 'Omoplates serrées, sans élan.' },
      { name: 'Tractions', reps: '5–10', note: 'Prise stable, descente contrôlée.' },
    ],
    core: [
      { name: 'Planche', reps: '30–45 s', note: 'Alignement épaules-bassin-chevilles.' },
      { name: 'Crunch à la poulie', reps: '12–15', note: 'Enroulez le dos, sans tirer avec les bras.' },
      { name: 'Relevé de jambes suspendu', reps: '8–12', note: 'Bassin qui monte, pas d’élan.' },
    ],
    calf: [
      { name: 'Mollets à la presse', reps: '15–20', note: 'Amplitude complète, sans rebond.' },
      { name: 'Mollets debout machine', reps: '12–15', note: 'Montée lente, pause en haut.' },
      { name: 'Mollets une jambe', reps: '12–15 / jambe', note: 'Charge modérée, cheville stable.' },
    ],
    shoulder: [
      { name: 'Élévations latérales poulie', reps: '12–15', note: 'Coudes légèrement fléchis, sans élan.' },
      { name: 'Développé militaire', reps: '6–10', note: 'Gainage serré, barre au-dessus de la tête.' },
      { name: 'Oiseau poulie', reps: '12–15', note: 'Omoplates serrées, buste stable.' },
    ],
  },
};

interface ExerciseSlot {
  pattern: MovementPattern;
  /** Séries de référence avant ajustement au niveau et à la semaine. */
  sets: number;
}

/** Composition des séances de renforcement, par titre de séance. */
const RECIPES: Record<string, ExerciseSlot[]> = {
  'Bas du corps': [
    { pattern: 'squat', sets: 4 },
    { pattern: 'lunge', sets: 3 },
    { pattern: 'hinge', sets: 3 },
    { pattern: 'calf', sets: 3 },
    { pattern: 'core', sets: 3 },
  ],
  'Haut du corps · dips': [
    { pattern: 'dip', sets: 4 },
    { pattern: 'push', sets: 3 },
    { pattern: 'pull', sets: 3 },
    { pattern: 'shoulder', sets: 3 },
    { pattern: 'core', sets: 3 },
  ],
  'Corps complet · dips': [
    { pattern: 'dip', sets: 3 },
    { pattern: 'pull', sets: 3 },
    { pattern: 'squat', sets: 3 },
    { pattern: 'push', sets: 3 },
    { pattern: 'core', sets: 3 },
  ],
  'Renforcement coureur': [
    { pattern: 'squat', sets: 3 },
    { pattern: 'lunge', sets: 3 },
    { pattern: 'hinge', sets: 3 },
    { pattern: 'calf', sets: 3 },
    { pattern: 'core', sets: 3 },
  ],
  'Renforcement complet': [
    { pattern: 'squat', sets: 3 },
    { pattern: 'push', sets: 3 },
    { pattern: 'pull', sets: 3 },
    { pattern: 'core', sets: 3 },
  ],
  'Renforcement doux': [
    { pattern: 'squat', sets: 2 },
    { pattern: 'push', sets: 2 },
    { pattern: 'hinge', sets: 2 },
    { pattern: 'core', sets: 2 },
  ],
  'Renforcement spécifique': [
    { pattern: 'squat', sets: 3 },
    { pattern: 'hinge', sets: 3 },
    { pattern: 'calf', sets: 3 },
    { pattern: 'core', sets: 3 },
  ],
};

const REST_SEC: Record<MovementPattern, number> = {
  squat: 90,
  hinge: 90,
  lunge: 75,
  push: 75,
  dip: 90,
  pull: 90,
  core: 45,
  calf: 45,
  shoulder: 60,
};

const EXPERIENCE_INDEX: Record<Experience, number> = {
  debutant: 0,
  intermediaire: 1,
  avance: 2,
};

/**
 * Construit la liste de mouvements d’une séance de renforcement. Le niveau
 * choisit la variante, la semaine ajuste le nombre de séries, et la semaine
 * allégée retire une série. Aucune charge chiffrée n’est inventée.
 */
function buildExercises(
  title: string,
  intake: PlanIntake,
  weekIndex: number
): PlanExercise[] | undefined {
  const recipe = RECIPES[title];
  if (!recipe) return undefined;

  // « Renforcement doux » garde volontairement les variantes les plus faciles,
  // même si l’utilisateur se déclare expérimenté.
  const gentle = title === 'Renforcement doux';
  const index = gentle ? 0 : EXPERIENCE_INDEX[intake.experience];
  const bank = MOVEMENTS[intake.equipment];

  return recipe.map((slot, position) => {
    const variants = bank[slot.pattern];
    const variant = variants[Math.min(index, variants.length - 1)] ?? variants[0]!;
    let sets = slot.sets;
    if (intake.experience === 'debutant') sets -= 1;
    if (intake.experience === 'avance') sets += 1;
    if (isDeload(weekIndex)) {
      sets -= 1;
    } else if (weekIndex % 4 === 2 && position === 0) {
      // Une série de plus sur le mouvement principal, au troisième semaine du bloc.
      sets += 1;
    }
    return {
      name: variant.name,
      sets: clamp(sets, 2, 6),
      reps: variant.reps,
      restSec: REST_SEC[slot.pattern],
      note: variant.note,
    };
  });
}

const PHASE_BY_GOAL: Record<GoalKind, PlanPhase[]> = {
  endurance: [
    {
      id: 'base',
      name: 'Socle aérobie',
      fromWeek: 0,
      toWeek: 0,
      focus: 'Construire la base, sans forcer',
      objective: 'Courir 40 min en continu, allure conversationnelle.',
    },
    {
      id: 'build',
      name: 'Développement',
      fromWeek: 0,
      toWeek: 0,
      focus: 'Allonger, puis accélérer',
      objective: 'Ajouter du volume et une séance de qualité par semaine.',
    },
    {
      id: 'specific',
      name: 'Spécifique',
      fromWeek: 0,
      toWeek: 0,
      focus: 'Allure cible et fraîcheur',
      objective: 'Tenir l’allure objectif sur des blocs de plus en plus longs.',
    },
  ],
  force: [
    {
      id: 'base',
      name: 'Apprentissage',
      fromWeek: 0,
      toWeek: 0,
      focus: 'Technique et amplitude',
      objective: 'Maîtriser les mouvements de base, amplitude et technique.',
    },
    {
      id: 'build',
      name: 'Charge progressive',
      fromWeek: 0,
      toWeek: 0,
      focus: 'Ajouter des répétitions, puis une variante plus difficile',
      objective: 'Progresser sur les quatre mouvements principaux.',
    },
    {
      id: 'specific',
      name: 'Consolidation',
      fromWeek: 0,
      toWeek: 0,
      focus: 'Intensité maîtrisée',
      objective: 'Tenir les séries cibles sans dégrader la technique.',
    },
  ],
  perte: [
    {
      id: 'base',
      name: 'Mise en route',
      fromWeek: 0,
      toWeek: 0,
      focus: 'Régularité avant intensité',
      objective: 'Enchaîner les semaines sans douleur ni fatigue excessive.',
    },
    {
      id: 'build',
      name: 'Volume',
      fromWeek: 0,
      toWeek: 0,
      focus: 'Dépense régulière',
      objective: 'Ajouter du volume de marche et deux séances de renforcement.',
    },
    {
      id: 'specific',
      name: 'Consolidation',
      fromWeek: 0,
      toWeek: 0,
      focus: 'Tenir le rythme',
      objective: 'Maintenir la fréquence en semaine chargée.',
    },
  ],
  sante: [
    {
      id: 'base',
      name: 'Réveil articulaire',
      fromWeek: 0,
      toWeek: 0,
      focus: 'Bouger tous les jours',
      objective: 'Marcher 30 min et retrouver de l’amplitude sans douleur.',
    },
    {
      id: 'build',
      name: 'Renforcement',
      fromWeek: 0,
      toWeek: 0,
      focus: 'Gainage et posture',
      objective: 'Deux séances de renforcement doux par semaine.',
    },
    {
      id: 'specific',
      name: 'Autonomie',
      fromWeek: 0,
      toWeek: 0,
      focus: 'Habitudes durables',
      objective: 'Un rythme tenable même en semaine chargée.',
    },
  ],
  performance: [
    {
      id: 'base',
      name: 'Préparation',
      fromWeek: 0,
      toWeek: 0,
      focus: 'Volume et endurance',
      objective: 'Installer la charge de fond sans accumuler de fatigue.',
    },
    {
      id: 'build',
      name: 'Développement',
      fromWeek: 0,
      toWeek: 0,
      focus: 'Allure objectif',
      objective: 'Enchaîner les blocs à allure cible avec récupération maîtrisée.',
    },
    {
      id: 'specific',
      name: 'Affûtage',
      fromWeek: 0,
      toWeek: 0,
      focus: 'Fraîcheur et précision',
      objective: 'Réduire le volume, garder l’intensité, arriver frais.',
    },
  ],
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function slotsFor(daysPerWeek: number): number[] {
  const days = clamp(Math.round(daysPerWeek), 2, 6);
  return DAY_SLOTS[days] ?? DEFAULT_SLOTS;
}

/** Semaine allégée toutes les 4 semaines (3 semaines de charge, 1 de récup). */
function isDeload(weekIndex: number): boolean {
  return (weekIndex + 1) % 4 === 0;
}

function volumeFactor(weekIndex: number): number {
  if (isDeload(weekIndex)) return 0.65;
  const position = (weekIndex + 1) % 4; // 1, 2 ou 3
  return 1 + Math.min(0.15, position * 0.05);
}

/** Découpe l'horizon en trois phases égales, bornes incluses (0-indexées). */
export function buildPhases(goal: GoalKind, horizonWeeks: number): PlanPhase[] {
  const third = Math.ceil(horizonWeeks / 3);
  const bounds: Array<[number, number]> = [
    [0, Math.min(horizonWeeks - 1, third - 1)],
    [third, Math.min(horizonWeeks - 1, third * 2 - 1)],
    [third * 2, horizonWeeks - 1],
  ];
  return PHASE_BY_GOAL[goal].map((phase, index) => {
    const [from, to] = bounds[index] ?? [0, horizonWeeks - 1];
    return {
      ...phase,
      fromWeek: from,
      toWeek: to,
    };
  }).filter((phase) => phase.toWeek >= phase.fromWeek);
}

function weekFocus(goal: GoalKind, weekIndex: number, horizonWeeks: number): string {
  if (isDeload(weekIndex)) return 'Semaine allégée : on récupère';
  const phase = buildPhases(goal, horizonWeeks).find(
    (item) => weekIndex >= item.fromWeek && weekIndex <= item.toWeek
  );
  return phase?.focus ?? 'Régularité';
}

function blueprintFor(goal: GoalKind, index: number): Blueprint {
  const list = BLUEPRINTS[goal];
  const blueprint = list[index % list.length];
  // `list` n'est jamais vide : le type reste non-optionnel pour l'appelant.
  return blueprint ?? BLUEPRINTS.sante[0]!;
}

function makeSession(
  blueprint: Blueprint,
  day: number,
  minutes: number,
  weekIndex: number,
  intake: PlanIntake
): PlanSession {
  return {
    id: `p${weekIndex}_${day}_${blueprint.slot}`,
    day,
    type: blueprint.type,
    title: blueprint.title,
    minutes: Math.max(15, Math.round(minutes / 5) * 5),
    intensity: blueprint.intensity,
    detail: blueprint.detail,
    exercises:
      blueprint.type === 'Musculation'
        ? buildExercises(blueprint.title, intake, weekIndex)
        : undefined,
  };
}

/**
 * Première semaine quand le bilan est fait en semaine : on garde les jours
 * prévus après aujourd’hui, on ajoute aujourd’hui, et on écarte les séances
 * collées pour ne pas enchaîner deux séances dures. La semaine 1 peut donc
 * contenir moins de séances que les suivantes — c’est une mise en route, pas
 * un plan tronqué.
 */
function firstWeekDays(days: number[], weekday: number): number[] {
  if (weekday <= 0 || weekday >= 5) return days;
  const picked = [weekday];
  for (const day of [...days].sort((a, b) => a - b)) {
    if (day <= weekday) continue;
    const last = picked[picked.length - 1] ?? weekday;
    if (day - last < 2) continue;
    picked.push(day);
  }
  return picked;
}

function buildMilestones(goal: GoalKind, horizonWeeks: number, intake: PlanIntake): PlanMilestone[] {
  // Indices de semaine (0-based) : un jalon ne doit jamais tomber après la
  // dernière semaine du plan.
  const end = horizonWeeks - 1;
  const mid = Math.max(1, Math.round((horizonWeeks - 1) / 2));
  const early = Math.max(0, Math.round((horizonWeeks - 1) / 4));
  const sessions = intake.daysPerWeek;
  const map: Record<GoalKind, PlanMilestone[]> = {
    endurance: [
      {
        id: 'm1',
        week: early,
        label: '30 minutes en continu',
        detail: 'Une sortie de 30 min sans marche, allure conversationnelle.',
      },
      {
        id: 'm2',
        week: mid,
        label: '10 km en endurance',
        detail: 'Distance tenue sans douleur ni dérive cardiaque majeure.',
      },
      {
        id: 'm3',
        week: end,
        label: 'Allure objectif tenue',
        detail: 'Deux blocs de 10 min à l’allure visée, dans la même séance.',
      },
    ],
    force: [
      {
        id: 'm1',
        week: early,
        label: 'Technique acquise',
        detail: 'Squat, pompes, tirage et gainage exécutés proprement.',
      },
      {
        id: 'm2',
        week: mid,
        label: 'Séries complètes',
        detail: '4 séries de 8 répétitions sur les mouvements principaux.',
      },
      {
        id: 'm3',
        week: end,
        label: 'Charge progressée',
        detail: `Tenir ${sessions} séances par semaine avec une charge supérieure au départ.`,
      },
    ],
    perte: [
      {
        id: 'm1',
        week: early,
        label: 'Semaines tenues',
        detail: `${sessions} séances par semaine, trois semaines de suite.`,
      },
      {
        id: 'm2',
        week: mid,
        label: 'Repères corporels',
        detail: 'Première variation mesurable du tour de taille ou du poids.',
      },
      {
        id: 'm3',
        week: end,
        label: 'Nouveau rythme',
        detail: 'Une semaine complète sans manquer une séance, même en semaine chargée.',
      },
    ],
    sante: [
      {
        id: 'm1',
        week: early,
        label: 'Bouger chaque jour',
        detail: 'Au moins 20 min de marche quotidienne, sans exception.',
      },
      {
        id: 'm2',
        week: mid,
        label: 'Renforcement installé',
        detail: 'Deux séances de renforcement doux par semaine, sans douleur.',
      },
      {
        id: 'm3',
        week: end,
        label: 'Sommeil régulier',
        detail: 'Coucher à heure stable ±30 min, avec une durée proche de la cible.',
      },
    ],
    performance: [
      {
        id: 'm1',
        week: early,
        label: 'Base solide',
        detail: 'Sortie longue maîtrisée, sans dérive de la FC de repos.',
      },
      {
        id: 'm2',
        week: mid,
        label: 'Test de contrôle',
        detail: 'Un test chronométré pour recalibrer les allures.',
      },
      {
        id: 'm3',
        week: end,
        label: 'Jour J',
        detail: intake.targetDate
          ? 'Objectif daté : arriver frais, avec deux semaines d’affûtage.'
          : 'Objectif tenu à l’allure visée, sans blessure.',
      },
    ],
  };
  return map[goal];
}

/** Note locale qui accompagne le plan quand l'IA est coupée ou indisponible. */
export function localPlanNote(intake: PlanIntake): string {
  const goal = GOALS[intake.goal];
  const sleepLine =
    intake.sleepHours < 7
      ? 'Votre sommeil déclaré est court : c’est le premier levier si les séances paraissent lourdes.'
      : 'Votre sommeil déclaré est correct : gardez des horaires stables, c’est ce qui rend la charge supportable.';
  const equipment =
    intake.equipment === 'salle'
      ? 'Vous avez accès à une salle : privilégiez les mouvements de base plutôt que les machines isolées.'
      : intake.equipment === 'maison'
        ? 'Avec du matériel à la maison, le poids du corps et les élastiques suffisent pour progresser.'
        : 'Sans matériel, les variantes au poids du corps et les escaliers remplacent largement les machines.';
  return [
    `Objectif : ${goal.label.toLowerCase()} — ${intake.daysPerWeek} séances de ${intake.sessionMin} min par semaine.`,
    `Le plan est découpé en trois phases, avec une semaine allégée toutes les quatre semaines. ${equipment}`,
    `${sleepLine} Si une douleur apparaît, remplacez la séance par de la marche ou du repos : un plan se garde sur plusieurs mois, pas sur une semaine.`,
  ].join('\n\n');
}

export interface PlanOptions {
  today?: ISODate;
  note?: string;
  noteSource?: 'ai' | 'local';
  /** Place une séance aujourd’hui quand le bilan est fait en semaine. */
  startToday?: boolean;
}

export function buildPlan(intake: PlanIntake, options: PlanOptions = {}): TrainingPlan {
  const today = options.today ?? todayISO();
  const horizonWeeks = clamp(
    intake.targetDate
      ? Math.ceil(
          (new Date(intake.targetDate).getTime() - new Date(today).getTime()) / (7 * 86_400_000)
        )
      : 12,
    4,
    24
  );
  const days = slotsFor(intake.daysPerWeek);
  // Un plan démarré un samedi ou un dimanche commencerait avec une semaine déjà
  // entamée : on cale alors la première semaine sur le lundi suivant.
  const weekday = (new Date(`${today}T00:00:00`).getDay() + 6) % 7;
  const firstMonday = addDays(startOfWeek(today), weekday >= 5 ? 7 : 0);
  const weeks: PlanWeek[] = [];

  for (let weekIndex = 0; weekIndex < horizonWeeks; weekIndex += 1) {
    const factor = volumeFactor(weekIndex);
    const weekDays =
      weekIndex === 0 && options.startToday ? firstWeekDays(days, weekday) : days;
    const sessions: PlanSession[] = weekDays.map((day, slotIndex) => {
      const blueprint = blueprintFor(intake.goal, slotIndex);
      const base = intake.sessionMin + (blueprint.extraMin ?? 0);
      return makeSession(blueprint, day, base * factor, weekIndex, intake);
    });
    const targetMinutes = sessions.reduce((total, session) => total + session.minutes, 0);
    const partialStart = weekIndex === 0 && weekDays.length < days.length;
    weeks.push({
      index: weekIndex,
      startDate: addDays(firstMonday, weekIndex * 7),
      focus: partialStart
        ? 'Mise en route : première séance aujourd’hui'
        : weekFocus(intake.goal, weekIndex, horizonWeeks),
      targetMinutes,
      deload: isDeload(weekIndex),
      sessions,
    });
  }

  return {
    createdAt: new Date().toISOString(),
    horizonWeeks,
    goal: intake.goal,
    intake,
    phases: buildPhases(intake.goal, horizonWeeks),
    weeks,
    milestones: buildMilestones(intake.goal, horizonWeeks, intake),
    note: options.note ?? localPlanNote(intake),
    noteSource: options.noteSource ?? 'local',
  };
}

/* --------------------------------------------------------------- lectures */

export function weekIndexFor(plan: TrainingPlan, date: ISODate): number | null {
  const start = plan.weeks[0]?.startDate;
  if (!start) return null;
  const diff = Math.floor(
    (new Date(`${date}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) /
      (7 * 86_400_000)
  );
  if (diff < 0 || diff >= plan.horizonWeeks) return null;
  return diff;
}

export function planPhaseFor(plan: TrainingPlan, weekIndex: number): PlanPhase | null {
  return (
    plan.phases.find((phase) => weekIndex >= phase.fromWeek && weekIndex <= phase.toWeek) ?? null
  );
}

/** Séance prévue aujourd'hui (ou le jour demandé), même si elle est déjà cochée. */
export function sessionForDate(plan: TrainingPlan, date: ISODate): PlanSession | null {
  const weekIndex = weekIndexFor(plan, date);
  if (weekIndex === null) return null;
  const weekday = (new Date(`${date}T00:00:00`).getDay() + 6) % 7;
  return plan.weeks[weekIndex]?.sessions.find((session) => session.day === weekday) ?? null;
}

/** Prochaine séance non réalisée, pour la carte « à venir » du tableau de bord. */
export function nextSession(
  plan: TrainingPlan,
  from: ISODate
): { weekIndex: number; session: PlanSession; date: ISODate } | null {
  for (let offset = 0; offset < 14; offset += 1) {
    const date = addDays(from, offset);
    const weekIndex = weekIndexFor(plan, date);
    if (weekIndex === null) continue;
    const session = sessionForDate(plan, date);
    if (session && !session.doneAt) return { weekIndex, session, date };
  }
  return null;
}

export interface PlanStats {
  done: number;
  total: number;
  adherence: number;
  currentWeek: number | null;
  targetMinutes: number;
  phase: PlanPhase | null;
}

export function planStats(plan: TrainingPlan, today = todayISO()): PlanStats {
  const done = plan.weeks.reduce(
    (total, week) => total + week.sessions.filter((session) => session.doneAt).length,
    0
  );
  const total = plan.weeks.reduce((sum, week) => sum + week.sessions.length, 0);
  const currentWeek = weekIndexFor(plan, today);
  const week = currentWeek === null ? plan.weeks[0] : plan.weeks[currentWeek];
  return {
    done,
    total,
    adherence: total === 0 ? 0 : Math.round((done / total) * 100),
    currentWeek,
    targetMinutes: week?.targetMinutes ?? 0,
    phase: currentWeek === null ? plan.phases[0] ?? null : planPhaseFor(plan, currentWeek),
  };
}

/** Marque une séance comme faite (ou annulée) sans muter le plan d'origine. */
export function togglePlanSession(
  plan: TrainingPlan,
  weekIndex: number,
  sessionId: string,
  done: boolean
): TrainingPlan {
  return {
    ...plan,
    weeks: plan.weeks.map((week) =>
      week.index !== weekIndex
        ? week
        : {
            ...week,
            sessions: week.sessions.map((session) =>
              session.id !== sessionId
                ? session
                : done
                  ? { ...session, doneAt: new Date().toISOString() }
                  : { ...session, doneAt: undefined }
            ),
          }
    ),
  };
}

/** Résumé compact et anonyme du plan, pour le prompt du coach. */
export function planSummary(plan: TrainingPlan): string {
  const stats = planStats(plan);
  return [
    `Plan ${plan.horizonWeeks} semaines, objectif ${GOALS[plan.goal].label.toLowerCase()}, ${plan.intake.daysPerWeek} séances de ${plan.intake.sessionMin} min.`,
    `Progression : ${stats.done}/${stats.total} séances réalisées (${stats.adherence} %).`,
    `Phase actuelle : ${stats.phase?.name ?? plan.phases[0]?.name ?? '—'}.`,
  ].join(' ');
}

/** Texte destiné au fournisseur IA : uniquement des choix fermés. */
export function planPromptContext(intake: PlanIntake, plan: TrainingPlan): string {
  return [
    `Objectif : ${GOALS[intake.goal].label} (${GOALS[intake.goal].tagline}).`,
    `Niveau : ${EXPERIENCE_LABELS[intake.experience]}.`,
    `Disponibilité : ${intake.daysPerWeek} séances de ${intake.sessionMin} min par semaine.`,
    `Matériel : ${intake.equipment}. Sommeil déclaré : ${intake.sleepHours} h.`,
    intake.targetWeightKg ? `Poids visé : ${intake.targetWeightKg} kg.` : '',
    intake.targetDate ? `Échéance visée : ${intake.targetDate}.` : '',
    `Structure : ${plan.horizonWeeks} semaines, ${plan.phases.map((phase) => phase.name).join(' → ')}.`,
    `Semaine type : ${plan.weeks[0]?.sessions.map((session) => `${session.type} ${session.minutes} min`).join(', ')}.`,
  ]
    .filter(Boolean)
    .join('\n');
}
