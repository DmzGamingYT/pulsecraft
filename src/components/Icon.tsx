import type { SVGProps } from 'react';

export type IconName =
  | 'today'
  | 'activity'
  | 'sleep'
  | 'body'
  | 'nutrition'
  | 'coach'
  | 'progress'
  | 'settings'
  | 'plus'
  | 'close'
  | 'chevron'
  | 'trash'
  | 'water'
  | 'flame'
  | 'heart'
  | 'clock'
  | 'route'
  | 'download'
  | 'upload'
  | 'spark'
  | 'check'
  | 'alert'
  | 'run'
  | 'walk'
  | 'bike'
  | 'swim'
  | 'strength'
  | 'hiit'
  | 'yoga'
  | 'row'
  | 'moon'
  | 'sun'
  | 'menu'
  | 'send'
  | 'target'
  | 'arrow';

const paths: Record<IconName, React.ReactNode> = {
  today: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
    </>
  ),
  activity: <path d="M2.5 12h4l2.2-6 3.2 12 2.8-9 1.6 3h5.2" />,
  sleep: <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z" />,
  body: (
    <>
      <path d="M5 20a7 7 0 0 1 14 0" />
      <circle cx="12" cy="7.5" r="3.5" />
    </>
  ),
  nutrition: (
    <>
      <path d="M12 8c-4.2 0-6.5 2.4-6.5 6 0 3.2 2.6 5.5 6.5 5.5s6.5-2.3 6.5-5.5c0-3.6-2.3-6-6.5-6Z" />
      <path d="M12 8c0-2.8 1.5-4.5 4-5" />
    </>
  ),
  coach: (
    <>
      <path d="M12 3l1.7 4.6L18.5 9l-4.8 1.5L12 15l-1.7-4.5L5.5 9l4.8-1.4Z" />
      <path d="M18.5 15.5l.8 2.2 2.2.8-2.2.7-.8 2.3-.7-2.3-2.3-.7 2.3-.8Z" />
    </>
  ),
  progress: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  trash: (
    <>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
      <path d="M10 11v5M14 11v5" />
    </>
  ),
  water: <path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11Z" />,
  flame: (
    <path d="M12 22c4 0 7-2.8 7-6.7 0-4.4-4.3-7.5-5.6-12.3-2 2.4-2.8 4.4-2.6 6.4-1.2-.6-2-1.7-2.2-3.1C6.7 8.6 5 11.3 5 15.3 5 19.2 8 22 12 22Z" />
  ),
  heart: <path d="M12 20s-7-4.3-7-9.6A4 4 0 0 1 12 7a4 4 0 0 1 7 3.4C19 15.7 12 20 12 20Z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.3 2" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <path d="M8.5 18h3a3 3 0 0 0 0-6h-1a3 3 0 0 1 0-6h5" />
    </>
  ),
  download: <path d="M12 3v11m0 0 4-4m-4 4-4-4M4 17v3h16v-3" />,
  upload: <path d="M12 16V5m0 0 4 4m-4-4L8 9M4 17v3h16v-3" />,
  spark: (
    <path d="M12 2.5l2 6.2 6.2 2-6.2 2-2 6.3-2-6.3-6.2-2 6.2-2Z" />
  ),
  check: <path d="m4 12.5 5 5L20 6.5" />,
  alert: (
    <>
      <path d="M12 4 2.8 20h18.4Z" />
      <path d="M12 9v5M12 17.2v.3" />
    </>
  ),
  run: (
    <>
      <circle cx="15.5" cy="4.5" r="2" />
      <path d="M12.5 21l1.2-5.4-3.2-3.1 1-4.6 4 2.2 2.5 2.8M8.5 13l-2 3M5 20l3-4.5M13.7 15.6l3.4 5" />
    </>
  ),
  walk: (
    <>
      <circle cx="13" cy="4.5" r="2" />
      <path d="M11 21l1.5-6-2.5-2.5 1-5 3 2.5 2 2.5M7 14l-1 3M9 21l1.5-3.5M14.5 15.5 17 20" />
    </>
  ),
  bike: (
    <>
      <circle cx="5.5" cy="17.5" r="3.5" />
      <circle cx="18.5" cy="17.5" r="3.5" />
      <path d="M8 17.5h6l-2-7h-3M14 10.5l3 7M12 6h3" />
    </>
  ),
  swim: (
    <>
      <circle cx="7" cy="7" r="2" />
      <path d="m9 8 5 4 5-1M3 17c2 0 2.5-1.5 4.5-1.5S10 17 12 17s2.5-1.5 4.5-1.5S19 17 21 17M3 21c2 0 2.5-1.5 4.5-1.5S10 21 12 21s2.5-1.5 4.5-1.5S19 21 21 21" />
    </>
  ),
  strength: <path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12" />,
  hiit: (
    <>
      <path d="M13 2 4 14h6l-1 8 9-12h-6Z" />
    </>
  ),
  yoga: (
    <>
      <circle cx="12" cy="5" r="2" />
      <path d="M12 8v4m0 0-5 3m5-3 5 3M4 19c2.5-1.6 5.3-2 8-2s5.5.4 8 2" />
    </>
  ),
  row: (
    <>
      <path d="M3 18h18M6 14l6-8 6 8M9 14h6" />
      <circle cx="12" cy="4" r="1.6" />
    </>
  ),
  moon: <path d="M19.5 14A7.5 7.5 0 0 1 10 4.5 7.7 7.7 0 1 0 19.5 14Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  send: <path d="M3 11.5 21 4l-7.5 17-2.5-7Z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
};

export function Icon({
  name,
  size = 20,
  ...rest
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}

export function PulseMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="pulse-mark"
    >
      <rect width="32" height="32" rx="9" fill="currentColor" opacity="0.1" />
      <path
        d="M4 17h5l2-7 3.5 13 3-16 2.5 10H28"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
