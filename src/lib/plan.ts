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
  Experience,
  GoalKind,
  ISODate,
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
    tagline: 'Devenir plus fort, sans matériel de salle',
    detail: 'Deux à quatre séances de renforcement, du cardio d’entretien.',
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
      detail: 'Squat, fente, gainage, mollets, tirage. 3 séries, charge modérée.',
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
      title: 'Bas du corps',
      detail: 'Squat, fente, pont fessier, mollets. 4 séries de 6 à 10, repos 90 s.',
      intensity: 'soutenue',
    },
    {
      slot: 'strength',
      type: 'Musculation',
      title: 'Haut du corps',
      detail: 'Pompes, tirage, élévations, gainage. 4 séries de 6 à 12.',
      intensity: 'modérée',
    },
    {
      slot: 'strength',
      type: 'Musculation',
      title: 'Corps complet',
      detail: 'Squat, pompes, tirage, gainage. 3 tours, 8 à 12 répétitions.',
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
      detail: 'Squat, pompes, tirage, gainage. 3 tours, 10 à 12 répétitions.',
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
      detail: 'Chaise, pompes inclinées, pont fessier, gainage. 2 à 3 séries, sans forcer.',
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
      detail: 'Squat, soulevé de terre léger, gainage, mollets. 3 séries de 6 à 8.',
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
      objective: 'Maîtriser les mouvements de base avec une charge modérée.',
    },
    {
      id: 'build',
      name: 'Charge progressive',
      fromWeek: 0,
      toWeek: 0,
      focus: 'Ajouter des répétitions, puis de la charge',
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
  weekIndex: number
): PlanSession {
  return {
    id: `p${weekIndex}_${day}_${blueprint.slot}`,
    day,
    type: blueprint.type,
    title: blueprint.title,
    minutes: Math.max(15, Math.round(minutes / 5) * 5),
    intensity: blueprint.intensity,
    detail: blueprint.detail,
  };
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
    const sessions: PlanSession[] = days.map((day, slotIndex) => {
      const blueprint = blueprintFor(intake.goal, slotIndex);
      const base = intake.sessionMin + (blueprint.extraMin ?? 0);
      return makeSession(blueprint, day, base * factor, weekIndex);
    });
    const targetMinutes = sessions.reduce((total, session) => total + session.minutes, 0);
    weeks.push({
      index: weekIndex,
      startDate: addDays(firstMonday, weekIndex * 7),
      focus: weekFocus(intake.goal, weekIndex, horizonWeeks),
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
