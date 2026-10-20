import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Icon } from './Icon';
import { usePulse } from '../store';
import { useUi } from '../lib/uiStore';
import { EQUIPMENT_LABELS, EXPERIENCE_LABELS, GOALS, rebuildPlan } from '../lib/plan';
import { todayISO } from '../lib/dates';
import type {
  Equipment,
  Experience,
  GoalKind,
  PlanIntake,
  TrainingPlan,
} from '../types';

/**
 * Ajustement rapide du plan : objectif, matériel, niveau, fréquence et durée.
 *
 * C'est le même moteur que le bilan, mais sans redemander le profil ni le
 * fournisseur IA. Le calendrier existant est conservé, et les séances déjà
 * cochées le restent à la même date ; le journal n'est jamais modifié.
 */
export function PlanAdjust({
  open,
  onClose,
  plan,
}: {
  open: boolean;
  onClose: () => void;
  plan: TrainingPlan | null;
}) {
  const applyTrainingPlan = usePulse((state) => state.applyTrainingPlan);
  const sessionRun = usePulse((state) => state.sessionRun);
  const openWizard = useUi((state) => state.openWizard);
  const notify = useUi((state) => state.notify);
  const [draft, setDraft] = useState<PlanIntake | null>(null);

  useEffect(() => {
    if (!open || !plan) return;
    setDraft(plan.intake);
  }, [open, plan]);

  if (!plan || !draft) return null;

  const patch = (values: Partial<PlanIntake>) =>
    setDraft((current) => (current ? { ...current, ...values } : current));

  const changed =
    draft.goal !== plan.intake.goal ||
    draft.equipment !== plan.intake.equipment ||
    draft.experience !== plan.intake.experience ||
    draft.daysPerWeek !== plan.intake.daysPerWeek ||
    draft.sessionMin !== plan.intake.sessionMin;

  const apply = () => {
    if (!changed) {
      onClose();
      return;
    }
    const next = rebuildPlan(plan, draft, { today: todayISO() });
    applyTrainingPlan(next);
    notify('Plan ajusté. Le journal et les séances cochées sont conservés.', 'success');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Plan personnel"
      title="Ajuster le plan"
      footer={
        <>
          <button type="button" className="btn btn--ghost btn--small" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="btn btn--primary btn--small"
            onClick={apply}
            disabled={!changed}
            title={changed ? 'Recalculer les séances à venir' : 'Aucun changement à appliquer'}
          >
            <Icon name="check" size={15} /> Mettre à jour
          </button>
        </>
      }
    >
      <p className="padj__intro">
        Le profil, le sommeil et les notes restent en place. Le calendrier est conservé et les
        séances déjà cochées restent dans le journal ; seules les séances à venir sont recalculées.
      </p>

      {plan.preset === 'monthly-muscle' ? (
        <p className="sess__notice">
          <Icon name="alert" size={14} /> Mettre à jour remplace le programme du mois par un plan
          calculé sur ces réponses. Pour garder le rythme du mois, fermez cette fenêtre et utilisez
          « Enchaîner le mois » à la fin du bloc.
        </p>
      ) : null}

      {sessionRun ? (
        <p className="sess__notice">
          <Icon name="alert" size={14} />          Une séance guidée est en cours. Mettre à jour le plan
          l’interrompra : terminez-la ou abandonnez-la avant de changer le programme.
        </p>
      ) : null}

      <div className="onb-choice">
        <span className="field__label">Objectif</span>
        <div className="onb-choice__row">
          {(Object.keys(GOALS) as GoalKind[]).map((goal) => (
            <button
              key={goal}
              type="button"
              className={draft.goal === goal ? 'is-active' : ''}
              aria-pressed={draft.goal === goal}
              onClick={() => patch({ goal })}
            >
              {GOALS[goal].label}
            </button>
          ))}
        </div>
      </div>

      <div className="onb-choice">
        <span className="field__label">Matériel disponible</span>
        <div className="onb-choice__row">
          {(Object.keys(EQUIPMENT_LABELS) as Equipment[]).map((equipment) => (
            <button
              key={equipment}
              type="button"
              className={draft.equipment === equipment ? 'is-active' : ''}
              aria-pressed={draft.equipment === equipment}
              onClick={() => patch({ equipment })}
            >
              {EQUIPMENT_LABELS[equipment]}
            </button>
          ))}
        </div>
      </div>

      <div className="onb-choice">
        <span className="field__label">Niveau actuel</span>
        <div className="onb-choice__row">
          {(Object.keys(EXPERIENCE_LABELS) as Experience[]).map((experience) => (
            <button
              key={experience}
              type="button"
              className={draft.experience === experience ? 'is-active' : ''}
              aria-pressed={draft.experience === experience}
              onClick={() => patch({ experience })}
            >
              {EXPERIENCE_LABELS[experience]}
            </button>
          ))}
        </div>
      </div>

      <div className="onb-slider padj__slider">
        <div className="onb-slider__head">
          <span>Séances par semaine</span>
          <strong>{draft.daysPerWeek}</strong>
        </div>
        <input
          type="range"
          min={2}
          max={6}
          step={1}
          value={draft.daysPerWeek}
          aria-label="Séances par semaine"
          onChange={(event) => patch({ daysPerWeek: Number(event.target.value) })}
        />
        <div className="onb-slider__ticks" aria-hidden>
          {[2, 3, 4, 5, 6].map((value) => (
            <span key={value}>{value}</span>
          ))}
        </div>
      </div>

      <div className="onb-slider padj__slider">
        <div className="onb-slider__head">
          <span>Durée de base d’une séance</span>
          <strong>{draft.sessionMin} min</strong>
        </div>
        <input
          type="range"
          min={20}
          max={120}
          step={5}
          value={draft.sessionMin}
          aria-label="Durée d’une séance en minutes"
          onChange={(event) => patch({ sessionMin: Number(event.target.value) })}
        />
        <span className="field__hint">
          Les semaines de charge ajoutent quelques minutes ; les semaines allégées en retirent.
        </span>
      </div>

      <p className="onb-note">
        <Icon name="heart" size={14} /> Ces réglages restent sur cet appareil, comme le reste du
        bilan.
      </p>

      <button
        type="button"
        className="textlink padj__full"
        onClick={() => {
          onClose();
          openWizard();
        }}
      >
        Refaire le bilan complet (profil, sommeil, IA) <Icon name="arrow" size={14} />
      </button>
    </Modal>
  );
}
