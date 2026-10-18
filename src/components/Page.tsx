import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from './Icon';

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="pagehead">
      <div className="pagehead__text">
        {eyebrow ? <p className="kicker">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {subtitle ? <p className="pagehead__sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="pagehead__actions">{actions}</div> : null}
    </header>
  );
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = '',
  id,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={`card ${className}`.trim()} id={id}>
      {title || action ? (
        <header className="card__head">
          <div>
            {typeof title === 'string' ? <h2>{title}</h2> : title}
            {subtitle ? <p className="card__sub">{subtitle}</p> : null}
          </div>
          {action ? <div className="card__action">{action}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function StatTile({
  label,
  value,
  unit,
  detail,
  icon,
  tone = 'var(--brand)',
  to,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  detail?: ReactNode;
  icon: IconName;
  tone?: string;
  to?: string;
}) {
  const content = (
    <>
      <span className="stat__icon" style={{ ['--tone' as string]: tone } as CSSProperties}>
        <Icon name={icon} size={18} />
      </span>
      <span className="stat__label">{label}</span>
      <span className="stat__value">
        {value}
        {unit ? <em>{unit}</em> : null}
      </span>
      {detail ? <span className="stat__detail">{detail}</span> : null}
      {to ? (
        <span className="stat__arrow" aria-hidden>
          <Icon name="arrow" size={15} />
        </span>
      ) : null}
    </>
  );

  if (to) {
    return (
      <Link className="stat" to={to}>
        {content}
      </Link>
    );
  }
  return <div className="stat">{content}</div>;
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: IconName;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty__icon">
        <Icon name={icon} size={24} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action ? <div className="empty__action">{action}</div> : null}
    </div>
  );
}

function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

/** Rendu sûr du texte du coach : gras et listes, jamais de HTML injecté. */
export function CoachText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: ReactNode[] = [];
  let listIndex = 0;

  const flush = () => {
    if (list.length === 0) return;
    blocks.push(<ul key={`ul-${listIndex}`}>{list}</ul>);
    list = [];
    listIndex += 1;
  };

  text.split('\n').forEach((raw, index) => {
    const line = raw.trim();
    if (!line) {
      flush();
      return;
    }
    if (/^[-•]\s+/.test(line)) {
      list.push(<li key={`li-${index}`}>{inline(line.replace(/^[-•]\s+/, ''))}</li>);
      return;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      list.push(<li key={`li-${index}`}>{inline(line.replace(/^\d+[.)]\s+/, ''))}</li>);
      return;
    }
    flush();
    blocks.push(<p key={`p-${index}`}>{inline(line)}</p>);
  });
  flush();

  return <div className="coachtext">{blocks}</div>;
}

export function SourceBadge({ source }: { source: string }) {
  if (source === 'manuel') return null;
  const labels: Record<string, string> = {
    apple: 'Apple Health',
    samsung: 'Samsung Health',
    gpx: 'GPX',
    demo: 'Démo',
  };
  return <span className={`sourcebadge sourcebadge--${source}`}>{labels[source] ?? source}</span>;
}
