/**
 * Coach IA de Battement.
 *
 * Le fournisseur est choisi par l'utilisateur (gratuit sans clé, API
 * compatible OpenAI avec sa clé, ou modèle local) et vit dans `lib/llm.ts`.
 * En cas d'échec — ou si l'utilisateur coupe l'IA — un raisonnement local
 * déterministe répond quand même.
 *
 * Vie privée : le contexte envoyé ne contient **aucun nom, aucune note de
 * séance, aucun repas, aucune donnée brute**. Uniquement des agrégats
 * (volumes, durées, FC, poids, objectifs) sur 7 et 28 jours.
 */

import type { AiConfig, ChatMessage, PlanIntake, TrainingPlan } from '../types';
import type { DataSlice } from './analytics';
import {
  bodyMetrics,
  maxHrOf,
  readinessFor,
  records,
  sleepStats,
  summary,
  typeBreakdown,
  workoutsOn,
} from './analytics';
import { ageFromBirthYear, formatMedium, todayISO } from './dates';
import { fmtMinutes, fmtNumber } from './format';
import { complete, type LlmMessage } from './llm';
import { planPromptContext, planSummary } from './plan';

const MIN_INTERVAL = 4_000;
let lastRemoteAt = 0;

export interface CoachReply {
  text: string;
  local: boolean;
}

const SYSTEM_PROMPT = `Tu es le coach de Battement, une application open source de suivi sportif et santé.
Tu réponds en français, de façon concise (180 mots maximum), concrète et bienveillante.
Tu t'appuies uniquement sur les données agrégées fournies. Tu n'inventes aucun chiffre.
Tu ne poses jamais de diagnostic médical et tu ne prescris ni médicament, ni complément, ni régime thérapeutique.
Si une douleur, un malaise, une blessure ou un trouble du sommeil inquiétant est évoqué, tu recommandes de consulter un professionnel de santé.
Tu proposes des actions simples et mesurables (durée, intensité, hydratation, heure de coucher).
Tu ne mentionnes pas que tu es une IA ni le nom du fournisseur.
Format : phrases courtes, au maximum 3 puces. Pas de tableau, pas de titre Markdown.`;

function fr(value: number, digits = 0): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(value);
}

/** Contexte compact, sans identifiant personnel. */
export function buildContext(
  data: DataSlice,
  today = todayISO(),
  plan?: TrainingPlan | null
): string {
  const seven = summary(data, today, 7);
  const twentyEight = summary(data, today, 28);
  const readiness = readinessFor(data, today);
  const sleep = sleepStats(data, today, 14);
  const body = bodyMetrics(data);
  const maxHr = Math.round(maxHrOf(data.profile));
  const age = ageFromBirthYear(data.profile.birthYear);
  const types = typeBreakdown(data, today, 28)
    .slice(0, 3)
    .map((item) => `${item.type} ${Math.round(item.minutes)} min`)
    .join(', ');
  const recent = [...data.workouts]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 5)
    .map(
      (workout) =>
        `${formatMedium(workout.date)} ${workout.type} ${Math.round(workout.durationMin)} min` +
        (workout.distanceKm ? ` ${workout.distanceKm} km` : '') +
        (workout.avgHr ? ` FC ${Math.round(workout.avgHr)}` : '') +
        (workout.rpe ? ` RPE ${workout.rpe}` : '')
    )
    .join(' | ');
  const todayWorkouts = workoutsOn(data, today)
    .map((workout) => `${workout.type} ${Math.round(workout.durationMin)} min`)
    .join(', ');

  return [
    `Profil : ${age} ans, ${data.profile.sex}, ${data.profile.heightCm ?? '?'} cm, ${fr(
      body.weight,
      1
    )} kg, FC repos ${Math.round(data.profile.restingHr)}, FC max ${maxHr}.`,
    `Objectifs : ${data.goals.moveKcal} kcal actives, ${data.goals.exerciseMin} min d'exercice, ${(
      data.goals.waterMl / 1000
    ).toFixed(1)} L d'eau, ${data.goals.sleepHours} h de sommeil${
      data.goals.weightKg ? `, poids cible ${data.goals.weightKg} kg` : ''
    }.`,
    `Aujourd'hui : ${
      readiness.score === null ? 'forme non calculable (données insuffisantes)' : `forme ${readiness.score}/100`
    }${todayWorkouts ? `, séances déjà faites : ${todayWorkouts}` : ', aucune séance encore'}, ${
      data.days[today]?.steps ? `${fr(data.days[today]!.steps!)} pas` : 'pas non renseignés'
    }, eau ${fr(data.days[today]?.waterMl ?? 0)} ml.`,
    `7 jours : ${seven.sessions} séances, ${Math.round(seven.minutes)} min, ${seven.distanceKm} km, charge ${seven.load}, ${seven.activeDays} jours actifs, ${fr(
      seven.steps
    )} pas.`,
    `28 jours : ${twentyEight.sessions} séances, ${Math.round(twentyEight.minutes)} min, charge ${twentyEight.load}. Activités principales : ${types || 'aucune'}.`,
    `Sommeil 14 j : moyenne ${fmtMinutes(sleep.avgMin)}, qualité ${sleep.avgQuality}/5, dette ${sleep.debtHours} h, régularité ${sleep.consistency}/100.`,
    `Charge aiguë/chronique : ${readiness.ratio} (${Math.round(readiness.acute)} sur 7 j, base ${Math.round(
      readiness.chronic
    )} par semaine). FC repos aujourd'hui : ${readiness.restingHr}.`,
    `Dernières séances : ${recent || 'aucune'}.`,
    `Poids : ${fr(body.weight, 1)} kg${body.delta ? `, évolution ${body.delta > 0 ? '+' : ''}${fr(body.delta, 1)} kg sur la dernière mesure` : ''}.`,
    plan ? `Plan long terme : ${planSummary(plan)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function chatMessages(history: ChatMessage[], context: string) {
  const trimmed: LlmMessage[] = history.slice(-10).map((message) => ({
    role: message.role,
    content: message.content.slice(0, 3000),
  }));
  return [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'system' as const, content: `Données agrégées de l'utilisateur :\n${context}` },
    ...trimmed,
  ];
}

