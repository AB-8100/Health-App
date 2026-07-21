import React from 'react';
import themes from '../data/themes';
import { supabase } from '../utils/supabase';

// ── Helpers ────────────────────────────────────────────────────────────────────

function ftInToCm(feet, inches) {
  return Math.round(((Number(feet) || 0) * 30.48) + ((Number(inches) || 0) * 2.54));
}

function cmToFtIn(cm) {
  const totalIn = cm / 2.54;
  return { feet: Math.floor(totalIn / 12), inches: Math.round(totalIn % 12) };
}

function lbsToKg(lbs) { return Math.round(Number(lbs) * 0.453592 * 10) / 10; }
function kgToLbs(kg)   { return Math.round(Number(kg) * 2.20462 * 10) / 10; }

function ageFromDob(dob) {
  if (!dob) return null;
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// ── ProfileSetupScreen ─────────────────────────────────────────────────────────

export function ProfileSetupScreen({ width = 390, height = 820, theme = 'light', userId, onComplete }) {
  const t = themes[theme];

  const [units, setUnits] = React.useState('metric'); // 'metric' | 'imperial'
  const [form, setForm] = React.useState({
    name: '',
    dob: '',
    sex: '',
    heightCm: '',
    heightFt: '',
    heightIn: '',
    weightKg: '',
    weightLbs: '',
  });
  const [errors, setErrors] = React.useState({});
  const [submitting, setSubmitting] = React.useState(false);
  const [globalError, setGlobalError] = React.useState('');

  const update = (patch) => {
    setForm(f => ({ ...f, ...patch }));
    setErrors(e => {
      const next = { ...e };
      Object.keys(patch).forEach(k => delete next[k]);
      return next;
    });
    setGlobalError('');
  };

  // Sync displayed height/weight when toggling units
  const switchUnits = (next) => {
    if (next === units) return;
    if (next === 'imperial') {
      const cm = Number(form.heightCm);
      const kg = Number(form.weightKg);
      const { feet, inches } = cm ? cmToFtIn(cm) : { feet: '', inches: '' };
      setForm(f => ({
        ...f,
        heightFt: cm ? String(feet) : '',
        heightIn: cm ? String(inches) : '',
        weightLbs: kg ? String(kgToLbs(kg)) : '',
      }));
    } else {
      const cm = (form.heightFt || form.heightIn) ? ftInToCm(form.heightFt, form.heightIn) : '';
      const kg = form.weightLbs ? lbsToKg(form.weightLbs) : '';
      setForm(f => ({
        ...f,
        heightCm: cm ? String(cm) : '',
        weightKg: kg ? String(kg) : '',
      }));
    }
    setUnits(next);
    setErrors({});
  };

  const validate = () => {
    const errs = {};

    if (!form.name.trim()) errs.name = 'Please enter your display name.';

    if (!form.dob) {
      errs.dob = 'Please enter your date of birth.';
    } else {
      const age = ageFromDob(form.dob);
      if (age < 13) errs.dob = 'You must be at least 13 to use Forma.';
      if (age > 120) errs.dob = 'Please enter a valid date of birth.';
      if (new Date(form.dob) > new Date()) errs.dob = 'Date of birth cannot be in the future.';
    }

    if (!form.sex) errs.sex = 'Please select an option.';

    if (units === 'metric') {
      const h = Number(form.heightCm);
      if (!form.heightCm || isNaN(h) || h < 50 || h > 300) errs.heightCm = 'Enter height between 50–300 cm.';
      const w = Number(form.weightKg);
      if (!form.weightKg || isNaN(w) || w < 20 || w > 500) errs.weightKg = 'Enter weight between 20–500 kg.';
    } else {
      const ft = Number(form.heightFt);
      const inches = Number(form.heightIn || 0);
      if (!form.heightFt || isNaN(ft) || ft < 1 || ft > 9) errs.heightFt = 'Enter a valid height.';
      if (isNaN(inches) || inches < 0 || inches > 11) errs.heightIn = 'Inches must be 0–11.';
      const lbs = Number(form.weightLbs);
      if (!form.weightLbs || isNaN(lbs) || lbs < 44 || lbs > 1100) errs.weightLbs = 'Enter weight between 44–1100 lbs.';
    }

    return errs;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true);
    setGlobalError('');

    try {
      const heightCm = units === 'metric'
        ? Number(form.heightCm)
        : ftInToCm(form.heightFt, form.heightIn);
      const weightKg = units === 'metric'
        ? Number(form.weightKg)
        : lbsToKg(form.weightLbs);
      const age = ageFromDob(form.dob);
      const bmi = Math.round((weightKg / ((heightCm / 100) ** 2)) * 10) / 10;

      const profileRow = {
        user_id:    userId,
        name:       form.name.trim(),
        age,
        sex:        form.sex,
        height_cm:  heightCm,
        weight_kg:  weightKg,
        bmi,
        extra:      { dateOfBirth: form.dob },
        updated_at: new Date().toISOString(),
      };

      const settingsRow = {
        user_id:      userId,
        weight_unit:  units === 'metric' ? 'kg' : 'lbs',
        height_unit:  units === 'metric' ? 'cm' : 'ft',
        updated_at:   new Date().toISOString(),
      };

      const [{ error: profileErr }, { error: settingsErr }] = await Promise.all([
        supabase.from('profiles').upsert(profileRow, { onConflict: 'user_id' }),
        supabase.from('user_settings').upsert(settingsRow, { onConflict: 'user_id' }),
      ]);

      if (profileErr) throw profileErr;
      if (settingsErr) throw settingsErr;

      onComplete({
        profile: {
          name:      form.name.trim(),
          age,
          sex:       form.sex,
          height:    heightCm,
          weight:    weightKg,
          bmi,
          dateOfBirth: form.dob,
        },
        userSettings: {
          weightUnit: units === 'metric' ? 'kg' : 'lbs',
          heightUnit: units === 'metric' ? 'cm' : 'ft',
        },
      });
    } catch (e) {
      setGlobalError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const accent = t.accent;
  const isImperial = units === 'imperial';

  return (
    <div style={{
      width, height, background: t.bg, fontFamily: t.sans, color: t.text,
      display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
    }}>
      {/* Ambient glows */}
      <div style={{
        position: 'absolute', top: -60, right: -60, width: 260, height: 260, borderRadius: '50%',
        background: `radial-gradient(circle, ${accent}22, transparent 65%)`, pointerEvents: 'none',
      }}/>
      <div style={{
        position: 'absolute', bottom: -80, left: -80, width: 280, height: 280, borderRadius: '50%',
        background: `radial-gradient(circle, #6D4AAF18, transparent 65%)`, pointerEvents: 'none',
      }}/>

      {/* Status bar */}
      <div style={{
        height: 44, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '0 22px 8px', fontSize: 14, fontWeight: 600, flexShrink: 0,
      }}>
        <span>9:41</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 11 }}>
          <span>●●●</span><span>📶</span><span>🔋</span>
        </div>
      </div>

      {/* Header */}
      <div style={{ padding: '20px 24px 16px', flexShrink: 0 }}>
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              height: 3, flex: i === 0 ? 2 : 1, borderRadius: 2,
              background: i === 0 ? accent : t.border2,
              transition: 'background .3s',
            }}/>
          ))}
        </div>

        <div style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: t.text3, fontWeight: 500, marginBottom: 6 }}>
          Step 1 of 3
        </div>
        <div style={{ fontFamily: t.serif, fontSize: 26, color: t.text, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          Set up your profile
        </div>
        <div style={{ fontSize: 13, color: t.text2, marginTop: 6, lineHeight: 1.5 }}>
          This helps Forma personalise your experience.
        </div>
      </div>

      {/* Scrollable form */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 32px' }} className="phone-scroll">

        {/* Units toggle */}
        <div style={{ marginBottom: 20 }}>
          <FieldLabel>Units</FieldLabel>
          <div style={{
            display: 'flex', background: t.surface, borderRadius: 12, padding: 3,
            border: `1px solid ${t.border}`,
          }}>
            {[['metric', 'Metric (kg / cm)'], ['imperial', 'Imperial (lbs / ft)']].map(([val, label]) => (
              <button key={val} onClick={() => switchUnits(val)} style={{
                flex: 1, padding: '9px 8px', borderRadius: 10,
                background: units === val ? t.bg : 'transparent',
                border: units === val ? `1px solid ${t.border}` : '1px solid transparent',
                color: units === val ? t.text : t.text2,
                fontFamily: t.sans, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                boxShadow: units === val ? '0 1px 4px rgba(0,0,0,0.07)' : 'none',
                transition: 'all .15s',
              }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Display name */}
        <div style={{ marginBottom: 16 }}>
          <FieldLabel>Display name</FieldLabel>
          <input
            value={form.name}
            onChange={e => update({ name: e.target.value })}
            placeholder="e.g. Alex"
            autoComplete="name"
            style={inputStyle(t, errors.name)}
          />
          {errors.name && <FieldError msg={errors.name} />}
        </div>

        {/* Date of birth */}
        <div style={{ marginBottom: 16 }}>
          <FieldLabel>Date of birth</FieldLabel>
          <input
            type="date"
            value={form.dob}
            onChange={e => update({ dob: e.target.value })}
            max={new Date().toISOString().split('T')[0]}
            style={{
              ...inputStyle(t, errors.dob),
              colorScheme: theme === 'dark' ? 'dark' : 'light',
            }}
          />
          {errors.dob && <FieldError msg={errors.dob} />}
        </div>

        {/* Sex — used to personalise the calorie calculation (Mifflin-St
            Jeor needs it; "Prefer not to say" falls back to a neutral
            average, see utils/calorieCalc.js) */}
        <div style={{ marginBottom: 16 }}>
          <FieldLabel>Sex</FieldLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['male', 'Male'], ['female', 'Female'], ['prefer_not_to_say', 'Prefer not to say']].map(([val, label]) => (
              <button key={val} onClick={() => update({ sex: val })} style={{
                flex: 1, padding: '10px 6px', borderRadius: 11,
                background: form.sex === val ? t.text : t.surface,
                color: form.sex === val ? '#fff' : t.text,
                border: `1.5px solid ${form.sex === val ? t.text : (errors.sex ? '#EF4444' : (t.border2 || t.border))}`,
                fontFamily: t.sans, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                transition: 'all .15s',
              }}>
                {label}
              </button>
            ))}
          </div>
          {errors.sex && <FieldError msg={errors.sex} />}
        </div>

        {/* Height */}
        <div style={{ marginBottom: 16 }}>
          <FieldLabel>Height</FieldLabel>
          {isImperial ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ position: 'relative' }}>
                  <input
                    value={form.heightFt}
                    onChange={e => update({ heightFt: e.target.value })}
                    placeholder="5"
                    type="number"
                    min="1" max="9"
                    style={inputStyle(t, errors.heightFt)}
                  />
                  <UnitBadge>ft</UnitBadge>
                </div>
                {errors.heightFt && <FieldError msg={errors.heightFt} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ position: 'relative' }}>
                  <input
                    value={form.heightIn}
                    onChange={e => update({ heightIn: e.target.value })}
                    placeholder="10"
                    type="number"
                    min="0" max="11"
                    style={inputStyle(t, errors.heightIn)}
                  />
                  <UnitBadge>in</UnitBadge>
                </div>
                {errors.heightIn && <FieldError msg={errors.heightIn} />}
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input
                value={form.heightCm}
                onChange={e => update({ heightCm: e.target.value })}
                placeholder="170"
                type="number"
                min="50" max="300"
                style={inputStyle(t, errors.heightCm)}
              />
              <UnitBadge>cm</UnitBadge>
              {errors.heightCm && <FieldError msg={errors.heightCm} />}
            </div>
          )}
        </div>

        {/* Weight */}
        <div style={{ marginBottom: 20 }}>
          <FieldLabel>Weight</FieldLabel>
          <div style={{ position: 'relative' }}>
            {isImperial ? (
              <input
                value={form.weightLbs}
                onChange={e => update({ weightLbs: e.target.value })}
                placeholder="154"
                type="number"
                min="44" max="1100"
                style={inputStyle(t, errors.weightLbs)}
              />
            ) : (
              <input
                value={form.weightKg}
                onChange={e => update({ weightKg: e.target.value })}
                placeholder="70"
                type="number"
                min="20" max="500"
                style={inputStyle(t, errors.weightKg)}
              />
            )}
            <UnitBadge>{isImperial ? 'lbs' : 'kg'}</UnitBadge>
          </div>
          {isImperial ? errors.weightLbs && <FieldError msg={errors.weightLbs} /> : errors.weightKg && <FieldError msg={errors.weightKg} />}
        </div>

        {globalError && (
          <div style={{
            padding: '11px 14px', borderRadius: 10, marginBottom: 14,
            background: '#EF444418', border: '1px solid #EF444438', color: '#DC2626',
            fontSize: 12.5, lineHeight: 1.4,
          }}>
            {globalError}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            width: '100%', padding: '15px', borderRadius: 14,
            background: submitting ? t.surface2 : accent,
            color: submitting ? t.text3 : t.accentText,
            border: 'none', fontFamily: t.sans, fontSize: 14, fontWeight: 700,
            cursor: submitting ? 'default' : 'pointer',
            letterSpacing: '0.01em',
            boxShadow: submitting ? 'none' : `0 6px 24px ${accent}30`,
            transition: 'all .15s',
          }}
        >
          {submitting ? 'Saving…' : 'Continue →'}
        </button>

        <div style={{ fontSize: 11, color: t.text3, textAlign: 'center', marginTop: 14, lineHeight: 1.5 }}>
          Your data is stored securely and never sold.
        </div>
      </div>
    </div>
  );
}

// ── Small UI helpers ───────────────────────────────────────────────────────────

function FieldLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase',
      color: '#A8A39C', fontWeight: 500, marginBottom: 7,
    }}>
      {children}
    </div>
  );
}

function FieldError({ msg }) {
  return (
    <div style={{ fontSize: 11.5, color: '#DC2626', marginTop: 5, lineHeight: 1.4 }}>
      {msg}
    </div>
  );
}

function UnitBadge({ children }) {
  return (
    <span style={{
      position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
      fontSize: 12, fontWeight: 600, color: '#A8A39C', pointerEvents: 'none',
    }}>
      {children}
    </span>
  );
}

function inputStyle(t, hasError) {
  return {
    width: '100%', padding: '12px 44px 12px 14px', borderRadius: 11,
    border: `1.5px solid ${hasError ? '#EF4444' : (t.border2 || t.border)}`,
    background: t.surface,
    fontFamily: t.sans, fontSize: 14, color: t.text, outline: 'none',
    boxSizing: 'border-box', transition: 'border-color .15s',
  };
}
