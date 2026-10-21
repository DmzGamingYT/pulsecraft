import type { Activity, DayLog, Sport } from '../types';
import { addDays, todayISO } from './dates';

const PLAN: { sport: Sport; title: string; minutes: number; km?: number; hr?: number }[] = [
  { sport: 'course', title: 'Footing au parc', minutes: 42, km: 7.4, hr: 152 },
  { sport: 'musculation', title: 'Haut du corps', minutes: 55, hr: 118 },
  { sport: 'velo', title: 'Boucle le long du canal', minutes: 68, km: 24.6, hr: 134 },
  { sport: 'course', title: 'Fractionné court', minutes: 34, km: 6.1, hr: 164 },
  { sport: 'musculation', title: 'Jambes et gainage', minutes: 48, hr: 124 },
  { sport: 'natation', title: 'Nage libre', minutes: 40, km: 1.5, hr: 138 },
  { sport: 'rando', title: 'Randonnée du dimanche', minutes: 105, km: 9.2, hr: 112 },
  { sport: 'yoga', title: 'Souplesse du soir', minutes: 25, hr: 84 },
];

/** Un journal d'exemple : six semaines, trois à quatre séances par semaine. */
export function makeDemoData(today = todayISO()): { activities: Activity[]; days: DayLog[] } {
  const activities: Activity[] = [];
  const days: DayLog[] = [];

  for (let offset = 41; offset >= 0; offset -= 1) {
    const day = addDays(today, -offset);
    const index = 41 - offset;
    const wave = Math.sin(index / 3.1) * 1800 + Math.cos(index / 6.7) * 900;
    const steps = Math.max(2400, Math.round(7600 + wave));
    days.push({
      date: day,
      steps,
      activeCalories: Math.round(240 + steps / 38),
    });

    const weekday = new Date(`${day}T12:00:00`).getDay();
    const restDay = weekday === 2 || weekday === 5;
    if (restDay) continue;
    if (index % 6 === 1 && weekday !== 0) continue;

    const item = PLAN[index % PLAN.length];
    if (!item) continue;
    const minutes = Math.max(18, item.minutes + Math.round(Math.sin(index) * 8));
    const distance = item.km ? Math.max(1, item.km + Math.sin(index / 2) * 0.9) : undefined;
    const hour = 7 + (index % 9);
    const minute = (index * 7) % 60;
    activities.push({
      id: `demo_${offset}`,
      date: `${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`,
      sport: item.sport,
      title: item.title,
      durationMin: minutes,
      distanceKm: distance ? Math.round(distance * 10) / 10 : undefined,
      calories: Math.round(minutes * (item.sport === 'velo' ? 7.2 : 9.4)),
      avgHr: item.hr,
      maxHr: item.hr ? item.hr + 18 : undefined,
      source: 'manuel',
      externalId: `demo:${offset}`,
    });
  }

  return { activities: activities.reverse(), days };
}
