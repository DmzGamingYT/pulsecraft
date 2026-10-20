import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { WORKOUT_META, WORKOUT_TYPES, type Meal, type WorkoutType } from '../types';
import { todayISO } from '../lib/dates';
import { fmtMinutes, fmtNumber } from '../lib/format';
import { workoutCalories } from '../lib/analytics';
import { usePulse } from '../store';
import { useUi } from '../lib/uiStore';
import { Icon } from './Icon';
import { Modal } from './Modal';

function Field({
  label,
  hint,
  children,
  wide,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`field${wide ? ' field--wide' : ''}`}>
      <span className="field__label">{label}</span>
      {children}
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
  min = 0,
  max,
  step = 'any',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function parseOptional(value: string): number | undefined {
  const normalized = value.replace(',', '.').trim();
  if (normalized === '') return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const emptyIf = (value: string) => (value.trim() === '' ? '' : value);

/* ------------------------------------------------------------------ séance */

export function WorkoutModal({
  open,
  onClose,
  defaultDate = todayISO(),
}: {
  open: boolean;
  onClose: () => void;
  defaultDate?: string;
}) {
  const addWorkout = usePulse((state) => state.addWorkout);
  const weight = usePulse((state) => state.body[0]?.weightKg ?? state.profile.weightKg);
  const notify = useUi((state) => state.notify);

  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('07:30');
  const [type, setType] = useState<WorkoutType>('Course');
  const [duration, setDuration] = useState('45');
  const [distance, setDistance] = useState('8');
  const [avgHr, setAvgHr] = useState('');
  const [maxHrValue, setMaxHrValue] = useState('');
  const [rpe, setRpe] = useState('6');
  const [calories, setCalories] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDate(defaultDate);
    setType('Course');
    setDuration('45');
    setDistance('8');
    setAvgHr('');
    setMaxHrValue('');
    setRpe('6');
    setCalories('');
    setNotes('');
    setError('');
  }, [open, defaultDate]);

  const meta = WORKOUT_META[type];
  const estimated = useMemo(() => {
    const minutes = parseOptional(duration) ?? 0;
    return workoutCalories(
      { id: '', date, type, durationMin: minutes, source: 'manuel' },
      weight
    );
  }, [date, duration, type, weight]);

  const submit = () => {
    const minutes = parseOptional(duration);
    if (!minutes || minutes <= 0) {
      setError('Indiquez une durée supérieure à zéro.');
      return;
    }
    if (minutes > 1440) {
      setError('Une séance ne peut pas dépasser 24 heures.');
      return;
    }
    addWorkout({
      date,
      time: time || undefined,
      type,
      durationMin: minutes,
      distanceKm: parseOptional(distance),
      avgHr: parseOptional(avgHr),
      maxHr: parseOptional(maxHrValue),
      rpe: parseOptional(rpe),
      calories: parseOptional(calories),
      notes: notes.trim() || undefined,
    });
    notify('Séance ajoutée à votre journal.');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouvelle séance"
      eyebrow="Journal d'entraînement"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn btn--primary" onClick={submit}>
            Ajouter la séance
          </button>
        </>
      }
    >
      <div className="typechips" role="group" aria-label="Type d’activité">
        {WORKOUT_TYPES.map((item) => (
          <button
            type="button"
            key={item}
            className={`typechip${item === type ? ' is-active' : ''}`}
            onClick={() => setType(item)}
            aria-pressed={item === type}
          >
            <Icon name={WORKOUT_META[item].icon} size={17} />
            {item}
          </button>
        ))}
      </div>

      <div className="formgrid">
        <Field label="Date">
          <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Heure">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <Field label="Durée (min)">
          <NumberInput value={duration} onChange={setDuration} placeholder="45" min={1} max={1440} />
        </Field>
        <Field label="Distance (km)" hint="Facultatif">
          <NumberInput value={distance} onChange={setDistance} placeholder="8" />
        </Field>
        <Field label="FC moyenne (bpm)">
          <NumberInput value={avgHr} onChange={setAvgHr} placeholder="148" min={30} max={240} />
        </Field>
        <Field label="FC max (bpm)">
          <NumberInput value={maxHrValue} onChange={setMaxHrValue} placeholder="176" min={30} max={240} />
        </Field>
        <Field label="Effort ressenti (1–10)">
          <NumberInput value={rpe} onChange={setRpe} placeholder="6" min={1} max={10} />
        </Field>
        <Field label="Calories" hint={`Estimé par le MET : ≈ ${fmtNumber(estimated)} kcal`}>
          <NumberInput value={calories} onChange={setCalories} placeholder={String(estimated)} />
        </Field>
        <Field label="Notes" wide>
          <textarea
            rows={2}
            value={notes}
            placeholder="Sensations, parcours, météo…"
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </div>

      <p className="formhint">
        <Icon name="spark" size={15} />
        {meta.label} · {meta.met} MET. Sans calories saisies, Battement utilise cette estimation.
      </p>
      {error ? <p className="formerror" role="alert">{error}</p> : null}
    </Modal>
  );
}