function callRemote(
  messages: LlmMessage[],
  config?: AiConfig | null,
  signal?: AbortSignal
): Promise<string> {
  return complete(messages, config, { signal });
}

/* ------------------------------------------------------------- repli local */

function sleepAdvice(data: DataSlice, today: string): string {
  const stats = sleepStats(data, today, 14);
  if (!stats.last) {
    return "Aucune nuit enregistrée pour l'instant. Notez votre sommeil pendant quelques jours : c'est le signal le plus utile pour ajuster la charge d'entraînement.";
  }
  const target = data.goals.sleepHours;
  if (stats.avgMin < target * 60 - 45) {
    return `Sur 14 jours, vous dormez en moyenne ${fmtMinutes(stats.avgMin)} pour un objectif de ${target} h. Décalez le coucher de 20 minutes et gardez une heure de lever stable : c'est plus efficace qu'une sieste de rattrapage.`;
  }
  return `Votre sommeil tient la route : ${fmtMinutes(stats.avgMin)} en moyenne, qualité ${stats.avgQuality}/5. Gardez la même heure de lever, même le week-end, pour préserver la régularité (${stats.consistency}/100).`;
}

export function localTodayAdvice(data: DataSlice, today = todayISO()): string {
  const readiness = readinessFor(data, today);
  const done = workoutsOn(data, today);
  const doneText =
    done.length > 0
      ? `Vous avez déjà ${done.map((workout) => `${workout.type.toLowerCase()} ${Math.round(workout.durationMin)} min`).join(' et ')} aujourd'hui.`
      : '';
  const remainingWater = Math.max(0, data.goals.waterMl - (data.days[today]?.waterMl ?? 0));
  const water =
    remainingWater > 0
      ? `Il reste ${fmtNumber(remainingWater)} ml d'eau pour atteindre l'objectif.`
      : 'Objectif d’hydratation atteint.';

  if (readiness.score === null) {
    return `Je manque encore de données pour juger votre forme. Commencez par une séance facile de 20 à 30 minutes, ou importez votre historique Apple Health / Samsung Health. ${water}`;
  }
  if (readiness.score >= 82) {
    return `${doneText || 'Votre forme est bonne'} (${readiness.score}/100) : une séance soutenue est adaptée — 30 à 45 minutes avec 3 à 4 efforts courts, ou votre séance prévue. Terminez par 5 minutes de retour au calme. ${water}`.trim();
  }
  if (readiness.score >= 62) {
    return `${doneText || 'Forme correcte'} (${readiness.score}/100) : restez en endurance fondamentale 35 à 50 minutes, conversation possible. Ajoutez 10 minutes de mobilité. ${water}`.trim();
  }
  return `${doneText || 'Forme basse'} (${readiness.score}/100) : privilégiez 20 à 30 minutes de marche ou de mobilité plutôt qu'une séance intense. Visez ${data.goals.sleepHours} h de sommeil cette nuit. ${water}`.trim();
}

