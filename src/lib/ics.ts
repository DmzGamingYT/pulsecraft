/**
 * Le programme dans un agenda.
 *
 * Un fichier `.ics` suffit pour Apple Calendrier, Google Agenda ou Outlook :
 * pas de compte, pas de synchronisation, pas de serveur. Les séances sont
 * posées à 7 h du matin, heure locale, et durent ce qu'elles durent — c'est un
 * rendez-vous à déplacer, pas une contrainte.
 */

import type { PlanSession, Program } from './coach';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function stamp(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(
    date.getUTCHours(),
  )}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function icsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/** Les lignes iCalendar se replient au-delà de 75 octets, avec une espace. */
function fold(line: string): string {
  if (line.length <= 74) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 74));
  rest = rest.slice(74);
  while (rest.length > 0) {
    parts.push(` ${rest.slice(0, 73)}`);
    rest = rest.slice(73);
  }
  return parts.join('\r\n');
}

function startTime(date: string): string {
  return `${date.replace(/-/g, '')}T070000`;
}

function endTime(session: PlanSession): string {
  const [year, month, day] = session.date.split('-').map(Number);
  const start = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1, 7, 0, 0);
  const end = new Date(start.getTime() + session.minutes * 60_000);
  return `${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}T${pad(
    end.getHours(),
  )}${pad(end.getMinutes())}00`;
}

export function buildProgramIcs(program: Program, now = new Date()): string {
  const generated = stamp(now);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Battement//Programme//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Battement — programme',
  ];

  for (const week of program.weeks) {
    for (const [index, session] of week.sessions.entries()) {
      lines.push(
        'BEGIN:VEVENT',
        `UID:battement-${session.date}-${session.sport}-${week.index}-${index}@battement`,
        `DTSTAMP:${generated}`,
        `DTSTART:${startTime(session.date)}`,
        `DTEND:${endTime(session)}`,
        `SUMMARY:${icsText(session.title)}`,
        `CATEGORIES:${icsText(session.sport)}`,
        fold(
          `DESCRIPTION:${icsText(
            `${session.minutes} min · ${session.intensity}${
              session.kind === 'cle' ? ' · séance clé' : ''
            }\n${week.focus} · semaine ${week.index + 1} sur ${program.weeks.length}`,
          )}`,
        ),
        'TRANSP:TRANSPARENT',
        'END:VEVENT',
      );
    }
  }

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}
