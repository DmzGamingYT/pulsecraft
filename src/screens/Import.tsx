import { useRef, useState, type DragEvent } from 'react';
import type { ImportSummary, ParsedImport } from '../types';
import { SOURCE_LABELS } from '../types';
import { importInWorker } from '../lib/import/workerClient';
import { Icon } from '../components/Icons';

interface Imported {
  parsed: ParsedImport;
  summary: ImportSummary;
}

export function ImportScreen({
  onImport,
  hasData,
}: {
  onImport: (parsed: ParsedImport) => ImportSummary;
  hasData: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [results, setResults] = useState<Imported[]>([]);

  async function handle(files: File[]) {
    if (files.length === 0 || busy) return;
    const local = new AbortController();
    controller.current = local;
    setBusy(true);
    setError('');
    setProgress(0);
    setStep('Préparation…');
    try {
      // Laisse le navigateur peindre l'état avant de lancer le worker.
      await new Promise((resolve) => setTimeout(resolve, 30));
      const parsed = await importInWorker(files, {
        onStep: setStep,
        onProgress: setProgress,
        signal: local.signal,
      });
      const next: Imported[] = [];
      for (const item of parsed) {
        setStep(`Enregistrement de ${SOURCE_LABELS[item.source]}…`);
        const summary = onImport(item);
        next.push({ parsed: item, summary });
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      setResults(next);
      setStep('');
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') {
        setError('Import annulé. Le journal n’a pas été modifié.');
      } else {
        setError(cause instanceof Error ? cause.message : 'Import impossible.');
      }
      setStep('');
    } finally {
      controller.current = null;
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  function cancel() {
    controller.current?.abort();
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void handle([...event.dataTransfer.files]);
  }

  const totalActivities = results.reduce((sum, item) => sum + item.summary.activities, 0);
  const totalDays = results.reduce((sum, item) => sum + item.summary.days, 0);

  return (
    <section className="screen">
      <header className="screen__head">
        <p className="eyebrow">Importer</p>
        <h1 className="screen__title">
          Vos données, sans détour.
        </h1>          <p className="screen__lede">
            Battement lit les exports d’Apple Santé et de Samsung Health, et les fichiers
            GPX, TCX ou FIT de vos montres. Tout est analysé dans un worker, sur cet appareil :
            le fichier ne quitte pas le navigateur.
          </p>
      </header>

      <div className="import-grid">
        <div
          className={`drop${dragging ? ' is-over' : ''}${busy ? ' is-busy' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
        >
          <input
            ref={input}
            type="file"
            multiple
            accept=".zip,.xml,.csv,.txt,.gpx,.tcx,.fit,application/zip,text/xml,text/csv,application/gpx+xml,application/vnd.garmin.tcx+xml"
            className="visuallyhidden"
            id="import-files"
            onChange={(event) => void handle([...(event.target.files ?? [])])}
          />
          <span className="drop__icon">
            <Icon name={busy ? 'clock' : 'import'} size={26} />
          </span>
          <h2>{busy ? 'Lecture en cours…' : 'Déposez un export ici'}</h2>
          <p>
            {busy
              ? step || 'Analyse du fichier…'
              : 'export.zip d’Apple Santé, CSV Samsung Health, ou trace GPX / TCX / FIT — plusieurs fichiers acceptés.'}
          </p>
          {busy ? (
            <div className="import-progress">
              <div
                className="import-progress__track"
                role="progressbar"
                aria-label="Progression de l’import"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
              >
                <i style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <span>{Math.round(progress * 100)} %</span>
            </div>
          ) : null}
          <div className="drop__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => input.current?.click()}
              disabled={busy}
            >
              <Icon name="file" size={16} />
              {busy ? 'Patientez' : 'Choisir des fichiers'}
            </button>
            {busy ? (
              <button type="button" className="btn btn--ghost" onClick={cancel}>
                <Icon name="close" size={16} /> Annuler
              </button>
            ) : !hasData ? (
              <span className="drop__hint">Premier import ?</span>
            ) : null}
          </div>
          <ul className="drop__formats">
            <li>.zip</li>
            <li>.xml</li>
            <li>.csv</li>
            <li>.gpx · .tcx · .fit</li>
            <li>100 % local</li>
          </ul>
        </div>

        <aside className="card import-steps">
          <header className="card__head">
            <span className="card__label">Ce qui se passe</span>
            <span className="card__meta">hors ligne</span>
          </header>
          <ol>
            <li>
              <span>01</span>
              <p>Le fichier est ouvert dans l’onglet, sans requête réseau.</p>
            </li>
            <li>
              <span>02</span>
              <p>Les séances, pas et calories utiles sont extraits.</p>
            </li>
            <li>
              <span>03</span>
              <p>Les doublons sont ignorés : réimporter ne compte pas deux fois.</p>
            </li>
          </ol>
          <p className="import-steps__note">
            Le journal reste dans le stockage local du navigateur. Vider les
            données du site l’efface.
          </p>
        </aside>
      </div>

      {error ? (
        <p className="notice notice--error" role="alert">
          <Icon name="close" size={17} />
          <span>
            <strong>Import impossible.</strong> {error}
          </span>
        </p>
      ) : null}

      {results.length > 0 ? (
        <section className="import-result" aria-live="polite">
          <header className="import-result__head">
            <div>
              <p className="micro">Dernier import</p>
              <h2>
                {totalActivities} séance{totalActivities > 1 ? 's' : ''} et {totalDays} journée
                {totalDays > 1 ? 's' : ''} ajoutées.
              </h2>
            </div>
            <button type="button" className="textlink" onClick={() => setResults([])}>
              Effacer le résumé <Icon name="close" size={14} />
            </button>
          </header>
          <div className="import-result__grid">
            {results.map(({ parsed, summary }) => (
              <article className="result" key={`${parsed.source}-${parsed.fileName}`}>
                <div className="result__head">
                  <span className="result__source" data-source={parsed.source}>
                    {SOURCE_LABELS[parsed.source]}
                  </span>
                  <span className="result__file">{parsed.fileName || 'export'}</span>
                </div>
                <dl className="result__stats">
                  <div>
                    <dt>Séances</dt>
                    <dd>{summary.activities}</dd>
                  </div>
                  <div>
                    <dt>Journées</dt>
                    <dd>{summary.days}</dd>
                  </div>
                  <div>
                    <dt>Doublons</dt>
                    <dd>{summary.skipped}</dd>
                  </div>
                </dl>
                {summary.warnings.length > 0 ? (
                  <ul className="result__warnings">
                    {summary.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="result__ok">
                    <Icon name="check" size={15} /> Import terminé sans réserve.
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="sources">
        <article className="source-card" data-source="apple">
          <header className="source-card__head">
            <span className="source-card__badge" data-source="apple">
              Apple
            </span>
            <h2>Apple Santé</h2>
            <p>Un seul fichier, toute l’histoire.</p>
          </header>
          <ol className="source-card__steps">
            <li>
              Sur l’iPhone : <strong>Santé</strong> → votre photo de profil.
            </li>
            <li>
              <strong>Exporter toutes les données de santé</strong>, puis choisir où
              enregistrer l’archive.
            </li>
            <li>
              Déposer <code>export.zip</code> ici. Pas besoin de le décompresser.
            </li>
          </ol>
          <p className="source-card__note">
            L’archive peut peser plusieurs centaines de Mo. Battement lit le fichier
            par morceaux, sans le copier ailleurs qu’en mémoire.
          </p>
          <a
            className="btn btn--ghost btn--small source-card__link"
            href="https://support.apple.com/fr-fr/guide/iphone/iph2f9e1f0/ios"
            target="_blank"
            rel="noreferrer"
          >
            Guide Apple : exporter ses données <span aria-hidden="true">↗</span>
          </a>
        </article>

        <article className="source-card" data-source="samsung">
          <header className="source-card__head">
            <span className="source-card__badge" data-source="samsung">
              Samsung
            </span>
            <h2>Samsung Health</h2>
            <p>Un dossier de CSV, lisible tel quel.</p>
          </header>
          <ol className="source-card__steps">
            <li>
              Dans <strong>Samsung Health</strong> : menu ⋮ → <strong>Paramètres</strong>{' '}
              → <strong>Télécharger mes données</strong>.
            </li>
            <li>
              Demandez l’export lié à votre compte Samsung, puis téléchargez
              l’archive depuis le lien reçu.
            </li>
            <li>
              Déposez le ZIP entier, ou seulement les CSV{' '}
              <code>com.samsung.health.exercise.*.csv</code> et{' '}
              <code>…step_count…</code>.
            </li>
          </ol>
          <p className="source-card__note">
            Les noms de colonnes changent selon la langue et la version : l’import
            lit les en-têtes plutôt qu’un ordre fixe.
          </p>
          <a
            className="btn btn--ghost btn--small source-card__link"
            href="https://www.samsung.com/be_fr/apps/samsung-health/"
            target="_blank"
            rel="noreferrer"
          >
            Samsung Health : présentation et aide <span aria-hidden="true">↗</span>
          </a>
        </article>
      </div>

      <p className="privacy-note">
        <Icon name="heart" size={16} />
        Aucun compte, aucun serveur, aucune télémétrie. Vos exports servent une
        seule fois, à remplir le journal.
      </p>
    </section>
  );
}
