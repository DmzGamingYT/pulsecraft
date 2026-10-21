/** Petites icônes au trait, dessinées plutôt qu'importées. */

export type IconName =
  | 'home'
  | 'activity'
  | 'import'
  | 'chart'
  | 'plus'
  | 'close'
  | 'sun'
  | 'moon'
  | 'settings'
  | 'trash'
  | 'upload'
  | 'check'
  | 'heart'
  | 'steps'
  | 'flame'
  | 'clock'
  | 'route'
  | 'arrow'
  | 'file'
  | 'search';

const PATHS: Record<IconName, string> = {
  home: 'M4 10.5 12 4l8 6.5V20h-5.5v-5h-5v5H4Z',
  activity: 'M3 12h3.2l2.1-6 3.4 12 2.6-8 1.8 2h5',
  import: 'M12 3v10m0 0 3.5-3.5M12 13 8.5 9.5M5 15v4h14v-4',
  chart: 'M5 20V10m5 10V4m5 16v-7m5 7V8',
  plus: 'M12 5v14M5 12h14',
  close: 'm6 6 12 12M18 6 6 18',
  sun: 'M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6ZM12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5 7 7M17 17l1.5 1.5M18.5 5.5 17 7M7 17l-1.5 1.5',
  moon: 'M20 14.2A8.2 8.2 0 0 1 9.8 4a8.2 8.2 0 1 0 10.2 10.2Z',
  settings:
    'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm7.4-3.2a7.7 7.7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a8 8 0 0 0-2-1.2L14.5 3h-5l-.4 2.7a8 8 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5a7.7 7.7 0 0 0 0 2.4l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 2 1.2l.4 2.7h5l.4-2.7a8 8 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z',
  trash: 'M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5M14 11v5',
  upload: 'M12 16V4m0 0L8 8m4-4 4 4M4 16v4h16v-4',
  check: 'm5 12.5 4.2 4.2L19 7',
  heart: 'M12 20s-7-4.4-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7 2.7C19 15.6 12 20 12 20Z',
  steps: 'M8 4v6m0 0-3 4h6l-3-4Zm8 6v6m0 0-3 4h6l-3-4Z',
  flame: 'M12 21c4 0 6-2.6 6-6 0-4.5-4-6-4-9 0 0-2 1.5-2 4 0 1.7-1 2-1 2s-1.5-1-1.5-3C7 11 6 12.5 6 15c0 3.4 2 6 6 6Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3 2',
  route: 'M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12-12a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7',
  arrow: 'M5 12h14m0 0-5-5m5 5-5 5',
  file: 'M6 3h8l4 4v14H6Zm8 0v5h4M9 13h6M9 17h4',
  search: 'M10.8 18.4a7.7 7.7 0 1 0 0-15.4 7.7 7.7 0 0 0 0 15.4Zm5.6-2.1 4.6 4.6',
};

export function Icon({
  name,
  size = 18,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** La marque : un battement de cœur qui devient une ligne de journal. */
export function BattementMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path
        d="M5 17h5l2.2-6 3.4 12 3-8 1.7 2H27"
        stroke="#fffaf2"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