export function localBriefing(data: DataSlice, today = todayISO()): string {
  const readiness = readinessFor(data, today);
  const sleep = sleepStats(data, today, 14);
  const seven = summary(data, today, 7);
  const remainingWater = Math.max(0, data.goals.waterMl - (data.days[today]?.waterMl ?? 0));

  if (!readiness.hasData && seven.sessions === 0 && data.sleeps.length === 0) {
    return "Votre journal est encore vide. Ajoutez une première séance ou importez votre historique Apple Health / Samsung Health : le coach pourra alors analyser votre charge, votre sommeil et votre régularité. En attendant, 20 minutes de marche sont un excellent point de départ.";
  }

  const lines: string[] = [];
  if (readiness.score !== null) {
    const tone =
      readiness.score >= 82
        ? 'Votre forme est élevée'
        : readiness.score >= 62
          ? 'Votre forme est correcte'
          : 'Votre forme demande de la retenue';
    lines.push(
      `${tone} (${readiness.score}/100) : ${fmtMinutes(readiness.sleepMin)} de sommeil, une charge ${
        readiness.ratio > 1.5 ? 'en progression rapide' : readiness.ratio < 0.8 ? 'plus légère que d’habitude' : 'maîtrisée'
      }.`
    );
  } else {
    lines.push(
      `Vous avez ${seven.sessions} séance${seven.sessions > 1 ? 's' : ''} cette semaine, mais pas encore assez de données de sommeil pour calculer votre forme.`
    );
  }

  lines.push(
    readiness.score !== null && readiness.score < 62
      ? 'Aujourd’hui : 20 à 30 minutes de marche ou de mobilité, sans chercher la performance.'
      : readiness.score !== null && readiness.score >= 82
        ? 'Aujourd’hui : une séance soutenue de 30 à 45 minutes est la bienvenue, avec un échauffement complet.'
        : 'Aujourd’hui : 35 à 50 minutes en endurance fondamentale, allure où vous pouvez parler.'
  );

  const bullets: string[] = [];
  if (sleep.debtHours >= 3) bullets.push(`Dette de sommeil : ${sleep.debtHours} h. Couchez-vous 20 min plus tôt.`);
  if (remainingWater > 0) bullets.push(`Hydratation : encore ${fmtNumber(remainingWater)} ml.`);
  if (readiness.ratio > 1.5) bullets.push('Charge récente élevée : gardez une journée facile cette semaine.');
  if (bullets.length === 0) bullets.push('Objectifs du jour atteints : entretenez la régularité.');
  lines.push(`- ${bullets.slice(0, 2).join('\n- ')}`);

  return lines.join('\n');
}

export function localPlan(data: DataSlice, today = todayISO()): string {
  const maxHr = Math.round(maxHrOf(data.profile));
  const z2 = `${Math.round(maxHr * 0.6)}–${Math.round(maxHr * 0.7)} bpm`;
  const seven = summary(data, today, 7);
  const readiness = readinessFor(data, today);
  const light = seven.minutes > 300 || (readiness.score !== null && readiness.score < 58);
  const long = light ? '45–55' : '60–80';

  return [
    `Plan indicatif — 7 jours (allure endurance : ${z2})`,
    '',
    'Lundi — Repos actif : 20–30 min de marche + mobilité hanches et épaules.',
    `Mardi — Endurance fondamentale : ${light ? '30–35' : '40–45'} min en zone 2, respiration nasale si possible.`,
    'Mercredi — Renforcement : 30 min (squat, fente, gainage, tirage), 2 à 3 séries, charge modérée.',
    'Jeudi — Repos complet ou 15 min de mobilité douce.',
    `Vendredi — ${light ? 'Ligne droite : 6 × 30 s rapide / 90 s lent' : 'Fractionné : 8 × 1 min rapide / 1 min lent'}, plus 10 min d’échauffement et 5 min de retour au calme.`,
    `Samedi — Sortie longue : ${long} min en endurance, allure conversationnelle.`,
    'Dimanche — Récupération : 20 min de yoga ou marche tranquille.',
    '',
    `Règle de prudence : si la forme descend sous 55/100, si le sommeil se dégrade ou si une douleur apparaît, remplacez la séance par du repos. Ce plan est indicatif, pas médical.`,
  ].join('\n');
}

