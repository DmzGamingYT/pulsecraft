import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePulse } from '../store';
import { useUi } from '../lib/uiStore';
import { calorieSeries, nutritionToday } from '../lib/analytics';
import { todayISO } from '../lib/dates';
import { fmtNumber } from '../lib/format';
import { PageHeader, SectionCard, StatTile, EmptyState } from '../components/Page';
import { BarChart, ProgressBar } from '../components/Charts';
import { MealModal } from '../components/Forms';
import { Icon } from '../components/Icon';

const PRESETS = [
  { ml: 250, label: 'Verre' },
  { ml: 500, label: 'Gourde' },
  { ml: 750, label: 'Grande gourde' },
];

function MacroRow({
  label,
  value,
  target,
  color,
}: {
  label: string;
  value: number;
  target: number;
  color: string;
}) {
  return (
    <div className="macro">
      <div className="macro__head">
        <span>{label}</span>
        <strong>
          {fmtNumber(value)} <em>/ {fmtNumber(target)} g</em>
        </strong>
      </div>
      <ProgressBar value={value} goal={target} color={color} label={`${label} du jour`} />
    </div>
  );
}

export function NutritionPage() {
  const data = usePulse();
  const addWater = usePulse((state) => state.addWater);
  const removeMeal = usePulse((state) => state.removeMeal);
  const notify = useUi((state) => state.notify);
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const date = todayISO();
  const nutrition = nutritionToday(data, date);
  const series = calorieSeries(data, date, 7);
  const goal = data.goals.dailyKcal;
  const remaining = Math.round(goal - nutrition.kcal);
  const waterGoal = data.goals.waterMl;
  const waterLeft = Math.max(0, waterGoal - nutrition.water);
  const proteinTarget = Math.round((goal * 0.3) / 4);
  const carbsTarget = Math.round((goal * 0.45) / 4);
  const fatTarget = Math.round((goal * 0.25) / 9);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Énergie"
        title={
          <>
            Nutrition<span className="title-dot">.</span>
          </>
        }
        subtitle={
          nutrition.meals.length > 0
            ? `${fmtNumber(nutrition.kcal)} kcal aujourd’hui · ${nutrition.meals.length} repas noté${nutrition.meals.length > 1 ? 's' : ''}`
            : 'Notez l’essentiel — calories et macros — sans peser chaque aliment au gramme.'
        }
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setOpen(true)}>
            <Icon name="plus" size={17} /> Repas
          </button>
        }
      />

      <div className="stats-grid">
        <StatTile label="Calories" value={fmtNumber(nutrition.kcal)} unit="kcal" icon="flame" tone="var(--coral)" detail={`objectif ${fmtNumber(goal)} kcal`} />
        <StatTile label="Protéines" value={fmtNumber(nutrition.protein)} unit="g" icon="strength" tone="var(--violet)" detail={`cible ${fmtNumber(proteinTarget)} g`} />
        <StatTile label="Eau" value={(nutrition.water / 1000).toFixed(2).replace('.', ',')} unit="L" icon="water" tone="var(--cyan)" detail={`reste ${fmtNumber(waterLeft)} ml`} />
        <StatTile label="Repas" value={nutrition.meals.length} icon="nutrition" tone="var(--brand)" detail="aujourd’hui" />
      </div>

      <div className="nutrition-grid">
        <SectionCard
          title="Énergie du jour"
          subtitle={remaining >= 0 ? `Encore ${fmtNumber(remaining)} kcal disponibles` : `${fmtNumber(Math.abs(remaining))} kcal au-dessus de l’objectif`}
          action={
            <Link to="/reglages" className="textlink">
              Objectif <Icon name="arrow" size={15} />
            </Link>
          }
        >
          <div className="energy">
            <div className="energy__big">
              <strong>{fmtNumber(nutrition.kcal)}</strong>
              <span>kcal</span>
            </div>
            <div className="energy__bar">
              <ProgressBar value={nutrition.kcal} goal={goal} color="var(--coral)" label="Calories du jour" />
              <div className="energy__scale">
                <span>0 kcal</span>
                <span>Objectif {fmtNumber(goal)} kcal</span>
              </div>
            </div>
          </div>
          <div className="macros">
            <MacroRow label="Protéines" value={nutrition.protein} target={proteinTarget} color="var(--violet)" />
            <MacroRow label="Glucides" value={nutrition.carbs} target={carbsTarget} color="var(--cyan)" />
            <MacroRow label="Lipides" value={nutrition.fat} target={fatTarget} color="var(--amber)" />
          </div>
        </SectionCard>

        <SectionCard
          title="Hydratation"
          subtitle={`${fmtNumber(nutrition.water)} / ${fmtNumber(waterGoal)} ml`}
          className="watercard"
        >
          <div className="waterwave" aria-hidden>
            <span style={{ height: `${Math.min(100, (nutrition.water / Math.max(1, waterGoal)) * 100)}%` }} />
          </div>
          <div className="watercard__value">
            <strong>{(nutrition.water / 1000).toFixed(2).replace('.', ',')}</strong>
            <span>litres</span>
          </div>
          <p className="watercard__left">
            {waterLeft > 0 ? `Encore ${fmtNumber(waterLeft)} ml` : 'Objectif atteint, bravo.'}
          </p>
          <div className="watercard__actions">
            {PRESETS.map((preset) => (
              <button
                key={preset.ml}
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => {
                  addWater(preset.ml);
                  notify(`+ ${fmtNumber(preset.ml)} ml`, 'success');
                }}
              >
                +{preset.ml} ml
              </button>
            ))}
          </div>
          <div className="watercard__foot">
            <button
              type="button"
              className="textlink"
              onClick={() => {
                addWater(-250);
                notify('− 250 ml', 'info');
              }}
            >
              Retirer 250 ml
            </button>
            <span>{fmtNumber(nutrition.water)} ml cumulés</span>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Calories des 7 derniers jours"
        subtitle="Repas notés uniquement"
        className="chartcard"
      >
        <BarChart
          points={series}
          color="var(--coral)"
          height={150}
          goal={goal}
          formatValue={(value) => `${fmtNumber(value)} kcal`}
          label="Calories des 7 derniers jours"
          emptyLabel="Notez un repas pour démarrer le suivi"
          highlightLast
        />
      </SectionCard>

      <SectionCard
        title="Repas du jour"
        subtitle={nutrition.meals.length ? `${nutrition.meals.length} repas` : 'Aucun repas noté'}
        action={
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setOpen(true)}>
            <Icon name="plus" size={15} /> Ajouter
          </button>
        }
      >
        {nutrition.meals.length === 0 ? (
          <EmptyState
            icon="nutrition"
            title="Rien de noté aujourd’hui"
            text="Un repas peut être noté en 10 secondes : un nom, des calories, et les macros si vous les connaissez."
            action={
              <button type="button" className="btn btn--primary btn--small" onClick={() => setOpen(true)}>
                Ajouter un repas
              </button>
            }
          />
        ) : (
          <ul className="meals">
            {nutrition.meals.map((meal) => (
              <li className="meal" key={meal.id}>
                <span className="meal__time">{meal.time ?? '—'}</span>
                <span className="meal__name">
                  <strong>{meal.name}</strong>
                  <em>
                    {fmtNumber(meal.protein)} g P · {fmtNumber(meal.carbs)} g G · {fmtNumber(meal.fat)} g L
                  </em>
                </span>
                <span className="meal__kcal">
                  <strong>{fmtNumber(meal.kcal)}</strong>
                  <em>kcal</em>
                </span>
                {confirmId === meal.id ? (
                  <span className="meal__confirm">
                    <button
                      type="button"
                      className="btn btn--danger btn--small"
                      onClick={() => {
                        removeMeal(meal.id);
                        setConfirmId(null);
                        notify('Repas supprimé.', 'info');
                      }}
                    >
                      Oui
                    </button>
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => setConfirmId(null)}>
                      Non
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="iconbtn iconbtn--danger"
                    onClick={() => setConfirmId(meal.id)}
                    aria-label={`Supprimer ${meal.name}`}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <p className="pagenote">
        Les objectifs de macros sont une répartition par défaut (30 % protéines, 45 % glucides,
        25 % lipides). Aucun conseil nutritionnel personnalisé n’est délivré : pour un besoin
        particulier, consultez un professionnel.
      </p>

      <MealModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