/* ------------------------------------------------------------------ sommeil */

function sleepMinutes(bedtime: string, wake: string): number {
  if (!bedtime || !wake) return 0;
  const [bh, bm] = bedtime.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  if (bh === undefined || bm === undefined || wh === undefined || wm === undefined) return 0;
  const start = bh * 60 + bm;
  let end = wh * 60 + wm;
  if (end <= start) end += 1440;
  return end - start;
}

export function SleepModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addSleep = usePulse((state) => state.addSleep);
  const notify = useUi((state) => state.notify);
  const [date, setDate] = useState(todayISO());
  const [bedtime, setBedtime] = useState('23:00');
  const [wake, setWake] = useState('07:00');
  const [quality, setQuality] = useState(4);
  const [deep, setDeep] = useState('');
  const [rem, setRem] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDate(todayISO());
    setBedtime('23:00');
    setWake('07:00');
    setQuality(4);
    setDeep('');
    setRem('');
    setError('');
  }, [open]);

  const duration = sleepMinutes(bedtime, wake);

  const submit = () => {
    if (duration <= 0) {
      setError('Vérifiez les heures de coucher et de réveil.');
      return;
    }
    if (duration > 16 * 60) {
      setError('Cette durée semble trop longue : vérifiez les heures.');
      return;
    }
    addSleep({
      date,
      durationMin: duration,
      quality,
      bedtime: bedtime || undefined,
      wake: wake || undefined,
      deepMin: parseOptional(deep),
      remMin: parseOptional(rem),
    });
    notify('Nuit enregistrée.');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enregistrer une nuit"
      eyebrow="Sommeil"
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn btn--primary" onClick={submit}>
            Enregistrer
          </button>
        </>
      }
    >
      <div className="formgrid formgrid--single">
        <Field label="Jour du réveil">
          <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="formgrid">
          <Field label="Coucher">
            <input type="time" value={bedtime} onChange={(e) => setBedtime(e.target.value)} />
          </Field>
          <Field label="Réveil">
            <input type="time" value={wake} onChange={(e) => setWake(e.target.value)} />
          </Field>
        </div>
        <div className="sleep-preview">
          <Icon name="moon" />
          <div>
            <strong>{fmtMinutes(duration)}</strong>
            <span>de sommeil calculé</span>
          </div>
        </div>
        <div className="field">
          <span className="field__label">Qualité ressentie</span>
          <div className="starrating" role="group" aria-label="Qualité du sommeil">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className={value <= quality ? 'is-on' : ''}
                onClick={() => setQuality(value)}
                aria-label={`${value} sur 5`}
                aria-pressed={value === quality}
              >
                ★
              </button>
            ))}
          </div>
        </div>
        <div className="formgrid">
          <Field label="Profond (min)" hint="Facultatif">
            <NumberInput value={deep} onChange={setDeep} placeholder="95" />
          </Field>
          <Field label="REM (min)" hint="Facultatif">
            <NumberInput value={rem} onChange={setRem} placeholder="105" />
          </Field>
        </div>
      </div>
      {error ? <p className="formerror" role="alert">{error}</p> : null}
    </Modal>
  );
}

/* -------------------------------------------------------------------- corps */