export function localCoachReply(question: string, data: DataSlice, today = todayISO()): string {
  const normalized = question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (/(plan|programme|semaine prochaine|organis)/.test(normalized)) {
    return localPlan(data, today);
  }
  if (/(sommeil|dormir|fatigue|fatigu|recuper)/.test(normalized)) {
    return sleepAdvice(data, today);
  }
  if (/(bilan|semaine|resume|progres|analyse)/.test(normalized)) {
    const seven = summary(data, today, 7);
    const readiness = readinessFor(data, today);
    const types = typeBreakdown(data, today, 7)
      .map((item) => `${item.type} ${Math.round(item.minutes)} min`)
      .join(', ');
    return [
      `Cette semaine : ${seven.sessions} séances, ${Math.round(seven.minutes)} min, ${seven.distanceKm} km, ${seven.activeDays} jours actifs.`,
      `Charge : ${seven.load} points sur 7 jours, ratio aigu/chronique ${readiness.ratio}.`,
      types ? `Répartition : ${types}.` : 'Aucune activité enregistrée sur la période.',
      readiness.score !== null
        ? `Forme du jour : ${readiness.score}/100. ${localTodayAdvice(data, today)}`
        : localTodayAdvice(data, today),
    ].join('\n');
  }
  if (/(poids|corps|masse|grasse|imc)/.test(normalized)) {
    const body = bodyMetrics(data);
    const trend = records(data, today).find((item) => item.label === 'Meilleure semaine');
    return `Dernier poids : ${fr(body.weight, 1)} kg${body.bmi ? `, IMC ${body.bmi} (${body.bmiLabel})` : ''}. ${
      body.delta === 0
        ? 'La tendance est stable.'
        : body.delta < 0
          ? `La dernière mesure est ${fr(Math.abs(body.delta), 1)} kg plus basse : une variation de 0,3 à 0,7 kg par semaine est un rythme raisonnable.`
          : `La dernière mesure est ${fr(body.delta, 1)} kg plus haute : une mesure isolée ne fait pas une tendance, regardez sur 3 à 4 semaines.`
    }${trend ? ` Repère d'entraînement : ${trend.value}.` : ''}`;
  }
  return localTodayAdvice(data, today);
}

/* ------------------------------------------------------------------- appels */

export async function askCoach(
  history: ChatMessage[],
  data: DataSlice,
  options: {
    enabled: boolean;
    signal?: AbortSignal;
    config?: AiConfig;
    plan?: TrainingPlan | null;
  }
): Promise<CoachReply> {
  const lastUser = [...history].reverse().find((message) => message.role === 'user');
  const question = lastUser?.content ?? '';
  if (!options.enabled) {
    return { text: localCoachReply(question, data), local: true };
  }

  const now = Date.now();
  if (now - lastRemoteAt < MIN_INTERVAL) {
    return { text: localCoachReply(question, data), local: true };
  }
  lastRemoteAt = now;

  try {
    const text = await callRemote(
      chatMessages(history, buildContext(data, todayISO(), options.plan)),
      options.config,
      options.signal
    );
    return { text, local: false };
  } catch {
    return { text: localCoachReply(question, data), local: true };
  }
}

export async function fetchBriefing(
  data: DataSlice,
  signal?: AbortSignal,
  config?: AiConfig,
  plan?: TrainingPlan | null
): Promise<string> {
  const messages: LlmMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: `Données agrégées :\n${buildContext(data, todayISO(), plan)}` },
    {
      role: 'user',
      content:
        "Rédige mon briefing du jour en 2 phrases maximum, puis 2 puces d'action concrètes. Commence par la forme, puis l'entraînement conseillé. Pas de titre.",
    },
  ];
  return callRemote(messages, config, signal);
}

export async function fetchPlan(
  data: DataSlice,
  signal?: AbortSignal,
  config?: AiConfig
): Promise<string> {
  const messages: LlmMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: `Données agrégées :\n${buildContext(data)}` },
    {
      role: 'user',
      content:
        'Propose un plan d’entraînement sur 7 jours (lundi à dimanche). Pour chaque jour : repos ou type, durée et intensité. Termine par une règle de prudence. 180 mots maximum, format liste simple.',
    },
  ];
  return callRemote(messages, config, signal);
}

/**
 * Commentaire du coach sur le plan long terme.
 *
 * Le plan lui-même est calculé localement (voir `lib/plan.ts`) : le modèle ne
 * reçoit que des choix fermés, jamais le texte libre de l'utilisateur, et ne
 * peut donc pas inventer une séance dangereuse qui serait exécutée.
 */
export async function fetchPlanNarrative(
  intake: PlanIntake,
  plan: TrainingPlan,
  config?: AiConfig,
  signal?: AbortSignal
): Promise<string> {
  const messages: LlmMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'system',
      content: `Plan calculé localement, à commenter sans le modifier :\n${planPromptContext(intake, plan)}`,
    },
    {
      role: 'user',
      content:
        'Explique en 3 paragraphes courts pourquoi ce plan est adapté, comment progresser semaine après semaine, et les deux signaux qui doivent faire lever le pied. 170 mots maximum, sans titre, sans tableau.',
    },
  ];
  return callRemote(messages, config, signal);
}

/* Cache de session : le palier gratuit de Pollinations limite le débit. */

export function readBriefingCache(date = todayISO()): string | null {
  try {
    return sessionStorage.getItem(`pc.brief.${date}`);
  } catch {
    return null;
  }
}

export function writeBriefingCache(text: string, date = todayISO()): void {
  try {
    sessionStorage.setItem(`pc.brief.${date}`, text);
  } catch {
    /* quota / mode privé : on ignore */
  }
}

export function clearBriefingCache(date = todayISO()): void {
  try {
    sessionStorage.removeItem(`pc.brief.${date}`);
  } catch {
    /* ignore */
  }
}