export function BodyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addBody = usePulse((state) => state.addBody);
  const latest = usePulse((state) => state.body[0]);
  const notify = useUi((state) => state.notify);
  const [date, setDate] = useState(todayISO());
  const [weight, setWeight] = useState('');
  const [fat, setFat] = useState('');
  const [muscle, setMuscle] = useState('');
  const [waist, setWaist] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDate(todayISO());
    setWeight(latest?.weightKg ? String(latest.weightKg) : '');
    setFat(latest?.bodyFatPct ? String(latest.bodyFatPct) : '');
    setMuscle(latest?.muscleKg ? String(latest.muscleKg) : '');
    setWaist(latest?.waistCm ? String(latest.waistCm) : '');
    setError('');
  }, [open, latest]);

  const submit = () => {
    const weightValue = parseOptional(weight);
    if (!weightValue || weightValue < 25 || weightValue > 350) {
      setError('Indiquez un poids valide (25 à 350 kg).');
      return;
    }
    addBody({
      date,
      weightKg: weightValue,
      bodyFatPct: parseOptional(fat),
      muscleKg: parseOptional(muscle),
      waistCm: parseOptional(waist),
    });
    notify('Mesure ajoutée.');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouvelle mesure"
      eyebrow="Corps"
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn btn--primary" onClick={submit}>
            Ajouter
          </button>
        </>
      }
    >
      <div className="formgrid formgrid--single">
        <Field label="Date">
          <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="formgrid">
          <Field label="Poids (kg)">
            <NumberInput value={weight} onChange={setWeight} placeholder="72,4" />
          </Field>
          <Field label="Masse grasse (%)" hint="Facultatif">
            <NumberInput value={fat} onChange={setFat} placeholder="18,5" />
          </Field>
          <Field label="Masse musculaire (kg)" hint="Facultatif">
            <NumberInput value={muscle} onChange={setMuscle} placeholder="34,2" />
          </Field>
          <Field label="Tour de taille (cm)" hint="Facultatif">
            <NumberInput value={waist} onChange={setWaist} placeholder="82" />
          </Field>
        </div>
      </div>
      {error ? <p className="formerror" role="alert">{error}</p> : null}
    </Modal>
  );
}

/* ---------------------------------------------------------------- nutrition */

export function MealModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addMeal = usePulse((state) => state.addMeal);
  const notify = useUi((state) => state.notify);
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('12:30');
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('500');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDate(todayISO());
    setName('');
    setKcal('500');
    setProtein('');
    setCarbs('');
    setFat('');
    setError('');
  }, [open]);

  const submit = () => {
    const kcalValue = parseOptional(kcal);
    if (name.trim().length < 2) {
      setError('Donnez un nom à ce repas.');
      return;
    }
    if (!kcalValue || kcalValue <= 0) {
      setError('Indiquez les calories du repas.');
      return;
    }
    const meal: Omit<Meal, 'id'> = {
      date,
      time: time || undefined,
      name: name.trim(),
      kcal: Math.round(kcalValue),
      protein: parseOptional(protein) ?? 0,
      carbs: parseOptional(carbs) ?? 0,
      fat: parseOptional(fat) ?? 0,
    };
    addMeal(meal);
    notify('Repas ajouté.');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajouter un repas"
      eyebrow="Nutrition"
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn btn--primary" onClick={submit}>
            Ajouter
          </button>
        </>
      }
    >
      <div className="formgrid formgrid--single">
        <Field label="Repas">
          <input
            type="text"
            value={name}
            placeholder="Poulet, riz et légumes"
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
          />
        </Field>
        <div className="formgrid">
          <Field label="Date">
            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Heure">
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <div className="formgrid">
          <Field label="Calories (kcal)">
            <NumberInput value={kcal} onChange={setKcal} placeholder="500" min={0} max={5000} />
          </Field>
          <Field label="Protéines (g)">
            <NumberInput value={protein} onChange={setProtein} placeholder="35" />
          </Field>
          <Field label="Glucides (g)">
            <NumberInput value={carbs} onChange={setCarbs} placeholder="55" />
          </Field>
          <Field label="Lipides (g)">
            <NumberInput value={fat} onChange={setFat} placeholder="18" />
          </Field>
        </div>
        <p className="formhint">
          <Icon name="water" size={15} /> Les macros sont facultatives ; seules les calories sont
          requises.
        </p>
      </div>
      {error ? <p className="formerror" role="alert">{error}</p> : null}
    </Modal>
  );
}

export { emptyIf };
